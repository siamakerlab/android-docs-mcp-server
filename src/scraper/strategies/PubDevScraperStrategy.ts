import type { ProgressCallback } from "../../types";
import type { AppConfig } from "../../utils/config";
import type { ScraperOptions, ScraperProgressEvent, ScraperStrategy } from "../types";
import { WebScraperStrategy } from "./WebScraperStrategy";

/**
 * Scraper strategy for pub.dev, the Dart/Flutter package registry.
 *
 * Like the npm and PyPI strategies, this is a thin, registry-tuned profile over
 * {@link WebScraperStrategy}: it recognizes pub.dev package pages and applies URL
 * normalization suited to the registry (dropping query strings and hash anchors so
 * the same package page is not indexed multiple times).
 */
export class PubDevScraperStrategy implements ScraperStrategy {
  private defaultStrategy: WebScraperStrategy;

  canHandle(url: string): boolean {
    const { hostname } = new URL(url);
    return ["pub.dev", "www.pub.dev"].includes(hostname);
  }

  constructor(config: AppConfig) {
    this.defaultStrategy = new WebScraperStrategy(config, {
      urlNormalizerOptions: {
        ignoreCase: true,
        removeHash: true,
        removeTrailingSlash: true,
        removeQuery: true, // pub.dev package pages don't need query params
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
