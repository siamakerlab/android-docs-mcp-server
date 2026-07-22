import { describe, expect, it } from "vitest";
import { loadConfig } from "../../utils/config";
import {
  AppleDeveloperDocsStrategy,
  toDisplayUrl,
  toRenderJsonUrl,
} from "./AppleDeveloperDocsStrategy";

describe("AppleDeveloperDocsStrategy", () => {
  describe("canHandle", () => {
    const strategy = new AppleDeveloperDocsStrategy(loadConfig());

    it("handles developer.apple.com URLs", () => {
      expect(
        strategy.canHandle("https://developer.apple.com/documentation/swiftui/view"),
      ).toBe(true);
    });

    it("rejects other hosts", () => {
      expect(strategy.canHandle("https://developer.android.com/reference")).toBe(false);
      expect(strategy.canHandle("not a url")).toBe(false);
    });
  });

  describe("toRenderJsonUrl", () => {
    it("rewrites a documentation URL to its render-JSON twin", () => {
      expect(
        toRenderJsonUrl("https://developer.apple.com/documentation/swiftui/view"),
      ).toBe(
        "https://developer.apple.com/tutorials/data/documentation/swiftui/view.json",
      );
    });

    it("strips trailing slash, query, and hash when rewriting", () => {
      expect(
        toRenderJsonUrl(
          "https://developer.apple.com/documentation/swiftui/view/?language=swift#overview",
        ),
      ).toBe(
        "https://developer.apple.com/tutorials/data/documentation/swiftui/view.json",
      );
    });

    it("leaves an already-render-JSON URL unchanged", () => {
      const jsonUrl =
        "https://developer.apple.com/tutorials/data/documentation/swiftui/view.json";
      expect(toRenderJsonUrl(jsonUrl)).toBe(jsonUrl);
    });
  });

  describe("toDisplayUrl", () => {
    it("maps a render-JSON URL back to the human page URL", () => {
      expect(
        toDisplayUrl(
          "https://developer.apple.com/tutorials/data/documentation/swiftui/view.json",
        ),
      ).toBe("https://developer.apple.com/documentation/swiftui/view");
    });

    it("leaves a human URL unchanged (minus query/hash)", () => {
      expect(
        toDisplayUrl("https://developer.apple.com/documentation/swiftui/view?x=1"),
      ).toBe("https://developer.apple.com/documentation/swiftui/view");
    });

    it("round-trips with toRenderJsonUrl", () => {
      const human = "https://developer.apple.com/documentation/swiftui/view";
      expect(toDisplayUrl(toRenderJsonUrl(human))).toBe(human);
    });
  });
});
