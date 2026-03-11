/**
 * Detect ADR file changes (create, update, delete) for automatic skill triggering.
 *
 * Monitors ADR file patterns in designated directories and detects changes
 * since the last check. Returns structured JSON output for skill orchestration.
 *
 * Patterns monitored:
 * - decisions/ADR-*.md (Brain folder - primary)
 * - docs/architecture/ADR-*.md (secondary)
 *
 * Exit codes follow ADR-035:
 *   0 - Success (changes detected or no changes found)
 *   1 - Logic or unexpected error during detection
 *   2 - Config/user error (invalid commit SHA, missing file)
 *   3 - External error (I/O failure, git command failure)
 */

import { resolve, basename } from "path";
import {
  readdirSync,
  existsSync,
  statSync,
  mkdirSync,
  readFileSync,
} from "fs";

const ADR_PATTERNS: readonly string[] = [
  "decisions/ADR-*.md",
  "docs/architecture/ADR-*.md",
];

const ADR_DIRECTORIES: readonly string[] = [
  "decisions",
  "docs/architecture",
];

interface ParsedArgs {
  readonly basePath: string;
  readonly sinceCommit: string;
  readonly includeUntracked: boolean;
}

interface DeletedDetail {
  readonly Path: string;
  readonly ADRName: string;
  readonly Status: string;
  readonly Dependents: readonly string[];
}

interface DetectionResult {
  readonly Created: readonly string[];
  readonly Modified: readonly string[];
  readonly Deleted: readonly string[];
  readonly DeletedDetails: readonly DeletedDetail[];
  readonly HasChanges: boolean;
  readonly RecommendedAction: string;
  readonly Timestamp: string;
  readonly SinceCommit: string;
}

interface GitResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function getAdrStatus(filePath: string): string {
  if (!existsSync(filePath)) {
    return "unknown";
  }
  try {
    const text = readFileSync(filePath, "utf-8");
    const match = text.match(/^status:\s*(.+)$/m);
    if (match) {
      return match[1].trim().toLowerCase();
    }
    return "proposed";
  } catch {
    return "unknown";
  }
}

function getDependentAdrs(adrName: string, basePath: string): string[] {
  const dependents: string[] = [];
  for (const directory of ADR_DIRECTORIES) {
    const dirPath = resolve(basePath, directory);
    if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
      continue;
    }
    let entries: string[];
    try {
      entries = readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.startsWith("ADR-") || !entry.endsWith(".md")) {
        continue;
      }
      const fullPath = resolve(dirPath, entry);
      try {
        const content = readFileSync(fullPath, "utf-8");
        if (content.includes(adrName)) {
          dependents.push(fullPath);
        }
      } catch {
        continue;
      }
    }
  }
  return dependents;
}

async function runGit(args: readonly string[], cwd: string): Promise<GitResult> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}

function parseArgs(argv: readonly string[]): ParsedArgs | null {
  let basePath = ".";
  let sinceCommit = "HEAD~1";
  let includeUntracked = false;

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        printUsage();
        return null;
      case "--base-path":
        i++;
        if (i >= argv.length) {
          console.error("Error: --base-path requires a value");
          process.exit(2);
        }
        basePath = argv[i];
        break;
      case "--since-commit":
        i++;
        if (i >= argv.length) {
          console.error("Error: --since-commit requires a value");
          process.exit(2);
        }
        sinceCommit = argv[i];
        break;
      case "--include-untracked":
        includeUntracked = true;
        break;
      default:
        console.error(`Error: Unknown argument: ${arg}`);
        process.exit(2);
    }
    i++;
  }

  return { basePath, sinceCommit, includeUntracked };
}

function printUsage(): void {
  console.log(
    `Usage: detect_adr_changes.ts [OPTIONS]

Detect ADR file changes for automatic skill triggering.

Options:
  --base-path PATH         Repository root path (default: current directory)
  --since-commit SHA       Git commit SHA to compare against (default: HEAD~1)
  --include-untracked      Include untracked new ADR files in detection
  -h, --help               Show this help message`,
  );
}

async function main(argv?: readonly string[]): Promise<number> {
  const args = parseArgs(argv ?? []);
  if (args === null) {
    return 0;
  }

  const basePath = resolve(args.basePath);

  if (!existsSync(resolve(basePath, ".git"))) {
    console.error(`Error: Not a git repository: ${basePath}`);
    return 1;
  }

  const agentsDir = resolve(basePath, ".agents");
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true });
  }

  try {
    const created: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const pattern of ADR_PATTERNS) {
      const result = await runGit(
        ["diff", "--name-status", args.sinceCommit, "--", pattern],
        basePath,
      );
      if (result.exitCode !== 0) {
        console.error(
          `Error: git diff failed for pattern '${pattern}': ${result.stderr.trim()}`,
        );
        return 3;
      }

      for (const line of result.stdout.trim().split("\n")) {
        if (!line) continue;
        const match = line.match(/^([AMD])\s+(.+)$/);
        if (match) {
          const statusChar = match[1];
          const filePath = match[2];
          if (statusChar === "A") {
            created.push(filePath);
          } else if (statusChar === "M") {
            modified.push(filePath);
          } else if (statusChar === "D") {
            deleted.push(filePath);
          }
        }
      }
    }

    if (args.includeUntracked) {
      for (const directory of ADR_DIRECTORIES) {
        const dirPath = resolve(basePath, directory);
        if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
          continue;
        }
        const result = await runGit(
          ["ls-files", "--others", "--exclude-standard", "--", `${directory}/ADR-*.md`],
          basePath,
        );
        if (result.exitCode !== 0) {
          console.error(
            `Warning: git ls-files failed for '${directory}': ${result.stderr.trim()}`,
          );
          continue;
        }
        for (const line of result.stdout.trim().split("\n")) {
          if (line) {
            created.push(line);
          }
        }
      }
    }

    const uniqueCreated = [...new Set(created)].sort();
    const uniqueModified = [...new Set(modified)].sort();
    const uniqueDeleted = [...new Set(deleted)].sort();

    let recommendedAction = "none";
    if (uniqueCreated.length > 0) {
      recommendedAction = "review";
    } else if (uniqueModified.length > 0) {
      recommendedAction = "review";
    } else if (uniqueDeleted.length > 0) {
      recommendedAction = "archive";
    }

    const deletedDetails: DeletedDetail[] = uniqueDeleted.map((filePath) => {
      const adrName = basename(filePath, ".md");
      const dependents = getDependentAdrs(adrName, basePath);
      return {
        Path: filePath,
        ADRName: adrName,
        Status: "deleted",
        Dependents: dependents,
      };
    });

    const resultObj: DetectionResult = {
      Created: uniqueCreated,
      Modified: uniqueModified,
      Deleted: uniqueDeleted,
      DeletedDetails: deletedDetails,
      HasChanges: uniqueCreated.length + uniqueModified.length + uniqueDeleted.length > 0,
      RecommendedAction: recommendedAction,
      Timestamp: new Date().toISOString(),
      SinceCommit: args.sinceCommit,
    };

    console.log(JSON.stringify(resultObj, null, 2));
    return 0;
  } catch (error) {
    if (error instanceof TypeError && String(error).includes("no such file")) {
      console.error(`Error: File or directory not found: ${error}`);
      return 2;
    }
    if (error instanceof Error && error.message.includes("I/O")) {
      console.error(`Error: I/O failure: ${error}`);
      return 3;
    }
    console.error(`Error detecting ADR changes: ${error}`);
    return 1;
  }
}

// CLI entrypoint
if (import.meta.main) {
  const exitCode = await main(process.argv.slice(2));
  process.exit(exitCode);
}

export {
  main,
  getAdrStatus,
  getDependentAdrs,
  parseArgs,
  runGit,
  ADR_PATTERNS,
  ADR_DIRECTORIES,
};
export type { ParsedArgs, DetectionResult, DeletedDetail, GitResult };
