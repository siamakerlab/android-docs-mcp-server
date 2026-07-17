import { describe, expect, it } from "vitest";
import { documentationUrl } from "./documentationUrl";
import type { ResolvedDependency } from "./types";

const dep = (over: Partial<ResolvedDependency>): ResolvedDependency => ({
  coordinate: "g:a",
  version: null,
  ecosystem: "maven",
  source: "test",
  ...over,
});

describe("documentationUrl", () => {
  it("maps a pinned Maven coordinate to a versioned javadoc.io URL", () => {
    expect(
      documentationUrl(
        dep({
          ecosystem: "maven",
          coordinate: "com.squareup.okhttp3:okhttp",
          version: "4.12.0",
        }),
      ),
    ).toBe("https://javadoc.io/static/com.squareup.okhttp3/okhttp/4.12.0/index.html");
  });

  it("maps a Maven coordinate without a pinned version to the latest doc page", () => {
    expect(
      documentationUrl(dep({ ecosystem: "maven", coordinate: "androidx.core:core-ktx" })),
    ).toBe("https://javadoc.io/doc/androidx.core/core-ktx");
  });

  it("returns null for a malformed Maven coordinate", () => {
    expect(
      documentationUrl(dep({ ecosystem: "maven", coordinate: "no-colon" })),
    ).toBeNull();
  });

  it("maps a pinned pub package to a versioned pub.dev URL", () => {
    expect(
      documentationUrl(
        dep({ ecosystem: "pub", coordinate: "provider", version: "6.1.1" }),
      ),
    ).toBe("https://pub.dev/packages/provider/versions/6.1.1");
  });

  it("maps a pub constraint version to the package page (not a version path)", () => {
    expect(
      documentationUrl(dep({ ecosystem: "pub", coordinate: "http", version: "^1.1.0" })),
    ).toBe("https://pub.dev/packages/http");
  });

  it("maps a gradle plugin id + version to plugins.gradle.org", () => {
    expect(
      documentationUrl(
        dep({
          ecosystem: "gradle-plugin",
          coordinate: "com.android.application",
          version: "8.2.0",
        }),
      ),
    ).toBe("https://plugins.gradle.org/plugin/com.android.application/8.2.0");
  });

  it("keeps prerelease pins but drops range/dynamic versions", () => {
    expect(documentationUrl(dep({ coordinate: "g:a", version: "1.0.0-alpha" }))).toBe(
      "https://javadoc.io/static/g/a/1.0.0-alpha/index.html",
    );
    // Dynamic / range versions are not path-safe pins → fall back to the /doc/ wrapper.
    expect(documentationUrl(dep({ coordinate: "g:a", version: "1.0.+" }))).toBe(
      "https://javadoc.io/doc/g/a",
    );
    expect(documentationUrl(dep({ coordinate: "g:a", version: ">=1.0.0" }))).toBe(
      "https://javadoc.io/doc/g/a",
    );
  });
});
