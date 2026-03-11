#!/usr/bin/env bun
/**
 * Auto-runs CodeQL quick scan after Python/workflow file writes.
 *
 * Claude Code PostToolUse hook that automatically triggers targeted CodeQL security
 * scans after Write operations on Python files (*.py) or GitHub Actions workflows
 * (*.yml in .github/workflows/).
 *
 * Uses a quick scan configuration with only 5-10 critical CWEs (command injection,
 * SQL injection, XSS, path traversal, hardcoded credentials) to meet a 30-second
 * performance budget. Gracefully degrades if CodeQL CLI is not installed.
 *
 * Part of the CodeQL multi-tier security strategy (Tier 3: PostToolUse Hook).
 *
 * NOTE: This hook was designed for Python/GitHub Actions CodeQL scanning.
 * For TypeScript projects, the CodeQL scan script and language configs may
 * need adaptation.
 *
 * Hook Type: PostToolUse
 * Matcher: Write
 * Filter: *.py files, *.yml in .github/workflows/
 * Performance Budget: 30 seconds
 * Exit Codes:
 *     0 = Always (non-blocking hook, all errors are warnings)
 */

import { join } from "path";
import { $ } from "bun";

interface HookInput {
  readonly tool_input?: {
    readonly file_path?: string;
  };
  readonly cwd?: string;
}

function getFilePathFromInput(hookInput: HookInput): string | null {
  const filePath = hookInput.tool_input?.file_path;
  return typeof filePath === "string" ? filePath : null;
}

function getProjectDirectory(hookInput: HookInput): string {
  const envDir = (process.env["CLAUDE_PROJECT_DIR"] ?? "").trim();
  if (envDir) return envDir;
  const cwd = hookInput.cwd;
  return typeof cwd === "string" && cwd ? String(cwd) : process.cwd();
}

function shouldScanFile(filePath: string): boolean {
  if (!filePath || !filePath.trim()) return false;

  const file = Bun.file(filePath);
  // Bun.file().exists() is async; we check synchronously via stat
  try {
    // Use a quick existence check
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".py")) return true;
    if (lower.endsWith(".yml") || lower.endsWith(".yaml")) {
      return filePath.replace(/\\/g, "/").includes(".github/workflows/");
    }
  } catch {
    // file doesn't exist or access error
  }
  return false;
}

async function isCodeqlInstalled(projectDir: string): Promise<boolean> {
  const whichResult = await $`which codeql`.nothrow().quiet();
  if (whichResult.exitCode === 0) return true;

  const defaultPath = join(projectDir, ".codeql", "cli", "codeql");
  const file = Bun.file(defaultPath);
  return file.exists();
}

function getLanguageFromFile(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "actions";
  return null;
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;

    const hookInput = JSON.parse(inputJson) as HookInput;
    const filePath = getFilePathFromInput(hookInput);

    if (filePath === null || !shouldScanFile(filePath)) return 0;

    // Verify file actually exists on disk
    const fileRef = Bun.file(filePath);
    if (!(await fileRef.exists())) return 0;

    const projectDir = getProjectDirectory(hookInput);

    if (!(await isCodeqlInstalled(projectDir))) return 0;

    const language = getLanguageFromFile(filePath);
    if (!language) return 0;

    const scanScriptPath = join(
      projectDir,
      ".codeql",
      "scripts",
      "Invoke-CodeQLScan.ps1",
    );
    const scanScript = Bun.file(scanScriptPath);
    if (!(await scanScript.exists())) return 0;

    // Invoke quick scan with 30-second timeout
    try {
      const proc = Bun.spawn(
        [
          "pwsh",
          "-NoProfile",
          "-NonInteractive",
          "-File",
          scanScriptPath,
          "-Languages",
          language,
          "-QuickScan",
          "-UseCache",
          "-RepoPath",
          projectDir,
          "-Format",
          "json",
        ],
        {
          cwd: projectDir,
          stdout: "pipe",
          stderr: "pipe",
        },
      );

      // Implement 30-second timeout
      const timer = setTimeout(() => {
        proc.kill();
      }, 30_000);

      const exitCode = await proc.exited;
      clearTimeout(timer);

      if (proc.killed) {
        console.log(
          `\n**CodeQL Quick Scan WARNING**: Scan timed out after 30s ` +
            `for \`${filePath}\`. Run full scan manually.\n`,
        );
        return 0;
      }

      const stdout = await new Response(proc.stdout).text();

      if (exitCode !== 0) {
        console.log(
          "\n**CodeQL Quick Scan ERROR**: Scan failed. " +
            "Check .codeql/logs/ or run manual scan for details.\n",
        );
        return 0;
      }

      // Parse JSON output for findings count
      let findingsCount = 0;
      try {
        const lines = stdout.trim().split("\n");
        const jsonLines = lines.filter((line: string) =>
          line.trim().startsWith("{"),
        );
        if (jsonLines.length > 0) {
          const jsonOutput = jsonLines.join("\n");
          const scanResult = JSON.parse(jsonOutput) as {
            TotalFindings?: number;
          };
          findingsCount = scanResult.TotalFindings ?? 0;
        }
      } catch {
        console.log(
          "\n**CodeQL Quick Scan ERROR**: Scan output invalid. " +
            "Run manual scan to see actual errors: " +
            "`pwsh .codeql/scripts/Invoke-CodeQLScan.ps1`\n",
        );
        return 0;
      }

      if (findingsCount > 0) {
        console.log(
          `\n**CodeQL Quick Scan**: Analyzed \`${filePath}\` ` +
            `- **${findingsCount} finding(s) detected**\n`,
        );
      } else {
        console.log(
          `\n**CodeQL Quick Scan**: Analyzed \`${filePath}\` ` +
            "- No findings\n",
        );
      }
    } catch {
      // Timeout or process error - silently continue
    }
  } catch {
    // JSON parse, type, or OS errors - silently continue
  }

  return 0;
}

process.exit(await main());
