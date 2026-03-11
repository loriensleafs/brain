#!/usr/bin/env bun
/**
 * Enforce memory-first protocol with hybrid education/escalation strategy.
 *
 * Claude Code SessionStart hook that verifies memory retrieval evidence before
 * allowing work to proceed. Uses hybrid enforcement:
 *
 * - First 3 invocations: Educational guidance (inject context)
 * - After threshold: Strong warning with escalated urgency (inject context)
 *
 * Evidence verification checks session log protocolCompliance.sessionStart for:
 * 1. serenaActivated.Complete = true
 * 2. handoffRead.Complete = true
 * 3. memoriesLoaded.Evidence (or .evidence) is non-empty
 *
 * NOTE: SessionStart hooks cannot block (exit 2 only shows stderr as error,
 * does not block the session, and prevents stdout from being injected).
 *
 * Hook Type: SessionStart
 * Exit Codes:
 *   0 = Success (guidance or warning injected into Claude's context)
 */

import { join } from "path";
import { Glob } from "bun";
import {
  getProjectDirectory,
  getTodaySessionLogs,
} from "../../lib/utilities.ts";
import { skipIfConsumerRepo } from "../../lib/guards.ts";

const EDUCATION_THRESHOLD = 3;

interface EvidenceResult {
  complete: boolean;
  evidence?: string;
  reason?: string;
}

async function testMemoryEvidence(
  sessionLogPath: string,
): Promise<EvidenceResult> {
  try {
    const file = Bun.file(sessionLogPath);
    const text = await file.text();
    const content = JSON.parse(text);

    const protocol = content?.protocolCompliance ?? {};
    const sessionStart = protocol?.sessionStart ?? {};
    if (!sessionStart || Object.keys(sessionStart).length === 0) {
      return {
        complete: false,
        reason: "Missing protocolCompliance.sessionStart section",
      };
    }

    const serena = sessionStart?.serenaActivated ?? {};
    if (!serena || !(serena.Complete ?? serena.complete)) {
      return { complete: false, reason: "Serena not initialized" };
    }

    const handoff = sessionStart?.handoffRead ?? {};
    if (!handoff || !(handoff.Complete ?? handoff.complete)) {
      return { complete: false, reason: "HANDOFF.md not read" };
    }

    const memories = sessionStart?.memoriesLoaded ?? {};
    if (!memories || !(memories.Complete ?? memories.complete)) {
      return { complete: false, reason: "Memories not loaded" };
    }

    const evidence = String(
      memories.Evidence ?? memories.evidence ?? "",
    ).trim();
    if (!evidence) {
      return { complete: false, reason: "Memory evidence is empty" };
    }

    return { complete: true, evidence };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        complete: false,
        reason:
          "Session log contains invalid JSON. Check file format or recreate.",
      };
    }
    const errType = err instanceof Error ? err.constructor.name : typeof err;
    return {
      complete: false,
      reason: `Error parsing session log: ${errType} - ${err}`,
    };
  }
}

async function getInvocationCount(
  stateDir: string,
  today: string,
): Promise<number> {
  try {
    const stateFile = join(stateDir, "memory-first-counter.txt");
    const file = Bun.file(stateFile);
    if (!(await file.exists())) {
      return 0;
    }
    const content = (await file.text()).trim();
    const lines = content.split("\n");
    if (lines.length === 2) {
      const storedCount = parseInt(lines[0], 10);
      const storedDate = lines[1];
      if (storedDate !== today) {
        return 0;
      }
      return isNaN(storedCount) ? 0 : storedCount;
    }
    // Legacy format (just a number)
    const parsed = parseInt(content, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

async function incrementInvocationCount(
  stateDir: string,
  today: string,
): Promise<number> {
  const { mkdirSync } = await import("fs");
  try {
    mkdirSync(stateDir, { recursive: true });
  } catch {
    // directory may already exist
  }

  const count = (await getInvocationCount(stateDir, today)) + 1;
  const stateFile = join(stateDir, "memory-first-counter.txt");
  await Bun.write(stateFile, `${count}\n${today}`);
  return count;
}

async function main(): Promise<number> {
  if (await skipIfConsumerRepo("memory-first-enforcer")) {
    return 0;
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const projectDir = await getProjectDirectory();
    const sessionsDir = join(projectDir, ".agents", "sessions");
    const stateDir = join(projectDir, ".agents", ".hook-state");

    const todayLogs = await getTodaySessionLogs(sessionsDir);

    if (todayLogs.length === 0) {
      let agentsRef = "";
      const agentsFile = Bun.file(join(projectDir, "AGENTS.md"));
      if (await agentsFile.exists()) {
        agentsRef = " Protocol details in AGENTS.md.";
      }
      console.log(
        `\nMemory-First: No session log for today. Run \`/session-init\`.${agentsRef}\n`,
      );
      return 0;
    }

    // Check most recent session log for evidence (sort by mtime descending)
    const logStats = await Promise.all(
      todayLogs.map(async (logPath) => ({
        path: logPath,
        mtime: Bun.file(logPath).lastModified,
      })),
    );
    logStats.sort((a, b) => b.mtime - a.mtime);
    const latestLog = logStats[0].path;
    const evidence = await testMemoryEvidence(latestLog);

    if (evidence.complete) {
      console.log(
        "\nMemory-First: Evidence verified in session log.\n",
      );
      return 0;
    }

    // Evidence missing - check invocation count for education vs escalation
    const count = await incrementInvocationCount(stateDir, today);

    const severity =
      count <= EDUCATION_THRESHOLD
        ? `Warning ${count}/${EDUCATION_THRESHOLD}`
        : `VIOLATION (warning ${count})`;

    const reason = evidence.reason ?? "Unknown";
    let agentsRef = "";
    const agentsFile = Bun.file(join(projectDir, "AGENTS.md"));
    if (await agentsFile.exists()) {
      agentsRef = " See AGENTS.md Session Protocol Gates.";
    }
    console.log(
      `\nMemory-First ${severity}: ${reason}. ` +
        `Complete: Brain MCP init, HANDOFF.md read, memory retrieval.${agentsRef}\n`,
    );
    return 0;
  } catch (exc) {
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.error(`Memory-first enforcer error: ${excType} - ${exc}`);
    return 0;
  }
}

process.exit(await main());
