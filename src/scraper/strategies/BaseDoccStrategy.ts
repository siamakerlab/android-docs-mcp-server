import type { AppConfig } from "../../utils/config";
import { AutoDetectFetcher } from "../fetcher/AutoDetectFetcher";
import { FetchStatus } from "../fetcher/types";
import { DoccJsonPipeline } from "../pipelines/DoccJsonPipeline";
import type { QueueItem, ScraperOptions } from "../types";
import { BaseScraperStrategy, type ProcessItemResult } from "./BaseScraperStrategy";

/**
 * Shared base for DocC render-JSON scraper strategies (Apple, Swift Package Index,
 * docs.swift.org). Each fetches the render-JSON twin of a human documentation URL,
 * hands it to {@link DoccJsonPipeline}, and drives the crawl from the JSON
 * `references` map. Only the per-host URL rewriting (and optional extra request
 * headers) differ, so a subclass implements just {@link canHandle},
 * {@link renderJsonUrlFor}, {@link displayUrlFor}, and — if the host needs it —
 * {@link extraHeaders}.
 *
 * Extends {@link BaseScraperStrategy} directly (like `GitHubScraperStrategy`)
 * because it fetches a different URL than the queued one and discovers links from
 * JSON rather than HTML — which the thin `WebScraperStrategy` profiles cannot do.
 */
export abstract class BaseDoccStrategy extends BaseScraperStrategy {
  protected readonly fetcher: AutoDetectFetcher;
  protected readonly pipeline: DoccJsonPipeline;

  constructor(config: AppConfig) {
    super(config);
    this.fetcher = new AutoDetectFetcher(config.scraper);
    this.pipeline = new DoccJsonPipeline(config);
  }

  abstract canHandle(url: string): boolean;

  /** Rewrite a human documentation URL to its render-JSON twin. */
  protected abstract renderJsonUrlFor(pageUrl: string): string;

  /** Inverse of {@link renderJsonUrlFor}: the human page URL to store and report. */
  protected abstract displayUrlFor(pageUrl: string): string;

  /** Per-host extra request headers (e.g. for anti-bot layers). Empty by default. */
  protected extraHeaders(): Record<string, string> {
    return {};
  }

  protected async processItem(
    item: QueueItem,
    options: ScraperOptions,
    signal?: AbortSignal,
  ): Promise<ProcessItemResult> {
    // Store/report the human documentation URL; fetch the render-JSON twin.
    const displayUrl = this.displayUrlFor(item.url);
    const jsonUrl = this.renderJsonUrlFor(item.url);

    const raw = await this.fetcher.fetch(jsonUrl, {
      signal,
      // Opt out of the markdown-preferred default Accept; we want the JSON.
      headers: { Accept: "application/json", ...this.extraHeaders() },
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

    // Source the pipeline with the human URL so the stored document URL reflects
    // the page a user would visit.
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
      // References are documentation paths; BaseScraperStrategy resolves them
      // against displayUrl and applies scope/dedup before enqueuing.
      links: processed.links,
      status: FetchStatus.SUCCESS,
    };
  }

  async cleanup(): Promise<void> {
    await this.pipeline.close();
    await this.fetcher.close();
  }
}
