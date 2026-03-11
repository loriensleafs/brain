#!/usr/bin/env bun
/**
 * Block Edit/Write on ADR files unless architect review evidence exists.
 *
 * Claude Code PreToolUse hook that enforces architect involvement before
 * modifying ADR files. This is a routing-level gate.
 *
 * Blocks Edit/Write operations on:
 * - .agents/architecture/ADR-*.md
 * - docs/architecture/ADR-*.md
 * - ** /ADR-*.md (any location)
 *
 * Evidence sources (any satisfies the gate):
 * 1. Debate log artifact in .agents/analysis/ or .agents/critique/
 * 2. Session log contains architect agent routing evidence
 * 3. adr-review skill was invoked
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Allow (continue with tool use)
 *   2 = Block (deny tool use with message)
 */

import { join, resolve } from "path";
import { Glob } from "bun";
import {
  getProjectDirectory,
  getTodaySessionLog,
} from "../../lib/utilities.ts";

const ADR_PATTERN = /ADR-\d+.*\.md$/i;

const ARCHITECT_EVIDENCE_PATTERNS = [
  /\/adr-review/,
  /adr-review skill/,
  /ADR Review Protocol/,
  /subagent_type\s*=\s*['"]?architect\b['"]?/,
  /Task\s*\([^)]*subagent_type\s*=\s*['"]?architect\b/,
  /\barchitect\s+agent\b/i,
  /multi-agent consensus.{0,200}\bADR\b/s,
];

const BLOCKED_MESSAGE_TEMPLATE = `
## BLOCKED: ADR Edit Without Architect Review

**YOU MUST invoke the architect agent before modifying ADR files.**

### File Targeted

{file_path}

### Required Action

Invoke the architect agent to review ADR changes:

\`\`\`
Task(subagent_type='architect', prompt='Review ADR changes for {adr_name}')
\`\`\`

After architect review, the adr-review skill will automatically be invoked
for multi-agent debate (6 agents: architect, critic, independent-thinker,
security, analyst, high-level-advisor).

### Alternative

Invoke the adr-review skill directly:

\`\`\`
/adr-review {file_path}
\`\`\`

**Skill**: \`.claude/skills/adr-review/SKILL.md\`
`;

async function writeAuditLog(message: string): Promise<void> {
  try {
    const hookDir = resolve(import.meta.dir, "..");
    const auditLogPath = join(hookDir, "audit.log");
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const entry = `[${timestamp}] [ADRArchitectGate] ${message}\n`;
    const file = Bun.file(auditLogPath);
    const existing = (await file.exists()) ? await file.text() : "";
    await Bun.write(auditLogPath, existing + entry);
  } catch {
    console.error(
      `[ADRArchitectGate] CRITICAL: Audit log write failed. Original error: ${message}`,
    );
  }
}

function isAdrFile(filePath: string): boolean {
  return ADR_PATTERN.test(filePath);
}

interface EvidenceResult {
  complete: boolean;
  reason?: string;
  evidence?: string;
}

async function checkArchitectEvidence(
  projectDir: string,
): Promise<EvidenceResult> {
  const today = new Date().toISOString().slice(0, 10);
  const cutoffMs = Date.now() - 86_400_000; // 24 hours ago

  // Check 1: Debate log artifacts in .agents/analysis/ or .agents/critique/
  for (const artifactDir of [".agents/analysis", ".agents/critique"]) {
    const analysisDir = join(projectDir, artifactDir);
    const dirCheck =
      await Bun.spawn(["test", "-d", analysisDir], {
        stdout: "pipe",
        stderr: "pipe",
      }).exited;

    if (dirCheck === 0) {
      const debateGlob = new Glob("**/*debate*.md");
      for await (const entry of debateGlob.scan({ cwd: analysisDir })) {
        const fullPath = join(analysisDir, entry);
        const file = Bun.file(fullPath);
        if (file.lastModified > cutoffMs) {
          return {
            complete: true,
            evidence: `Debate log artifact found: ${entry}`,
          };
        }
      }
    }
  }

  // Check 2: Session log evidence
  const sessionsDir = join(projectDir, ".agents", "sessions");
  const sessionLog = await getTodaySessionLog(sessionsDir, today);

  if (sessionLog !== null) {
    try {
      const content = await Bun.file(sessionLog).text();
      for (const pattern of ARCHITECT_EVIDENCE_PATTERNS) {
        if (pattern.test(content)) {
          return {
            complete: true,
            evidence: `Session log contains architect evidence: ${pattern.source}`,
          };
        }
      }
    } catch (exc) {
      await writeAuditLog(`Session log read failed: ${exc}`);
    }
  }

  return {
    complete: false,
    reason:
      "No architect involvement evidence found in session log or analysis artifacts",
  };
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    const hookInput = JSON.parse(inputJson);

    const toolName = hookInput?.tool_name ?? "";
    if (toolName !== "Edit" && toolName !== "Write") {
      return 0;
    }

    const toolInput = hookInput?.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) {
      return 0;
    }

    const filePath: string = toolInput.file_path ?? "";
    if (!filePath) {
      return 0;
    }

    if (!isAdrFile(filePath)) {
      return 0;
    }

    // ADR file edit/write detected, check for architect evidence
    const projectDir = await getProjectDirectory();
    const evidence = await checkArchitectEvidence(projectDir);

    if (evidence.complete) {
      return 0;
    }

    // Block the operation
    const parts = filePath.split("/");
    const adrName = parts[parts.length - 1];
    console.log(
      BLOCKED_MESSAGE_TEMPLATE.replaceAll("{file_path}", filePath).replaceAll(
        "{adr_name}",
        adrName,
      ),
    );
    console.error("Blocked: ADR edit without architect review");
    return 2;
  } catch (exc) {
    if (exc instanceof SyntaxError) {
      const errorMsg = `JSON parse error: ${exc}`;
      console.error(errorMsg);
      await writeAuditLog(errorMsg);
      return 0; // Fail-open on infrastructure errors
    }

    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    const errorMsg = `ADR architect gate error: ${excType} - ${exc}`;
    console.error(errorMsg);
    await writeAuditLog(errorMsg);
    return 0;
  }
}

process.exit(await main());
