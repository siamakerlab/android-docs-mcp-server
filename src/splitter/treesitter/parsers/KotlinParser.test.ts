/**
 * Tests for KotlinParser - Kotlin source code parsing and boundary extraction
 */

import { beforeEach, describe, expect, it } from "vitest";
import { KotlinParser } from "./KotlinParser";

describe("KotlinParser", () => {
  let parser: KotlinParser;

  beforeEach(() => {
    parser = new KotlinParser(30000);
  });

  describe("initialization", () => {
    it("should have correct name and extensions", () => {
      expect(parser.name).toBe("kotlin");
      expect(parser.fileExtensions).toContain(".kt");
      expect(parser.fileExtensions).toContain(".kts");
    });

    it("should have Kotlin MIME types", () => {
      expect(parser.mimeTypes).toContain("text/x-kotlin");
    });
  });

  describe("parsing", () => {
    it("should parse simple Kotlin code without errors", () => {
      const code = `package com.example

class Calculator {
    fun add(a: Int, b: Int): Int = a + b
}
`;
      const result = parser.parse(code);
      expect(result.tree).toBeDefined();
      expect(result.hasErrors).toBe(false);
      expect(result.errorNodes).toHaveLength(0);
    });

    it("should handle empty content", () => {
      const result = parser.parse("");
      expect(result.tree).toBeDefined();
      expect(result.hasErrors).toBe(false);
    });
  });

  describe("boundary extraction", () => {
    it("should extract class and function boundaries", () => {
      const code = `class Calculator {
    fun add(a: Int, b: Int): Int = a + b
    fun subtract(a: Int, b: Int): Int = a - b
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const cls = boundaries.find((b) => b.name === "Calculator");
      expect(cls).toBeDefined();
      expect(cls?.type).toBe("class");
      expect(cls?.boundaryType).toBe("structural");

      const fns = boundaries.filter((b) => b.type === "function");
      expect(fns.map((f) => f.name)).toEqual(expect.arrayContaining(["add", "subtract"]));
      for (const f of fns) {
        expect(f.boundaryType).toBe("content");
      }
    });

    it("should classify interfaces, data classes, enum classes, and objects", () => {
      const code = `interface Bar {
    fun baz()
}

data class Point(val x: Int, val y: Int)

enum class Color { RED, GREEN, BLUE }

object Singleton {
    val value = 1
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      expect(boundaries.find((b) => b.name === "Bar")?.type).toBe("interface");
      expect(boundaries.find((b) => b.name === "Point")?.type).toBe("class");
      expect(boundaries.find((b) => b.name === "Color")?.type).toBe("enum");
      expect(boundaries.find((b) => b.name === "Singleton")?.type).toBe("class");
    });

    it("should extract functions inside a companion object", () => {
      const code = `class Greeter(val name: String) {
    companion object {
        fun create(): Greeter = Greeter("default")
    }
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      expect(boundaries.map((b) => b.name)).toContain("create");
    });

    it("should extract top-level and extension functions", () => {
      const code = `fun topLevel(): Int = 42

fun String.shout(): String = this.uppercase()
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const fns = boundaries.filter((b) => b.type === "function");
      expect(fns.map((f) => f.name)).toEqual(
        expect.arrayContaining(["topLevel", "shout"]),
      );
    });

    it("should extract package and import boundaries as modules", () => {
      const code = `package com.example.app

import kotlin.math.PI
import kotlin.collections.List

class Foo
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const pkg = boundaries.find((b) => b.name === "package com.example.app");
      expect(pkg).toBeDefined();
      expect(pkg?.type).toBe("module");

      const imp = boundaries.find((b) => b.name === "import kotlin.math.PI");
      expect(imp).toBeDefined();
      expect(imp?.type).toBe("module");
    });

    it("should include the preceding KDoc in a member function boundary", () => {
      const code = `class Foo {
    /**
     * Returns a greeting.
     * @return the greeting
     */
    fun greet(): String = "hi"
}
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const fn = boundaries.find((b) => b.name === "greet");
      expect(fn).toBeDefined();

      const lines = code.split("\n");
      const content = lines.slice(fn!.startLine - 1, fn!.endLine).join("\n");
      expect(content).toContain("/**");
      expect(content).toContain("Returns a greeting");
      expect(content).toContain("fun greet()");
    });

    it("should suppress local functions", () => {
      const code = `fun outer(): Int {
    fun inner(): Int = 1
    return inner()
}

fun another(): Int = 2
`;
      const result = parser.parse(code);
      const boundaries = parser.extractBoundaries(result.tree, code);

      const fns = boundaries.filter((b) => b.type === "function").map((b) => b.name);
      expect(fns).toEqual(expect.arrayContaining(["outer", "another"]));
      expect(fns).not.toContain("inner");
    });

    it("should handle empty content", () => {
      const result = parser.parse("");
      const boundaries = parser.extractBoundaries(result.tree, "");
      expect(boundaries).toHaveLength(0);
    });
  });

  describe("large file handling", () => {
    it("should handle files larger than 32KB gracefully", () => {
      let largeCode = "package com.example\n\n";
      let count = 1;
      while (largeCode.length < 35000) {
        largeCode += `class Generated${count} {
    fun method${count}(v: Int): Int = v * ${count}
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
      const code = `package com.example

import kotlin.math.PI

class Service {
    fun run() {}
}
`;
      const result = parser.parse(code);
      const nodes = parser.extractStructuralNodes(result.tree, code);

      const names = nodes.map((n) => n.name);
      expect(names).toContain("package com.example");
      expect(names).toContain("import kotlin.math.PI");
      expect(names).toContain("Service");
      expect(names).toContain("run");
    });
  });
});
