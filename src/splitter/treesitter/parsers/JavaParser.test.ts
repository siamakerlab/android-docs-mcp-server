/**
 * Tests for JavaParser - Java source code parsing and boundary extraction
 */

import { beforeEach, describe, expect, it } from "vitest";
import { JavaParser } from "./JavaParser";

describe("JavaParser", () => {
  let parser: JavaParser;

  beforeEach(() => {
    parser = new JavaParser(30000);
  });

  describe("initialization", () => {
    it("should have correct name and extensions", () => {
      expect(parser.name).toBe("java");
      expect(parser.fileExtensions).toContain(".java");
    });

    it("should have Java MIME types", () => {
      expect(parser.mimeTypes).toContain("text/x-java");
      expect(parser.mimeTypes).toContain("text/x-java-source");
    });
  });

  describe("parsing", () => {
    it("should parse simple Java code without errors", () => {
      const code = `package com.example;

public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}
`;
      const result = parser.parse(code);
      expect(result.tree).toBeDefined();
      expect(result.hasErrors).toBe(false);
      expect(result.errorNodes).toHaveLength(0);
    });

    it("should handle syntax errors gracefully", () => {
      const invalidCode = `public class Broken {
    int x = = = ;
}
`;
      const result = parser.parse(invalidCode);
      expect(result.tree).toBeDefined();
      expect(result.hasErrors).toBe(true);
      expect(result.errorNodes.length).toBeGreaterThan(0);
    });

    it("should flag recovery-via-MISSING as an error too", () => {
      const missingCode = `public class Broken {
    public int add(int a, int b {
        return a + b;
`;
      const result = parser.parse(missingCode);
      expect(result.hasErrors).toBe(true);
    });

    it("should handle empty content", () => {
      const result = parser.parse("");
      expect(result.tree).toBeDefined();
      expect(result.hasErrors).toBe(false);
    });
  });

  describe("boundary extraction", () => {
    it("should extract class and method boundaries", () => {
      const code = `public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }

    public int subtract(int a, int b) {
        return a - b;
    }
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const cls = boundaries.find((b) => b.name === "Calculator");
      expect(cls).toBeDefined();
      expect(cls?.type).toBe("class");
      expect(cls?.boundaryType).toBe("structural");

      const methods = boundaries.filter((b) => b.type === "function");
      expect(methods.map((m) => m.name)).toEqual(
        expect.arrayContaining(["add", "subtract"]),
      );
      for (const m of methods) {
        expect(m.boundaryType).toBe("content");
      }
    });

    it("should extract constructor boundaries", () => {
      const code = `public class Point {
    private final int x;

    public Point(int x) {
        this.x = x;
    }
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const ctor = boundaries.find((b) => b.name === "Point" && b.type === "function");
      expect(ctor).toBeDefined();
      expect(ctor?.boundaryType).toBe("content");
    });

    it("should classify interfaces, enums, records, and annotations", () => {
      const code = `interface Bar {
    void baz();
}

enum Color {
    RED, GREEN, BLUE
}

record PointR(int x, int y) {}

@interface MyAnno {}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      expect(boundaries.find((b) => b.name === "Bar")?.type).toBe("interface");
      expect(boundaries.find((b) => b.name === "Color")?.type).toBe("enum");
      expect(boundaries.find((b) => b.name === "PointR")?.type).toBe("class");
      expect(boundaries.find((b) => b.name === "MyAnno")?.type).toBe("interface");
    });

    it("should extract package and import boundaries as modules", () => {
      const code = `package com.example.app;

import java.util.List;
import java.util.Map;

public class Foo {}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const pkg = boundaries.find((b) => b.name === "package com.example.app");
      expect(pkg).toBeDefined();
      expect(pkg?.type).toBe("module");
      expect(pkg?.boundaryType).toBe("structural");

      const listImport = boundaries.find((b) => b.name === "import java.util.List");
      expect(listImport).toBeDefined();
      expect(listImport?.type).toBe("module");
    });

    it("should include the preceding Javadoc in a boundary", () => {
      const code = `public class Foo {
    /**
     * Adds a and the field.
     * @param a input
     */
    public int doThing(int a) {
        return a;
    }
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const method = boundaries.find((b) => b.name === "doThing");
      expect(method).toBeDefined();

      const lines = code.split("\n");
      const content = lines.slice(method!.startLine - 1, method!.endLine).join("\n");
      expect(content).toContain("/**");
      expect(content).toContain("Adds a and the field");
      expect(content).toContain("@param a input");
      expect(content).toContain("public int doThing(int a)");
    });

    it("should keep nested type members and suppress anonymous-class methods", () => {
      const code = `public class Outer {
    static class Inner {
        void innerMethod() {}
    }

    void setup() {
        Runnable r = new Runnable() {
            public void run() {
                work();
            }
        };
    }
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      // Nested type and its member are kept.
      expect(boundaries.find((b) => b.name === "Inner")?.type).toBe("class");
      expect(boundaries.map((b) => b.name)).toContain("innerMethod");
      expect(boundaries.map((b) => b.name)).toContain("setup");

      // The anonymous Runnable's run() is a local declaration -> suppressed.
      expect(boundaries.map((b) => b.name)).not.toContain("run");
    });

    it("should handle empty content", () => {
      const result = parser.parse("");
      const boundaries = parser.extractBoundaries(result.tree, "");
      expect(boundaries).toHaveLength(0);
    });
  });

  describe("large file handling", () => {
    it("should handle files larger than 32KB gracefully", () => {
      let largeCode = "package com.example;\n\n";
      let count = 1;
      while (largeCode.length < 35000) {
        largeCode += `class Generated${count} {
    public int method${count}(int v) {
        return v * ${count};
    }
}
`;
        count++;
      }
      expect(largeCode.length).toBeGreaterThan(32767);

      const result = parser.parse(largeCode);
      expect(result.tree).toBeDefined();
      expect(result.hasErrors).toBe(true); // truncation

      const boundaries = parser.extractBoundaries(result.tree, largeCode);
      expect(boundaries.length).toBeGreaterThan(0);
      expect(boundaries.map((b) => b.name)).toContain("Generated1");

      for (const b of boundaries) {
        expect(b.startLine).toBeGreaterThan(0);
        expect(b.endLine).toBeGreaterThanOrEqual(b.startLine);
        expect(b.endByte).toBeGreaterThan(b.startByte);
      }
    });
  });

  describe("structural nodes extraction", () => {
    it("should extract structural nodes for compatibility", () => {
      const code = `package com.example;

import java.util.List;

public class Service {
    public void run() {}
}
`;
      const result = parser.parse(code);
      const nodes = parser.extractStructuralNodes(result.tree, code);

      const names = nodes.map((n) => n.name);
      expect(names).toContain("package com.example");
      expect(names).toContain("import java.util.List");
      expect(names).toContain("Service");
      expect(names).toContain("run");
    });
  });
});
