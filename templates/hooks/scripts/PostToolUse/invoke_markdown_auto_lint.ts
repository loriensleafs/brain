#!/usr/bin/env bun
/**
 * Auto-lint markdown files after Write/Edit operations.
 *
 * Claude Code PostToolUse hook that automatically runs markdownlint-cli2 --fix
 * on .md files after they are written or edited. This ensures consistent markdown
 * formatting across the project without manual intervention.
 *
 * Hook Type: PostToolUse
 * Matcher: Write|Edit
 * Filter: .md files only
 * Exit Codes (Claude Hook Semantics, exempt from ADR-035):
 *     0 = Always (non-blocking hook, all errors are warnings)
 */

import { resolve, sep } from "path";
import { $ } from "bun";

interface HookInput {
  readonly tool_input?: {
    readonly file_path?: string;
  };
  readonly cwd?: string;
}

function getFilePathFromInput(hookInput: HookInput): string | null {
  const filePath = hookInput.tool_input?.file_path;
  if (typeof filePath === "string" && filePath.trim()) {
    return filePath.trim();
  }
  return null;
}

function getProjectDirectory(hookInput: HookInput): string {
  const envDir = (process.env["CLAUDE_PROJECT_DIR"] ?? "").trim();
  if (envDir) return envDir;
  const cwd = hookInput.cwd;
  if (typeof cwd === "string" && cwd.trim()) return cwd.trim();
  return process.cwd();
}

async function shouldLintFile(
  filePath: string | null,
  projectDir: string,
): Promise<boolean> {
  if (!filePath) return false;
  if (!filePath.toLowerCase().endsWith(".md")) return false;

  const resolvedFile = resolve(filePath);
  const resolvedProject = resolve(projectDir);

  if (!resolvedFile.startsWith(resolvedProject + sep)) {
    console.error(`WARNING: Path outside project directory: ${filePath}`);
    return false;
  }

  const file = Bun.file(resolvedFile);
  if (!(await file.exists())) {
    console.error(`WARNING: Markdown file does not exist: ${filePath}`);
    return false;
  }

  return true;
}

async function main(): Promise<number> {
  // Check npx availability
  const npxCheck = await $`which npx`.nothrow().quiet();
  if (npxCheck.exitCode !== 0) {
    console.error(
      "[SKIP] npx not found. Install Node.js for markdown auto-linting.",
    );
    return 0;
  }

  let hookInput: HookInput;
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;
    hookInput = JSON.parse(inputJson) as HookInput;
  } catch {
    console.error(
      "WARNING: Markdown auto-lint: Failed to parse hook input JSON",
    );
    return 0;
  }

  const filePath = getFilePathFromInput(hookInput);
  const projectDir = getProjectDirectory(hookInput);

  if (!(await shouldLintFile(filePath, projectDir)) || filePath === null) {
    return 0;
  }

  try {
    const result = await $`npx markdownlint-cli2 --fix ${filePath}`
      .cwd(projectDir)
      .nothrow()
      .quiet();

    if (result.exitCode !== 0) {
      const output = (result.stderr.toString() || result.stdout.toString())
        .trim();

      if (!output) {
        console.error(
          `WARNING: Markdown linting failed for ${filePath} ` +
            `(exit ${result.exitCode}) with no output. ` +
            "Linter may not be installed.",
        );
        console.log(
          "\n**Markdown Auto-Lint WARNING**: Linter failed with no output. " +
            "Verify installation: `npm list markdownlint-cli2`\n",
        );
      } else {
        const errorSummary = output.slice(0, 200);
        console.error(
          `WARNING: Markdown linting failed for ${filePath} ` +
            `(exit ${result.exitCode}): ${errorSummary}`,
        );
        console.log(
          `\n**Markdown Auto-Lint WARNING**: Failed to lint \`${filePath}\`. ` +
            `Exit code: ${result.exitCode}. ` +
            `Run manually: \`npx markdownlint-cli2 --fix '${filePath}'\`\n`,
        );
      }
    } else {
      console.log(
        `\n**Markdown Auto-Lint**: Fixed formatting in \`${filePath}\`\n`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("ENOENT")
    ) {
      console.error(`WARNING: npx not found. Cannot lint ${filePath}`);
      console.log(
        "\n**Markdown Auto-Lint WARNING**: npx not found. " +
          "Install Node.js and markdownlint-cli2.\n",
      );
    } else {
      console.error(
        `WARNING: Markdown auto-lint: File system error for ${filePath}: ${error}`,
      );
      console.log(
        `\n**Markdown Auto-Lint ERROR**: Cannot access file \`${filePath}\`. ` +
          "Check permissions.\n",
      );
    }
  }

  return 0;
}

process.exit(await main());
