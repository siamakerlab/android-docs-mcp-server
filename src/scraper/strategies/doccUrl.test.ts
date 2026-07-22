import { describe, expect, it } from "vitest";
import { dataSegmentDisplayUrl, dataSegmentRenderJsonUrl } from "./doccUrl";

describe("doccUrl (data-segment DocC hosts)", () => {
  describe("dataSegmentRenderJsonUrl", () => {
    it("rewrites a Swift Package Index documentation URL to its render-JSON twin", () => {
      expect(
        dataSegmentRenderJsonUrl(
          "https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/1.15.0/documentation/composablearchitecture",
        ),
      ).toBe(
        "https://swiftpackageindex.com/pointfreeco/swift-composable-architecture/1.15.0/data/documentation/composablearchitecture.json",
      );
    });

    it("rewrites a docs.swift.org documentation URL to its render-JSON twin", () => {
      expect(
        dataSegmentRenderJsonUrl(
          "https://docs.swift.org/swift-book/documentation/the-swift-programming-language",
        ),
      ).toBe(
        "https://docs.swift.org/swift-book/data/documentation/the-swift-programming-language.json",
      );
    });

    it("strips trailing slash, query, and hash", () => {
      expect(
        dataSegmentRenderJsonUrl(
          "https://docs.swift.org/swift-book/documentation/the-swift-programming-language/?utm=x#section",
        ),
      ).toBe(
        "https://docs.swift.org/swift-book/data/documentation/the-swift-programming-language.json",
      );
    });

    it("leaves an already-render-JSON URL unchanged", () => {
      const jsonUrl =
        "https://docs.swift.org/swift-book/data/documentation/the-swift-programming-language.json";
      expect(dataSegmentRenderJsonUrl(jsonUrl)).toBe(jsonUrl);
    });
  });

  describe("dataSegmentDisplayUrl", () => {
    it("maps a render-JSON URL back to the human page URL", () => {
      expect(
        dataSegmentDisplayUrl(
          "https://swiftpackageindex.com/o/r/1.0.0/data/documentation/target.json",
        ),
      ).toBe("https://swiftpackageindex.com/o/r/1.0.0/documentation/target");
    });

    it("round-trips with dataSegmentRenderJsonUrl", () => {
      const human =
        "https://docs.swift.org/swift-book/documentation/the-swift-programming-language";
      expect(dataSegmentDisplayUrl(dataSegmentRenderJsonUrl(human))).toBe(human);
    });
  });
});
