#!/usr/bin/env bun
/**
 * Fix malformed markdown code fence closings.
 *
 * Scans markdown files and repairs closing fences that incorrectly include
 * language identifiers (```python instead of ```).
 *
 * EXIT CODES (ADR-035):
 *    0 - Success: Fences fixed or no issues found
 */

import { Glob } from "bun";

const OPENING_PATTERN = /^(\s*)```(\w+)/;
const CLOSING_PATTERN = /^(\s*)```\s*$/;

function repairMarkdownFences(content: string): string {
  const lines = content.split(/\r?\n/);
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockIndent = "";

  for (const line of lines) {
    const openingMatch = line.match(OPENING_PATTERN);
    const closingMatch = line.match(CLOSING_PATTERN);

    if (openingMatch) {
      if (inCodeBlock) {
        result.push(codeBlockIndent + "```");
      }
      result.push(line);
      codeBlockIndent = openingMatch[1];
      inCodeBlock = true;
    } else if (closingMatch) {
      result.push(line);
      inCodeBlock = false;
      codeBlockIndent = "";
    } else {
      result.push(line);
    }
  }

  if (inCodeBlock) {
    result.push(codeBlockIndent + "```");
  }

  return result.join("\n");
}

async function fixFences(
  directories: string[],
  pattern: string = "*.md",
): Promise<number> {
  let totalFixed = 0;

  for (const directory of directories) {
    const dirFile = Bun.file(directory);
    const stat = await dirFile.exists();
    if (!stat) {
      console.error(`Warning: Directory does not exist: ${directory}`);
      continue;
    }

    const glob = new Glob(`**/${pattern}`);

    for await (const path of glob.scan({ cwd: directory })) {
      const fullPath = `${directory}/${path}`;
      const file = Bun.file(fullPath);

      let content: string;
      try {
        content = await file.text();
      } catch {
        continue;
      }

      if (!content) {
        continue;
      }

      const fixedContent = repairMarkdownFences(content);
      if (content !== fixedContent) {
        await Bun.write(fullPath, fixedContent);
        totalFixed += 1;
      }
    }
  }

  return totalFixed;
}

function parseArgs(): { directories: string[]; pattern: string } {
  const args = process.argv.slice(2);
  let directories: string[] = ["."];
  let pattern = "*.md";

  let i = 0;
  while (i < args.length) {
    if (args[i] === "--directories") {
      directories = [];
      i++;
      while (i < args.length && !args[i].startsWith("--")) {
        directories.push(args[i]);
        i++;
      }
    } else if (args[i] === "--pattern") {
      i++;
      if (i < args.length) {
        pattern = args[i];
        i++;
      }
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log("Usage: fix_fences.ts [--directories dir1 dir2 ...] [--pattern *.md]");
      console.log("\nFix malformed markdown code fence closings");
      console.log("\nOptions:");
      console.log("  --directories  Directories to scan (default: [\".\"])");
      console.log("  --pattern      File pattern to match (default: *.md)");
      process.exit(0);
    } else {
      i++;
    }
  }

  return { directories, pattern };
}

async function main(): Promise<number> {
  const { directories, pattern } = parseArgs();
  const totalFixed = await fixFences(directories, pattern);

  if (totalFixed === 0) {
    console.log("No files needed fixing");
  } else {
    console.log(`\nTotal: fixed ${totalFixed} file(s)`);
  }

  return 0;
}

process.exit(await main());
