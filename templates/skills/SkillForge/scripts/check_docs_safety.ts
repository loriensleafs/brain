/**
 * check_docs_safety.ts - Guard against unsafe hook command examples in docs.
 *
 * Flags markdown lines where $TOOL_INPUT or $TOOL_OUTPUT appear in command
 * strings without explicit quoting.
 *
 * Usage:
 *    bun scripts/check_docs_safety.ts
 *    bun scripts/check_docs_safety.ts SKILL.md references/script-integration-framework.md
 *
 * Exit codes:
 *    0 - no unsafe patterns found
 *    1 - unsafe patterns found
 *    2 - bad input / file read error
 */

import { resolve, dirname } from "path";

function getRepoRoot(): string {
  return resolve(dirname(Bun.main), "..");
}

function defaultTargets(repoRoot: string): string[] {
  return [
    resolve(repoRoot, "SKILL.md"),
    resolve(repoRoot, "references", "script-integration-framework.md"),
    resolve(repoRoot, "references", "synthesis-protocol.md"),
  ];
}

function isUnquotedToolVar(line: string, varName: string): boolean {
  const tokenA = `$${varName}`;
  const tokenB = `\${${varName}}`;
  if (!line.includes(tokenA) && !line.includes(tokenB)) {
    return false;
  }

  const safeForms = [`"$${varName}"`, `"\${${varName}}"`];
  return !safeForms.some((safe) => line.includes(safe));
}

function scanFile(filePath: string): string[] {
  const issues: string[] = [];
  let content: string;
  try {
    content = Bun.file(filePath).toString();
  } catch (exc) {
    throw new Error(`Cannot read ${filePath}: ${exc}`);
  }

  // Bun.file().toString() returns the path for non-text reads; use text() instead
  // Actually we need to read synchronously
  const file = Bun.file(filePath);
  const text = require("fs").readFileSync(filePath, "utf-8") as string;
  const lines = text.split("\n");

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (!line.includes("command:")) {
      continue;
    }
    if (
      isUnquotedToolVar(line, "TOOL_INPUT") ||
      isUnquotedToolVar(line, "TOOL_OUTPUT")
    ) {
      issues.push(`${filePath}:${idx + 1}: ${line.trim()}`);
    }
  }
  return issues;
}

function main(): number {
  const repoRoot = getRepoRoot();
  const args = process.argv.slice(2);
  const targets =
    args.length > 0
      ? args.map((arg) => resolve(arg))
      : defaultTargets(repoRoot);

  const allIssues: string[] = [];
  try {
    for (const target of targets) {
      allIssues.push(...scanFile(target));
    }
  } catch (exc) {
    console.error(String(exc));
    return 2;
  }

  if (allIssues.length > 0) {
    console.log("Unsafe command interpolation found:");
    for (const issue of allIssues) {
      console.log(`  - ${issue}`);
    }
    return 1;
  }

  console.log("No unsafe command interpolation patterns found.");
  return 0;
}

process.exit(main());
