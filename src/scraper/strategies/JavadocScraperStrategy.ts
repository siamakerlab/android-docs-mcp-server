import type { ProgressCallback } from "../../types";
import type { AppConfig } from "../../utils/config";
import type { ScraperOptions, ScraperProgressEvent, ScraperStrategy } from "../types";
import { WebScraperStrategy } from "./WebScraperStrategy";

/**
 * Scraper strategy for javadoc.io, which hosts generated API documentation
 * (Javadoc and Dokka/KDoc) for artifacts published to Maven Central — the standard
 * documentation entry point for the JVM / Android / Kotlin ecosystem.
 *
 * Like the npm and PyPI strategies, this is a thin, registry-tuned profile over
 * {@link WebScraperStrategy}. javadoc.io serves versioned artifact docs at paths
 * like `/doc/{group}/{artifact}/{version}/`; query strings carry no content and
 * hash fragments are in-page anchors, so both are normalized away to avoid
 * indexing the same page multiple times.
 */
export class JavadocScraperStrategy implements ScraperStrategy {
  private defaultStrategy: WebScraperStrategy;

  canHandle(url: string): boolean {
    const { hostname } = new URL(url);
    return ["javadoc.io", "www.javadoc.io"].includes(hostname);
  }

  constructor(config: AppConfig) {
    this.defaultStrategy = new WebScraperStrategy(config, {
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // javadoc.io pages don't need query params
      },
    });
  }

  async scrape(
    options: ScraperOptions,
    progressCallback: ProgressCallback<ScraperProgressEvent>,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.defaultStrategy.scrape(options, progressCallback, signal);
  }

  /**
   * Cleanup resources used by this strategy.
   */
  async cleanup(): Promise<void> {
    await this.defaultStrategy.cleanup();
  }
}
