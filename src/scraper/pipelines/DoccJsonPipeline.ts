import { GreedySplitter } from "../../splitter/GreedySplitter";
import { SemanticMarkdownSplitter } from "../../splitter/SemanticMarkdownSplitter";
import type { AppConfig } from "../../utils/config";
import { MimeTypeUtils } from "../../utils/mimeTypeUtils";
import type { ContentFetcher, RawContent } from "../fetcher/types";
import type { ScraperOptions } from "../types";
import { convertToString } from "../utils/buffer";
import { BasePipeline } from "./BasePipeline";
import type { PipelineResult } from "./types";

/**
 * Pipeline for Apple **DocC render JSON** — the machine-readable format that
 * `developer.apple.com`, `docs.swift.org`, Swift Package Index, and every
 * self-hosted `.doccarchive` all serve. Unlike Javadoc/Dartdoc HTML, DocC is
 * already structured, so this pipeline consumes the JSON directly and assembles
 * Markdown from it — no headless browser, no HTML chrome to strip.
 *
 * It reduces a render node to: the symbol title + role, the declaration
 * (fully-qualified signature, preserved verbatim in a code fence so search can
 * match `Type.method(_:)`), the overview prose, and the Topics / Relationships /
 * See Also link groups. The `references` map's page URLs are surfaced as `links`
 * so the crawler uses them as its frontier.
 *
 * The URL-rewriting from a human documentation URL to its render-JSON twin is a
 * per-host concern and lives in the DocC scraper strategies (e.g.
 * {@link AppleDeveloperDocsStrategy}); this pipeline only parses and renders.
 */
export class DoccJsonPipeline extends BasePipeline {
  private readonly greedySplitter: GreedySplitter;

  constructor(config: AppConfig) {
    super();
    const { preferredChunkSize, maxChunkSize, minChunkSize } = config.splitter;
    const semanticSplitter = new SemanticMarkdownSplitter(
      preferredChunkSize,
      maxChunkSize,
    );
    this.greedySplitter = new GreedySplitter(
      semanticSplitter,
      minChunkSize,
      preferredChunkSize,
      maxChunkSize,
    );
  }

  /**
   * DocC render JSON is served as `application/json`. To avoid claiming ordinary
   * JSON payloads, require the DocC discriminators: a `schemaVersion`, a
   * `references` map, and at least one documentation section.
   */
  canProcess(mimeType: string, content?: string | Buffer): boolean {
    if (!MimeTypeUtils.isJson(mimeType)) return false;
    if (content == null) return false;
    const text = typeof content === "string" ? content : content.toString("utf-8");
    return (
      text.includes('"schemaVersion"') &&
      text.includes('"references"') &&
      (text.includes('"primaryContentSections"') || text.includes('"topicSections"'))
    );
  }

  async process(
    rawContent: RawContent,
    _options: ScraperOptions,
    _fetcher?: ContentFetcher,
  ): Promise<PipelineResult> {
    const contentString = convertToString(rawContent.content, rawContent.charset);

    let node: DoccRenderNode;
    try {
      node = JSON.parse(contentString) as DoccRenderNode;
    } catch (error) {
      return {
        textContent: contentString,
        links: [],
        errors: [error instanceof Error ? error : new Error(String(error))],
        chunks: [],
      };
    }

    const references = node.references ?? {};
    const title = node.metadata?.title ?? null;
    const markdown = renderDoccMarkdown(node, references);
    const links = extractDoccLinks(references);
    const chunks = await this.greedySplitter.splitText(markdown);

    return {
      title,
      contentType: "text/markdown",
      textContent: markdown,
      links,
      errors: [],
      chunks,
    };
  }
}

/** Minimal shape of the DocC render-JSON nodes we consume. Unused fields omitted. */
interface DoccInline {
  type: string;
  text?: string;
  code?: string;
  identifier?: string;
  destination?: string;
  inlineContent?: DoccInline[];
}

interface DoccBlock {
  type: string;
  level?: number;
  text?: string;
  syntax?: string;
  style?: string;
  code?: string[];
  inlineContent?: DoccInline[];
  content?: DoccBlock[];
  items?: Array<{ content?: DoccBlock[] }>;
}

interface DoccDeclaration {
  platforms?: string[];
  tokens?: Array<{ text?: string; kind?: string }>;
}

interface DoccContentSection {
  kind?: string;
  declarations?: DoccDeclaration[];
  content?: DoccBlock[];
}

interface DoccGroupSection {
  title?: string;
  identifiers?: string[];
}

interface DoccReference {
  url?: string;
  title?: string;
  abstract?: DoccInline[];
  kind?: string;
  role?: string;
  type?: string;
}

type DoccReferences = Record<string, DoccReference>;

interface DoccRenderNode {
  kind?: string;
  metadata?: { title?: string; roleHeading?: string; role?: string };
  abstract?: DoccInline[];
  primaryContentSections?: DoccContentSection[];
  topicSections?: DoccGroupSection[];
  relationshipsSections?: DoccGroupSection[];
  seeAlsoSections?: DoccGroupSection[];
  references?: DoccReferences;
}

/** Assemble a full Markdown document from a DocC render node. */
function renderDoccMarkdown(node: DoccRenderNode, refs: DoccReferences): string {
  const parts: string[] = [];

  const title = node.metadata?.title?.trim();
  const roleHeading = node.metadata?.roleHeading?.trim();
  if (title) {
    parts.push(`# ${title}`);
    if (roleHeading) parts.push(`*${roleHeading}*`);
  }

  const abstract = renderInline(node.abstract ?? [], refs).trim();
  if (abstract) parts.push(abstract);

  for (const section of node.primaryContentSections ?? []) {
    if (section.kind === "declarations") {
      const decl = renderDeclarations(section.declarations ?? []);
      if (decl) {
        parts.push("## Declaration");
        parts.push(decl);
      }
    } else if (section.kind === "content") {
      const body = renderBlocks(section.content ?? [], refs).trim();
      if (body) parts.push(body);
    }
  }

  const topics = renderGroups(node.topicSections ?? [], refs);
  if (topics) {
    parts.push("## Topics");
    parts.push(topics);
  }

  const relationships = renderGroups(node.relationshipsSections ?? [], refs);
  if (relationships) {
    parts.push("## Relationships");
    parts.push(relationships);
  }

  const seeAlso = renderGroups(node.seeAlsoSections ?? [], refs);
  if (seeAlso) {
    parts.push("## See Also");
    parts.push(seeAlso);
  }

  return `${parts.join("\n\n").trim()}\n`;
}

/** Render an inline-content array (abstracts, paragraph runs) to Markdown. */
function renderInline(nodes: DoccInline[], refs: DoccReferences): string {
  let out = "";
  for (const n of nodes) {
    switch (n.type) {
      case "text":
        out += n.text ?? "";
        break;
      case "codeVoice":
        out += n.code ? `\`${n.code}\`` : "";
        break;
      case "emphasis":
        out += `*${renderInline(n.inlineContent ?? [], refs)}*`;
        break;
      case "strong":
        out += `**${renderInline(n.inlineContent ?? [], refs)}**`;
        break;
      case "reference": {
        const ref = n.identifier ? refs[n.identifier] : undefined;
        const label = ref?.title ?? n.identifier ?? "";
        out += ref?.url ? `[${label}](${ref.url})` : label;
        break;
      }
      case "link": {
        const label = renderInline(n.inlineContent ?? [], refs) || n.text || "";
        out += n.destination ? `[${label}](${n.destination})` : label;
        break;
      }
      default:
        if (n.inlineContent) out += renderInline(n.inlineContent, refs);
        else if (n.text) out += n.text;
    }
  }
  return out;
}

/** Render a block-content array (prose sections) to Markdown. */
function renderBlocks(blocks: DoccBlock[], refs: DoccReferences): string {
  const parts: string[] = [];
  for (const b of blocks) {
    switch (b.type) {
      case "paragraph":
        parts.push(renderInline(b.inlineContent ?? [], refs));
        break;
      case "heading": {
        const level = Math.min(Math.max(b.level ?? 2, 1), 6);
        const text = b.text ?? renderInline(b.inlineContent ?? [], refs);
        parts.push(`${"#".repeat(level)} ${text}`);
        break;
      }
      case "codeListing": {
        const code = (b.code ?? []).join("\n");
        parts.push(`\`\`\`${b.syntax ?? ""}\n${code}\n\`\`\``);
        break;
      }
      case "unorderedList":
        for (const item of b.items ?? []) {
          parts.push(`- ${renderBlocks(item.content ?? [], refs).trim()}`);
        }
        break;
      case "orderedList": {
        let i = 1;
        for (const item of b.items ?? []) {
          parts.push(`${i++}. ${renderBlocks(item.content ?? [], refs).trim()}`);
        }
        break;
      }
      case "aside": {
        const label = b.style
          ? b.style.charAt(0).toUpperCase() + b.style.slice(1)
          : "Note";
        const body = renderBlocks(b.content ?? [], refs)
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n");
        parts.push(`> **${label}**\n${body}`);
        break;
      }
      default:
        if (b.content) parts.push(renderBlocks(b.content, refs));
        else if (b.inlineContent) parts.push(renderInline(b.inlineContent, refs));
    }
  }
  return parts.filter(Boolean).join("\n\n");
}

/** Render declaration sections as verbatim Swift code fences (signature-preserving). */
function renderDeclarations(decls: DoccDeclaration[]): string {
  const blocks: string[] = [];
  for (const d of decls) {
    const code = (d.tokens ?? []).map((t) => t.text ?? "").join("");
    if (code.trim()) blocks.push(`\`\`\`swift\n${code.trim()}\n\`\`\``);
  }
  return blocks.join("\n\n");
}

/** Render a group of link sections (Topics / Relationships / See Also). */
function renderGroups(sections: DoccGroupSection[], refs: DoccReferences): string {
  const parts: string[] = [];
  for (const section of sections) {
    const lines: string[] = [];
    if (section.title) lines.push(`### ${section.title}`);
    for (const id of section.identifiers ?? []) {
      const ref = refs[id];
      if (!ref) continue;
      const label = ref.title ?? id;
      const link = ref.url ? `[${label}](${ref.url})` : label;
      const abstract = ref.abstract ? renderInline(ref.abstract, refs).trim() : "";
      lines.push(abstract ? `- ${link} — ${abstract}` : `- ${link}`);
    }
    if (lines.length) parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

/**
 * Collect the internal documentation page URLs from the `references` map. These
 * become the crawl frontier: the strategy resolves each against the human page
 * URL and re-fetches its render-JSON twin. External links (absolute URLs, videos)
 * are excluded so the crawler stays within the documentation graph.
 */
function extractDoccLinks(refs: DoccReferences): string[] {
  const urls = new Set<string>();
  for (const ref of Object.values(refs)) {
    // Internal documentation pages are site-absolute paths containing a
    // `/documentation/` segment. The exact prefix varies by host — Apple uses
    // `/documentation/…`, Swift Package Index `/{owner}/{repo}/{ref}/documentation/…`,
    // docs.swift.org `/{book}/documentation/…` — so match the segment, not a fixed
    // prefix. Absolute URLs (videos, external links) are excluded.
    if (ref.url?.startsWith("/") && ref.url.includes("/documentation/")) {
      urls.add(ref.url);
    }
  }
  return [...urls];
}
