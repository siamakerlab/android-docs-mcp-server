/**
 * URL rewriting for DocC hosts that expose render JSON by inserting a `/data/`
 * segment before `documentation/`:
 * - Swift Package Index: `/{owner}/{repo}/{ref}/documentation/{target}`
 *   → `/{owner}/{repo}/{ref}/data/documentation/{target}.json`
 * - docs.swift.org: `/{book}/documentation/{path}`
 *   → `/{book}/data/documentation/{path}.json`
 *
 * developer.apple.com uses a different scheme (a `/tutorials/data/` prefix) handled
 * directly in {@link AppleDeveloperDocsStrategy}.
 */

/** Human documentation URL → its render-JSON twin (data-segment hosts). */
export function dataSegmentRenderJsonUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  u.search = "";
  u.hash = "";
  if (u.pathname.includes("/data/documentation/") && u.pathname.endsWith(".json")) {
    return u.href;
  }
  const path = u.pathname.replace(/\/+$/, "");
  u.pathname = `${path.replace("/documentation/", "/data/documentation/")}.json`;
  return u.href;
}

/** Render-JSON URL → the human page URL (data-segment hosts). */
export function dataSegmentDisplayUrl(pageUrl: string): string {
  const u = new URL(pageUrl);
  u.search = "";
  u.hash = "";
  if (u.pathname.includes("/data/documentation/") && u.pathname.endsWith(".json")) {
    u.pathname = u.pathname
      .replace("/data/documentation/", "/documentation/")
      .replace(/\.json$/, "");
  }
  return u.href;
}
