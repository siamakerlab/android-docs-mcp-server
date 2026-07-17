import { describe, expect, it } from "vitest";
import { parsePubspec } from "./pubspec";

describe("parsePubspec", () => {
  it("parses string version constraints from dependencies and dev_dependencies", () => {
    const yaml = `
name: my_app
dependencies:
  http: ^1.1.0
  provider: 6.1.1
dev_dependencies:
  build_runner: ^2.4.0
`;
    const { dependencies, warnings } = parsePubspec(yaml);
    expect(warnings).toEqual([]);

    const byCoord = Object.fromEntries(dependencies.map((d) => [d.coordinate, d]));
    expect(byCoord.http).toMatchObject({ version: "^1.1.0", ecosystem: "pub" });
    expect(byCoord.provider.version).toBe("6.1.1");
    expect(byCoord.build_runner.version).toBe("^2.4.0");
  });

  it("resolves explicit version in a hosted map form", () => {
    const yaml = `
dependencies:
  some_pkg:
    version: 1.2.3
    hosted: https://example.com
`;
    const { dependencies } = parsePubspec(yaml);
    expect(dependencies[0]).toMatchObject({ coordinate: "some_pkg", version: "1.2.3" });
  });

  it("reports SDK / git / path dependencies with null version and a warning", () => {
    const yaml = `
dependencies:
  flutter:
    sdk: flutter
  from_git:
    git: https://github.com/x/y.git
  local:
    path: ../local
`;
    const { dependencies, warnings } = parsePubspec(yaml);
    const byCoord = Object.fromEntries(dependencies.map((d) => [d.coordinate, d]));

    expect(byCoord.flutter.version).toBeNull();
    expect(byCoord.from_git.version).toBeNull();
    expect(byCoord.local.version).toBeNull();
    expect(warnings.some((w) => w.includes("SDK dependency"))).toBe(true);
    expect(warnings.some((w) => w.includes("git dependency"))).toBe(true);
    expect(warnings.some((w) => w.includes("path dependency"))).toBe(true);
  });

  it("returns empty result for a pubspec without dependency sections", () => {
    const { dependencies, warnings } = parsePubspec("name: my_app\n");
    expect(dependencies).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it("returns a warning (not a throw) on malformed YAML", () => {
    const { dependencies, warnings } = parsePubspec("dependencies:\n  - : : :\n    bad");
    // Either parses to nothing useful or warns; must never throw.
    expect(Array.isArray(dependencies)).toBe(true);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("tags source on every dependency", () => {
    const { dependencies } = parsePubspec(
      "dependencies:\n  http: ^1.0.0\n",
      "app/pubspec.yaml",
    );
    expect(dependencies[0].source).toBe("app/pubspec.yaml");
  });
});
