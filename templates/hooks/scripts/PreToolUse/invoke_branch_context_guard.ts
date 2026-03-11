#!/usr/bin/env bun
/**
 * Verify git branch matches session context before commit/push.
 *
 * Claude Code PreToolUse hook that intercepts git commit/push commands and
 * verifies the current branch matches the expected branch from the session log.
 * Prevents cross-PR contamination by catching branch mismatches.
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Allow (branch matches or no session context)
 *   2 = Block (branch mismatch detected)
 */

import { join } from "path";
import {
  getProjectDirectory,
  getTodaySessionLog,
  isGitCommitOrPushCommand,
} from "../../lib/utilities.ts";

async function getCurrentBranch(cwd: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "branch", "--show-current"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const text = await new Response(proc.stdout).text();
      return text.trim();
    }
  } catch {
    // git not available or timeout
  }
  return null;
}

async function getSessionBranch(
  sessionLogPath: string,
): Promise<string | null> {
  try {
    const file = Bun.file(sessionLogPath);
    const content = await file.text();
    const data = JSON.parse(content);
    if (typeof data === "object" && data !== null) {
      return data.branch ?? null;
    }
  } catch (exc) {
    console.error(
      `branch_context_guard: Error reading session log '${sessionLogPath}': ${exc}`,
    );
  }
  return null;
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    const hookInput = JSON.parse(inputJson);

    const toolInput = hookInput?.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) {
      return 0;
    }
    const command = toolInput.command;
    if (!command) {
      return 0;
    }

    // Only check for git commit/push commands
    if (!isGitCommitOrPushCommand(command)) {
      return 0;
    }

    const projectDir = await getProjectDirectory();
    const sessionsDir = join(projectDir, ".agents", "sessions");

    // Skip if no sessions directory (consumer repo)
    const sessionsDirCheck =
      await Bun.spawn(["test", "-d", sessionsDir], {
        stdout: "pipe",
        stderr: "pipe",
      }).exited;
    if (sessionsDirCheck !== 0) {
      return 0;
    }

    // Get current branch
    const currentBranch = await getCurrentBranch(projectDir);
    if (!currentBranch) {
      console.error(
        "branch_context_guard: Cannot determine current branch, skipping check",
      );
      return 0;
    }

    // Get session log
    const sessionLog = await getTodaySessionLog(sessionsDir);
    if (sessionLog === null) {
      // No session log, let session_log_guard handle this
      return 0;
    }

    // Get expected branch from session
    const sessionBranch = await getSessionBranch(sessionLog);
    if (!sessionBranch) {
      // No branch in session log, skip check
      return 0;
    }

    // Compare branches
    if (currentBranch !== sessionBranch) {
      const sessionName = sessionLog.split("/").pop();
      const truncatedCmd =
        command.length > 50 ? command.slice(0, 50) + "..." : command;
      const output = `
## BLOCKED: Branch Mismatch Detected

**Current branch**: \`${currentBranch}\`
**Session expects**: \`${sessionBranch}\`

### Why This Matters
Branch mismatch can cause cross-PR contamination. This happens when:
- You switched branches mid-session without updating the session log
- The session was created for a different PR
- A previous operation left the repo on the wrong branch

### How to Fix

**Option 1: Switch to the expected branch**
\`\`\`bash
git checkout ${sessionBranch}
\`\`\`

**Option 2: Update session log to current branch**
Edit \`${sessionName}\` and set \`"branch": "${currentBranch}"\`

**Option 3: Start a new session**
Run \`/session-init\` to create a session for the current branch.

### Evidence
- Session log: \`${sessionName}\`
- Current time: now
- Command blocked: \`${truncatedCmd}\`
`;
      console.log(output);
      console.log(
        JSON.stringify({
          decision: "block",
          reason: `Branch mismatch: current='${currentBranch}', session='${sessionBranch}'`,
        }),
      );
      return 2;
    }

    return 0;
  } catch (exc) {
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.error(
      `branch_context_guard error: ${excType} - ${exc}`,
    );
    return 0;
  }
}

process.exit(await main());
