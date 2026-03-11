#!/usr/bin/env bun
/**
 * Create a new session log in JSON format (simplified version).
 *
 * Lightweight alternative to new_session_log.ts that creates
 * session JSON without full validation pipeline integration.
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid parameters / logic error
 *   2 - Config / file I/O error
 */

import { join } from "path";
import { readdirSync, existsSync, mkdirSync, openSync, writeSync, closeSync, constants } from "fs";

function parseArgs(argv: string[]): {
  sessionNumber: number;
  objective: string;
  traceId: string;
  parentSessionId: string;
} {
  let sessionNumber = 0;
  let objective = "";
  let traceId = "";
  let parentSessionId = "";

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--session-number": sessionNumber = parseInt(argv[++i] ?? "0", 10); break;
      case "--objective": objective = argv[++i] ?? ""; break;
      case "--trace-id": traceId = argv[++i] ?? ""; break;
      case "--parent-session-id": parentSessionId = argv[++i] ?? ""; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run new_session_log_json.ts --session-number <N> --objective <text>");
        process.exit(0);
    }
  }

  return { sessionNumber, objective, traceId, parentSessionId };
}

async function getBranch(): Promise<string> {
  const proc = Bun.spawn(["git", "branch", "--show-current"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return "unknown";
  return output.trim() || "unknown";
}

async function getCommit(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return "unknown";
  return output.trim() || "unknown";
}

async function getRepoRoot(): Promise<string> {
  const proc = Bun.spawn(["git", "rev-parse", "--show-toplevel"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return process.cwd();
  return output.trim() || process.cwd();
}

async function main(argv?: string[]): Promise<number> {
  const args = parseArgs(argv ?? process.argv.slice(2));

  const repoRoot = await getRepoRoot();
  const sessionsDir = join(repoRoot, ".agents", "sessions");
  mkdirSync(sessionsDir, { recursive: true });

  const currentDate = new Date().toISOString().split("T")[0];
  const branch = await getBranch();
  const commit = await getCommit();

  let sessionNumber = args.sessionNumber;
  if (sessionNumber === 0) {
    let maxNum = 0;
    if (existsSync(sessionsDir)) {
      for (const name of readdirSync(sessionsDir)) {
        const m = name.match(/session-(\d+)/);
        if (m && name.endsWith(".json")) {
          maxNum = Math.max(maxNum, parseInt(m[1], 10));
        }
      }
    }
    sessionNumber = maxNum > 0 ? maxNum + 1 : 1;
  }

  let maxExisting = 0;
  let foundExisting = false;
  if (existsSync(sessionsDir)) {
    for (const name of readdirSync(sessionsDir)) {
      const m = name.match(/session-(\d+)/);
      if (m && name.endsWith(".json")) {
        maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
        foundExisting = true;
      }
    }
  }
  if (foundExisting && sessionNumber > maxExisting + 10) {
    console.error(
      `ERROR: Session number ${sessionNumber} exceeds ceiling ` +
        `(max existing: ${maxExisting}, ceiling: ${maxExisting + 10}).`
    );
    return 1;
  }

  const notOnMain = !["main", "master"].includes(branch);

  const sessionMetadata: Record<string, unknown> = {
    number: sessionNumber,
    date: currentDate,
    branch,
    startingCommit: commit,
    objective: args.objective || "[TODO: Describe objective]",
  };
  if (args.traceId) sessionMetadata["traceId"] = args.traceId;
  if (args.parentSessionId) sessionMetadata["parentSessionId"] = args.parentSessionId;

  const session = {
    session: sessionMetadata,
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
        branchVerified: { level: "MUST", Complete: true, Evidence: branch },
        notOnMain: { level: "MUST", Complete: notOnMain, Evidence: `On ${branch}` },
        gitStatusVerified: { level: "SHOULD", Complete: false, Evidence: "" },
        startingCommitNoted: { level: "SHOULD", Complete: true, Evidence: commit },
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

  let jsonContent = JSON.stringify(session, null, 2);
  const maxRetries = 5;
  let created = false;
  let filepath = "";

  for (let retry = 0; retry < maxRetries; retry++) {
    const filename = `${currentDate}-session-${sessionNumber}.json`;
    filepath = join(sessionsDir, filename);

    try {
      const fd = openSync(filepath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY);
      try {
        writeSync(fd, jsonContent);
      } finally {
        closeSync(fd);
      }
      created = true;
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") {
        if (retry < maxRetries - 1) {
          console.error(
            `WARNING: Session ${sessionNumber} already exists, trying ${sessionNumber + 1}`
          );
          sessionNumber++;
          (session.session as Record<string, unknown>).number = sessionNumber;
          jsonContent = JSON.stringify(session, null, 2);
        } else {
          throw e;
        }
      } else {
        throw e;
      }
    }
  }

  if (!created) {
    console.error(`ERROR: Failed to create session log after ${maxRetries} attempts.`);
    return 2;
  }

  console.error(`Created: ${filepath}`);
  console.error(`Session: ${sessionNumber}`);
  console.error(`Branch: ${branch}`);
  console.error(`Commit: ${commit}`);

  console.log(filepath);
  return 0;
}

export { main };

if (import.meta.main) {
  process.exit(await main());
}
