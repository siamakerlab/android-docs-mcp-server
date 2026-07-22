import type { AppConfig } from "../../utils/config";
import { AutoDetectFetcher } from "../fetcher/AutoDetectFetcher";
import { FetchStatus } from "../fetcher/types";
import { DoccJsonPipeline } from "../pipelines/DoccJsonPipeline";
import type { QueueItem, ScraperOptions } from "../types";
import { BaseScraperStrategy, type ProcessItemResult } from "./BaseScraperStrategy";

const APPLE_DOCS_HOST = "developer.apple.com";

/**
 * Scraper strategy for **developer.apple.com** — Apple's official framework
 * reference (SwiftUI, UIKit, Foundation, …).
 *
 * The human page (`/documentation/<framework>/<symbol>`) is a `swift-docc-render`
 * Vue SPA with no content in its HTML, but the underlying **DocC render JSON** is
 * directly fetchable at `/tutorials/data/<same-path>.json`. This strategy fetches
 * that JSON twin instead of rendering the SPA, hands it to {@link DoccJsonPipeline}
 * for Markdown extraction, and uses the JSON's `references` map as the crawl
 * frontier — so no headless browser is needed.
 *
 * Unlike the thin host-profile strategies (which delegate to `WebScraperStrategy`),
 * this extends {@link BaseScraperStrategy} directly because it must (a) fetch a
 * different URL than the queued one and (b) drive link discovery from JSON rather
 * than HTML — the same reasons `GitHubScraperStrategy` owns its `processItem`.
 */
export class AppleDeveloperDocsStrategy extends BaseScraperStrategy {
  private readonly fetcher: AutoDetectFetcher;
  private readonly pipeline: DoccJsonPipeline;

  constructor(config: AppConfig) {
    super(config);
    this.fetcher = new AutoDetectFetcher(config.scraper);
    this.pipeline = new DoccJsonPipeline(config);
  }

  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname === APPLE_DOCS_HOST;
    } catch {
      return false;
    }
  }

  protected async processItem(
    item: QueueItem,
    options: ScraperOptions,
    signal?: AbortSignal,
  ): Promise<ProcessItemResult> {
    // Store/report the human documentation URL; fetch the render-JSON twin.
    const displayUrl = toDisplayUrl(item.url);
    const jsonUrl = toRenderJsonUrl(item.url);

    const raw = await this.fetcher.fetch(jsonUrl, {
      signal,
      // Opt out of the markdown-preferred default Accept; we want the JSON.
      headers: { Accept: "application/json" },
      etag: item.etag,
    });

    if (raw.status === FetchStatus.NOT_FOUND) {
      return { url: displayUrl, status: FetchStatus.NOT_FOUND };
    }
    if (raw.status === FetchStatus.NOT_MODIFIED) {
      return {
        url: displayUrl,
        status: FetchStatus.NOT_MODIFIED,
        etag: raw.etag,
        lastModified: raw.lastModified,
      };
    }

    // Source the pipeline with the human URL so any relative resolution and the
    // stored document URL reflect the page a user would visit.
    const processed = await this.pipeline.process(
      { ...raw, source: displayUrl },
      options,
      this.fetcher,
    );

    return {
      url: displayUrl,
      title: processed.title,
      sourceContentType: "application/json",
      contentType: "text/markdown",
      etag: raw.etag,
      lastModified: raw.lastModified,
      content: processed,
      // References are `/documentation/...` paths; BaseScraperStrategy resolves
      // them against displayUrl and applies scope/dedup before enqueuing.
      links: processed.links,
      status: FetchStatus.SUCCESS,
    };
  }

  async cleanup(): Promise<void> {
    await this.pipeline.close();
    await this.fetcher.close();
  }
}

/**
 * Rewrite a developer.apple.com documentation URL to its render-JSON twin:
 * `/documentation/swiftui/view` → `/tutorials/data/documentation/swiftui/view.json`.
 * A URL that is already a render-JSON URL is returned unchanged (minus query/hash).
 */
export function toRenderJsonUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  u.search = "";
  u.hash = "";
  if (u.pathname.startsWith("/tutorials/data/") && u.pathname.endsWith(".json")) {
    return u.href;
  }
  const path = u.pathname.replace(/\/+$/, "");
  u.pathname = `/tutorials/data${path}.json`;
  return u.href;
}

/**
 * Inverse of {@link toRenderJsonUrl}: map a render-JSON URL back to the human page
 * URL. A URL that is already a human URL is returned unchanged (minus query/hash).
 */
export function toDisplayUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  u.search = "";
  u.hash = "";
  if (u.pathname.startsWith("/tutorials/data/") && u.pathname.endsWith(".json")) {
    u.pathname = u.pathname.replace(/^\/tutorials\/data/, "").replace(/\.json$/, "");
  }
  return u.href;
}
