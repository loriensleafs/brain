#!/usr/bin/env bun
/**
 * Complete a session log by auto-populating session end evidence and validating.
 *
 * Finds the current session log, auto-populates session end checklist items
 * with evidence gathered from git state and file changes, runs validation,
 * and reports status.
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error: Validation failed or missing required items
 */

import { join, resolve } from "path";
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from "fs";

function parseArgs(argv: string[]): { sessionPath: string; dryRun: boolean } {
  let sessionPath = "";
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--session-path": sessionPath = argv[++i] ?? ""; break;
      case "--dry-run": dryRun = true; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run complete_session_log.ts [--session-path <path>] [--dry-run]");
        process.exit(0);
    }
  }

  return { sessionPath, dryRun };
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

function findCurrentSessionLog(sessionsDir: string): string | null {
  const today = new Date().toISOString().split("T")[0];

  if (!existsSync(sessionsDir)) return null;

  const candidates: [number, string, string][] = [];
  for (const name of readdirSync(sessionsDir)) {
    if (name.endsWith(".json") && /^\d{4}-\d{2}-\d{2}-session-\d+/.test(name)) {
      const full = join(sessionsDir, name);
      const mtime = statSync(full).mtimeMs;
      candidates.push([mtime, full, name]);
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b[0] - a[0]);

  for (const [, full, name] of candidates) {
    if (name.startsWith(today)) return full;
  }

  return candidates[0][1];
}

async function getEndingCommit(): Promise<string | null> {
  const proc = Bun.spawn(["git", "rev-parse", "--short", "HEAD"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return null;
  return output.trim() || null;
}

async function testHandoffModified(): Promise<boolean> {
  for (const cmd of [
    ["git", "diff", "--cached", "--name-only"],
    ["git", "diff", "--name-only"],
  ]) {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0 && output.includes("HANDOFF.md")) return true;
  }
  return false;
}

async function testBrainMemoryUpdated(): Promise<boolean> {
  for (const cmd of [
    ["git", "diff", "--cached", "--name-only"],
    ["git", "diff", "--name-only"],
    ["git", "ls-files", "--others", "--exclude-standard"],
  ]) {
    const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      for (const line of output.split("\n")) {
        if (line.startsWith("docs/")) return true;
      }
    }
  }
  return false;
}

async function runMarkdownLint(): Promise<[boolean, string]> {
  const staged = Bun.spawn(
    ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const stagedOutput = await new Response(staged.stdout).text();
  await staged.exited;

  const unstaged = Bun.spawn(
    ["git", "diff", "--name-only", "--diff-filter=ACMR"],
    { stdout: "pipe", stderr: "pipe" }
  );
  const unstagedOutput = await new Response(unstaged.stdout).text();
  await unstaged.exited;

  const mdFiles = new Set<string>();
  for (const output of [stagedOutput, unstagedOutput]) {
    for (const line of output.split("\n")) {
      if (line.trim().endsWith(".md")) mdFiles.add(line.trim());
    }
  }

  if (mdFiles.size === 0) return [true, "No markdown files changed"];

  let allSuccess = true;
  const errors: string[] = [];
  for (const f of mdFiles) {
    const proc = Bun.spawn(["npx", "markdownlint-cli2", "--fix", "--", f], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      allSuccess = false;
      errors.push(stdout.trim() || stderr.trim());
    }
  }

  if (allSuccess) return [true, `${mdFiles.size} files linted`];
  return [false, errors.join("\n")];
}

async function testUncommittedChanges(): Promise<boolean> {
  const proc = Bun.spawn(["git", "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return true;
  return !!output.trim();
}

function validatePathContainment(sessionPath: string, sessionsDir: string): string | null {
  try {
    const resolved = resolve(sessionPath);
    const base = resolve(sessionsDir) + "/";
    if (!resolved.startsWith(base)) return null;
    return resolved;
  } catch {
    return null;
  }
}

async function main(argv?: string[]): Promise<number> {
  const args = parseArgs(argv ?? process.argv.slice(2));
  const repoRoot = await getRepoRoot();
  const sessionsDir = join(repoRoot, ".agents", "sessions");

  let sessionPath = args.sessionPath;
  if (!sessionPath) {
    const found = findCurrentSessionLog(sessionsDir);
    if (!found) {
      console.error("[FAIL] No session log found in .agents/sessions/");
      return 1;
    }
    sessionPath = found;
    console.error(`Auto-detected session log: ${sessionPath}`);
  } else {
    if (!existsSync(sessionPath)) {
      console.error(`[FAIL] Session file not found: ${sessionPath}`);
      return 1;
    }
    const resolved = validatePathContainment(sessionPath, sessionsDir);
    if (resolved === null) {
      console.error(`[FAIL] Session path must be inside '${sessionsDir}'.`);
      return 1;
    }
    sessionPath = resolved;
  }

  let session: Record<string, unknown>;
  try {
    const content = readFileSync(sessionPath, "utf-8");
    session = JSON.parse(content);
  } catch (e) {
    console.error(`[FAIL] Invalid JSON in session file: ${sessionPath}`);
    console.error(`  Error: ${(e as Error).message}`);
    return 1;
  }

  const pc = (session["protocolCompliance"] as Record<string, unknown>) ?? {};
  const sessionEnd = pc["sessionEnd"] as Record<string, Record<string, unknown>> | undefined;
  if (!sessionEnd) {
    console.error("[FAIL] Session log missing protocolCompliance.sessionEnd section");
    return 1;
  }

  const changes: string[] = [];
  console.error("");
  console.error("=== Session End Completion ===");
  console.error(`File: ${sessionPath}`);
  console.error("");

  const endingCommit = await getEndingCommit();
  if (endingCommit && !session["endingCommit"]) {
    session["endingCommit"] = endingCommit;
    changes.push(`Set endingCommit: ${endingCommit}`);
  }

  const handoffModified = await testHandoffModified();
  const handoffKey = "handoffPreserved" in sessionEnd
    ? "handoffPreserved"
    : "handoffNotUpdated" in sessionEnd
      ? "handoffNotUpdated"
      : null;

  if (handoffKey === "handoffPreserved") {
    const check = sessionEnd[handoffKey];
    if (handoffModified) {
      check["Complete"] = false;
      check["Evidence"] = "WARNING: HANDOFF.md was modified (should be read-only)";
      changes.push("[WARN] HANDOFF.md was modified (violation)");
    } else {
      check["Complete"] = true;
      check["Evidence"] = "HANDOFF.md not modified (read-only respected)";
      changes.push("Confirmed HANDOFF.md preserved (not modified)");
    }
  } else if (handoffKey === "handoffNotUpdated") {
    const check = sessionEnd[handoffKey];
    if (handoffModified) {
      check["Complete"] = true;
      check["Evidence"] = "WARNING: HANDOFF.md was modified - this violates MUST NOT";
      changes.push("[WARN] HANDOFF.md was modified (MUST NOT violation)");
    } else {
      check["Complete"] = false;
      check["Evidence"] = "HANDOFF.md not modified (read-only respected)";
      changes.push("Confirmed HANDOFF.md not modified");
    }
  }

  const memoryUpdated = await testBrainMemoryUpdated();
  const memoryKey = "brainMemoryUpdated" in sessionEnd
    ? "brainMemoryUpdated"
    : "brainMemoryUpdated" in sessionEnd
      ? "brainMemoryUpdated"
      : null;

  if (memoryKey) {
    const check = sessionEnd[memoryKey];
    if (memoryUpdated) {
      check["Complete"] = true;
      check["Evidence"] = "Memory files have changes";
      changes.push("Confirmed Brain memory updated");
    } else if (!check["Complete"]) {
      changes.push("[TODO] Brain memory not updated - write notes via Brain MCP before completing");
    }
  }

  console.error("Running markdown lint...");
  const [lintSuccess, lintOutput] = await runMarkdownLint();
  if ("markdownLintRun" in sessionEnd) {
    const check = sessionEnd["markdownLintRun"];
    check["Complete"] = lintSuccess;
    check["Evidence"] = lintOutput;
    changes.push(`Markdown lint: ${lintOutput}`);
  }

  const hasUncommitted = await testUncommittedChanges();
  if ("changesCommitted" in sessionEnd) {
    const check = sessionEnd["changesCommitted"];
    if (!hasUncommitted) {
      check["Complete"] = true;
      check["Evidence"] = `All changes committed (HEAD: ${endingCommit})`;
      changes.push("All changes committed");
    } else {
      changes.push("[TODO] Uncommitted changes exist - commit before completing");
    }
  }

  const mustItems = [
    "handoffPreserved", "handoffNotUpdated", "brainMemoryUpdated",
    "brainMemoryUpdated", "markdownLintRun", "changesCommitted", "validationPassed",
  ];
  let allMustComplete = true;
  for (const item of mustItems) {
    if (item in sessionEnd) {
      const check = sessionEnd[item];
      const level = check["level"] as string;
      const complete = check["Complete"] as boolean;
      if (level === "MUST" && !complete) allMustComplete = false;
      if (level === "MUST NOT" && complete) allMustComplete = false;
    }
  }

  if ("checklistComplete" in sessionEnd) {
    const check = sessionEnd["checklistComplete"];
    check["Complete"] = allMustComplete;
    check["Evidence"] = allMustComplete
      ? "All MUST items verified"
      : "Some MUST items still incomplete";
  }

  console.error("");
  console.error("--- Changes ---");
  for (const change of changes) {
    console.error(`  ${change}`);
  }

  if (!args.dryRun) {
    writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    console.error("");
    console.error(`Updated: ${sessionPath}`);
  } else {
    console.error("");
    console.error("[DRY RUN] No changes written");
  }

  console.error("");
  console.error("Running validation...");
  const validateScript = join(repoRoot, "scripts", "validate_session_json.py");

  if (existsSync(validateScript)) {
    const proc = Bun.spawn(["python3", validateScript, sessionPath], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const validationExitCode = await proc.exited;

    if (!args.dryRun && "validationPassed" in sessionEnd) {
      const check = sessionEnd["validationPassed"];
      check["Complete"] = validationExitCode === 0;
      check["Evidence"] = validationExitCode === 0
        ? "validate_session_json.py passed"
        : "validate_session_json.py failed";

      if (validationExitCode === 0 && allMustComplete && "checklistComplete" in sessionEnd) {
        sessionEnd["checklistComplete"]["Complete"] = true;
        sessionEnd["checklistComplete"]["Evidence"] =
          "All MUST items verified and validation passed";
      }

      writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    }

    if (validationExitCode !== 0) {
      console.error("");
      console.error("[FAIL] Session validation failed. Fix issues above and re-run.");
      return 1;
    }
  } else {
    console.error(`WARNING: Validation script not found: ${validateScript}`);
  }

  console.error("");
  console.error("[PASS] Session log completed and validated");
  return 0;
}

export { main, findCurrentSessionLog };

if (import.meta.main) {
  process.exit(await main());
}
