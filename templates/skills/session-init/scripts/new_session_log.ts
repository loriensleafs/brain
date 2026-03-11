#!/usr/bin/env bun
/**
 * Create protocol-compliant JSON session log with verification-based enforcement.
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid parameters / logic error
 *   2 - Config / file I/O error
 *   3 - External error
 *   4 - Validation failed
 */

import { join, dirname } from "path";
import { readdirSync, existsSync, mkdirSync, openSync, writeSync, closeSync, constants } from "fs";
import { getGitInfo } from "../lib/git_helpers.ts";
import { getDescriptiveKeywords } from "../lib/template_helpers.ts";

function parseArgs(argv: string[]): { sessionNumber: number; objective: string; skipValidation: boolean } {
  let sessionNumber = 0;
  let objective = "";
  let skipValidation = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--session-number": sessionNumber = parseInt(argv[++i] ?? "0", 10); break;
      case "--objective": objective = argv[++i] ?? ""; break;
      case "--skip-validation": skipValidation = true; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run new_session_log.ts --session-number <N> --objective <text> [--skip-validation]");
        process.exit(0);
    }
  }

  return { sessionNumber, objective, skipValidation };
}

function autoDetectSessionNumber(sessionsDir: string): number {
  if (!existsSync(sessionsDir)) return 1;
  let maxNum = 0;
  for (const name of readdirSync(sessionsDir)) {
    const m = name.match(/session-(\d+)/);
    if (m && name.endsWith(".json")) {
      maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
  }
  return maxNum > 0 ? maxNum + 1 : 1;
}

function getMaxExistingSession(sessionsDir: string): number | null {
  if (!existsSync(sessionsDir)) return null;
  let maxNum = 0;
  let found = false;
  for (const name of readdirSync(sessionsDir)) {
    const m = name.match(/session-(\d+)/);
    if (m && name.endsWith(".json")) {
      maxNum = Math.max(maxNum, parseInt(m[1], 10));
      found = true;
    }
  }
  return found ? maxNum : null;
}

async function deriveObjective(branch: string): Promise<string> {
  const m = branch.match(/^(?:feat|feature|fix|refactor|chore|docs)\/(.+)$/);
  if (m) {
    const topic = m[1].replace(/-/g, " ");
    return `Work on ${topic}`;
  }

  try {
    const proc = Bun.spawn(["git", "log", "--oneline", "-3"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0 && output.trim()) {
      const firstLine = output.trim().split("\n")[0];
      const parts = firstLine.split(/\s+/, 2);
      if (parts.length === 2) {
        return `Continue: ${firstLine.substring(parts[0].length).trim()}`;
      }
    }
  } catch {
    // Fall through
  }
  return "";
}

interface SessionData {
  session: {
    number: number;
    date: string;
    branch: string;
    startingCommit: string;
    objective: string;
  };
  protocolCompliance: {
    sessionStart: Record<string, { level: string; Complete: boolean; Evidence: string }>;
    sessionEnd: Record<string, { level: string; Complete: boolean; Evidence: string }>;
  };
  workLog: unknown[];
  endingCommit: string;
  nextSteps: unknown[];
}

function buildSessionData(
  gitInfo: { branch: string; commit: string },
  sessionNumber: number,
  objective: string,
  currentDate: string
): SessionData {
  const notOnMain = !["main", "master"].includes(gitInfo.branch);

  return {
    session: {
      number: sessionNumber,
      date: currentDate,
      branch: gitInfo.branch,
      startingCommit: gitInfo.commit,
      objective: objective || "[TODO: Describe objective]",
    },
    protocolCompliance: {
      sessionStart: {
        brainActivated: { level: "MUST", Complete: false, Evidence: "" },
        brainInstructions: { level: "MUST", Complete: false, Evidence: "" },
        handoffRead: { level: "MUST", Complete: false, Evidence: "" },
        sessionLogCreated: { level: "MUST", Complete: true, Evidence: "This file" },
        skillScriptsListed: { level: "MUST", Complete: false, Evidence: "" },
        usageMandatoryRead: { level: "MUST", Complete: false, Evidence: "" },
        constraintsRead: { level: "MUST", Complete: false, Evidence: "" },
        memoriesLoaded: { level: "MUST", Complete: false, Evidence: "" },
        branchVerified: { level: "MUST", Complete: true, Evidence: gitInfo.branch },
        notOnMain: { level: "MUST", Complete: notOnMain, Evidence: `On ${gitInfo.branch}` },
        gitStatusVerified: { level: "SHOULD", Complete: false, Evidence: "" },
        startingCommitNoted: { level: "SHOULD", Complete: true, Evidence: gitInfo.commit },
      },
      sessionEnd: {
        checklistComplete: { level: "MUST", Complete: false, Evidence: "" },
        handoffPreserved: { level: "MUST", Complete: false, Evidence: "" },
        brainMemoryUpdated: { level: "MUST", Complete: false, Evidence: "" },
        markdownLintRun: { level: "MUST", Complete: false, Evidence: "" },
        changesCommitted: { level: "MUST", Complete: false, Evidence: "" },
        validationPassed: { level: "MUST", Complete: false, Evidence: "" },
        tasksUpdated: { level: "SHOULD", Complete: false, Evidence: "" },
        retrospectiveInvoked: { level: "SHOULD", Complete: false, Evidence: "" },
      },
    },
    workLog: [],
    endingCommit: "",
    nextSteps: [],
  };
}

function writeSessionFile(
  sessionsDir: string,
  sessionData: SessionData,
  currentDate: string,
  objective: string
): [string, number] {
  mkdirSync(sessionsDir, { recursive: true });
  let sessionNumber = sessionData.session.number;
  const maxRetries = 5;

  for (let retry = 0; retry < maxRetries; retry++) {
    const keywords = getDescriptiveKeywords(objective);
    const suffix = keywords ? `-${keywords}` : "";
    const filename = `${currentDate}-session-${sessionNumber}${suffix}.json`;
    const filepath = join(sessionsDir, filename);

    try {
      const fd = openSync(filepath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      try {
        const content = JSON.stringify(sessionData, null, 2);
        writeSync(fd, content);
      } finally {
        closeSync(fd);
      }
      return [filepath, sessionNumber];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") {
        if (retry < maxRetries - 1) {
          sessionNumber++;
          sessionData.session.number = sessionNumber;
          console.error(`WARNING: Session file collision, retrying with session-${sessionNumber}`);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  throw new Error(`Failed to create session log after ${maxRetries} attempts.`);
}

async function runValidation(sessionLogPath: string, repoRoot: string): Promise<boolean> {
  const validationScript = join(repoRoot, "scripts", "validate_session_json.py");
  if (!existsSync(validationScript)) {
    console.error(`CRITICAL: Validation script not found at: ${validationScript}`);
    return false;
  }

  console.error("Running validation...");
  const proc = Bun.spawn(["python3", validationScript, sessionLogPath], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  return exitCode === 0;
}

async function main(argv?: string[]): Promise<number> {
  const args = parseArgs(argv ?? process.argv.slice(2));

  let gitInfo;
  try {
    gitInfo = await getGitInfo();
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    return 1;
  }

  const repoRoot = gitInfo.repo_root;
  const sessionsDir = join(repoRoot, ".agents", "sessions");
  mkdirSync(sessionsDir, { recursive: true });
  const currentDate = new Date().toISOString().split("T")[0];

  let sessionNumber = args.sessionNumber;
  if (sessionNumber === 0) {
    sessionNumber = autoDetectSessionNumber(sessionsDir);
  }

  const maxExisting = getMaxExistingSession(sessionsDir);
  if (maxExisting !== null && sessionNumber > maxExisting + 10) {
    console.error(
      `ERROR: Session number ${sessionNumber} exceeds ceiling ` +
        `(max existing: ${maxExisting}, ceiling: ${maxExisting + 10}). ` +
        `This prevents DoS via large session numbers.`
    );
    return 1;
  }

  let objective = args.objective;
  if (!objective) {
    objective = await deriveObjective(gitInfo.branch);
  }

  const sessionData = buildSessionData(gitInfo, sessionNumber, objective, currentDate);

  let filepath: string;
  let finalNumber: number;
  try {
    [filepath, finalNumber] = writeSessionFile(sessionsDir, sessionData, currentDate, objective);
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    return 2;
  }

  console.error(`Created: ${filepath}`);
  console.error(`Session: ${finalNumber}`);
  console.error(`Branch: ${gitInfo.branch}`);
  console.error(`Commit: ${gitInfo.commit}`);

  if (!args.skipValidation) {
    const passed = await runValidation(filepath, repoRoot);
    if (!passed) {
      console.error(
        `\nSession log created but validation FAILED.\n` +
          `  File: ${filepath}\n` +
          `Fix issues and re-validate.`
      );
      return 4;
    }
  } else {
    console.error("Validation skipped (--skip-validation flag set).");
  }

  console.log(filepath);
  return 0;
}

export { main, autoDetectSessionNumber, getMaxExistingSession, buildSessionData };

if (import.meta.main) {
  process.exit(await main());
}
