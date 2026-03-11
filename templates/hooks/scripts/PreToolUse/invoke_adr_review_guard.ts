#!/usr/bin/env bun
/**
 * Block git commit with ADR changes unless adr-review skill was executed.
 *
 * Claude Code PreToolUse hook that enforces ADR review before commit.
 * Detects ADR file modifications and blocks commit unless the adr-review
 * skill ran in the current session.
 *
 * Checks:
 * 1. Command is git commit
 * 2. Staged changes include ADR files (ADR-*.md)
 * 3. Session log contains adr-review evidence
 * 4. Debate log artifact exists in .agents/analysis/
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Allow (not commit, no ADR changes, or review done)
 *   2 = Block (ADR changes without review)
 */

import { join, resolve } from "path";
import { Glob } from "bun";
import {
  getProjectDirectory,
  getTodaySessionLog,
  isGitCommitCommand,
} from "../../lib/utilities.ts";
import { skipIfConsumerRepo } from "../../lib/guards.ts";

const ADR_PATTERN = /ADR-\d+\.md$/i;

const REVIEW_PATTERNS = [
  /\/adr-review/,
  /adr-review skill/,
  /ADR Review Protocol/,
  /multi-agent consensus.{0,200}\bADR\b/s,
  /\barchitect\b.{0,80}\bplanner\b.{0,80}\bqa\b/s,
];

const AGENTS_DEBATE = ".agents/analysis/";

const NO_SESSION_LOG_TEMPLATE = `
## BLOCKED: ADR Changes Without Review

**YOU MUST run /adr-review before committing ADR changes.**

### Changes Detected

{changes_list}

### Required Action

Invoke the adr-review skill for multi-agent consensus:

\`\`\`
/adr-review [ADR-path]
\`\`\`

This ensures 6-agent debate before ADR acceptance.

**Skill**: \`.claude/skills/adr-review/SKILL.md\`
`;

const NO_EVIDENCE_TEMPLATE = `
## BLOCKED: ADR Changes Without Review

**YOU MUST run /adr-review before committing ADR changes.**

### Changes Detected

{changes_list}

### Problem

{reason}. Session log needs evidence of /adr-review execution.

### Required Action

Invoke the adr-review skill for multi-agent consensus:

\`\`\`
/adr-review [ADR-path]
\`\`\`

This ensures 6-agent debate before ADR acceptance.

**Skill**: \`.claude/skills/adr-review/SKILL.md\`
**Session Log**: {session_log_name}
`;

async function writeAuditLog(message: string): Promise<void> {
  try {
    const hookDir = resolve(import.meta.dir, "..");
    const auditLogPath = join(hookDir, "audit.log");
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const entry = `[${timestamp}] [ADRReviewGuard] ${message}\n`;
    const file = Bun.file(auditLogPath);
    const existing = (await file.exists()) ? await file.text() : "";
    await Bun.write(auditLogPath, existing + entry);
  } catch {
    console.error(
      `[ADRReviewGuard] CRITICAL: Audit log write failed. Original error: ${message}`,
    );
  }
}

async function getStagedAdrChanges(): Promise<string[]> {
  const proc = Bun.spawn(["git", "diff", "--cached", "--name-only"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    throw new Error(
      `git diff --cached failed with exit code ${exitCode}: ${stderr}`,
    );
  }

  const stdout = (await new Response(proc.stdout).text()).trim();
  if (!stdout) {
    return [];
  }

  return stdout.split("\n").filter((f) => ADR_PATTERN.test(f));
}

interface EvidenceResult {
  complete: boolean;
  reason?: string;
  evidence?: string;
}

async function checkAdrReviewEvidence(
  sessionLogPath: string,
  projectDir: string,
): Promise<EvidenceResult> {
  try {
    const file = Bun.file(sessionLogPath);
    const content = await file.text();

    let matchedPattern: string | null = null;
    for (const pattern of REVIEW_PATTERNS) {
      if (pattern.test(content)) {
        matchedPattern = pattern.source;
        break;
      }
    }

    if (matchedPattern === null) {
      return {
        complete: false,
        reason: "No adr-review evidence in session log",
      };
    }

    const analysisDir = join(projectDir, ".agents", "analysis");
    const analysisDirCheck =
      await Bun.spawn(["test", "-d", analysisDir], {
        stdout: "pipe",
        stderr: "pipe",
      }).exited;

    if (analysisDirCheck !== 0) {
      return {
        complete: false,
        reason: `Session log mentions adr-review, but ${AGENTS_DEBATE} directory does not exist`,
      };
    }

    const debateGlob = new Glob("*debate*.md");
    let hasDebateLog = false;
    for await (const _entry of debateGlob.scan({ cwd: analysisDir })) {
      hasDebateLog = true;
      break;
    }

    if (!hasDebateLog) {
      return {
        complete: false,
        reason: `Session log mentions adr-review, but no debate log artifact found in ${AGENTS_DEBATE}`,
      };
    }

    return {
      complete: true,
      evidence: `ADR review evidence found: matched pattern '${matchedPattern}' and debate log artifact exists`,
    };
  } catch (err) {
    const errType = err instanceof Error ? err.constructor.name : typeof err;
    return {
      complete: false,
      reason: `Error reading session log: ${errType} - ${err}`,
    };
  }
}

async function main(): Promise<number> {
  if (await skipIfConsumerRepo("adr-review-guard")) {
    return 0;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);

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

    if (!isGitCommitCommand(command)) {
      return 0;
    }

    // Fail-closed: git errors block to prevent bypass
    let adrChanges: string[];
    try {
      adrChanges = await getStagedAdrChanges();
    } catch (exc) {
      const errorMsg = `Staged ADR check failed (fail-closed): ${exc}`;
      console.error(errorMsg);
      await writeAuditLog(errorMsg);
      return 2;
    }

    if (adrChanges.length === 0) {
      return 0;
    }

    // ADR changes detected, verify review was done
    const projectDir = await getProjectDirectory();
    const sessionsDir = join(projectDir, ".agents", "sessions");
    const sessionLog = await getTodaySessionLog(sessionsDir, today);

    const changesList = adrChanges.join("\n");

    if (sessionLog === null) {
      console.log(
        NO_SESSION_LOG_TEMPLATE.replace("{changes_list}", changesList),
      );
      console.error(
        "Session blocked: ADR changes without review",
      );
      return 2;
    }

    const evidence = await checkAdrReviewEvidence(sessionLog, projectDir);

    if (!evidence.complete) {
      const sessionName = sessionLog.split("/").pop() ?? "";
      console.log(
        NO_EVIDENCE_TEMPLATE.replace("{changes_list}", changesList)
          .replace("{reason}", evidence.reason ?? "Unknown")
          .replace("{session_log_name}", sessionName),
      );
      console.error(
        "Session blocked: ADR review not completed in session",
      );
      return 2;
    }

    return 0;
  } catch (exc) {
    // Fail-open on infrastructure errors
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    const errorMsg = `ADR review guard error: ${excType} - ${exc}`;
    console.error(errorMsg);
    await writeAuditLog(errorMsg);
    return 0;
  }
}

process.exit(await main());
