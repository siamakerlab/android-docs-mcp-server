import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../../utils/config";
import { FetchStatus, type RawContent } from "../fetcher/types";
import type { ScraperOptions } from "../types";
import { DoccJsonPipeline } from "./DoccJsonPipeline";

const fixture = fs.readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../test/fixtures/docc-render.json",
  ),
  "utf-8",
);

const baseOptions: ScraperOptions = {
  url: "https://developer.apple.com/documentation/swiftui/view",
  library: "swiftui",
  version: "",
  maxPages: 10,
  maxDepth: 3,
  includePatterns: [],
  excludePatterns: [],
};

describe("DoccJsonPipeline", () => {
  const config = loadConfig();

  describe("canProcess", () => {
    it("accepts DocC render JSON (json mime + discriminators)", () => {
      const pipeline = new DoccJsonPipeline(config);
      expect(pipeline.canProcess("application/json", fixture)).toBe(true);
    });

    it("rejects ordinary JSON without DocC discriminators", () => {
      const pipeline = new DoccJsonPipeline(config);
      expect(pipeline.canProcess("application/json", '{"name":"x","age":1}')).toBe(false);
    });

    it("rejects non-JSON MIME types", () => {
      const pipeline = new DoccJsonPipeline(config);
      expect(pipeline.canProcess("text/html", fixture)).toBe(false);
    });

    it("rejects when no content is provided for sniffing", () => {
      const pipeline = new DoccJsonPipeline(config);
      expect(pipeline.canProcess("application/json")).toBe(false);
    });
  });

  describe("process", () => {
    const raw: RawContent = {
      content: fixture,
      mimeType: "application/json",
      charset: "utf-8",
      source: "https://developer.apple.com/documentation/swiftui/view",
      status: FetchStatus.SUCCESS,
    };

    it("extracts the symbol title and marks output as markdown", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const result = await pipeline.process(raw, baseOptions);
      expect(result.title).toBe("View");
      expect(result.contentType).toBe("text/markdown");
      expect(result.errors).toHaveLength(0);
    });

    it("renders title, role, abstract, and the declaration signature verbatim", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const md = (await pipeline.process(raw, baseOptions)).textContent ?? "";
      expect(md).toContain("# View");
      expect(md).toContain("*Protocol*");
      expect(md).toContain("part of your app’s user interface");
      expect(md).toContain("## Declaration");
      // Declaration preserved in a swift code fence, tokens joined verbatim.
      expect(md).toMatch(/```swift\n@MainActor protocol View\n```/);
    });

    it("renders overview prose with inline references, code voice, and code listings", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const md = (await pipeline.process(raw, baseOptions)).textContent ?? "";
      expect(md).toContain("## Overview");
      expect(md).toContain("[View](/documentation/swiftui/view)");
      expect(md).toContain("`body`");
      expect(md).toContain('Text("Hello, world!")');
    });

    it("renders topics, relationships, and see-also groups as annotated links", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const md = (await pipeline.process(raw, baseOptions)).textContent ?? "";
      expect(md).toContain("## Topics");
      expect(md).toContain("### Creating a view");
      expect(md).toContain("[Shape](/documentation/swiftui/shape) — A 2D shape");
      expect(md).toContain("## Relationships");
      expect(md).toContain("### Conforming Types");
      expect(md).toContain("## See Also");
    });

    it("surfaces internal documentation references as crawl links, excluding external", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const links = (await pipeline.process(raw, baseOptions)).links ?? [];
      expect(links).toContain("/documentation/swiftui/view");
      expect(links).toContain("/documentation/swiftui/shape");
      expect(links).toContain("/documentation/swiftui/view/body-swift.property");
      // Host-agnostic: a Swift Package Index-style path (with owner/repo/ref
      // prefix before /documentation/) is captured too, not just Apple-style.
      expect(links).toContain(
        "/pointfreeco/swift-composable-architecture/1.15.0/documentation/composablearchitecture/store",
      );
      // Absolute external URLs are excluded.
      expect(links).not.toContain("https://developer.apple.com/videos/wwdc");
    });

    it("indexes the primary Swift node and ignores the objc language variant (no noise)", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const md = (await pipeline.process(raw, baseOptions)).textContent ?? "";
      // The primary render node is Swift; the objc `variants` entry is a separate
      // render-JSON page, so its metadata must not leak into this document.
      expect(md).toContain("# View");
      expect(md).not.toContain("occ");
      expect(md).not.toContain("interfaceLanguage");
    });

    it("emits chunks for the assembled markdown", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const result = await pipeline.process(raw, baseOptions);
      expect(result.chunks?.length ?? 0).toBeGreaterThan(0);
    });

    it("returns an error and no chunks for invalid JSON", async () => {
      const pipeline = new DoccJsonPipeline(config);
      const result = await pipeline.process(
        { ...raw, content: "{ not valid json" },
        baseOptions,
      );
      expect(result.errors?.length ?? 0).toBeGreaterThan(0);
      expect(result.chunks).toHaveLength(0);
    });
  });
});
