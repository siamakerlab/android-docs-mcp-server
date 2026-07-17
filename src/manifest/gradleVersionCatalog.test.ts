import { describe, expect, it } from "vitest";
import { parseGradleVersionCatalog } from "./gradleVersionCatalog";

describe("parseGradleVersionCatalog", () => {
  it("resolves library forms: version.ref, module+version, group/name, shorthand", () => {
    const toml = `
[versions]
coreKtx = "1.12.0"

[libraries]
core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
okhttp = { module = "com.squareup.okhttp3:okhttp", version = "4.12.0" }
material = "com.google.android.material:material:1.11.0"
`;
    const { dependencies, warnings } = parseGradleVersionCatalog(toml);
    expect(warnings).toEqual([]);

    const byCoord = Object.fromEntries(dependencies.map((d) => [d.coordinate, d]));
    expect(byCoord["androidx.core:core-ktx"]).toMatchObject({
      version: "1.12.0",
      ecosystem: "maven",
    });
    expect(byCoord["com.squareup.okhttp3:okhttp"].version).toBe("4.12.0");
    expect(byCoord["com.google.android.material:material"].version).toBe("1.11.0");
  });

  it("resolves plugins by version.ref and inline version", () => {
    const toml = `
[versions]
agp = "8.2.0"

[plugins]
android-app = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version = "1.9.22" }
`;
    const { dependencies } = parseGradleVersionCatalog(toml);
    const byCoord = Object.fromEntries(dependencies.map((d) => [d.coordinate, d]));

    expect(byCoord["com.android.application"]).toMatchObject({
      version: "8.2.0",
      ecosystem: "gradle-plugin",
    });
    expect(byCoord["org.jetbrains.kotlin.android"].version).toBe("1.9.22");
  });

  it("resolves plugin string shorthand id:version", () => {
    const toml = `
[plugins]
foo = "com.example.foo:1.2.3"
`;
    const { dependencies } = parseGradleVersionCatalog(toml);
    expect(dependencies[0]).toMatchObject({
      coordinate: "com.example.foo",
      version: "1.2.3",
      ecosystem: "gradle-plugin",
    });
  });

  it("reports a warning and null version for an unresolved version ref", () => {
    const toml = `
[libraries]
lib = { module = "com.example:lib", version.ref = "missing" }
`;
    const { dependencies, warnings } = parseGradleVersionCatalog(toml);
    expect(dependencies[0]).toMatchObject({
      coordinate: "com.example:lib",
      version: null,
    });
    expect(warnings.some((w) => w.includes('version ref "missing"'))).toBe(true);
  });

  it("handles a library with no version (null)", () => {
    const toml = `
[libraries]
lib = { module = "com.example:lib" }
`;
    const { dependencies } = parseGradleVersionCatalog(toml);
    expect(dependencies[0]).toMatchObject({
      coordinate: "com.example:lib",
      version: null,
    });
  });

  it("resolves Gradle rich versions (require/strictly/prefer)", () => {
    const toml = `
[libraries]
a = { module = "g:a", version = { require = "1.0.0" } }
b = { module = "g:b", version = { strictly = "2.0.0" } }
`;
    const { dependencies } = parseGradleVersionCatalog(toml);
    const byCoord = Object.fromEntries(dependencies.map((d) => [d.coordinate, d]));
    expect(byCoord["g:a"].version).toBe("1.0.0");
    expect(byCoord["g:b"].version).toBe("2.0.0");
  });

  it("returns a warning (not a throw) on malformed TOML", () => {
    const { dependencies, warnings } = parseGradleVersionCatalog("this is = = not toml");
    expect(dependencies).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("tags source on every dependency", () => {
    const toml = `
[libraries]
a = "g:a:1.0"
`;
    const { dependencies } = parseGradleVersionCatalog(toml, "custom/libs.versions.toml");
    expect(dependencies[0].source).toBe("custom/libs.versions.toml");
  });
});
