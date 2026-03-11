#!/usr/bin/env bun
/**
 * Pre-commit hook to validate staged slash command files.
 *
 * Git pre-commit hook helper (called from .githooks/pre-commit), NOT a Claude Code hook.
 * Validates slash command frontmatter on staged .md files under .claude/commands/.
 *
 * Uses standard POSIX exit codes (not Claude Hook Semantics):
 *     0 = All validations passed (or no files to validate)
 *     1 = One or more files failed validation
 */

import { resolve, join } from "path";
import { $ } from "bun";

/** Project root: this script lives at .claude/hooks/scripts/pre_commit_slash_commands.ts */
const PROJECT_ROOT = resolve(import.meta.dir, "..", "..", "..");

const VALIDATION_SCRIPT = join(
  PROJECT_ROOT,
  ".claude",
  "skills",
  "slashcommandcreator",
  "scripts",
  "validate_slash_command.ts",
);

async function getStagedSlashCommands(): Promise<string[]> {
  const result = await $`git diff --cached --name-only --diff-filter=ACM`
    .nothrow()
    .quiet();

  if (result.exitCode !== 0) return [];

  return result.stdout
    .toString()
    .split("\n")
    .map((line: string) => line.trim())
    .filter(
      (line: string) =>
        line.startsWith(".claude/commands/") && line.endsWith(".md"),
    );
}

async function validateFile(filePath: string): Promise<boolean> {
  const result = await $`bun run ${VALIDATION_SCRIPT} --path ${filePath}`
    .nothrow()
    .quiet();

  return result.exitCode === 0;
}

async function main(): Promise<number> {
  console.log("Validating staged slash commands...");

  const stagedFiles = await getStagedSlashCommands();

  if (stagedFiles.length === 0) {
    console.log("[SKIP] No slash command files staged, skipping validation");
    return 0;
  }

  console.log(`Found ${stagedFiles.length} staged slash command(s)`);

  const failedFiles: string[] = [];

  for (const filePath of stagedFiles) {
    console.log(`\nValidating: ${filePath}`);
    if (!(await validateFile(filePath))) {
      failedFiles.push(filePath);
    }
  }

  if (failedFiles.length > 0) {
    console.log(
      `\n[FAIL] COMMIT BLOCKED: ${failedFiles.length} file(s) failed validation`,
    );
    console.log("\nFailed files:");
    for (const f of failedFiles) {
      console.log(`  - ${f}`);
    }
    console.log("\nFix violations and try again.");
    console.log(
      "Emergency bypass (if validation script has bugs): git commit --no-verify",
    );
    return 1;
  }

  console.log("\n[PASS] All slash commands passed validation");
  return 0;
}

process.exit(await main());
