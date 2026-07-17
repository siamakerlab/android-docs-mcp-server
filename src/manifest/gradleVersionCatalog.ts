/**
 * Parser for Gradle Version Catalogs (`gradle/libs.versions.toml`), the modern,
 * declarative standard for declaring dependency and plugin versions in Android /
 * Gradle projects.
 *
 * Handles the `[versions]`, `[libraries]`, and `[plugins]` tables, resolving
 * `version.ref` pointers against `[versions]` and supporting the `module`,
 * `group`+`name`, and string-shorthand library forms.
 */

import { parse } from "smol-toml";
import {
  asRecord,
  asString,
  type ManifestParseResult,
  type ResolvedDependency,
} from "./types";

/**
 * Resolve a library/plugin `version` field (string, `{ ref }`, or a Gradle rich
 * version like `{ require }`) into a concrete version string, or `null`.
 */
function resolveVersion(
  version: unknown,
  versions: Record<string, unknown>,
  entryName: string,
  source: string,
  warnings: string[],
): string | null {
  const direct = asString(version);
  if (direct !== undefined) {
    return direct;
  }
  const obj = asRecord(version);
  if (!obj) {
    return null;
  }
  const ref = asString(obj.ref);
  if (ref !== undefined) {
    const resolved = asString(versions[ref]);
    if (resolved !== undefined) {
      return resolved;
    }
    warnings.push(
      `${source}: version ref "${ref}" for "${entryName}" is not defined in [versions]`,
    );
    return null;
  }
  // Gradle rich versions: prefer strictly > require > prefer.
  return asString(obj.strictly) ?? asString(obj.require) ?? asString(obj.prefer) ?? null;
}

/**
 * Parse a Gradle version catalog into normalized dependencies.
 *
 * @param content - Raw `libs.versions.toml` content.
 * @param source - Manifest path for provenance/warnings (default `gradle/libs.versions.toml`).
 */
export function parseGradleVersionCatalog(
  content: string,
  source = "gradle/libs.versions.toml",
): ManifestParseResult {
  const dependencies: ResolvedDependency[] = [];
  const warnings: string[] = [];

  let root: Record<string, unknown> | undefined;
  try {
    root = asRecord(parse(content));
  } catch (error) {
    return {
      dependencies: [],
      warnings: [`${source}: failed to parse TOML: ${(error as Error).message}`],
    };
  }
  if (!root) {
    return { dependencies: [], warnings: [`${source}: empty or invalid catalog`] };
  }

  const versions = asRecord(root.versions) ?? {};

  // [libraries] → maven coordinates (group:artifact)
  const libraries = asRecord(root.libraries) ?? {};
  for (const [name, entry] of Object.entries(libraries)) {
    let coordinate: string | undefined;
    let version: string | null = null;

    const shorthand = asString(entry);
    if (shorthand !== undefined) {
      // "group:artifact:version" or "group:artifact"
      const parts = shorthand.split(":");
      if (parts.length >= 2) {
        coordinate = `${parts[0]}:${parts[1]}`;
        version = parts[2] ?? null;
      }
    } else {
      const obj = asRecord(entry);
      if (obj) {
        const module = asString(obj.module);
        const group = asString(obj.group);
        const artifact = asString(obj.name);
        if (module !== undefined) {
          coordinate = module;
        } else if (group !== undefined && artifact !== undefined) {
          coordinate = `${group}:${artifact}`;
        }
        version = resolveVersion(obj.version, versions, name, source, warnings);
      }
    }

    if (coordinate) {
      dependencies.push({ coordinate, version, ecosystem: "maven", source });
    } else {
      warnings.push(`${source}: could not parse library "${name}"`);
    }
  }

  // [plugins] → gradle plugin ids
  const plugins = asRecord(root.plugins) ?? {};
  for (const [name, entry] of Object.entries(plugins)) {
    let coordinate: string | undefined;
    let version: string | null = null;

    const shorthand = asString(entry);
    if (shorthand !== undefined) {
      // "plugin.id:version"
      const idx = shorthand.lastIndexOf(":");
      if (idx > 0) {
        coordinate = shorthand.slice(0, idx);
        version = shorthand.slice(idx + 1);
      } else {
        coordinate = shorthand;
      }
    } else {
      const obj = asRecord(entry);
      if (obj) {
        coordinate = asString(obj.id);
        version = resolveVersion(obj.version, versions, name, source, warnings);
      }
    }

    if (coordinate) {
      dependencies.push({ coordinate, version, ecosystem: "gradle-plugin", source });
    } else {
      warnings.push(`${source}: could not parse plugin "${name}"`);
    }
  }

  return { dependencies, warnings };
}
