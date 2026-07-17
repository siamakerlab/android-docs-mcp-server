# Android-First Fork — Subsystems & Conventions

This document describes the Android-specific subsystems this fork adds on top of
[`arabold/docs-mcp-server`](https://github.com/arabold/docs-mcp-server), plus the
fork-hygiene conventions (upstream sync, versioning, distribution). For the overall
plan and status see [ROADMAP.md](ROADMAP.md); for the general architecture see
[ARCHITECTURE.md](ARCHITECTURE.md).

## Android subsystems

Everything here is additive — the general-purpose core is untouched.

### Source-code intelligence (`src/splitter/treesitter/`)
AST-aware, symbol-aligned chunking for the JVM languages via tree-sitter:
- **Kotlin** (`KotlinParser`, `tree-sitter-kotlin`) and **Java** (`JavaParser`,
  `tree-sitter-java`) on the project's `tree-sitter ^0.21` core.
- **Dart** has no viable npm grammar yet, so `.dart` falls back to line-based
  splitting (content-preserving, logged at `logger.debug`).
- Java also required a MIME fix (`.java` → `text/x-java`) so it reaches the
  SourceCodePipeline. See `docs/spikes/phase1-treesitter-grammars.md`.

### Ecosystem registry strategies (`src/scraper/strategies/`)
Thin, registry-tuned profiles over `WebScraperStrategy` recognizing the Android/JVM/
Flutter documentation hosts:
- `JavadocScraperStrategy` — `javadoc.io` (Javadoc/Dokka-KDoc for Maven artifacts).
- `PubDevScraperStrategy` — `pub.dev` (Dart/Flutter packages).
- `GradlePluginScraperStrategy` — `plugins.gradle.org`.

Note: javadoc.io's `/doc/…` page is a Vue wrapper; real docs live at `/static/…`. See
`docs/spikes/javadoc-io-scraping.md`.

### Project-aware version resolution (`src/manifest/`, `src/tools/`)
Parse a project's build manifests and drive version-correct docs:
- Parsers: Gradle Version Catalog (`libs.versions.toml`), `build.gradle(.kts)`
  (best-effort), Flutter `pubspec.yaml` → normalized `coordinate → version` tagged by
  ecosystem (`maven` / `gradle-plugin` / `pub`).
- `documentationUrl` maps each coordinate to its registry doc URL (javadoc.io /
  pub.dev / plugins.gradle.org), versioned for pinned versions.
- Tools (interface-agnostic, reused by CLI + MCP):
  - `resolve-project-deps` / `resolve_project_deps` — list a project's deps + doc URLs.
  - `scrape-project` / `scrape_project` — one-shot: scrape every dependency's docs.
  - `SearchTool` `projectPath` — default a search to the version the project declares.

## Upstream sync policy

- `upstream` remote points at `https://github.com/arabold/docs-mcp-server.git`;
  `origin` is the personal fork `siamakerlab/android-docs-mcp-server`.
- Merge upstream periodically. Conflict-prone files are the ones this fork edits in
  place rather than extends: `src/scraper/ScraperRegistry.ts`,
  `src/splitter/treesitter/LanguageParserRegistry.ts`, `src/utils/mimeTypeUtils.ts`,
  `src/mcp/tools.ts`, `src/mcp/mcpServer.ts`, `src/cli/index.ts`. Everything else is
  additive (new files), so most upstream changes merge cleanly.
- Prefer additive extension points over core edits when adding features.

## Versioning

Follow SemVer with a fork-lineage pre-release suffix while the public API tracks
upstream: `<upstream-base>-android.<n>` (e.g. `2.4.2-android.1`). Record the upstream
base commit in `CHANGELOG.md` on each sync. Switch to an independent line (e.g.
`3.0.0`) only once the fork's public API diverges from upstream.

## Distribution

Not published to npm yet. Before publishing, rename the distributable so it does not
collide with upstream's `@arabold/docs-mcp-server` (new scope and/or `bin` name) while
keeping attribution intact. Fork-specific commands (`resolve-project-deps`,
`scrape-project`, Kotlin/Java AST chunking) require a local build (`npm run build`) or
a global install of this fork.

**Node 22 only** — `better-sqlite3` and the tree-sitter grammars ship Node-ABI-pinned
binaries. The current dev environment runs Node 24; grammar/DB loading was validated
there (N-API), but re-confirm on Node 22 and in the Docker image before release.
