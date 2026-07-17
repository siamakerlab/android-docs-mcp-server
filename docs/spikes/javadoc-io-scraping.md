# Spike — javadoc.io is a Vue wrapper; scrape `/static/`, not `/doc/`

- **Date:** 2026-07-17
- **Phase:** [ROADMAP](../../ROADMAP.md) Phase 2 (registry strategies) / Phase 3 (API-doc pipelines)
- **Status:** ✅ resolved for URL mapping; Phase 3 HTML cleanup still open
- **Question:** Does the javadoc.io URL we generate actually yield scrapeable Javadoc/KDoc?

## Finding

`https://javadoc.io/doc/{group}/{artifact}[/{version}]` is **not** the documentation —
it is a **Vue single-page-app wrapper**. The page ships a Bootstrap navbar/modal shell
and loads the real docs in an iframe:

```html
<iframe class="content" src="/static/{group}/{artifact}/{version}/index.html" ...>
```

So a plain fetch of `/doc/...` returns the wrapper chrome (navbar, modal, gtag), not the
API docs. The real, static Javadoc/KDoc lives under `/static/`:

| URL | Result |
|---|---|
| `/doc/{g}/{a}/{v}` | 200 — Vue wrapper (navbar/modal), real docs only via iframe/JS |
| `/static/{g}/{a}/{v}/index.html` | real Javadoc entry point (intermittent Cloudflare 522 on cold artifacts) |
| `/static/{g}/{a}/{v}/{module}/{pkg}/Class.html` | 200, ~119 KB — **real Javadoc HTML** |
| `/static/{g}/{a}/latest/index.html` | 404 — `/static/` has **no `latest`**, a concrete version is required |

## Decision

`documentationUrl` now maps a **pinned** Maven coordinate to the static entry point
`/static/{group}/{artifact}/{version}/index.html` (the real docs, scrapeable and
crawlable), and only falls back to the `/doc/` wrapper when the version is **not
pinned** (since `/static/` cannot resolve `latest`). `JavadocScraperStrategy` matches on
the `javadoc.io` hostname, so it covers both paths unchanged.

## Remaining risks / follow-ups

- **Intermittent 522** on `/static/.../index.html` for cold/rarely-viewed artifacts is a
  javadoc.io (Cloudflare origin) issue; the scraper's `axios-retry` mitigates transient
  failures. Not something we can fix here.
- **Module-path depth** — modern (JPMS) artifacts nest class pages under a module
  segment (`…/{module}/{pkg}/Class.html`). The `index.html` entry point handles this via
  crawling; we don't construct class URLs directly.
- **Unpinned Maven deps** still map to the `/doc/` wrapper (no static `latest`). Rare for
  Gradle catalogs, which pin versions.
- **Phase 3 (Javadoc/KDoc/Dartdoc HTML cleanup)** should be tuned against **real
  `/static/` HTML**, not the wrapper. Deferred until we index static pages and can sample
  their actual chrome/content class structure (`.header`, `.top-nav`, `.summary`,
  `.member-signature`, Dokka `.navigation`/`.filter-section`, Dartdoc `.self-crumbs`).
