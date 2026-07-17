/**
 * Kotlin parser for tree-sitter based source code splitting.
 *
 * Goals:
 *  - Semantic parsing of Kotlin source code (.kt / .kts files)
 *  - Direct boundary extraction aligned with the canonical ruleset
 *  - Handle KDoc (`/** … *\/` multiline comments) preceding declarations
 *  - Support for classes, interfaces, data/enum classes, objects, companion
 *    objects, and functions, including nested members
 *
 * Grammar: `tree-sitter-kotlin` (fwcd, peer `tree-sitter ^0.21`), validated against
 * the project core in docs/spikes/phase1-treesitter-grammars.md.
 *
 * Node-type notes (differ from Java): the root is `source_file`; classes,
 * interfaces, `data`/`enum` classes all parse as `class_declaration` (enums carry
 * an `enum_class_body`, interfaces are told apart by the declaration header);
 * names come from `type_identifier` (types) or `simple_identifier` (functions),
 * not a `name` field; imports live under `import_list` as `import_header` nodes.
 */

import Parser, { type SyntaxNode, type Tree } from "tree-sitter";
import Kotlin from "tree-sitter-kotlin";
import { defaults } from "../../../utils/config";
import type { CodeBoundary, LanguageParser, ParseResult, StructuralNode } from "./types";
import { StructuralNodeType } from "./types";

/**
 * Type declarations that introduce a structural container.
 */
const TYPE_DECL_TYPES = new Set([
  "class_declaration",
  "object_declaration",
  "companion_object",
]);

/**
 * Structural declarations we emit as boundaries.
 */
const STRUCTURAL_DECL_TYPES = new Set([
  ...TYPE_DECL_TYPES,
  "import_header",
  "package_header",
]);

/**
 * Executable / member declarations we also emit.
 */
const CONTENT_DECL_TYPES = new Set(["function_declaration"]);

/**
 * Comment node types that can carry documentation preceding a declaration.
 * Kotlin KDoc is a `multiline_comment` (`/** … *\/`); line comments (`//`) are also collected.
 */
const COMMENT_TYPES = new Set(["multiline_comment", "line_comment"]);

/**
 * Decide if a node type is boundary-worthy (before suppression rules).
 */
function isCandidateBoundary(node: SyntaxNode): boolean {
  return STRUCTURAL_DECL_TYPES.has(node.type) || CONTENT_DECL_TYPES.has(node.type);
}

/**
 * Determine if a function is a local declaration (nested inside another function
 * body), in which case we suppress emission to match the canonical ruleset.
 */
function isLocalHelper(node: SyntaxNode): boolean {
  let ancestor = node.parent;
  while (ancestor) {
    if (ancestor.type === "function_declaration") {
      return true;
    }
    if (TYPE_DECL_TYPES.has(ancestor.type) || ancestor.type === "source_file") {
      break;
    }
    ancestor = ancestor.parent;
  }
  return false;
}

/**
 * Classify a class-like declaration into a simple boundary kind.
 * Enums are recognized by their `enum_class_body`; interfaces by the `interface`
 * keyword in the declaration header (before the type name).
 */
function classifyClassLike(node: SyntaxNode, source: string): CodeBoundary["type"] {
  if (node.children.some((c) => c.type === "enum_class_body")) {
    return "enum";
  }
  const id = node.children.find((c) => c.type === "type_identifier");
  const headerEnd = id ? id.startIndex : Math.min(node.endIndex, node.startIndex + 60);
  const header = source.slice(node.startIndex, headerEnd);
  if (/\binterface\b/.test(header)) {
    return "interface";
  }
  return "class";
}

/**
 * Compute the boundary start, extending upward over a contiguous block of
 * preceding comments (KDoc / line comments) so documentation stays attached to
 * the declaration it describes.
 */
function findDocumentationStart(
  node: SyntaxNode,
  source: string,
): { startLine: number; startByte: number } {
  let startByte = node.startIndex;
  let startLine = node.startPosition.row + 1;

  const parent = node.parent;
  if (!parent) {
    return { startLine, startByte };
  }

  const siblings = parent.children;
  const idx = siblings.indexOf(node);
  if (idx === -1) {
    return { startLine, startByte };
  }

  let sawComment = false;
  for (let i = idx - 1; i >= 0; i--) {
    const s = siblings[i];
    const text = source.slice(s.startIndex, s.endIndex);

    if (COMMENT_TYPES.has(s.type)) {
      sawComment = true;
      startByte = s.startIndex;
      startLine = s.startPosition.row + 1;
      continue;
    }

    if (/^\s*$/.test(text)) {
      if (sawComment) {
        startByte = s.startIndex;
        startLine = s.startPosition.row + 1;
      }
      continue;
    }

    break;
  }

  return { startLine, startByte };
}

/**
 * Name extraction for Kotlin nodes.
 */
function extractName(node: SyntaxNode): string {
  switch (node.type) {
    case "class_declaration":
    case "object_declaration": {
      const id = node.children.find((c) => c.type === "type_identifier");
      return id?.text || `<anonymous_${node.type}>`;
    }
    case "companion_object": {
      const id = node.children.find((c) => c.type === "type_identifier");
      return id ? id.text : "companion";
    }
    case "function_declaration": {
      const id = node.children.find((c) => c.type === "simple_identifier");
      return id?.text || "<anonymous_fun>";
    }
    case "package_header": {
      const id = node.children.find((c) => c.type === "identifier");
      return id ? `package ${id.text}` : "package";
    }
    case "import_header": {
      const id = node.children.find((c) => c.type === "identifier");
      return id ? `import ${id.text}` : "import";
    }
    default:
      return node.type;
  }
}

/**
 * Boundary classification mapping for Kotlin.
 */
function classifyBoundaryKind(
  node: SyntaxNode,
  source: string,
): {
  boundaryType: "structural" | "content";
  simple: CodeBoundary["type"];
} {
  switch (node.type) {
    case "class_declaration":
      return { boundaryType: "structural", simple: classifyClassLike(node, source) };
    case "object_declaration":
    case "companion_object":
      return { boundaryType: "structural", simple: "class" };
    case "import_header":
    case "package_header":
      return { boundaryType: "structural", simple: "module" };
    case "function_declaration":
      return { boundaryType: "content", simple: "function" };
    default:
      return { boundaryType: "content", simple: "other" };
  }
}

export class KotlinParser implements LanguageParser {
  readonly name = "kotlin";
  readonly fileExtensions = [".kt", ".kts"];
  readonly mimeTypes = ["text/x-kotlin", "text/kotlin", "application/x-kotlin"];

  constructor(
    private readonly treeSitterSizeLimit: number = defaults.splitter.treeSitterSizeLimit,
  ) {}

  private createParser(): Parser {
    const parser = new Parser();
    parser.setLanguage(Kotlin as unknown);
    return parser;
  }

  parse(source: string): ParseResult {
    if (typeof source !== "string") {
      throw new Error(`KotlinParser expected string input, got ${typeof source}`);
    }

    if (source == null) {
      throw new Error("KotlinParser received null or undefined source");
    }

    // Handle tree-sitter size limit by truncating at a line boundary.
    const limit = this.treeSitterSizeLimit;
    if (source.length > limit) {
      let truncatedSource = source.slice(0, limit);
      const lastNewline = truncatedSource.lastIndexOf("\n");
      if (lastNewline > limit * 0.9) {
        truncatedSource = source.slice(0, lastNewline + 1);
      }

      try {
        const parser = this.createParser();
        const tree = parser.parse(truncatedSource);
        const errorNodes: SyntaxNode[] = [];
        this.collectErrorNodes(tree.rootNode, errorNodes);

        return {
          tree,
          hasErrors: true, // Mark as having errors due to truncation
          errorNodes,
        };
      } catch (error) {
        throw new Error(
          `Failed to parse truncated Kotlin file (${truncatedSource.length} chars): ${(error as Error).message}`,
        );
      }
    }

    try {
      const parser = this.createParser();
      const tree = parser.parse(source);
      const errorNodes: SyntaxNode[] = [];
      this.collectErrorNodes(tree.rootNode, errorNodes);

      return {
        tree,
        // `errorNodes` only holds explicit ERROR nodes; the grammar often recovers
        // via MISSING nodes instead, so also honor `rootNode.hasError`.
        hasErrors: errorNodes.length > 0 || tree.rootNode.hasError,
        errorNodes,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse Kotlin file (${source.length} chars): ${(error as Error).message}`,
      );
    }
  }

  private collectErrorNodes(node: SyntaxNode, acc: SyntaxNode[]): void {
    if (node.hasError && node.type === "ERROR") {
      acc.push(node);
    }
    for (const c of node.children) {
      this.collectErrorNodes(c, acc);
    }
  }

  getNodeText(node: SyntaxNode, source: string): string {
    return source.slice(node.startIndex, node.endIndex);
  }

  getNodeLines(node: SyntaxNode, _source: string) {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
  }

  /**
   * Legacy structural node extraction (used by existing tests).
   * Produces a flat list (no parent/child linking beyond simple push).
   */
  extractStructuralNodes(tree: Tree, source?: string): StructuralNode[] {
    const src = source ?? tree.rootNode.text;
    const out: StructuralNode[] = [];
    const structuralTypes = new Set<string>([
      ...STRUCTURAL_DECL_TYPES,
      ...CONTENT_DECL_TYPES,
    ]);

    const visit = (node: SyntaxNode): void => {
      if (structuralTypes.has(node.type)) {
        const name = extractName(node);
        const { startLine, startByte } = findDocumentationStart(node, src);
        const endLine = node.endPosition.row + 1;
        const structuralNode: StructuralNode = {
          type: this.classifyStructuralNode(node, src),
          name,
          startLine,
          endLine,
          startByte,
          endByte: node.endIndex,
          children: [],
          text: this.getNodeText(node, src),
          indentLevel: 0,
          modifiers: [],
          documentation: undefined,
        };
        out.push(structuralNode);
        for (const child of node.children) visit(child);
        return;
      }
      for (const child of node.children) visit(child);
    };

    visit(tree.rootNode);
    return this.deduplicate(out);
  }

  /**
   * Boundary extraction: produces CodeBoundary[] directly from the AST.
   */
  extractBoundaries(tree: Tree, source: string): CodeBoundary[] {
    if (!source.trim()) return [];
    const boundaries: CodeBoundary[] = [];

    const walk = (node: SyntaxNode): void => {
      if (isCandidateBoundary(node)) {
        // Local declaration suppression for functions.
        if (CONTENT_DECL_TYPES.has(node.type) && isLocalHelper(node)) {
          for (const c of node.children) walk(c);
          return;
        }

        const name = extractName(node);
        const docInfo = findDocumentationStart(node, source);
        const classification = classifyBoundaryKind(node, source);

        boundaries.push({
          type: classification.simple,
          boundaryType: classification.boundaryType,
          name,
          startLine: docInfo.startLine,
          endLine: node.endPosition.row + 1,
          startByte: docInfo.startByte,
          endByte: node.endIndex,
        });

        for (const c of node.children) walk(c);
        return;
      }

      for (const c of node.children) walk(c);
    };

    walk(tree.rootNode);

    // Deduplicate by start/end/name triple.
    const seen = new Set<string>();
    return boundaries.filter((b) => {
      const key = `${b.startByte}:${b.endByte}:${b.name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private classifyStructuralNode(node: SyntaxNode, source: string): StructuralNodeType {
    switch (node.type) {
      case "function_declaration":
        return StructuralNodeType.FUNCTION_DECLARATION;
      case "class_declaration": {
        const kind = classifyClassLike(node, source);
        if (kind === "interface") return StructuralNodeType.INTERFACE_DECLARATION;
        if (kind === "enum") return StructuralNodeType.ENUM_DECLARATION;
        return StructuralNodeType.CLASS_DECLARATION;
      }
      case "object_declaration":
      case "companion_object":
        return StructuralNodeType.CLASS_DECLARATION;
      case "import_header":
      case "package_header":
        return StructuralNodeType.IMPORT_STATEMENT;
      default:
        return StructuralNodeType.VARIABLE_DECLARATION;
    }
  }

  private deduplicate(nodes: StructuralNode[]): StructuralNode[] {
    const seen = new Set<string>();
    const out: StructuralNode[] = [];
    for (const n of nodes) {
      const key = `${n.startByte}:${n.endByte}:${n.type}:${n.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(n);
    }
    out.sort((a, b) => a.startByte - b.startByte);
    return out;
  }
}
