# ROADMAP — Android-First Grounded Docs

This roadmap tracks the work required to evolve this fork of
[`arabold/docs-mcp-server`](https://github.com/arabold/docs-mcp-server) into a
documentation-grounding MCP server **specialized for Android and mobile app
development**, with first-class focus on the **Kotlin, Java, Flutter/Dart, and
Gradle** ecosystems.

It is a living document. Milestones are ordered by dependency, not by calendar
date. Status markers: `⬜ planned` · `🟡 in progress` · `✅ done` · `❄️ deferred`.

---

## 1. Vision & Identity

Upstream is an excellent **general-purpose** documentation indexer. This fork
keeps that powerful indexing + hybrid semantic-search core intact and re-points
its ingestion, parsing, version resolution, and defaults at the sources an
Android/mobile engineer touches every day:

- **Kotlin** — language reference, coroutines, Jetpack/AndroidX, Kotlin Multiplatform.
- **Java** — JDK APIs and Android's Java interop surface.
- **Flutter / Dart** — framework docs and pub.dev package references.
- **Gradle** — the build system, Android Gradle Plugin (AGP), and plugin DSL.

**Success, stated plainly:** an AI coding assistant connected to this server can
answer "how do I do X in Kotlin/AGP/Flutter, on the exact versions my project
declares" with grounded, version-correct citations — without the operator hand-picking URLs.

---

## 2. Design Principles (constraints every milestone honors)

1. **Stay mergeable with upstream.** Prefer *additive* extension points
   (new strategy, new parser, new pipeline, new tool) over edits to shared core
   files. Where a core edit is unavoidable, keep it small, behind a flag, and
   documented in the PR so upstream rebases stay cheap. See `ARCHITECTURE.md`
   → *Extension Points*.
2. **Business logic lives in `src/tools/`.** Every new capability is exposed
   through a tool so CLI, MCP, and Web inherit it for free. Never add
   Android-specific logic directly in an interface layer.
3. **Node 22 + native ABI discipline.** `better-sqlite3` and every `tree-sitter`
   grammar ship Node-ABI-pinned native binaries. New grammar deps must build on
   Node 22 and survive `npm rebuild`; verify in the Docker image, not just locally.
4. **Behavior-driven tests, co-located.** `src/foo.ts` ↔ `src/foo.test.ts`;
   system-wide flows under `test/*-e2e.test.ts`. New parsers/strategies ship with
   fixtures under `test/fixtures/`.
5. **Version-awareness is the whole point.** Any feature that ignores the
   library version the user actually depends on is out of scope.

---

## 3. Milestone Overview

| Phase | Theme | Primary code surface | Status |
|------|-------|----------------------|--------|
| 0 | Fork foundations & sync hygiene | repo meta, CI, benchmark baseline | ⬜ |
| 1 | Source-code intelligence (Kotlin/Java/Dart) | `src/splitter/treesitter/` | ✅ java + kotlin (dart: line-based, AST follow-up) |
| 2 | Ecosystem package registries | `src/scraper/strategies/` | 🟡 pub.dev + javadoc.io + gradle-plugins done |
| 3 | API-doc pipelines (Javadoc/KDoc/Dartdoc) | `src/scraper/middleware/`, `pipelines/` | ⬜ |
| 4 | Project-aware version resolution | `src/manifest/`, `src/tools/` | 🟡 parsers + resolve/scrape-project + search wiring |
| 5 | Search quality tuning for Android | `tests/search-eval/`, retriever | ⬜ |
| 6 | Agent Skills & developer experience | `skills/`, docs, CLI ergonomics | ⬜ |
| 7 | Distribution & pre-seeded indexes | Docker, release pipeline | ⬜ |

The **critical path** is Phase 1 → Phase 4: without Kotlin/Java/Dart chunking
(1) and manifest-driven version detection (4), the Android value proposition is
incomplete. Phases 2, 3, 5, 6, 7 can proceed in parallel once 1 lands.

---

## 4. Phase 0 — Fork Foundations & Sync Hygiene

**Goal:** make the fork identifiable, safe to diverge, and cheap to keep in sync.

**Tasks**
- ⬜ Establish an **upstream sync policy**: track `arabold/docs-mcp-server` as the
  `upstream` remote; adopt a cadence (e.g. monthly) to merge/rebase; document the
  conflict-prone files (core `src/index.ts`, `src/utils/config.ts`,
  `ScraperRegistry.ts`, `LanguageParserRegistry.ts`).
- ⬜ Decide **fork versioning**. Upstream is at `2.4.x`. Options: (a) continue
  SemVer with a pre-release suffix that encodes the fork lineage
  (`2.4.2-android.1`), or (b) hard-fork the version line at `3.0.0` and record the
  upstream base commit in `CHANGELOG.md`. Recommendation: **(a)** until the fork's
  public API diverges, then **(b)**.
- ⬜ Rename the distributable identity where it must not collide with upstream's
  npm package (`@arabold/docs-mcp-server`) — new scope or `bin` name for any
  published artifact; leave attribution intact.
- ⬜ Seed a **benchmark baseline for Android corpora** (`tests/search-eval/`) so
  every later phase can prove it improves retrieval instead of regressing it.
- ⬜ Add an `ANDROID.md` (or a section in `ARCHITECTURE.md`) describing the
  Android-specific subsystems as they land.

**Done when:** upstream can be pulled with a documented, low-conflict process and
a reproducible Android retrieval baseline number exists.

---

## 5. Phase 1 — Source-Code Intelligence: Kotlin / Java / Dart

**Goal:** structure-aware (AST) chunking of Kotlin, Java, and Dart source so
indexed code splits on real boundaries (classes, functions, KDoc/Javadoc/Dartdoc
comments) instead of arbitrary line windows.

**Why this is the keystone:** today `src/splitter/treesitter/LanguageParserRegistry.ts`
registers only the unified TypeScript/JS parser and Python. Android's primary
languages fall back to line-based `TextDocumentSplitter`, which fragments
signatures and doc comments — exactly the content an assistant needs intact.

**Code surface & extension pattern**
- `src/splitter/treesitter/parsers/` — implement `LanguageParser`
  (see `TypeScriptParser.ts`, `PythonParser.ts` as templates: node-type sets,
  boundary classification, name extraction, doc-comment extraction).
- `src/splitter/treesitter/LanguageParserRegistry.ts` — register each new parser
  with its file extensions and MIME types.
- `src/scraper/strategies/LocalFileStrategy.ts` / `SourceCodePipeline.ts` — ensure
  `.kt`, `.kts`, `.java`, `.dart` route to the source-code pipeline.

> **Grammar spike complete (2026-07-17)** — see
> [`docs/spikes/phase1-treesitter-grammars.md`](docs/spikes/phase1-treesitter-grammars.md).
> Java and Kotlin have grammars compatible with our `tree-sitter ^0.21` core and load
> cleanly via N-API prebuilds; Dart has no viable npm grammar today and is deferred to
> a line-based fallback. Decisions below reflect that.

**Tasks**
- ✅ **JavaParser** — `tree-sitter-java@0.23.5` (official, peer `tree-sitter ^0.21.1`).
  Implemented in `src/splitter/treesitter/parsers/JavaParser.ts`, registered, and
  unit + end-to-end tested. Handles classes, interfaces, enums, records, annotation
  types, methods, constructors, Javadoc, and package/import. Also fixed `.java` MIME
  routing in `mimeTypeUtils.ts` (`text/x-java`) so it reaches the SourceCodePipeline.
- ✅ **KotlinParser** — `tree-sitter-kotlin@0.3.8` (fwcd, peer `tree-sitter ^0.21.0`)
  on the current core. Implemented in `src/splitter/treesitter/parsers/KotlinParser.ts`,
  registered, and unit + end-to-end tested. Handles `.kt`/`.kts`, KDoc, top-level +
  extension functions, `object`/`companion object`, `data class`, `enum class`, and
  interfaces (told apart via `enum_class_body` / declaration-header keyword).
  Did **not** adopt `@tree-sitter-grammars/tree-sitter-kotlin@1.1.0` (needs core
  `^0.22.4`) — that stays gated behind a scheduled core upgrade + TS/Python re-validation.
- ❄️ **DartParser** — deferred (no usable npm grammar: NAN-based `tree-sitter-dart@1.0.0`
  fails to load, `Invalid language object`). Interim **shipped**: `.dart` routes through
  the line-based fallback in `TreesitterSourceCodeSplitter` — proven content-preserving,
  logged at `logger.debug`, and regression-tested. A dedicated grammar (vendored or
  self-built) is a follow-up, not a Phase 1 blocker.
- ⬜ Extend `languageTypes.ts` / extension + MIME maps; add each language to
  `docs/concepts/supported-formats.md`.
- ⬜ Fixtures + `*.test.ts` per parser (real Kotlin/Java snippets), plus a
  `vector-search-e2e` case that indexes a small Kotlin file and retrieves a symbol.

**Risks**
- **Node runtime drift.** Grammars were validated on Node 24 (current shell) but the
  project pins **Node 22**. N-API binding makes this low-risk; still, re-confirm on
  Node 22 and in the Phase 7 Docker image before declaring done.
- **Kotlin grammar maintenance.** `fwcd/tree-sitter-kotlin@0.3.8` (last publish
  2024-08, ~24 MB unpacked) trails the newer grammars-org build. Acceptable now;
  migrate if/when the core is upgraded.
- **Dart gap.** Flutter/Dart source stays coarsely indexed until a grammar lands.
  Mitigation: fallback + warning keeps it usable; don't block Phase 1 on it.
- Native module count grows install/build time. Keep grammars as direct deps and
  document the `npm rebuild` requirement.

**Done when:** indexing a Kotlin/Java/Dart file produces symbol- and doc-aligned
chunks, verified by tests, with a measurable retrieval improvement over the
line-based baseline.

**Status (2026-07-17) — Phase 1 core complete.** Java and Kotlin ship AST-aware
chunking (parsers + registry + unit + end-to-end tests, all green on Node 24). Java
also required a `.java` MIME fix so it reaches the SourceCodePipeline. Dart is indexed
today via the line-based fallback (content-preserving, debug-logged, regression-tested);
a dedicated Dart grammar and the Node 22 re-validation remain tracked follow-ups. See
[`docs/spikes/phase1-treesitter-grammars.md`](docs/spikes/phase1-treesitter-grammars.md).

---

## 6. Phase 2 — Ecosystem Package Registries

**Goal:** index version-specific docs for the dependency coordinates Android
projects actually declare, the way upstream already does for npm and PyPI.

**Code surface & pattern:** model new strategies on
`src/scraper/strategies/NpmScraperStrategy.ts` and `PyPiScraperStrategy.ts`;
register them in `src/scraper/ScraperRegistry.ts` behind new URL schemes/handlers.

**Tasks**
- ✅ **javadoc.io strategy** — `JavadocScraperStrategy` recognizes `javadoc.io`, the
  standard host for generated Javadoc/Dokka-KDoc of Maven Central artifacts.
  Registry-tuned profile over `WebScraperStrategy`, registered and tested. Note: the
  bare `/doc/…` page is a Vue SPA wrapper that loads the real docs in an iframe, so
  `documentationUrl` targets the scrapeable `/static/{g}/{a}/{v}/index.html` entry point
  for pinned versions — see
  [`docs/spikes/javadoc-io-scraping.md`](docs/spikes/javadoc-io-scraping.md).
- ✅ **pub.dev strategy** — `PubDevScraperStrategy` recognizes `pub.dev` package pages
  (Dart/Flutter). Registered and tested. Especially valuable since Dart source has no
  AST parser yet (Phase 1).
- ⬜ **Google Maven strategy** — `dl.google.com/.../maven2` (AndroidX/AGP). Deferred:
  these artifacts have no canonical hosted doc page, so coordinate→docs URL mapping is
  an open design question (see below). AndroidX docs largely live on developer.android.com.
- ✅ **Gradle Plugin Portal strategy** — `GradlePluginScraperStrategy` recognizes
  `plugins.gradle.org` (plugin pages keyed by id, e.g. `/plugin/com.android.application`).
  Registered and tested.
- ⬜ Introduce a coordinate-parsing utility so `ScrapeTool`/`FindVersionTool`
  accept ecosystem-native identifiers (`androidx.compose.ui:ui:1.x`,
  `dart:pubspec` names, `com.android.application` plugin ids). Ties into Phase 4.

**Risks:** each registry has bespoke metadata/redirect behavior; Google Maven has
no human doc index per artifact — may need to map coordinates → docs site.
**Mitigation:** ship registries incrementally, Maven Central first.

**Done when:** `scrape` accepts an Android dependency coordinate and indexes the
correct versioned documentation.

---

## 7. Phase 3 — API-Doc Pipelines: Javadoc / KDoc / Dartdoc

**Goal:** extract clean, high-signal content from generated API-doc HTML, which
is dense with navigation chrome, frames, and boilerplate.

**Code surface:** the HTML middleware chain in `src/scraper/middleware/`
(`HtmlDefuddleMiddleware`, `HtmlToMarkdownMiddleware`, sanitizer, normalization)
and `HtmlPipeline.ts`. Prefer new/tuned middleware over rewriting the chain.

**Tasks**
- ⬜ Recognizers for **Javadoc**, **Dokka/KDoc**, and **Dartdoc** HTML layouts;
  strip nav/frames, keep signature blocks, parameter tables, and descriptions.
- ⬜ Special handling for **`developer.android.com`** (reference + guides) and
  **`kotlinlang.org`** structures.
- ⬜ Preserve fully-qualified names and method signatures through
  HTML→Markdown conversion so search can match `Class.method(...)`.
- ⬜ Live-site coverage in `test/html-pipeline-live-e2e.test.ts` (kept out of
  default `npm test`; run via `npm run test:live`).

**Done when:** an indexed Javadoc/KDoc/Dartdoc page yields Markdown chunks whose
signatures and descriptions survive intact, verified against fixtures.

**Status (2026-07-17) — prerequisite resolved, cleanup deferred.** A spike found that
javadoc.io serves a Vue wrapper at `/doc/…` and the real docs at `/static/…`, so
`documentationUrl` now targets the scrapeable `/static/` entry point (Phase 2). The
HTML-cleanup recognizers below should be tuned against **real `/static/` Javadoc/KDoc
and Dartdoc HTML** — deferred until static pages are indexed and their actual chrome vs.
content class structure can be sampled, to avoid guessing selectors. See
[`docs/spikes/javadoc-io-scraping.md`](docs/spikes/javadoc-io-scraping.md).

---

## 8. Phase 4 — Project-Aware Version Resolution

**Goal:** let the server (and thus the assistant) automatically target the exact
versions a project declares, instead of asking the user to specify them.

**Code surface:** new manifest parsers feeding `src/tools/FindVersionTool.ts`;
expose a new tool in `src/tools/` (inherited by CLI/MCP/Web).

**Tasks**
- ✅ Manifest parsers (`src/manifest/`) — Gradle Version Catalog
  (`gradle/libs.versions.toml`, via `smol-toml`), **`build.gradle(.kts)`** (best-effort
  regex for inline `group:artifact:version` coordinates and `id(...) version` plugins),
  and Flutter `pubspec.yaml` (`yaml`), all pure and unit-tested, normalizing to a flat
  coordinate→version list tagged by ecosystem (`maven` / `gradle-plugin` / `pub`) and
  discovered recursively by `resolveProjectManifests`.
  **Follow-up:** `settings.gradle(.kts)` and `pubspec.lock` (the latter needs
  lock-over-yaml precedence when both exist in a module).
- ✅ Tool `resolve-project-deps` — `ResolveProjectDepsTool` + `resolveProjectManifests`
  walk a project root, parse every recognized manifest, and emit the de-duplicated
  coordinate→version set. Store-free (filesystem only) so every interface reuses it.
  Exposed over **CLI** (`docs-mcp-server resolve-project-deps [path] --output json`) and
  **MCP** (`resolve_project_deps`, read-only; registration verified in `mcp-stdio-e2e`).
  Each resolved dependency also carries a `docUrl` (via `documentationUrl`) pointing at
  the Phase 2 registry page — javadoc.io / pub.dev / plugins.gradle.org, versioned when
  the declared version is a concrete pin — so results feed straight into `scrape`, or
  use the one-shot project scrape below.
- ✅ Wire resolved versions into `SearchTool` — it accepts an optional `projectPath`;
  when set and no explicit version is given, searches default to the concrete version
  the project declares for the library (`projectVersionForLibrary`, matching by exact
  coordinate or Maven artifact name; pinned versions only). Exposed as
  `search --project <path>` (CLI) and the `projectPath` param on `search_docs` (MCP).
- ✅ One-shot project scrape — `ScrapeProjectTool` resolves the project, maps each
  coordinate to its doc URL, and enqueues a scrape job per dependency (pinned version
  or unversioned; unmappable coordinates reported as `skipped`). Exposed as
  `scrape-project [path]` (CLI — waits for all jobs) and `scrape_project` (MCP —
  enqueues and returns jobs; monitor via `list_jobs`).

**Risks:** Gradle's dynamic versions (`+`, `latest.release`), catalog aliases, and
Kotlin-DSL expressions resist static parsing. **Mitigation:** parse the common
declarative forms; clearly report unresolved/dynamic entries rather than guessing.

**Done when:** pointing the tool at a real Android/Flutter project yields a correct
version map and version-scoped search results.

---

## 9. Phase 5 — Search Quality Tuning for Android

**Goal:** prove and improve retrieval quality on Android corpora, not just
general docs.

**Code surface:** `tests/search-eval/` (qrel dataset, IR metrics: MRR, Recall@k,
nDCG@k, Hit@k, plus LLM-judged scores) and `DocumentRetrieverService.ts` (hybrid
RRF weights, FTS query generation, overfetch factor).

**Tasks**
- ⬜ Build an **Android qrel dataset** (labelled queries over Kotlin/AGP/Flutter
  docs) and set it as the gated baseline.
- ⬜ Tune RRF weights / FTS generation for symbol-heavy queries
  (`Modifier.padding`, `viewModelScope`, `implementation(libs...)`).
- ⬜ Evaluate embedding-provider behavior on code-ish text; document recommended
  provider/model defaults for Android use in `docs/guides/embedding-models.md`.

**Done when:** `npm run evaluate:search` shows Android-corpus metrics at or above
the Phase 0 baseline, with regressions gating.

---

## 10. Phase 6 — Agent Skills & Developer Experience

**Goal:** make the Android workflow turnkey for AI assistants and humans.

**Tasks**
- ⬜ Add Android-focused **Agent Skills** under `skills/` (index an AGP/Compose
  dependency, resolve project versions, search Kotlin APIs).
- ⬜ Provide ready-made **scrape recipes** for the canonical sources
  (developer.android.com, kotlinlang.org, api.flutter.dev, docs.gradle.org).
- ⬜ Document MCP client setup examples aimed at Android tooling (Android Studio +
  MCP-capable assistants, Gemini CLI, Claude).
- ⬜ CLI ergonomics: coordinate-aware `scrape`/`search` examples in `README.md`.

**Done when:** a new user can go from "connect server" to "search my project's
exact Compose version" by following documented skills/recipes.

---

## 11. Phase 7 — Distribution & Pre-Seeded Indexes

**Goal:** ship the fork so Android teams can adopt it in minutes.

**Tasks**
- ⬜ Docker image that **builds all native grammars** (Phase 1) and Playwright deps
  cleanly on Node 22; extend `test/docker-e2e.test.ts` to assert Kotlin/Java/Dart
  parsing inside the image.
- ⬜ Optional **pre-seeded index** artifacts for stable core docs
  (Android SDK, Kotlin stdlib) so first-run search is useful without a long scrape.
- ⬜ Release automation aligned with the Phase 0 versioning decision; changelog
  records the upstream base and the fork's Android deltas.

**Done when:** `docker run …` yields a working Android-focused server with grammars
and (optionally) seeded docs, validated by the Docker E2E suite.

---

## 12. Cross-Cutting Concerns

- **Testing:** every parser/strategy/pipeline ships unit + fixture tests; add
  Android cases to the E2E suites listed in `AGENTS.md`. Keep unit tests <100ms.
- **Docs:** update `README.md` (user-facing), `ARCHITECTURE.md` (design), and
  `docs/concepts/supported-formats.md` as each language/registry lands.
- **Telemetry & privacy:** no Android-specific telemetry beyond upstream's opt-out
  model; keep `DOCS_MCP_TELEMETRY` semantics unchanged.
- **CI:** native-grammar build must be green on Node 22 in CI and Docker before a
  parser is considered done.

---

## 13. Explicit Non-Goals

- Not building an Android IDE plugin, build tool, or linter — this indexes and
  searches **documentation**.
- Not generating code or performing RAG answer-synthesis (retrieval only, matching
  upstream scope).
- Not dropping upstream's general-purpose sources — Android focus is *additive*.
- Not supporting iOS/Swift as a first-class target in this roadmap (possible later).

---

## 14. Open Questions

- Fork versioning: pre-release suffix vs. hard `3.0.0` line (Phase 0).
- ~~Which Kotlin/Dart grammar has reliable prebuilds?~~ **Resolved (2026-07-17):**
  Java `tree-sitter-java@0.23.5` + Kotlin `tree-sitter-kotlin@0.3.8` on core `^0.21`;
  Dart deferred. See the [spike](docs/spikes/phase1-treesitter-grammars.md).
- Dart grammar: vendor & self-build from source, or wait for a `tree-sitter-grammars`
  release? (Phase 1 follow-up.)
- Google Maven artifacts often lack a canonical hosted doc page — how to map
  coordinate → docs URL? (Phase 2 design.)
- Distribution: is a published npm package needed, or is Docker-only sufficient?

---

*Attribution: this fork builds on the design and implementation of*
*[`arabold/docs-mcp-server`](https://github.com/arabold/docs-mcp-server). All*
*credit for the original foundation belongs to its authors.*
