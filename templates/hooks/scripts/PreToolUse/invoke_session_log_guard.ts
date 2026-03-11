#!/usr/bin/env bun
/**
 * Block git commit without session log evidence.
 *
 * Claude Code PreToolUse hook that enforces session logging before commits.
 * Prevents untracked work by requiring a session log for the current date.
 *
 * Checks:
 * 1. Command is git commit
 * 2. Session log exists for today in Brain memories sessions/
 * 3. Session log has >= 100 characters and, if JSON, has >= 2 properties
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Allow (not commit, or log exists with evidence)
 *   2 = Block (commit without session log or with empty log)
 */

import { join } from "path";
import {
  getMemoriesDir,
  getTodaySessionLog,
  isGitCommitCommand,
} from "../../lib/utilities.ts";
import { skipIfConsumerRepo } from "../../lib/guards.ts";

const MIN_SESSION_LOG_LENGTH = 100;
const MIN_JSON_PROPERTIES = 2;

interface EvidenceResult {
  valid: boolean;
  reason?: string;
  content?: string;
}

async function checkSessionLogEvidence(
  sessionLogPath: string,
): Promise<EvidenceResult> {
  try {
    const file = Bun.file(sessionLogPath);
    const content = await file.text();

    if (content.length < MIN_SESSION_LOG_LENGTH) {
      return { valid: false, reason: "Session log exists but is empty" };
    }

    try {
      const data = JSON.parse(content);
      if (
        typeof data === "object" &&
        data !== null &&
        !Array.isArray(data) &&
        Object.keys(data).length < MIN_JSON_PROPERTIES
      ) {
        return {
          valid: false,
          reason: "Session log lacks required sections",
        };
      }
    } catch {
      // Not JSON is acceptable (could be markdown log)
    }

    const previewLength = Math.min(200, content.length);
    return { valid: true, content: content.slice(0, previewLength) };
  } catch (err) {
    const errType = err instanceof Error ? err.constructor.name : typeof err;
    return {
      valid: false,
      reason: `Error reading session log: ${errType} - ${err}`,
    };
  }
}

async function main(): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    const hookInput = JSON.parse(inputJson);
    const stdinCwd: string | undefined = hookInput?.cwd;

    if (await skipIfConsumerRepo("session-log-guard", stdinCwd)) {
      return 0;
    }

    const toolInput = hookInput?.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) {
      return 0;
    }
    const command = toolInput.command;
    if (!command) {
      return 0;
    }

    if (!isGitCommitCommand(command)) {
      return 0;
    }

    const memoriesDir = await getMemoriesDir(stdinCwd);
    if (!memoriesDir) {
      console.error(
        "[SKIP] session-log-guard: Could not resolve Brain memories directory",
      );
      return 0;
    }

    const sessionsDir = join(memoriesDir, "sessions");

    const sessionsDirCheck =
      await Bun.spawn(["test", "-d", sessionsDir], {
        stdout: "pipe",
        stderr: "pipe",
      }).exited;
    if (sessionsDirCheck !== 0) {
      console.error(
        `[SKIP] session-log-guard: ${sessionsDir} not found ` +
          "(sessions directory missing)",
      );
      return 0;
    }

    const sessionLog = await getTodaySessionLog(sessionsDir, today);

    if (sessionLog === null) {
      const output = `
## BLOCKED: No Session Log Found

**YOU MUST create a session log before committing.**

### Why Session Logs Matter
- Evidence of work performed
- Compliance tracking
- Context for future sessions
- Audit trail for peer review

### How to Create a Session Log

**Option 1: Use /session-init skill**
\`\`\`
/session-init
\`\`\`

**Option 2: Create manually**
Session logs go in: \`sessions/${today}-session-NN.json\`

**Current Date**: ${today}
**Sessions Directory**: ${sessionsDir}
`;
      console.log(output);
      console.error(
        "Session blocked: No session log found for today",
      );
      return 2;
    }

    const evidence = await checkSessionLogEvidence(sessionLog);

    if (!evidence.valid) {
      const reason = evidence.reason;
      const sessionName = sessionLog.split("/").pop();
      const output = `
## BLOCKED: Session Log Empty or Invalid

**Reason**: ${reason}

### Fix

Edit the session log and add substantial work evidence:

\`\`\`
${sessionLog}
\`\`\`

Session log MUST contain:
- Timestamp of work
- Description of tasks performed
- Tool usage evidence
- Key decisions made

**Current Session Log**: ${sessionName}
`;
      console.log(output);
      console.error(
        "Session blocked: Session log has insufficient evidence",
      );
      return 2;
    }

    return 0;
  } catch (exc) {
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.error(`Session log guard error: ${excType} - ${exc}`);
    return 0;
  }
}

process.exit(await main());
