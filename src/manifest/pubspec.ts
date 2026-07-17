/**
 * Parser for Flutter/Dart `pubspec.yaml` manifests.
 *
 * Reads the `dependencies` and `dev_dependencies` sections and normalizes each
 * entry into a pub coordinate (package name) plus its declared version constraint.
 * SDK / git / path dependencies have no pub version and are reported with a note.
 */

import { parse as parseYaml } from "yaml";
import {
  asRecord,
  asString,
  type ManifestParseResult,
  type ResolvedDependency,
} from "./types";

const SECTIONS = ["dependencies", "dev_dependencies"] as const;

/**
 * Parse a `pubspec.yaml` into normalized pub dependencies.
 *
 * @param content - Raw `pubspec.yaml` content.
 * @param source - Manifest path for provenance/warnings (default `pubspec.yaml`).
 */
export function parsePubspec(
  content: string,
  source = "pubspec.yaml",
): ManifestParseResult {
  const dependencies: ResolvedDependency[] = [];
  const warnings: string[] = [];

  let doc: Record<string, unknown> | undefined;
  try {
    doc = asRecord(parseYaml(content));
  } catch (error) {
    return {
      dependencies: [],
      warnings: [`${source}: failed to parse YAML: ${(error as Error).message}`],
    };
  }
  if (!doc) {
    return { dependencies: [], warnings: [`${source}: empty or invalid pubspec`] };
  }

  for (const section of SECTIONS) {
    const deps = asRecord(doc[section]);
    if (!deps) {
      continue;
    }

    for (const [name, spec] of Object.entries(deps)) {
      let version: string | null = null;

      const direct = asString(spec);
      if (direct !== undefined) {
        // e.g. "^1.1.0", "1.2.3", "any"
        version = direct;
      } else {
        const obj = asRecord(spec);
        if (obj) {
          const explicit = asString(obj.version);
          if (explicit !== undefined) {
            version = explicit;
          } else if ("sdk" in obj) {
            warnings.push(`${source}: "${name}" is an SDK dependency (no pub version)`);
          } else if ("git" in obj) {
            warnings.push(`${source}: "${name}" is a git dependency (no pub version)`);
          } else if ("path" in obj) {
            warnings.push(`${source}: "${name}" is a path dependency (no pub version)`);
          }
        }
      }

      dependencies.push({ coordinate: name, version, ecosystem: "pub", source });
    }
  }

  return { dependencies, warnings };
}
