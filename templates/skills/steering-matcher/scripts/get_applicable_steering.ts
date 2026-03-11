#!/usr/bin/env bun
/**
 * Match file paths against steering file glob patterns.
 *
 * Analyzes file paths and returns applicable steering files based on glob
 * pattern matching. Steering files are sorted by priority (higher first).
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid parameters / logic error
 */

import { resolve } from "path";

interface SteeringMatch {
  name: string;
  path: string;
  apply_to: string;
  exclude_from: string | null;
  priority: number;
}

function globToRegex(pattern: string): RegExp {
  let p = pattern.replace(/\\/g, "/");

  // Protect globstar patterns before processing single-char wildcards
  p = p.replace(/\*\*\//g, "<!GLOBSTAR_SLASH!>");
  p = p.replace(/\/\*\*/g, "<!SLASH_GLOBSTAR!>");

  // Handle standalone ** at start/end
  if (p.startsWith("**")) {
    p = "<!START_GLOBSTAR!>" + p.slice(2);
  }
  if (p.endsWith("**")) {
    p = p.slice(0, -2) + "<!END_GLOBSTAR!>";
  }

  // Escape dots before processing wildcards
  p = p.replace(/\./g, "\\.");

  // Convert single wildcards
  p = p.replace(/\?/g, ".");
  p = p.replace(/\*/g, "[^/]*");

  // Restore globstar patterns
  p = p.replace(/<!GLOBSTAR_SLASH!>/g, "(?:.+/|)");
  p = p.replace(/<!SLASH_GLOBSTAR!>/g, "/.*");
  p = p.replace(/<!START_GLOBSTAR!>/g, ".*");
  p = p.replace(/<!END_GLOBSTAR!>/g, ".*");

  return new RegExp(`^${p}$`);
}

function fileMatchesPatterns(filePath: string, patterns: string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return patterns.some((pattern) => {
    const normalizedPattern = pattern.replace(/\\/g, "/");
    const regex = globToRegex(normalizedPattern);
    return regex.test(normalized);
  });
}

async function getApplicableSteering(
  files: string[],
  steeringPath: string = ".agents/steering",
): Promise<SteeringMatch[]> {
  if (files.length === 0) return [];

  const { readdirSync, readFileSync, statSync } = await import("fs");

  let entries: string[];
  try {
    entries = readdirSync(steeringPath);
  } catch {
    return [];
  }

  const frontMatterRe = /^---\s*\n([\s\S]*?)\n---/;
  const applicable: SteeringMatch[] = [];

  const mdFiles = entries.filter((e) => e.endsWith(".md") && e !== "README.md" && e !== "SKILL.md");
  mdFiles.sort();

  for (const filename of mdFiles) {
    const fullPath = resolve(steeringPath, filename);
    try {
      const stat = statSync(fullPath);
      if (!stat.isFile()) continue;
    } catch {
      continue;
    }

    let content: string;
    try {
      content = readFileSync(fullPath, "utf-8");
    } catch {
      continue;
    }

    const fmMatch = frontMatterRe.exec(content);
    if (!fmMatch) continue;

    const frontMatter = fmMatch[1];

    const applyToMatch = /applyTo:\s*"([^"]+)"/.exec(frontMatter);
    if (!applyToMatch) continue;
    const applyTo = applyToMatch[1];

    const excludeMatch = /excludeFrom:\s*"([^"]+)"/.exec(frontMatter);
    const excludeFrom = excludeMatch ? excludeMatch[1] : null;

    const priorityMatch = /priority:\s*(\d+)/.exec(frontMatter);
    const priority = priorityMatch ? parseInt(priorityMatch[1], 10) : 5;

    const includePatterns = applyTo.split(",").map((p) => p.trim());
    const excludePatterns = excludeFrom ? excludeFrom.split(",").map((p) => p.trim()) : [];

    for (const filePath of files) {
      const matchesInclude = fileMatchesPatterns(filePath, includePatterns);
      const matchesExclude = excludePatterns.length > 0
        ? fileMatchesPatterns(filePath, excludePatterns)
        : false;

      if (matchesInclude && !matchesExclude) {
        applicable.push({
          name: filename.replace(/\.md$/, ""),
          path: fullPath,
          apply_to: applyTo,
          exclude_from: excludeFrom,
          priority,
        });
        break;
      }
    }
  }

  applicable.sort((a, b) => b.priority - a.priority);
  return applicable;
}

function parseArgs(argv: string[]): { files: string[]; steeringPath: string } {
  const files: string[] = [];
  let steeringPath = ".agents/steering";
  let collectingFiles = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--files") {
      collectingFiles = true;
      continue;
    }
    if (argv[i] === "--steering-path") {
      collectingFiles = false;
      steeringPath = argv[++i];
      continue;
    }
    if (argv[i]?.startsWith("--")) {
      collectingFiles = false;
      continue;
    }
    if (collectingFiles) {
      files.push(argv[i]);
    }
  }

  if (files.length === 0) {
    console.error("ERROR: --files is required");
    process.exit(1);
  }

  return { files, steeringPath };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await getApplicableSteering(args.files, args.steeringPath);
  console.log(JSON.stringify(result, null, 2));
}

main();

export { getApplicableSteering, fileMatchesPatterns, globToRegex };
export type { SteeringMatch };
