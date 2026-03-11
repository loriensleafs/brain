#!/usr/bin/env bun
/**
 * Block git push without retrospective evidence per ADR-033.
 *
 * Claude Code PreToolUse hook that enforces retrospective before push.
 * Prevents pushing without capturing session learnings.
 *
 * Gate triggers on:
 * - git push commands
 *
 * Evidence requirements (any one satisfies):
 * 1. Retrospective section in session log (## Retrospective)
 * 2. Retrospective file in retrospective/ (Brain memories) for today
 * 3. Reference to retrospective file in session log
 *
 * Bypass conditions:
 * - Documentation-only changes (no code files)
 * - Trivial sessions (<10 minutes, single file)
 * - SKIP_RETROSPECTIVE_GATE environment variable set
 *
 * Hook Type: PreToolUse
 * Exit Codes (Claude Hook Semantics, exempt from ADR-035):
 *     0 = Allow (not push, or retrospective evidence exists)
 *     2 = Block (push without retrospective evidence)
 */

import { join } from "path";
import { Glob, $ } from "bun";
import {
  getMemoriesDir,
  isGitPushCommand,
  getTodaySessionLog,
} from "../../lib/utilities.ts";

interface HookInput {
  readonly cwd?: string;
  readonly tool_input?: {
    readonly command?: string;
  };
}

const RETROSPECTIVE_SECTION_PATTERN =
  /(?:##\s*retrospective|retrospective\s*section|learnings?\s*captured)/i;
const RETROSPECTIVE_FILE_REF_PATTERN =
  /(?:retrospective\/|retrospective[-_]?file|retro[-_]?\d{4})/i;

/** Documentation-only file patterns. */
const DOC_PATTERNS: ReadonlyArray<RegExp> = [
  /\.md$/,
  /\.txt$/,
  /(^|\/)README$/,
  /(^|\/)LICENSE$/,
  /(^|\/)CHANGELOG$/,
  /\.gitignore$/,
  /\.editorconfig$/,
];

const TRIVIAL_SESSION_MINUTES = 10;

async function checkRetrospectiveInSessionLog(
  sessionLog: string,
): Promise<boolean> {
  try {
    const content = await Bun.file(sessionLog).text();
    if (RETROSPECTIVE_SECTION_PATTERN.test(content)) return true;
    if (RETROSPECTIVE_FILE_REF_PATTERN.test(content)) return true;
  } catch {
    // file read error
  }
  return false;
}

async function checkRetrospectiveFileExists(
  memoriesDir: string,
): Promise<boolean> {
  const retroDir = join(memoriesDir, "retrospective");
  const dirExists =
    (await Bun.spawn(["test", "-d", retroDir]).exited) === 0;
  if (!dirExists) return false;

  const today = new Date().toISOString().slice(0, 10);
  try {
    const glob = new Glob(`${today}*.md`);
    for await (const _ of glob.scan({ cwd: retroDir })) {
      return true;
    }
  } catch {
    // directory or glob error
  }
  return false;
}

async function checkDocumentationOnly(): Promise<boolean> {
  try {
    let result = await $`git diff --name-only origin/main...HEAD`
      .nothrow()
      .quiet();

    if (result.exitCode !== 0) {
      result = await $`git diff --name-only origin/main`
        .nothrow()
        .quiet();

      if (result.exitCode !== 0) return false;
    }

    const changedFiles = result.stdout.toString().trim();
    if (!changedFiles) return true; // No changes, allow

    for (const filePath of changedFiles.split("\n")) {
      const isDoc = DOC_PATTERNS.some((pat) => pat.test(filePath));
      if (!isDoc) return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function checkTrivialSession(
  sessionLog: string | null,
): Promise<boolean> {
  if (sessionLog === null) return false;

  try {
    const file = Bun.file(sessionLog);
    // Use file's lastModified as proxy for creation time
    const logCtime = file.lastModified;
    const elapsedMinutes = (Date.now() - logCtime) / 60_000;

    if (elapsedMinutes > TRIVIAL_SESSION_MINUTES) return false;

    // Check number of changed files
    const result = await $`git diff --name-only origin/main...HEAD`
      .nothrow()
      .quiet();

    if (result.exitCode !== 0) return false;

    const changedFiles = result.stdout.toString().trim().split("\n");
    return changedFiles.length <= 1;
  } catch {
    return false;
  }
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;

    const hookInput = JSON.parse(inputJson) as HookInput;

    const toolInput = hookInput.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) return 0;

    const command = toolInput.command;
    if (!command) return 0;

    if (!isGitPushCommand(command)) return 0;

    const memoriesDir = await getMemoriesDir(hookInput.cwd);
    if (!memoriesDir) {
      console.error(
        "[SKIP] Could not resolve Brain memories directory. " +
          "Retrospective enforcement skipped.",
      );
      return 0;
    }

    const sessionsDir = join(memoriesDir, "sessions");

    // Skip if sessions infrastructure is absent
    const dirExists =
      (await Bun.spawn(["test", "-d", sessionsDir]).exited) === 0;
    if (!dirExists) {
      console.error(
        `[SKIP] ${sessionsDir} not found. ` +
          "Retrospective enforcement skipped.",
      );
      return 0;
    }

    // Bypass 1: Environment variable override
    if (process.env["SKIP_RETROSPECTIVE_GATE"] === "true") {
      console.error(
        "Retrospective gate bypassed via SKIP_RETROSPECTIVE_GATE environment variable",
      );
      return 0;
    }

    // Resolve session log early (needed by trivial session check)
    const today = new Date().toISOString().slice(0, 10);
    const sessionLog = await getTodaySessionLog(sessionsDir, today);

    // Bypass 2: Documentation-only changes
    if (await checkDocumentationOnly()) return 0;

    // Bypass 3: Trivial session
    if (await checkTrivialSession(sessionLog)) return 0;

    let hasRetrospective = false;

    // Check 1: Retrospective file exists for today
    if (await checkRetrospectiveFileExists(memoriesDir)) {
      hasRetrospective = true;
    }

    // Check 2: Retrospective section in session log
    if (
      sessionLog &&
      (await checkRetrospectiveInSessionLog(sessionLog))
    ) {
      hasRetrospective = true;
    }

    if (hasRetrospective) return 0;

    // Block: No retrospective evidence found
    const sessionLogName = sessionLog
      ? sessionLog.split("/").pop() ?? "Not found"
      : "Not found";

    console.log(`
## BLOCKED: Retrospective Required Before Push

**Session retrospective required per ADR-033 enforcement gates.**

### Why Retrospectives Matter
- Capture learnings while context is fresh
- Prevent knowledge loss across sessions
- Enable continuous improvement
- Build institutional memory

### How to Satisfy This Gate

**Option 1: Run retrospective agent**
\`\`\`
Task(subagent_type='retrospective', prompt='Analyze this session for learnings')
\`\`\`

**Option 2: Add retrospective section to session log**
Add a \`## Retrospective\` section to today's session log with:
- What went well
- What could improve
- Key learnings

**Option 3: Create retrospective file**
Create \`retrospective/${today}-*.md\` in the memories folder with session analysis.

### Bypass Conditions
- Documentation-only changes (auto-detected)
- Trivial sessions (<10 minutes, single file)
- Set \`SKIP_RETROSPECTIVE_GATE=true\` (requires justification)

**Current Date**: ${today}
**Session Log**: ${sessionLogName}
`);
    console.error("Push blocked: No retrospective evidence found");
    return 2;
  } catch (error) {
    const errorName =
      error instanceof Error ? error.constructor.name : "Unknown";
    console.error(
      `Retrospective gate error: ${errorName} - ${error}`,
    );
    return 0;
  }
}

process.exit(await main());
