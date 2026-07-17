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
- Parsers: Gradle Version Catalog (`libs.versions.toml`), `build.gradle(.kts)` +
  `settings.gradle(.kts)` (best-effort), Flutter `pubspec.yaml` and `pubspec.lock`
  (lock takes precedence for exact versions) → normalized `coordinate → version` tagged
  by ecosystem (`maven` / `gradle-plugin` / `pub`).
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

This fork versions **independently on a 0.x line** (pre-1.0, active development),
starting at `0.1.1`, decoupled from upstream's version numbers. Bump 0.x normally
(`0.1.x` for patches, `0.2.0` for features) and reserve `1.0.0` for the first stable
release. Record the upstream base commit in `CHANGELOG.md` on each sync.

## Distribution

Published to npm as **`@siamakerlab/android-docs-mcp-server`** (renamed off upstream's
`@arabold/docs-mcp-server`; `bin` kept as `docs-mcp-server`). Install with
`npx @siamakerlab/android-docs-mcp-server` or `npm install -g`. Versioned on the
independent 0.x line (starting `0.1.1`). Attribution to the original authors stays in
`README.md` / `LICENSE`.

**Node 22 only** — `better-sqlite3` and the tree-sitter grammars ship Node-ABI-pinned
binaries. The current dev environment runs Node 24; grammar/DB loading was validated
there (N-API), but re-confirm on Node 22 and in the Docker image before release.
