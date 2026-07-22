import { BaseDoccStrategy } from "./BaseDoccStrategy";
import { dataSegmentDisplayUrl, dataSegmentRenderJsonUrl } from "./doccUrl";

const SPI_HOST = "swiftpackageindex.com";

/**
 * Scraper strategy for **swiftpackageindex.com** — Swift's de-facto
 * "javadoc.io / pub.dev equivalent", which auto-generates, auto-hosts, and
 * versions DocC documentation for Swift Package Manager packages.
 *
 * Docs live at `/{owner}/{repo}/{ref}/documentation/{target}`, rendered by
 * `swift-docc-render`; the render JSON twin is `/{owner}/{repo}/{ref}/data/documentation/{target}.json`.
 * The shared {@link BaseDoccStrategy} handles fetch/pipeline/crawl.
 *
 * Note: Swift Package Index sits behind Cloudflare, so a naive HTTP fetch can be
 * challenged (HTTP 403). {@link AutoDetectFetcher} falls back to the browser fetcher
 * when a challenge is detected, which requires a working Playwright install.
 */
export class SwiftPackageIndexStrategy extends BaseDoccStrategy {
  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname === SPI_HOST;
    } catch {
      return false;
    }
  }

  protected renderJsonUrlFor(pageUrl: string): string {
    return dataSegmentRenderJsonUrl(pageUrl);
  }

  protected displayUrlFor(pageUrl: string): string {
    return dataSegmentDisplayUrl(pageUrl);
  }
}
