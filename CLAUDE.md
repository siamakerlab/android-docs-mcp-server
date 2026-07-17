# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

`AGENTS.md` (imported above) is the source of truth for commands, git/commit rules, code style, and the E2E test inventory — don't duplicate it here. This file adds only the big-picture architecture that spans multiple files. For the full deep dive, read `ARCHITECTURE.md`.

## Architecture at a glance

The server indexes documentation (web, local files, npm/PyPI) into a SQLite vector store and exposes semantic search over three interfaces: MCP, a CLI, and a web UI.

**Interfaces are thin adapters over a shared tools layer.** The CLI (`src/cli/`), MCP server (`src/mcp/`), and web UI (`src/web/`) all delegate to the same business logic in `src/tools/` — `ScrapeTool`, `SearchTool`, `FetchUrlTool`, `FindVersionTool`, `ListLibrariesTool`, plus the job-control tools. Never put business logic in an interface; add or extend a tool so every interface inherits it.

**Content flow (indexing):** `src/scraper/` acquires content (source-specific *strategies* → *fetchers* → content-type *pipelines* → *middleware*), `src/splitter/` chunks it in two phases (structure-aware semantic split, then `GreedySplitter` size optimization), embeddings are generated via LangChain providers, and `src/store/` persists chunks + vectors to SQLite (`sqlite-vec`). Search is hybrid: vector similarity + full-text search fused with Reciprocal Rank Fusion.

**Async job processing:** scrape/refresh run as background jobs in `src/pipeline/`, and `PipelineFactory` picks the implementation:
- `PipelineManager` — in-process worker (unified mode; `recoverJobs` toggles DB job recovery on startup).
- `PipelineClient` — RPC to an out-of-process worker over tRPC (distributed mode).

Job state is write-through to the `versions` table (`QUEUED → RUNNING → COMPLETED/FAILED/CANCELLED`) and progress is broadcast through the `EventBus`, so CLI/Web/MCP receive real-time updates identically in both modes.

**Entry & protocol:** `src/index.ts` is the entry point. Transport auto-detects by TTY — stdio for AI tools (no TTY), HTTP + SSE for interactive terminals — and is overridable with `--protocol stdio|http`.

**Configuration:** resolved once per process by `loadConfig` in `src/utils/config.ts`, validated by the Zod `AppConfigSchema`, merging four layers in precedence order: defaults < `config.yaml` < env vars < CLI args.

## Non-obvious constraints

- **Node 22 only.** `better-sqlite3` ships a Node-ABI-pinned native binary; don't raise the engine floor. Run `npm rebuild` after switching Node versions.
- **Tests are co-located** (`src/foo.ts` ↔ `src/foo.test.ts`); system-wide E2E lives under `test/`. `npm test` excludes the Docker suite — run `npm run test:docker` and `npm run test:live` separately. See the full test inventory in `AGENTS.md`.
- **Playwright browsers are not auto-installed** (`postinstall` skips them); scraping paths that need a real browser require a manual Playwright install.
