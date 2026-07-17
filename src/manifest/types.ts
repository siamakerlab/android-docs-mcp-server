/**
 * Shared types for build-manifest parsing.
 *
 * These parsers read a project's dependency manifests (Gradle version catalogs,
 * Flutter `pubspec.yaml`, …) and normalize the declared dependencies into a flat,
 * ecosystem-tagged list so downstream tools can resolve version-specific docs.
 */

/** The dependency ecosystem a coordinate belongs to. */
export type Ecosystem = "maven" | "pub" | "gradle-plugin";

/**
 * A single dependency declared in a project manifest.
 */
export interface ResolvedDependency {
  /**
   * Ecosystem-native identifier:
   * - `maven` → `group:artifact` (e.g. `androidx.core:core-ktx`)
   * - `pub` → package name (e.g. `provider`)
   * - `gradle-plugin` → plugin id (e.g. `com.android.application`)
   */
  coordinate: string;
  /**
   * The declared version as written in the manifest (may be a constraint such as
   * `^1.1.0`), or `null` when it cannot be resolved statically (unresolved catalog
   * ref, SDK/git/path dependency, dynamic version).
   */
  version: string | null;
  /** The ecosystem this coordinate belongs to. */
  ecosystem: Ecosystem;
  /** The manifest file the dependency was declared in. */
  source: string;
}

/**
 * The result of parsing a single manifest: the resolved dependencies plus any
 * non-fatal notes (unresolved refs, dynamic versions, unparseable entries).
 */
export interface ManifestParseResult {
  dependencies: ResolvedDependency[];
  warnings: string[];
}

/** Narrow an unknown value to a plain object. */
export function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Narrow an unknown value to a string. */
export function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
