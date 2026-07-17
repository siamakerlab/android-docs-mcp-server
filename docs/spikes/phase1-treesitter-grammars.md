# Spike — Phase 1 tree-sitter grammars (Kotlin / Java / Dart)

- **Date:** 2026-07-17
- **Phase:** [ROADMAP](../../ROADMAP.md) Phase 1 — Source-Code Intelligence
- **Status:** ✅ complete — Java & Kotlin cleared for implementation; Dart deferred
- **Question:** Which npm `tree-sitter-*` grammars for Kotlin, Java, and Dart are
  compatible with this project's tree-sitter core (`^0.21.1`) and build/load on a
  modern Node runtime without a fragile native compile?

## Why it matters

`src/splitter/treesitter/LanguageParserRegistry.ts` registers only the unified
TypeScript/JS parser and Python today. Android's primary languages currently fall
back to line-based `TextDocumentSplitter`, which fragments signatures and doc
comments. Phase 1 adds `LanguageParser` implementations, but each depends on a
usable grammar binding. A grammar that needs the tree-sitter **core** bumped from
`0.21` to `0.22+` would risk regressing the existing TS/Python parsers, so core
compatibility is a hard gate.

## Method

- Isolated npm project in the session scratchpad (project `package-lock.json`
  untouched — no dependency added to the repo yet).
- Installed `tree-sitter@^0.21.1` (matching this repo) plus each candidate grammar,
  then loaded it via `new Parser().setLanguage(grammar)` and parsed a minimal snippet.
- Registry metadata (`npm view`) captured for version, provenance, peer dep, and
  native-binding style.

> **Runtime caveat:** the current shell's Node is **v24.11.1**, while the project
> pins **Node 22** (`better-sqlite3` ABI). The load tests therefore ran on v24. Java
> and Kotlin bind through **N-API** (`node-addon-api` + `node-gyp-build` prebuilds),
> which is ABI-stable across Node 22/24, so success on v24 strongly predicts success
> on 22 — but this must be **re-confirmed on Node 22** (and inside the Phase 7 Docker
> image) before the grammars are declared production-ready.

## Results

| Grammar | Version | Provenance | peer `tree-sitter` | Binding | Install | Load + parse (Node 24) |
|---|---|---|---|---|---|---|
| `tree-sitter-java` | 0.23.5 | official `tree-sitter/tree-sitter-java` | `^0.21.1` ✅ | N-API prebuild | 5s, no compile | ✅ `root=program`, no error |
| `tree-sitter-kotlin` | 0.3.8 | `fwcd/tree-sitter-kotlin` | `^0.21.0` ✅ | N-API prebuild | included above | ✅ `root=source_file`, no error |
| `@tree-sitter-grammars/tree-sitter-kotlin` | 1.1.0 | tree-sitter-grammars org (maintained 2025-10) | `^0.22.4` ❌ | N-API | not tested | requires core bump to 0.22 |
| `tree-sitter-dart` | 1.0.0 | community (last publish 2023-02) | none declared | **NAN** (legacy) | 3s | ❌ `Invalid language object` (ABI mismatch) |
| `@tree-sitter-grammars/tree-sitter-dart` | — | — | — | — | — | ❌ does not exist (404) |
| `@fwcd/tree-sitter-kotlin` | — | — | — | — | — | ❌ does not exist (404) |

## Analysis & decisions

- **Java → ADOPT `tree-sitter-java@0.23.5`.** Official grammar, exact core match,
  N-API prebuild, clean parse. Lowest-risk parser; implement first.
- **Kotlin → ADOPT `tree-sitter-kotlin@0.3.8` (fwcd)** on the current `0.21` core.
  Compatible peer dep, N-API prebuild, clean parse. Note it is less actively
  maintained (last publish 2024-08) and the tarball is large (~24 MB unpacked). The
  newer `@tree-sitter-grammars/tree-sitter-kotlin@1.1.0` is better maintained but
  demands `tree-sitter ^0.22.4`; **do not** adopt it until a deliberate core upgrade
  is scheduled and the TS/Python parsers are re-validated against it.
- **Dart → DEFER.** No viable npm grammar today: the only published package is
  NAN-based, unmaintained since 2023, and fails to load against the current core
  (`Invalid language object`). There is no `@tree-sitter-grammars/tree-sitter-dart`.

## Dart follow-up options (pick during Phase 1 detailed design)

1. **Build from source** — vendor a maintained Dart grammar (e.g. the
   `UserNobody14/tree-sitter-dart` GitHub source) and generate the parser with the
   `tree-sitter` CLI against our core version; publish/prebuild it ourselves.
2. **Track upstream grammar orgs** — watch for a Dart grammar under the
   `tree-sitter-grammars` org with N-API prebuilds; adopt when available.
3. **Line-based fallback (interim)** — let `.dart` continue through
   `TextDocumentSplitter` and log that AST chunking is unavailable, so Flutter/Dart
   is still indexed (just less precisely) while options 1–2 mature.

Recommendation: ship **Java + Kotlin AST chunking in Phase 1**, keep **Dart on the
line-based fallback (option 3)** with a warning, and treat a proper Dart grammar as
a follow-up sub-task rather than a Phase 1 blocker.

## Next actions

- [x] Implement `JavaParser` (`src/splitter/treesitter/parsers/JavaParser.ts`) —
      done: registered in `LanguageParserRegistry.ts`, unit-tested in
      `JavaParser.test.ts`, and proven end-to-end (a `.java` file splits into
      package/import/class/constructor/method boundaries via `SourceCodePipeline`).
- [x] Fix `.java` MIME routing — `mimeTypeUtils.ts` now maps `.java` → `text/x-java`
      (and normalizes mime-db's `text/x-java-source`), so it reaches the
      SourceCodePipeline instead of the plain-text fallback. Without this the parser
      never runs. (Regression covered in `mimeTypeUtils.test.ts`.)
- [x] Implement `KotlinParser` (`tree-sitter-kotlin@0.3.8`) — done: registered in
      `LanguageParserRegistry.ts`, unit-tested in `KotlinParser.test.ts`, and proven
      end-to-end (a `.kt` file splits into package/import/class/method/companion/
      companion-fn/data-class boundaries). `.kt`/`.kts` already routed to
      `text/x-kotlin`, so no MIME fix was needed (unlike Java).
- [ ] Re-run the grammar load test on **Node 22** and record the result here
      (validated on Node 24 so far; N-API makes this low-risk).
- [ ] Decide Dart path (options above); wire `.dart` fallback + warning meanwhile.
- [ ] Add the chosen grammars to the Phase 7 Docker build check.
