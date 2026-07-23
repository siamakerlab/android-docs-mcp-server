# ROADMAP — Mobile-First Grounded Docs (Android + iOS)

This roadmap tracks the work required to evolve this fork of
[`arabold/docs-mcp-server`](https://github.com/arabold/docs-mcp-server) into a
documentation-grounding MCP server **specialized for mobile app development**,
across two first-class, additive tracks:

- **Part I — Android** (Phases 0–7): the **Kotlin, Java, Flutter/Dart, and Gradle**
  ecosystems. Largely landed.
- **Part II — iOS / Apple** (Phases i1–i7): the **Swift, Objective-C, DocC, and Swift
  Package Manager** ecosystems. Planned; applies the same extension pattern a second time.

Both tracks share one indexing + hybrid-search core and one set of interface-agnostic
tools, so every capability reaches CLI, MCP, and Web identically.

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

### iOS / Apple ecosystem (Part II — additive)

The same core, re-pointed a second time at the Apple stack. Nothing here removes the
Android or general-purpose sources; it adds a parallel track:

- **Swift / Objective-C** — language and framework source (SwiftUI, UIKit, Foundation),
  AST-chunked like Kotlin/Java.
- **DocC** — Apple's documentation format. Crucially, `developer.apple.com`,
  `docs.swift.org`, and Swift Package Index all serve it as a **directly fetchable
  render-JSON API** (no headless browser, no HTML chrome to strip) — a structural
  advantage over Android's Javadoc HTML.
- **Swift Package Manager / CocoaPods / Carthage** — dependency coordinates and, via
  their lock files, exact-version resolution.

**Success, Apple flavor:** answer "how do I do X in Swift/SwiftUI/SPM, on the exact
versions my `Package.resolved`/`Podfile.lock` pins" with grounded citations — the same
promise as Android, a different ecosystem.

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
| 0 | Fork foundations & sync hygiene | repo meta, `ANDROID.md` | ✅ (benchmark → Phase 5) |
| 1 | Source-code intelligence (Kotlin/Java/Dart) | `src/splitter/treesitter/` | ✅ java + kotlin (dart: line-based, AST follow-up) |
| 2 | Ecosystem package registries | `src/scraper/strategies/` | ✅ 5 host strategies + docUrl mapping |
| 3 | API-doc pipelines (Javadoc/KDoc/Dartdoc) | `src/scraper/middleware/` | 🟡 chrome removal (real-HTML verified) |
| 4 | Project-aware version resolution | `src/manifest/`, `src/tools/` | ✅ parsers + resolve/scrape-project + search wiring |
| 5 | Search quality tuning for Android | `tests/search-eval/` | 🟡 android qrel dataset (draft) |
| 6 | Agent Skills & developer experience | `skills/`, docs | 🟡 android-project-docs skill + recipes |
| 7 | Distribution & pre-seeded indexes | Docker, release pipeline | 🟡 docker grammar verification |

The **critical path** is Phase 1 → Phase 4: without Kotlin/Java/Dart chunking
(1) and manifest-driven version detection (4), the Android value proposition is
incomplete. Phases 2, 3, 5, 6, 7 can proceed in parallel once 1 lands.

**iOS / Apple track (Part II).** A parallel, additive set of milestones (Phases i1–i7)
applies the exact same extension pattern — new parser / new strategy / new manifest /
new tool, never core edits — to Swift, Objective-C, DocC, and SPM. Its full table and
critical path live in **§12**. Unlike Android, the iOS critical path is led by the
**DocC render-JSON pipeline (i3)**: because Apple's docs expose clean JSON, that single
strategy unlocks `developer.apple.com`, `docs.swift.org`, and Swift Package Index at
once, and can land before Swift source chunking (i1).

---

## 4. Phase 0 — Fork Foundations & Sync Hygiene

**Goal:** make the fork identifiable, safe to diverge, and cheap to keep in sync.

**Tasks**
- ✅ **Upstream sync policy** — `upstream` remote tracks `arabold/docs-mcp-server`;
  policy + conflict-prone file list documented in `ANDROID.md` ("Upstream sync policy").
- ✅ **Fork versioning decided** — SemVer with a fork-lineage pre-release suffix
  (`<upstream-base>-android.<n>`, e.g. `2.4.2-android.1`) while the API tracks upstream;
  switch to an independent line (`3.0.0`) once it diverges. Documented in `ANDROID.md`.
- ✅ **Distributable identity** — published to npm as the unscoped **`mobile-docs-mcp`**
  (independent 0.x line, `latest`), renamed off upstream's `@arabold/docs-mcp-server`
  and off this fork's earlier `@siamakerlab/android-docs-mcp-server` name; GitHub repo
  `siamakerlab/mobile-docs-mcp-server`; `bin` kept as `docs-mcp-server`.
- ✅ **`ANDROID.md`** describing the Android-specific subsystems, sync, and versioning.
- ➡️ Android retrieval **benchmark baseline** — moved to Phase 5 (`tests/search-eval/`),
  where the search-quality work lives.

**Done when:** upstream can be pulled with a documented, low-conflict process, the
fork's identity/versioning conventions are written down, and the Android subsystems are
documented. ✅ (retrieval baseline tracked under Phase 5.)

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
- ✅ **Android official docs strategies** — Google Maven artifacts (AndroidX/AGP) have
  no per-artifact hosted doc page, so instead of mapping coordinates to a binary repo,
  this fork recognizes the official documentation hosts:
  `AndroidDevDocsScraperStrategy` (`developer.android.com` — Android SDK + AndroidX
  reference/guides) and `KotlinLangScraperStrategy` (`kotlinlang.org`). Registered and
  tested. General Maven coordinates still map to javadoc.io via `documentationUrl`.
- ✅ **Gradle Plugin Portal strategy** — `GradlePluginScraperStrategy` recognizes
  `plugins.gradle.org` (plugin pages keyed by id, e.g. `/plugin/com.android.application`).
  Registered and tested.
- ✅ Coordinate handling — covered by Phase 4: `documentationUrl` maps ecosystem-native
  coordinates to registry URLs, and `resolve-project-deps` / `scrape-project` consume
  them end-to-end (`androidx.compose.ui:ui`, pub package names, plugin ids).

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
- ✅ Strip API-doc generator chrome — `apiDocChrome.ts` adds generator-specific
  nav/sub-nav/breadcrumb/skip-link selectors (Javadoc new + old style, Dartdoc, Dokka)
  to `HtmlSanitizerMiddleware`. Verified against **real `/static/` Javadoc and Dartdoc
  HTML** so signatures, descriptions, and summary tables survive; broad classes
  (`.header`/`.nav`/`.sidebar`/layout containers) are deliberately excluded to avoid
  false positives on ordinary sites.
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
  `settings.gradle(.kts)` is parsed with the same best-effort regex; `pubspec.lock`
  provides exact resolved versions and takes precedence over `pubspec.yaml` in the same
  module.
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
- 🟡 **Android qrel dataset** — `tests/search-eval/dataset.android.yaml`: 10 labelled
  queries across Kotlin, Jetpack Compose, OkHttp, Flutter/Dart, and Gradle over all four
  intents (api-lookup / conceptual / comparison / troubleshooting), same schema as the
  upstream dataset. **Draft** — best-effort canonical URLs (javadoc.io uses the
  scrapeable `/static/` path); needs a human pass and a real scrape of the corpora
  before it can gate regressions.
- ⬜ Tune RRF weights / FTS generation for symbol-heavy queries
  (`Modifier.padding`, `viewModelScope`, `implementation(libs...)`). Blocked on the
  Android corpora being indexed and the qrel dataset finalized.
- ⬜ Evaluate embedding-provider behavior on code-ish text; document recommended
  provider/model defaults for Android use in `docs/guides/embedding-models.md`.

**Done when:** `npm run evaluate:search` shows Android-corpus metrics at or above
the Phase 0 baseline, with regressions gating.

---

## 10. Phase 6 — Agent Skills & Developer Experience

**Goal:** make the Android workflow turnkey for AI assistants and humans.

**Tasks**
- ✅ Android-focused **Agent Skill** — `skills/android-project-docs/SKILL.md` teaches
  the resolve → scrape-project → search-with-`--project` flow plus Kotlin/Java source
  indexing, in the same SKILL.md format as the upstream skills.
- ✅ Ready-made **scrape recipes** for the canonical sources (developer.android.com,
  kotlinlang.org, api.flutter.dev, docs.gradle.org, javadoc.io `/static/`) — included in
  the skill.
- ✅ CLI ergonomics — the README "Android workflow" section and the skill document the
  resolve/scrape-project/search commands end-to-end.
- ⬜ MCP client setup examples aimed specifically at Android tooling (Android Studio +
  MCP-capable assistants, Gemini CLI) — general client setup already lives in
  `docs/guides/mcp-clients.md`.

**Done when:** a new user can go from "connect server" to "search my project's
exact Compose version" by following documented skills/recipes.

---

## 11. Phase 7 — Distribution & Pre-Seeded Indexes

**Goal:** ship the fork so Android teams can adopt it in minutes.

**Tasks**
- ✅ Docker image builds the native grammars + Playwright deps on Node 22
  (`node:22-trixie-slim`); `docker-e2e` asserts Kotlin + Java grammars load and parse
  inside the production image ("ships working Kotlin and Java tree-sitter grammars").
  Dart has no grammar (line-based fallback). This also serves as the **Node 22
  re-validation** deferred from Phase 1.
- ⬜ Optional **pre-seeded index** artifacts for stable core docs
  (Android SDK, Kotlin stdlib) so first-run search is useful without a long scrape.
- ⬜ Release automation aligned with the Phase 0 versioning decision; changelog
  records the upstream base and the fork's Android deltas.

**Done when:** `docker run …` yields a working Android-focused server with grammars
and (optionally) seeded docs, validated by the Docker E2E suite.

---

## 12. iOS / Apple Track — Overview

Part II re-applies the Android track's proven extension pattern to the Apple ecosystem:
**Swift, Objective-C, SwiftUI/UIKit, Swift Package Manager, and DocC**. Every milestone
honors the same Design Principles (§2) — additive extension points, business logic in
`src/tools/`, Node 22 + native-ABI discipline, behavior-driven co-located tests,
version-awareness.

**iOS milestone overview**

| Phase | Theme | Primary code surface | Status |
|------|-------|----------------------|--------|
| i1 | Source-code intelligence (Swift / Obj-C) | `src/splitter/treesitter/parsers/` | 🟡 line-based (AST deferred: grammar build) |
| i2 | Apple ecosystem registries | `src/scraper/strategies/` | 🟡 apple + SPI + swift.org landed |
| i3 | DocC render-JSON pipeline | `src/scraper/` (new JSON-native pipeline) | 🟡 pipeline + renderer landed |
| i4 | iOS project-aware version resolution | `src/manifest/`, `src/tools/` | 🟡 lock-file resolution landed |
| i5 | Search quality tuning for iOS | `tests/search-eval/` | 🟡 qrel dataset (draft) |
| i6 | iOS agent skills & DX | `skills/`, docs | 🟡 skill + README (Xcode setup pending) |
| i7 | Distribution (Swift grammar in Docker) | Docker, release pipeline | ⬜ planned |

**Critical path — different from Android.** Apple's docs (and every DocC-based site)
expose a clean, unauthenticated **render-JSON API**, so the highest-leverage move is the
**DocC pipeline (i3)**, not source chunking. i3 → i4 is the spine: JSON extraction plus
manifest-driven version resolution delivers most of the iOS value. i1 (Swift AST
chunking) raises quality for indexed *source*, and i2 recognizes the hosts, but a useful
iOS server exists as soon as i3 + i4 land. i5/i6/i7 parallelize after i3.

**What carries over for free.** The tools layer is already interface-agnostic and
ecosystem-tagged, so `resolve-project-deps`, `scrape-project`, and `search --project`
extend to SPM/CocoaPods by adding parsers + `documentationUrl` mappings — no new tool
surface, no interface edits. Likewise `ScraperRegistry` and `LanguageParserRegistry`
take new entries additively.

---

## 13. Phase i1 — Source-Code Intelligence: Swift / Objective-C

**Goal:** AST-aware, symbol-aligned chunking of `.swift` (and, if adopted, `.h`/`.m`/`.mm`)
source, so indexed Apple code splits on real boundaries — types, functions, doc comments,
`// MARK:` — instead of line windows. Direct analogue of Android Phase 1.

**Code surface & pattern:** identical to Android — implement `LanguageParser`
(templates: `KotlinParser.ts`, `JavaParser.ts`) under
`src/splitter/treesitter/parsers/`, register in `LanguageParserRegistry.ts`, and route
extensions/MIME in `src/utils/mimeTypeUtils.ts` + `SourceCodePipeline`.

**Grammar decision (2026-07 research — re-confirm on Node 22 before adopting).** The core
is pinned at `tree-sitter ^0.21.1` and cannot cheaply move (`better-sqlite3` + existing
grammars are Node-ABI-pinned). This forces the same "pin an older grammar release" tactic
Android used for Kotlin:
- **Swift** — `tree-sitter-swift` (alex-pinkus). Latest `0.7.x` requires core `^0.22.1`
  — **incompatible**. **Pin `tree-sitter-swift@0.6.0`**, which declares peer
  `tree-sitter ^0.21.1` and ships N-API prebuilds (loads without compiling). Trade-off:
  `0.6.0` lags the newest Swift 6 macro syntax; revisit on a scheduled core `^0.22`
  upgrade (shared gate with the Kotlin grammars-org migration noted in Phase 1).
- **Objective-C** — `tree-sitter-objc` (tree-sitter-grammars). `3.0.1+` needs core
  `^0.22.1`; **`3.0.0` declares no tree-sitter peer** — the candidate for core 0.21,
  subject to runtime ABI validation. It pulls in a **second** native grammar
  (`tree-sitter-c ^0.23.4`); both must build on Node 22 and survive `npm rebuild`.

**Tasks**
- ✅ **Swift line-based indexing** — `.swift` already maps to `text/x-swift` → `swift` in
  `mimeTypeUtils.ts`, so it routes to the `SourceCodePipeline` and, with no AST grammar
  registered, indexes via `TreesitterSourceCodeSplitter`'s line-based fallback
  (content-preserving) exactly like Dart. Regression-tested in
  `TreesitterSourceCodeSplitter.test.ts`.
- ❄️ **SwiftParser (AST)** — **deferred: grammar won't build.** `tree-sitter-swift@0.6.0`
  (the only release peered at core `^0.21`) ships **no N-API prebuild**, so it compiles from
  source and its `binding.gyp` fails at the `wait_for_tree_sitter` / `tree-sitter-cli`
  generation step on Node 22. `0.7.x` has prebuilds but needs core `^0.22.1` (incompatible
  with our pin). So Swift stays on the line-based fallback — same posture as Dart — until
  either a `^0.21`-compatible prebuilt Swift grammar lands or the core is upgraded to `^0.22`
  (shared gate with the Kotlin grammars-org migration).
- ❄️ **ObjCParser** — deferred with Swift. `tree-sitter-objc@3.0.0` (+ transitive
  `tree-sitter-c`) has the same source-build risk; `.m` also collides with MATLAB on
  extension. Obj-C indexes via the generic source/line-based path when a MIME is assigned;
  a dedicated parser waits on the same core upgrade. Lower priority than Swift.
- ✅ Extension + MIME maps — `.swift` → `text/x-swift` and `docs/concepts/supported-formats.md`
  already list Swift (upstream's 90+ language coverage). `.h`/`.m`/`.mm` Obj-C-specific MIME
  routing deferred with ObjCParser.
- ⬜ Spike doc `docs/spikes/ios-treesitter-grammars.md` recording the Node 22 build failure
  (optional; the failure + decision are captured here).

**Risks:** the same core-version conflict that shaped Android Phase 1; ambiguous `.h`
headers (C / C++ / Obj-C); Obj-C's transitive `tree-sitter-c` grammar; grammar staleness
vs. newest Swift syntax.

**Done when:** indexing a Swift file yields symbol- and doc-aligned chunks. **Interim (met):**
Swift files index via the line-based fallback (verified by tests); AST-aware boundaries are
deferred to a compatible/prebuilt Swift grammar or a core `^0.22` upgrade.

**Status (2026-07-23).** Swift source is indexable today (line-based, like Dart). The AST
parser is blocked by grammar tooling, not by this codebase: `tree-sitter-swift@0.6.0` fails
to build from source on Node 22 and the prebuilt `0.7.x` needs a newer core. Tracked as a
deferred follow-up, not a Phase i1 blocker.

---

## 14. Phase i2 — Apple Ecosystem Registries

**Goal:** recognize the Apple/Swift documentation hosts so `scrape` accepts an Apple docs
URL or a Swift package coordinate. Model on `AndroidDevDocsScraperStrategy`,
`JavadocScraperStrategy`, `PubDevScraperStrategy`; register in `ScraperRegistry.ts`.

**Tasks**
- ✅ **AppleDeveloperDocsStrategy** — `developer.apple.com/documentation/…`. Extends
  `BaseScraperStrategy` (like `GitHubScraperStrategy`), rewrites each page to its
  render-JSON twin (`/tutorials/data/…​.json`), fetches it with `Accept: application/json`,
  hands it to the i3 `DoccJsonPipeline`, and drives crawl from the JSON `references` map.
  Registered in `ScraperRegistry.ts`; unit-tested (URL rewrite + round-trip + registry
  dispatch).
- ✅ **SwiftPackageIndexStrategy** — `swiftpackageindex.com/{owner}/{repo}/{version}/documentation/{target}`.
  Swift's **javadoc.io / pub.dev equivalent** (auto-generated, auto-hosted, versioned DocC
  for SPM packages), so it anchors the package-coordinate → doc-URL mapping in i4. Extends
  the shared `BaseDoccStrategy`; render-JSON rewrite (`/documentation/…` →
  `/data/documentation/….json`) shared with docs.swift.org via `doccUrl.ts`; registered and
  unit-tested. **Runtime caveat (unchanged): Cloudflare-protected** (naive fetch → HTTP 403)
  even though the JSON is static — relies on `AutoDetectFetcher`'s browser fallback, which
  needs a working Playwright install. See §22 open question.
- ✅ **SwiftOrgDocsStrategy** — `docs.swift.org/swift-book/…` (The Swift Programming
  Language + stdlib, DocC). Same shared base + `doccUrl.ts` rewrite; registered and
  unit-tested. (`swift.org/documentation/` landing pages remain generic-web.)
- ⬜ **CocoaPods = metadata/version only.** CocoaDocs was sunset; `cocoapods.org` hosts no
  API-doc content. Map a pod coordinate → Swift Package Index or the podspec's
  `documentation_url`, never to a cocoapods.org doc page.

**Done when:** `scrape` accepts an Apple docs URL or a Swift package coordinate and
indexes the correct versioned documentation.

---

## 15. Phase i3 — DocC Render-JSON Pipeline (highest-leverage)

**Goal:** extract clean, high-signal content from **DocC render JSON** — the one format
that Apple's site, `docs.swift.org`, Swift Package Index, and every self-hosted
`.doccarchive` all serve. This is the iOS track's keystone.

**Why it leads the track.** `developer.apple.com` is a `swift-docc-render` Vue SPA with
no content in the HTML — but the render JSON is directly fetchable, unauthenticated, and
needs no browser:
- Apple: `https://developer.apple.com/tutorials/data/documentation/<framework>/<symbol>.json`
- Swift book: `https://docs.swift.org/swift-book/data/documentation/….json`
- SPI: `https://swiftpackageindex.com/{o}/{r}/{v}/data/documentation/{target}.json`

Map JSON URL → human URL by dropping the `/tutorials/data/` (or `/data/`) segment and the
`.json` suffix. The JSON's `references` map is the **crawl frontier** — the full symbol
link graph, enumerable without rendering a single page.

**Code surface:** a **new JSON-native pipeline** under `src/scraper/`, parallel to
`HtmlPipeline` — it consumes DocC JSON directly rather than HTML→Markdown. Prefer this over
any headless-browser path for Apple / docs.swift.org. (Unlike Android Phase 3, there is
**no generator chrome to strip** — the JSON is already structured.)

**Tasks**
- ✅ **DocC JSON fetcher + detection** — `DoccJsonPipeline.canProcess` sniffs the DocC
  discriminators (`schemaVersion` + `references` + a documentation section) so it claims
  DocC JSON without touching ordinary JSON; the fetch + `references`-as-frontier wiring
  lives in `AppleDeveloperDocsStrategy` (i2).
- ✅ **DocC JSON → Markdown renderer** — `DoccJsonPipeline` flattens `abstract`;
  `primaryContentSections` (`declarations` `tokens` → a `swift` code fence preserving the
  full signature verbatim; prose `content` with inline references/`codeVoice`/code
  listings); `topicSections`; `relationshipsSections`; `seeAlsoSections`. Chunks via the
  shared `SemanticMarkdownSplitter` + `GreedySplitter`. Unit-tested against a
  `test/fixtures/docc-render.json` fixture and smoke-verified on the real 139 KB SwiftUI
  `View` render JSON (197 links, 20 chunks, signature preserved).
- 🟡 `schemaVersion` variance is handled (the parser reads every field defensively/
  optionally, so minor schema drift doesn't break it). The **Swift / Objective-C `variants`**
  split: the pipeline indexes the **primary (Swift) render node** and ignores the `variants`
  array — the Obj-C variant is a separate render-JSON page — so the two languages aren't
  collapsed into noise. Verified with a `variants`-bearing fixture. Dedicated Obj-C variant
  indexing is deferred (low priority, gated on ObjC parsing overall).
- ⬜ Fixtures from **real render JSON** (a TSPL page, one SPI package) + live coverage as a
  sibling of `test/html-pipeline-live-e2e.test.ts`. (SwiftUI `View` fixture landed.)

**Done when:** an indexed DocC page yields Markdown whose signatures and descriptions
survive intact, verified against JSON fixtures, with **no** headless-browser dependency
for Apple / docs.swift.org.

**Status (2026-07-23) — i3 core landed.** `DoccJsonPipeline` + `AppleDeveloperDocsStrategy`
ship the render-JSON path end-to-end for `developer.apple.com` (no browser), unit-tested
and smoke-verified on real Apple docs. Remaining: `variants` (Swift/Obj-C) handling,
`schemaVersion` variance, live-site E2E, and the sibling DocC hosts (Swift Package Index,
docs.swift.org) which reuse the same pipeline with a different URL-rewrite step.

---

## 16. Phase i4 — iOS Project-Aware Version Resolution

**Goal:** target the exact versions an iOS project declares, mirroring Android's
manifest → `resolve-project-deps` / `scrape-project` / `search --project` chain. Reuses
`documentationUrl`, `ResolveProjectDepsTool`, `ScrapeProjectTool`, and `SearchTool`'s
`projectPath` — all already interface-agnostic. New manifest parsers in `src/manifest/`,
tagged with new ecosystems (`spm` / `cocoapods` / `carthage`).

**Principle: trust lock files, not DSL manifests.** `Package.swift` (Swift) and `Podfile`
(Ruby) are executable code carrying only loose ranges; exact pins live in the lock files.

**Tasks**
- ✅ **`Package.resolved` parser** (`packageResolved.ts`, JSON, exact versions) — handles all
  three schema versions: **v1** (`object.pins[]` with `package` / `repositoryURL` /
  `state.version`), **v2** (`pins[]` with `identity` / `location` / `state.version`), **v3**
  (v2 + `originHash`). Reduces git URLs to `owner/repo` (`gitCoordinate.ts`); branch/revision
  pins reported with a `null` version + note. The recursive walk also reaches the
  Xcode-embedded copy at `*.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`.
- ✅ **`Podfile.lock` parser** (`podfileLock.ts`, YAML, exact versions) — the `PODS:` section,
  parenthesized versions (`- Alamofire (5.9.1)`), subspecs collapsed to their top-level pod.
- ✅ **`Cartfile.resolved` parser** (`cartfileResolved.ts`) — line format
  `github "owner/repo" "5.9.1"` / `git "url" "5.9.1"`.
- 🟡 **Best-effort loose parsers** — `Package.swift` (`packageSwift.ts`), `Podfile`
  (`podfile.ts`), and `Cartfile` (`cartfile.ts`) ship: regex the common declaration forms,
  extract only exact pins (`exact:` / bare version), and **flag range/branch/operator forms
  as unresolved** — same policy as Gradle dynamic versions. `discovery.ts` prefers the lock
  file when present (`Package.resolved` / `Podfile.lock` / `Cartfile.resolved` shadow the
  loose manifest in the same directory). ⬜ `.pbxproj` `XCRemoteSwiftPackageReference`
  (old-style plist — needs `plutil` or a library) remains deferred.
- ✅ **`documentationUrl` mapping** — SPM/Carthage coordinate (`owner/repo`) → Swift Package
  Index `{owner}/{repo}[/{version}]/documentation`; CocoaPods → `null` (CocoaDocs sunset, no
  hosted docs). Target module isn't known from the lock file, so the default target is used
  (see §22 open question). `projectVersionForLibrary` also matches an SPM/Carthage repo name
  so `search --project` defaults iOS searches to the pinned version.
- ✅ **`discovery.ts`** registers `Package.resolved` / `Podfile.lock` / `Cartfile.resolved`;
  the existing recursive walk reaches `.xcodeproj`/`.xcworkspace` embedded copies without a
  special case. `ResolveProjectDepsTool` and `ScrapeProjectTool` inherit iOS support with no
  changes (they delegate to `resolveProjectManifests` + `documentationUrl`).

**Risks:** `Package.swift`/`Podfile` DSLs resist static parse (deferred to loose parsers);
`.pbxproj` is an old-style plist (convert via `plutil` or a library, never hand-parse); a
package may vend multiple DocC targets (which module to map? — §22).

**Done when:** pointing the tool at a real SPM/CocoaPods/Xcode project yields a correct
version map and version-scoped search results.

**Status (2026-07-23) — i4 lock-file resolution landed.** The three lock parsers +
`gitCoordinate` + SPI doc-URL mapping + `search --project` matching ship end-to-end; CLI/MCP
`resolve-project-deps` and `scrape-project` cover SPM/CocoaPods/Carthage (and Xcode-embedded
`Package.resolved`) with no tool-layer changes. Loose DSL-manifest fallbacks
(`Package.swift` / `Podfile` / `Cartfile`) also ship. Remaining: `.pbxproj` (old-style plist).

---

## 17. Phase i5 — Search Quality Tuning for iOS

**Goal:** prove and improve retrieval quality on Apple corpora, not just general docs.
Same surface as Android Phase 5 — `tests/search-eval/` and `DocumentRetrieverService.ts`.

**Tasks**
- 🟡 **iOS qrel dataset** `tests/search-eval/dataset.ios.yaml` — **draft** shipped: 12
  labelled queries across Swift, SwiftUI, UIKit, Foundation, and SPM over all four intents
  (api-lookup / conceptual / comparison / troubleshooting), same schema as the
  Android/upstream datasets. URLs are best-effort canonical Apple/Swift.org paths and need
  a human pass + a real scrape of the corpora before they can gate regressions.
- ⬜ Tune RRF weights / FTS generation for Swift symbol-heavy queries (`@State`,
  `some View`, `NavigationStack`, `URLSession.data(from:)`). Blocked on the Apple corpora
  being indexed and the qrel dataset finalized.
- ⬜ Confirm embedding-provider behavior on Swift/DocC text; fold recommendations into
  `docs/guides/embedding-models.md`.

**Done when:** `npm run evaluate:search` shows iOS-corpus metrics at or above a captured
baseline, with regressions gating.

---

## 18. Phase i6 — iOS Agent Skills & Developer Experience

**Goal:** make the iOS workflow turnkey, mirroring `skills/android-project-docs/`.

**Tasks**
- ✅ **`skills/ios-project-docs/SKILL.md`** — the resolve → scrape-project →
  search-with-`--project` flow plus Swift source indexing, in the SKILL.md format,
  mirroring `android-project-docs`.
- ✅ Ready-made **scrape recipes** for the canonical Apple sources
  (`developer.apple.com/documentation`, `docs.swift.org/swift-book`,
  `swiftpackageindex.com`) — included in the skill.
- ✅ README updated — the "Mobile project workflow" section covers iOS projects, the
  recognized-manifests list includes the iOS lock/loose files, and the "About This Fork"
  section reflects the landed iOS state; it links to the `ios-project-docs` skill.
- ⬜ MCP client setup examples aimed specifically at Xcode + MCP-capable assistants
  (general client setup already lives in `docs/guides/mcp-clients.md`).

**Done when:** a new user can go from "connect server" to "search my project's exact
SwiftUI/SPM version" by following documented skills/recipes. **Met** for the CLI/skill
flow; a dedicated Xcode client-setup example remains.

---

## 19. Phase i7 — Distribution: Swift Grammar in Docker

**Goal:** ship the iOS track so Apple teams can adopt it in minutes.

**Tasks**
- ⬜ Docker image builds the **Swift** (and, if adopted, Obj-C + C) tree-sitter grammars on
  Node 22 (`node:22-trixie-slim`); `docker-e2e` asserts the Swift grammar loads and parses
  inside the production image — this also serves as the **Node 22 re-validation** for the
  iOS grammars.
- ⬜ Optional **pre-seeded index** for stable Apple core docs (Swift stdlib, SwiftUI) so
  first-run search is useful without a long scrape.
- ⬜ Release automation + changelog records the iOS deltas alongside the Android ones.

**Done when:** `docker run …` yields a working server that parses Swift and scrapes DocC,
validated by the Docker E2E suite.

---

## 20. Cross-Cutting Concerns

- **Testing:** every parser/strategy/pipeline ships unit + fixture tests; add
  Android cases to the E2E suites listed in `AGENTS.md`. Keep unit tests <100ms.
- **Docs:** update `README.md` (user-facing), `ARCHITECTURE.md` (design), and
  `docs/concepts/supported-formats.md` as each language/registry lands.
- **Telemetry & privacy:** no Android-specific telemetry beyond upstream's opt-out
  model; keep `DOCS_MCP_TELEMETRY` semantics unchanged.
- **CI:** native-grammar build must be green on Node 22 in CI and Docker before a
  parser is considered done.

---

## 21. Explicit Non-Goals

- Not building an Android or Xcode/iOS IDE plugin, build tool, or linter — this indexes
  and searches **documentation**.
- Not generating code or performing RAG answer-synthesis (retrieval only, matching
  upstream scope).
- Not dropping upstream's general-purpose sources — the Android **and iOS** focus is
  *additive*.
- Not code-signing, provisioning, or driving `xcodebuild`/Gradle/`swift build` —
  dependency *versions* are read from manifests and lock files, never built or resolved
  by invoking the toolchain (the one allowed exception is optionally shelling out to
  `swift package dump-package` to read `Package.swift`, when a toolchain is present).

---

## 22. Open Questions

- Fork versioning: pre-release suffix vs. hard `3.0.0` line (Phase 0).
- ~~Which Kotlin/Dart grammar has reliable prebuilds?~~ **Resolved (2026-07-17):**
  Java `tree-sitter-java@0.23.5` + Kotlin `tree-sitter-kotlin@0.3.8` on core `^0.21`;
  Dart deferred. See the [spike](docs/spikes/phase1-treesitter-grammars.md).
- Dart grammar: vendor & self-build from source, or wait for a `tree-sitter-grammars`
  release? (Phase 1 follow-up.)
- Google Maven artifacts often lack a canonical hosted doc page — how to map
  coordinate → docs URL? (Phase 2 design.)
- Distribution: is a published npm package needed, or is Docker-only sufficient?
- **iOS — Swift grammar core version:** pin `tree-sitter-swift@0.6.0` on core `^0.21`
  (available now, lags newest Swift 6 syntax), or schedule a core `^0.22` upgrade that
  unlocks the latest Swift + Kotlin (grammars-org) grammars but ripples into the whole
  native ABI stack (`better-sqlite3`, existing grammars)? (Phase i1.)
- **iOS — Objective-C:** adopt `tree-sitter-objc@3.0.0` (+ transitive `tree-sitter-c`)
  on core 0.21, or defer to a line-based fallback like Dart until a core upgrade? (Phase i1.)
- **iOS — Swift Package Index Cloudflare:** the render JSON is static but the host returns
  403 to naive fetches — browser-grade headers, or route it through the Playwright path?
  (Phase i2.)
- **iOS — multi-target packages:** when an SPM package vends several DocC targets, which
  `{target}` does `documentationUrl` map a bare coordinate to? (Phase i4.)
- **Distribution identity:** ✅ **Decided** — renamed to the mobile-neutral, unscoped
  **`mobile-docs-mcp`** (npm), with GitHub repo `siamakerlab/mobile-docs-mcp-server`;
  `bin` stays `docs-mcp-server` for upstream compatibility. (Phase i6/i7.)

---

*Attribution: this fork builds on the design and implementation of*
*[`arabold/docs-mcp-server`](https://github.com/arabold/docs-mcp-server). All*
*credit for the original foundation belongs to its authors.*
