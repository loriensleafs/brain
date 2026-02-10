#!/usr/bin/env bun
/**
 * Brain adapter sync orchestrator.
 *
 * Main entry point for transforming canonical Brain content into tool-specific
 * plugin formats. Called by the Go CLI (`brain install`, `brain claude`) via:
 *   bun adapters/sync.ts --target claude-code --output /path/to/output
 *
 * Usage:
 *   bun adapters/sync.ts --target <tool> [--output <dir>] [--project <dir>] [--dry-run] [--json]
 *
 * Options:
 *   --target    Target tool: "claude-code" or "cursor" (required)
 *   --output    Output directory (required unless --dry-run or --json)
 *   --project   Project root directory (defaults to cwd)
 *   --dry-run   Print what would be generated without writing
 *   --json      Output generated file list as JSON to stdout (for Go CLI consumption)
 */

import { dirname, join, resolve } from "path";
import { transform as claudeCodeTransform } from "./claude-code.js";
import type { GeneratedFile } from "./shared.js";
import { readBrainConfig } from "./shared.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SyncOptions {
  target: string;
  output?: string;
  projectRoot: string;
  dryRun: boolean;
  jsonOutput: boolean;
}

interface SyncResult {
  target: string;
  files: Array<{ relativePath: string; size: number }>;
  totalFiles: number;
  errors: string[];
}

// ─── Argument Parsing ────────────────────────────────────────────────────────

function parseArgs(args: string[]): SyncOptions {
  let target = "";
  let output: string | undefined;
  let projectRoot = process.cwd();
  let dryRun = false;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--target":
        target = args[++i] ?? "";
        break;
      case "--output":
        output = args[++i];
        break;
      case "--project":
        projectRoot = resolve(args[++i] ?? ".");
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--json":
        jsonOutput = true;
        break;
    }
  }

  if (!target) {
    console.error(
      "Error: --target is required (claude-code or cursor)",
    );
    process.exit(1);
  }

  if (!dryRun && !jsonOutput && !output) {
    console.error(
      "Error: --output is required unless --dry-run or --json is specified",
    );
    process.exit(1);
  }

  return { target, output, projectRoot, dryRun, jsonOutput };
}

// ─── File Writing ────────────────────────────────────────────────────────────

async function writeGeneratedFiles(
  files: GeneratedFile[],
  outputDir: string,
): Promise<{ written: number; errors: string[] }> {
  let written = 0;
  const errors: string[] = [];

  for (const file of files) {
    const fullPath = join(outputDir, file.relativePath);
    try {
      const dir = dirname(fullPath);
      await Bun.$`mkdir -p ${dir}`.quiet();
      await Bun.write(fullPath, file.content);
      written++;
    } catch (err) {
      errors.push(
        `Failed to write ${file.relativePath}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { written, errors };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  // Read brain.config.json
  let brainConfig;
  try {
    brainConfig = await readBrainConfig(opts.projectRoot);
  } catch (err) {
    console.error(
      `Error reading brain.config.json: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  // Validate target
  if (!brainConfig.targets.includes(opts.target)) {
    console.error(
      `Error: target "${opts.target}" not in brain.config.json targets: [${brainConfig.targets.join(", ")}]`,
    );
    process.exit(1);
  }

  // Run transform for the requested target
  let allFiles: GeneratedFile[];

  switch (opts.target) {
    case "claude-code": {
      const output = await claudeCodeTransform(opts.projectRoot, brainConfig);
      allFiles = [
        ...output.agents,
        ...output.skills,
        ...output.commands,
        ...output.rules,
        ...output.hooks,
        ...output.mcp,
        ...output.plugin,
      ];
      break;
    }
    case "cursor":
      console.error("Error: cursor adapter not yet implemented (Phase 2)");
      process.exit(1);
    default:
      console.error(`Error: unknown target "${opts.target}"`);
      process.exit(1);
  }

  const result: SyncResult = {
    target: opts.target,
    files: allFiles.map((f) => ({
      relativePath: f.relativePath,
      size: Buffer.byteLength(f.content),
    })),
    totalFiles: allFiles.length,
    errors: [],
  };

  // JSON output mode (for Go CLI)
  if (opts.jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // Dry-run mode
  if (opts.dryRun) {
    console.log(`Target: ${opts.target}`);
    console.log(`Files to generate: ${allFiles.length}`);
    for (const file of result.files) {
      console.log(`  ${file.relativePath} (${file.size} bytes)`);
    }
    return;
  }

  // Write files
  if (!opts.output) {
    console.error("Error: --output is required for writing");
    process.exit(1);
  }

  const { written, errors } = await writeGeneratedFiles(allFiles, opts.output);
  result.errors = errors;

  console.log(`Target: ${opts.target}`);
  console.log(`Written: ${written}/${allFiles.length} files to ${opts.output}`);
  if (errors.length > 0) {
    console.error("Errors:");
    for (const err of errors) {
      console.error(`  ${err}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(
    `Fatal: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
