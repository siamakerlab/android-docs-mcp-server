import { BaseDoccStrategy } from "./BaseDoccStrategy";
import { dataSegmentDisplayUrl, dataSegmentRenderJsonUrl } from "./doccUrl";

const SWIFT_ORG_DOCS_HOST = "docs.swift.org";

/**
 * Scraper strategy for **docs.swift.org** — the official Swift.org documentation
 * host, including *The Swift Programming Language* book and the standard library
 * reference, all published with DocC.
 *
 * Docs live at `/{book}/documentation/{path}` (e.g.
 * `/swift-book/documentation/the-swift-programming-language`), rendered by
 * `swift-docc-render`; the render JSON twin is `/{book}/data/documentation/{path}.json`.
 * The shared {@link BaseDoccStrategy} handles fetch/pipeline/crawl.
 */
export class SwiftOrgDocsStrategy extends BaseDoccStrategy {
  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname === SWIFT_ORG_DOCS_HOST;
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
