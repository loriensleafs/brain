#!/usr/bin/env bun
/**
 * Block git commit/push on main/master branches.
 *
 * Claude Code PreToolUse hook that prevents accidental commits and pushes
 * to protected branches (main, master). Enforces that work must be done
 * on feature branches.
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Allow operation
 *   2 = Block operation (on protected branch)
 */

const PROTECTED_BRANCHES = ["main", "master"];

interface HookInput {
  tool_input?: { command?: string };
  cwd?: string;
}

function writeBlockResponse(reason: string): void {
  console.log(JSON.stringify({ decision: "block", reason }));
}

function getWorkingDirectory(hookInput: HookInput): string {
  const cwd = hookInput.cwd;
  if (typeof cwd === "string" && cwd.trim()) {
    return cwd.trim();
  }

  const envDir = (process.env["CLAUDE_PROJECT_DIR"] ?? "").trim();
  if (envDir) {
    return envDir;
  }

  return process.cwd();
}

async function main(): Promise<number> {
  let hookInput: HookInput;
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    hookInput = JSON.parse(inputJson);
  } catch (exc) {
    console.error(
      `branch_protection_guard: Failed to parse input JSON: ${exc}`,
    );
    return 0;
  }

  const cwd = getWorkingDirectory(hookInput);

  try {
    const proc = Bun.spawn(["git", "branch", "--show-current"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;

    if (exitCode === 128) {
      const msg =
        `Not a git repository or git not installed in '${cwd}'. ` +
        "Cannot verify branch safety. Check: git status";
      console.error(msg);
      writeBlockResponse(msg);
      return 2;
    }

    if (exitCode !== 0) {
      const stderrText = (await new Response(proc.stderr).text()).trim();
      const stdoutText = (await new Response(proc.stdout).text()).trim();
      const output = stderrText || stdoutText;
      const msg =
        `Cannot determine current git branch in '${cwd}' ` +
        `(git failed with exit code ${exitCode}). ` +
        `Verify manually: git branch --show-current. Output: ${output}`;
      console.error(msg);
      writeBlockResponse(msg);
      return 2;
    }

    const currentBranch = (
      await new Response(proc.stdout).text()
    ).trim();

    if (PROTECTED_BRANCHES.includes(currentBranch)) {
      const msg =
        `Cannot commit or push directly to protected branch '${currentBranch}'. ` +
        "Create a feature branch first: git checkout -b feature/your-feature-name";
      writeBlockResponse(msg);
      return 2;
    }

    return 0;
  } catch (exc) {
    const msg =
      `Branch protection check failed in '${cwd}': ${exc}. ` +
      "Verify manually: git branch --show-current.";
    console.error(msg);
    writeBlockResponse(msg);
    return 2;
  }
}

process.exit(await main());
