import { BaseDoccStrategy } from "./BaseDoccStrategy";

const APPLE_DOCS_HOST = "developer.apple.com";

/**
 * Scraper strategy for **developer.apple.com** — Apple's official framework
 * reference (SwiftUI, UIKit, Foundation, …).
 *
 * The human page (`/documentation/<framework>/<symbol>`) is a `swift-docc-render`
 * Vue SPA with no content in its HTML, but the underlying DocC render JSON is
 * directly fetchable at `/tutorials/data/<same-path>.json`. The shared
 * {@link BaseDoccStrategy} fetches that JSON twin, extracts Markdown via
 * `DoccJsonPipeline`, and crawls from the `references` map — no headless browser.
 * This class only supplies the Apple-specific URL rewriting.
 */
export class AppleDeveloperDocsStrategy extends BaseDoccStrategy {
  canHandle(url: string): boolean {
    try {
      return new URL(url).hostname === APPLE_DOCS_HOST;
    } catch {
      return false;
    }
  }

  protected renderJsonUrlFor(pageUrl: string): string {
    return toRenderJsonUrl(pageUrl);
  }

  protected displayUrlFor(pageUrl: string): string {
    return toDisplayUrl(pageUrl);
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
