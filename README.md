# Grounded Docs: Your AI's Up-to-Date Documentation Expert

> **Note — This is a fork.** This repository is a fork of the excellent [`arabold/docs-mcp-server`](https://github.com/arabold/docs-mcp-server). Our sincere gratitude goes to [@arabold](https://github.com/arabold) and all the original contributors for taking on the hard problems and solving them so gracefully, then generously open-sourcing the result. This project builds gladly on the strong foundation they laid. All credit for the original design and implementation belongs to them.

**Docs MCP Server** solves the problem of AI hallucinations and outdated knowledge by providing a personal, always-current documentation index for your AI coding assistant. It fetches official docs from websites, GitHub, npm, PyPI, and local files, allowing your AI to query the exact version you are using.

![Docs MCP Server Web Interface](docs/docs-mcp-server.png)

## 🤖 About This Fork — Android-First

This fork adapts Grounded Docs into a documentation companion purpose-built for **Android and mobile app development**. Upstream is an outstanding general-purpose documentation indexer; our goal is to refine and extend it so it excels specifically at the sources, formats, and workflows an Android developer reaches for every day.

**Focus ecosystems:**

-   **Kotlin** — language reference, coroutines, Jetpack, Kotlin Multiplatform.
-   **Java** — JVM APIs and Android's Java interop surface.
-   **Flutter / Dart** — framework documentation and pub.dev package references.
-   **Gradle** — the build system, Android Gradle Plugin, and plugin DSL.

**Ultimate goal:** keep the powerful indexing and hybrid semantic-search core intact while tuning ingestion, formatting, and defaults toward the Android / JVM / Flutter documentation an AI coding assistant needs to stay accurate and version-aware. Everything here is a set of incremental modifications and improvements layered on top of upstream — full credit for the original design and implementation belongs to the [original authors](https://github.com/arabold/docs-mcp-server).

See the **[ROADMAP](ROADMAP.md)** for the detailed, phased plan to get there.

### Android workflow (fork-specific)

These commands use features this fork adds on top of upstream (the
`resolve-project-deps` / `scrape-project` commands and Kotlin/Java AST chunking).
It's published to npm (requires **Node.js 22+**):

```bash
# Run on demand with npx …
npx @siamakerlab/android-docs-mcp-server <command> [args]

# … or install globally to get the `docs-mcp-server` command used below.
npm install -g @siamakerlab/android-docs-mcp-server
```

Add it to an MCP client (Claude Desktop / Claude Code). Set `OPENAI_API_KEY` (or
another embedding provider) in `env` for semantic search:

```json
{
  "mcpServers": {
    "android-docs": {
      "command": "npx",
      "args": ["-y", "@siamakerlab/android-docs-mcp-server", "--protocol", "stdio"]
    }
  }
}
```

Then, from the CLI:

```bash
# 1. See exactly what your project depends on — each result carries a docUrl
#    (javadoc.io / pub.dev / plugins.gradle.org) at the declared version.
docs-mcp-server resolve-project-deps ./my-android-app --output json

# 2. Index a dependency's docs at that version (paste a docUrl from step 1).
docs-mcp-server scrape okhttp https://javadoc.io/static/com.squareup.okhttp3/okhttp/4.12.0/index.html

# 3. Index your own Kotlin/Java source with AST-aware, symbol-aligned chunking.
docs-mcp-server scrape my-app file:///abs/path/to/my-android-app/app/src

# 4. Search across everything you indexed.
docs-mcp-server search okhttp "connection pool timeout"
```

Over MCP, the `resolve_project_deps` tool returns each dependency's `docUrl`, so an
assistant can resolve → scrape → search version-correct documentation in one flow.
Recognized manifests: Gradle version catalogs (`libs.versions.toml`),
`build.gradle(.kts)` / `settings.gradle(.kts)`, and Flutter `pubspec.yaml` / `pubspec.lock`.

## ✨ Why Grounded Docs MCP Server?

The open-source alternative to **Context7**, **Nia**, and **Ref.Tools**.

-   ✅ **Up-to-Date Context:** Fetches documentation directly from official sources on demand.
-   🎯 **Version-Specific:** Queries target the exact library versions in your project.
-   💡 **Reduces Hallucinations:** Grounds LLMs in real documentation.
-   🔒 **Private & Local:** Runs entirely on your machine; your code never leaves your network.
-   🧩 **Broad Compatibility:** Works with any MCP-compatible client (Claude, Cline, etc.).
-   📁 **Multiple Sources:** Index websites, GitHub repositories, local folders, and zip archives.
-   📄 **Rich File Support:** Processes HTML, Markdown, PDF, Office documents (Word, Excel, PowerPoint), OpenDocument, RTF, EPUB, Jupyter Notebooks, and [90+ source code languages](docs/concepts/supported-formats.md).

---

## 📄 Supported Formats

| Category | Formats |
|----------|---------|
| **Documents** | PDF, Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint (.pptx/.ppt), OpenDocument (.odt/.ods/.odp), RTF, EPUB, FictionBook, Jupyter Notebooks |
| **Archives** | ZIP, TAR, gzipped TAR (contents are extracted and processed individually) |
| **Web** | HTML, XHTML |
| **Markup** | Markdown, MDX, reStructuredText, AsciiDoc, Org Mode, Textile, R Markdown |
| **Source Code** | TypeScript, JavaScript, Python, Go, Rust, C/C++, Java, Kotlin, Ruby, PHP, Swift, C#, and [many more](docs/concepts/supported-formats.md#source-code) |
| **Data** | JSON, YAML, TOML, CSV, XML, SQL, GraphQL, Protocol Buffers |
| **Config** | Dockerfile, Makefile, Terraform/HCL, INI, dotenv, Bazel |

See **[Supported Formats](docs/concepts/supported-formats.md)** for the complete reference including MIME types and processing details.

---

## 🚀 Quick Start

### CLI First

For agents and scripts, the CLI is usually the simplest way to use Grounded Docs.

**1. Index documentation** (requires Node.js 22+):

```bash
npx @arabold/docs-mcp-server@latest scrape react https://react.dev/reference/react
```

For hash-routed SPA docs sites, enable hash preservation explicitly:

```bash
npx @arabold/docs-mcp-server@latest scrape my-spa https://docs.example.com/#/guide --preserve-hashes
```

**2. Query the index:**

```bash
npx @arabold/docs-mcp-server@latest search react "useEffect cleanup" --output yaml
```

**3. Fetch a single page as Markdown:**

```bash
npx @arabold/docs-mcp-server@latest fetch-url https://react.dev/reference/react/useEffect
```

### Output Behavior

- Structured commands default to clean JSON on stdout in non-interactive runs.
- Use `--output json|yaml|toon` to pick a structured format.
- Plain-text commands such as `fetch-url` keep their text payload on stdout.
- Diagnostics go through the shared logger and are kept off stdout in non-interactive runs.
- Use `--quiet` to suppress non-error diagnostics or `--verbose` to enable debug output.

### Agent Skills

The [`skills/`](skills/) directory contains [Agent Skills](https://agentskills.io) that teach AI coding assistants how to use the CLI — covering documentation search, index management, and URL fetching.

### MCP Server

If you want a long-running MCP endpoint for Claude, Cline, Copilot, Gemini CLI, or other MCP clients:

**1. Start the server:**

```bash
npx @arabold/docs-mcp-server@latest
```

**2. Open the Web UI** at **[http://localhost:6280](http://localhost:6280)** to add documentation.

**3. Connect your AI client** by adding this to your MCP settings (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "docs-mcp-server": {
      "type": "sse",
      "url": "http://localhost:6280/sse"
    }
  }
}
```

See **[Connecting Clients](docs/guides/mcp-clients.md)** for VS Code (Cline, Roo) and other setup options.

`scrape_docs` also accepts `preserveHashes: true` for documentation sites that use hash-based client-side routing.
Use it only for hash-routed SPAs; normal sites typically use hash fragments for in-page anchors.

<details>
<summary>Alternative: Run with Docker</summary>

```bash
docker run --rm \
  -v docs-mcp-data:/data \
  -v docs-mcp-config:/config \
  -p 6280:6280 \
  ghcr.io/arabold/docs-mcp-server:latest \
  --protocol http --host 0.0.0.0 --port 6280
```

</details>

### 🧠 Configure Embedding Model (Recommended)

Using an embedding model is **optional** but dramatically improves search quality by enabling semantic vector search.

**Example: Enable OpenAI Embeddings**

```bash
OPENAI_API_KEY="sk-proj-..." npx @arabold/docs-mcp-server@latest
```

See **[Embedding Models](docs/guides/embedding-models.md)** for configuring **Ollama**, **Gemini**, **Azure**, and others.

---

## 📚 Documentation

### Getting Started
-   **[Installation](docs/setup/installation.md)**: Detailed setup guides for Docker, Node.js (npx), and Embedded mode.
-   **[Connecting Clients](docs/guides/mcp-clients.md)**: How to connect Claude, VS Code (Cline/Roo), and other MCP clients.
-   **[Basic Usage](docs/guides/basic-usage.md)**: Using the Web UI, CLI, and scraping local files.
-   **[Configuration](docs/setup/configuration.md)**: Full reference for config files and environment variables.
-   **[Supported Formats](docs/concepts/supported-formats.md)**: Complete file format and MIME type reference.
-   **[Embedding Models](docs/guides/embedding-models.md)**: Configure OpenAI, Ollama, Gemini, and other providers.
-   **[Search Quality Benchmark](docs/guides/benchmarking.md)**: Measure retrieval quality with IR metrics + LLM-judged scores; prerequisites, how to run, how to interpret results.

### Hash-Routed SPAs
-   Use `--preserve-hashes`, MCP `preserveHashes`, or the Web UI "Preserve Hash Routes" checkbox only for docs sites that route with URLs like `#/guide`.
-   When enabled with `scrapeMode=fetch`, the scraper automatically upgrades the job to Playwright because plain fetch cannot evaluate client-side hash routes.
-   Refresh reuses the stored `preserveHashes` setting by default, and CLI/Web refresh entrypoints can override it explicitly.

### Markdown-Optimized Web Scraping
-   Web scrapes and refreshes automatically probe for `llms.txt` at the documentation subpath and site root before normal crawling. When found, the curated links become additional crawl seeds, and pages discovered this way prefer `.md` URL variants such as `/guide/index.html.md` or `/page.html.md` before falling back to the original page.
-   Web requests send `Accept: text/markdown, text/html;q=0.9, */*;q=0.8` by default. Servers that support Markdown content negotiation, including Cloudflare Markdown for Agents, can return Markdown directly so the scraper bypasses HTML-to-Markdown conversion for cleaner output.
-   This behavior is automatic and requires no configuration. Custom `Accept` headers are preserved when provided.

### Key Concepts & Architecture
-   **[Deployment Modes](docs/infrastructure/deployment-modes.md)**: Standalone vs. Distributed (Docker Compose).
-   **[Authentication](docs/infrastructure/authentication.md)**: Securing your server with OAuth2/OIDC.
-   **[Security](docs/infrastructure/security.md)**: Trust boundaries, deployment hardening, and outbound access controls.
-   **[Telemetry](docs/infrastructure/telemetry.md)**: Privacy-first usage data collection.
-   **[Architecture](ARCHITECTURE.md)**: Deep dive into the system design.

---

## 🤝 Contributing

We welcome contributions! Please see **[CONTRIBUTING.md](CONTRIBUTING.md)** for development guidelines and setup instructions.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
