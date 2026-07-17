/**
 * Java parser for tree-sitter based source code splitting.
 *
 * Goals:
 *  - Semantic parsing of Java source code (.java files)
 *  - Direct boundary extraction aligned with the canonical ruleset
 *  - Handle Javadoc (`/** … *\/` block comments) preceding declarations
 *  - Support for classes, interfaces, enums, records, annotation types,
 *    methods, and constructors, including nested types
 *
 * Grammar: `tree-sitter-java` (peer `tree-sitter ^0.21`), validated against the
 * project core in docs/spikes/phase1-treesitter-grammars.md.
 */

import Parser, { type SyntaxNode, type Tree } from "tree-sitter";
import Java from "tree-sitter-java";
import { defaults } from "../../../utils/config";
import type { CodeBoundary, LanguageParser, ParseResult, StructuralNode } from "./types";
import { StructuralNodeType } from "./types";

/**
 * Type declarations that introduce a structural container.
 */
const TYPE_DECL_TYPES = new Set([
  "class_declaration",
  "interface_declaration",
  "enum_declaration",
  "record_declaration",
  "annotation_type_declaration",
]);

/**
 * Structural declarations we emit as boundaries.
 */
const STRUCTURAL_DECL_TYPES = new Set([
  ...TYPE_DECL_TYPES,
  "import_declaration",
  "package_declaration",
]);

/**
 * Executable / member declarations we also emit.
 */
const CONTENT_DECL_TYPES = new Set(["method_declaration", "constructor_declaration"]);

/**
 * Comment node types that can carry documentation preceding a declaration.
 * Java Javadoc is a `block_comment` (`/** … *\/`); line comments (`//`) are also collected.
 */
const COMMENT_TYPES = new Set(["block_comment", "line_comment"]);

/**
 * Decide if a node type is boundary-worthy (before suppression rules).
 */
function isCandidateBoundary(node: SyntaxNode): boolean {
  return STRUCTURAL_DECL_TYPES.has(node.type) || CONTENT_DECL_TYPES.has(node.type);
}

/**
 * Determine if a method/constructor is a local declaration (nested inside another
 * method/constructor body, e.g. via a local class), in which case we suppress
 * emission to match the canonical ruleset used by the Python parser.
 */
function isLocalHelper(node: SyntaxNode): boolean {
  const methodLike = new Set(["method_declaration", "constructor_declaration"]);

  let ancestor = node.parent;
  while (ancestor) {
    if (methodLike.has(ancestor.type)) {
      // Nested inside a method/constructor body -> local declaration
      return true;
    }
    // Stop climbing at type declarations (where members are allowed) or the root
    if (TYPE_DECL_TYPES.has(ancestor.type) || ancestor.type === "program") {
      break;
    }
    ancestor = ancestor.parent;
  }
  return false;
}

/**
 * Compute the boundary start, extending upward over a contiguous block of
 * preceding comments (Javadoc / line comments) so documentation stays attached
 * to the declaration it describes.
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

  // Walk upward collecting a contiguous comment block (allowing blank lines).
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

    // Hit non-comment code: stop.
    break;
  }

  return { startLine, startByte };
}

/**
 * Name extraction for Java nodes.
 */
function extractName(node: SyntaxNode): string {
  switch (node.type) {
    case "class_declaration":
    case "interface_declaration":
    case "enum_declaration":
    case "record_declaration":
    case "annotation_type_declaration":
    case "method_declaration":
    case "constructor_declaration": {
      const nameNode = node.childForFieldName("name");
      return nameNode?.text || `<anonymous_${node.type}>`;
    }
    case "import_declaration": {
      const id = node.children.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier",
      );
      return id ? `import ${id.text}` : "import";
    }
    case "package_declaration": {
      const id = node.children.find(
        (c) => c.type === "scoped_identifier" || c.type === "identifier",
      );
      return id ? `package ${id.text}` : "package";
    }
    default:
      return node.type;
  }
}

/**
 * Boundary classification mapping for Java.
 */
function classifyBoundaryKind(node: SyntaxNode): {
  boundaryType: "structural" | "content";
  simple: CodeBoundary["type"];
} {
  switch (node.type) {
    case "class_declaration":
    case "record_declaration":
      return { boundaryType: "structural", simple: "class" };
    case "interface_declaration":
    case "annotation_type_declaration":
      return { boundaryType: "structural", simple: "interface" };
    case "enum_declaration":
      return { boundaryType: "structural", simple: "enum" };
    case "import_declaration":
    case "package_declaration":
      return { boundaryType: "structural", simple: "module" };
    case "method_declaration":
    case "constructor_declaration":
      return { boundaryType: "content", simple: "function" };
    default:
      return { boundaryType: "content", simple: "other" };
  }
}

export class JavaParser implements LanguageParser {
  readonly name = "java";
  readonly fileExtensions = [".java"];
  readonly mimeTypes = [
    "text/x-java",
    "text/x-java-source",
    "text/java",
    "application/java",
  ];

  constructor(
    private readonly treeSitterSizeLimit: number = defaults.splitter.treeSitterSizeLimit,
  ) {}

  private createParser(): Parser {
    const parser = new Parser();
    parser.setLanguage(Java as unknown);
    return parser;
  }

  parse(source: string): ParseResult {
    if (typeof source !== "string") {
      throw new Error(`JavaParser expected string input, got ${typeof source}`);
    }

    if (source == null) {
      throw new Error("JavaParser received null or undefined source");
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
          `Failed to parse truncated Java file (${truncatedSource.length} chars): ${(error as Error).message}`,
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
        // `errorNodes` only holds explicit ERROR nodes; Java's parser often
        // recovers via MISSING nodes instead, so also honor `rootNode.hasError`.
        hasErrors: errorNodes.length > 0 || tree.rootNode.hasError,
        errorNodes,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse Java file (${source.length} chars): ${(error as Error).message}`,
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
          type: this.classifyStructuralNode(node),
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
        // Local declaration suppression for methods/constructors.
        if (CONTENT_DECL_TYPES.has(node.type) && isLocalHelper(node)) {
          for (const c of node.children) walk(c);
          return;
        }

        const name = extractName(node);
        const docInfo = findDocumentationStart(node, source);
        const classification = classifyBoundaryKind(node);

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

  private classifyStructuralNode(node: SyntaxNode): StructuralNodeType {
    switch (node.type) {
      case "method_declaration":
      case "constructor_declaration":
        return StructuralNodeType.FUNCTION_DECLARATION;
      case "class_declaration":
      case "record_declaration":
        return StructuralNodeType.CLASS_DECLARATION;
      case "interface_declaration":
      case "annotation_type_declaration":
        return StructuralNodeType.INTERFACE_DECLARATION;
      case "enum_declaration":
        return StructuralNodeType.ENUM_DECLARATION;
      case "import_declaration":
      case "package_declaration":
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
