#!/usr/bin/env bun
/**
 * Routing-level enforcement gates for Claude Code.
 *
 * Blocks high-stakes actions until validation prerequisites are met.
 *
 * Gates:
 * - Gate 2: QA Validation Gate - blocks PR creation without QA evidence
 * - Gate 3: Critic Review Gate - blocks PR merge without critic validation
 * - Gate 4: ADR Existence Gate - blocks feature PR creation without ADR evidence
 *
 * Hook Type: PreToolUse
 * Exit Codes:
 *   0 = Always (uses JSON decision payload for deny/allow semantics)
 */

import { join, resolve } from "path";
import { Glob } from "bun";
import { skipIfConsumerRepo } from "../lib/guards.ts";
import { getMemoriesDir } from "../lib/utilities.ts";

const QA_EVIDENCE_PATTERN =
  /(?:## QA|qa agent|Test Results|QA Validation|Test Strategy)/i;
const CRITIC_EVIDENCE_PATTERN =
  /(?:critic agent|critic review|APPROVED|REJECTED|NEEDS.?WORK)/i;
const ADR_EVIDENCE_PATTERN =
  /(?:architect agent|architecture review|ADR-\d+|architectural decision)/i;

// Feature branch patterns (require ADR)
const FEATURE_BRANCH_PATTERN = /^(feat|feature)\//;

// Documentation-only file patterns
const DOC_PATTERNS = [
  /\.md$/,
  /\.txt$/,
  /(^|\/)README$/,
  /(^|\/)LICENSE$/,
  /(^|\/)CHANGELOG$/,
  /\.gitignore$/,
];

async function writeAuditLog(
  hookName: string,
  message: string,
): Promise<void> {
  try {
    const scriptDir = resolve(import.meta.dir);
    const auditLogPath = join(scriptDir, "audit.log");
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const entry = `[${timestamp}] [${hookName}] ${message}\n`;
    const file = Bun.file(auditLogPath);
    const existing = (await file.exists()) ? await file.text() : "";
    await Bun.write(auditLogPath, existing + entry);
  } catch (exc) {
    console.error(`[${hookName}] Audit log write failed: ${exc}`);
    try {
      const tmpDir =
        process.env["TMPDIR"] ?? process.env["TEMP"] ?? "/tmp";
      const tempPath = join(tmpDir, "claude-hook-audit.log");
      const timestamp = new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, 19);
      const entry = `[${timestamp}] [${hookName}] ${message}\n`;
      const file = Bun.file(tempPath);
      const existing = (await file.exists()) ? await file.text() : "";
      await Bun.write(tempPath, existing + entry);
    } catch {
      console.error(
        `[${hookName}] CRITICAL: All audit log paths failed. Original message: ${message}`,
      );
    }
  }
}

async function getTodaySessionLogLocal(
  memoriesDir: string,
): Promise<string | null> {
  const sessionDir = join(memoriesDir, "sessions");
  const today = new Date().toISOString().slice(0, 10);

  const dirCheck =
    await Bun.spawn(["test", "-d", sessionDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (dirCheck !== 0) {
    console.error(
      `routing_gates: Session directory not found: ${sessionDir}`,
    );
    return null;
  }

  try {
    const glob = new Glob(`${today}-session-*.json`);
    const logs: string[] = [];
    for await (const entry of glob.scan({ cwd: sessionDir })) {
      logs.push(entry);
    }
    if (logs.length === 0) {
      return null;
    }
    logs.sort().reverse();
    return join(sessionDir, logs[0]);
  } catch (exc) {
    const msg = `Failed to read session logs from ${sessionDir}: ${exc}`;
    console.error(`routing_gates: ${msg}`);
    await writeAuditLog("RoutingGates", `Session log read error: ${exc}`);
    return null;
  }
}

async function readSessionLogContent(
  sessionLog: string,
): Promise<string | null> {
  try {
    return await Bun.file(sessionLog).text();
  } catch (exc) {
    const msg = `Session log exists but cannot be read: ${exc}`;
    console.error(`routing_gates: ${msg}`);
    await writeAuditLog("RoutingGates", `Session log read failed: ${exc}`);
    return null;
  }
}

async function checkQaEvidence(memoriesDir: string): Promise<boolean> {
  // Option 1: QA report in qa/ from last 24 hours
  const qaDir = join(memoriesDir, "qa");
  const qaDirCheck =
    await Bun.spawn(["test", "-d", qaDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (qaDirCheck === 0) {
    const cutoffTime = Date.now() - 24 * 3600 * 1000;
    const glob = new Glob("*.md");
    for await (const entry of glob.scan({ cwd: qaDir })) {
      const file = Bun.file(join(qaDir, entry));
      if (file.lastModified > cutoffTime) {
        return true;
      }
    }
  }

  // Option 2: QA section in session log
  const sessionLog = await getTodaySessionLogLocal(memoriesDir);
  if (sessionLog !== null) {
    const content = await readSessionLogContent(sessionLog);
    if (content && QA_EVIDENCE_PATTERN.test(content)) {
      return true;
    }
  }

  return false;
}

async function checkCriticEvidence(memoriesDir: string): Promise<boolean> {
  // Option 1: Critique file in critique/ from last 24 hours
  const critiqueDir = join(memoriesDir, "critique");
  const critDirCheck =
    await Bun.spawn(["test", "-d", critiqueDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (critDirCheck === 0) {
    const cutoffTime = Date.now() - 24 * 3600 * 1000;
    const glob = new Glob("*.md");
    for await (const entry of glob.scan({ cwd: critiqueDir })) {
      const file = Bun.file(join(critiqueDir, entry));
      if (file.lastModified > cutoffTime) {
        return true;
      }
    }
  }

  // Option 2: Critic verdict in session log
  const sessionLog = await getTodaySessionLogLocal(memoriesDir);
  if (sessionLog !== null) {
    const content = await readSessionLogContent(sessionLog);
    if (content && CRITIC_EVIDENCE_PATTERN.test(content)) {
      return true;
    }
  }

  return false;
}

async function getCurrentBranch(): Promise<string> {
  const proc = Bun.spawn(["git", "branch", "--show-current"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`git branch --show-current failed with exit code ${exitCode}`);
  }

  const branch = (await new Response(proc.stdout).text()).trim();
  if (!branch) {
    throw new Error(
      "Failed to get current branch name (e.g., detached HEAD).",
    );
  }
  return branch;
}

function isFeatureBranch(branch: string): boolean {
  if (!branch) {
    return false;
  }
  return FEATURE_BRANCH_PATTERN.test(branch);
}

async function checkAdrEvidence(memoriesDir: string): Promise<boolean> {
  // Option 1: ADR file in decisions/ modified within last 7 days
  const adrDir = join(memoriesDir, "decisions");
  const adrDirCheck =
    await Bun.spawn(["test", "-d", adrDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (adrDirCheck === 0) {
    const cutoffTime = Date.now() - 7 * 24 * 3600 * 1000;
    const glob = new Glob("ADR-*.md");
    for await (const entry of glob.scan({ cwd: adrDir })) {
      try {
        const file = Bun.file(join(adrDir, entry));
        if (file.lastModified > cutoffTime) {
          return true;
        }
      } catch {
        continue;
      }
    }
  }

  // Option 2: Architect agent section in session log
  const sessionLog = await getTodaySessionLogLocal(memoriesDir);
  if (sessionLog !== null) {
    const content = await readSessionLogContent(sessionLog);
    if (content && ADR_EVIDENCE_PATTERN.test(content)) {
      return true;
    }
  }

  return false;
}

async function checkDocumentationOnly(): Promise<boolean> {
  try {
    let proc = Bun.spawn(
      ["git", "diff", "--name-only", "origin/main...HEAD"],
      { stdout: "pipe", stderr: "pipe" },
    );
    let exitCode = await proc.exited;

    if (exitCode !== 0) {
      proc = Bun.spawn(
        ["git", "diff", "--name-only", "origin/main"],
        { stdout: "pipe", stderr: "pipe" },
      );
      exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderrText = (
          await new Response(proc.stderr).text()
        ).trim();
        const errorMsg = `git diff failed (exit ${exitCode}): ${stderrText}`;
        console.error(
          `routing_gates: ${errorMsg}. Failing closed (git errors block).`,
        );
        await writeAuditLog("RoutingGates", errorMsg);
        return false;
      }
    }

    const changedFiles = (
      await new Response(proc.stdout).text()
    ).trim();
    if (!changedFiles) {
      return true; // No changes, allow (fail-open)
    }

    for (const filePath of changedFiles.split("\n")) {
      const isDoc = DOC_PATTERNS.some((pat) => pat.test(filePath));
      if (!isDoc) {
        return false; // Code file found
      }
    }

    return true; // All files are documentation
  } catch (exc) {
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    const errorMsg = `Error checking changed files: ${excType} - ${exc}`;
    console.error(
      `routing_gates: ${errorMsg}. Failing closed (QA required).`,
    );
    await writeAuditLog("RoutingGates", errorMsg);
    return false;
  }
}

async function isValidProjectRoot(effectiveCwd: string): Promise<boolean> {
  const indicators = [".claude/settings.json", ".git"];
  for (const indicator of indicators) {
    const checkPath = join(effectiveCwd, indicator);
    const check =
      await Bun.spawn(["test", "-e", checkPath], {
        stdout: "pipe",
        stderr: "pipe",
      }).exited;
    if (check === 0) {
      return true;
    }
  }
  return false;
}

async function main(): Promise<number> {
  let inputData: Record<string, unknown> = {};
  let command = "";
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    inputData = JSON.parse(inputJson);
    const toolInput = inputData?.tool_input;
    if (typeof toolInput === "object" && toolInput !== null) {
      const cmd = (toolInput as Record<string, unknown>).command;
      if (typeof cmd === "string") {
        command = cmd;
      }
    }
  } catch (exc) {
    console.error(
      `routing_gates: Failed to parse input JSON. Error: ${exc}. ` +
        "Assuming empty command and allowing action.",
    );
    command = "";
  }

  const stdinCwd = typeof inputData?.cwd === "string" ? inputData.cwd : undefined;

  if (await skipIfConsumerRepo("routing-gates", stdinCwd)) {
    return 0;
  }

  const effectiveCwd = stdinCwd?.trim() || process.cwd();
  if (!(await isValidProjectRoot(effectiveCwd))) {
    console.error(
      `routing_gates: CWD '${effectiveCwd}' does not appear to be a project root ` +
        "(missing .claude/settings.json or .git). Failing open.",
    );
    return 0;
  }

  // Resolve Brain memories directory
  const memoriesDir = await getMemoriesDir(stdinCwd);
  if (!memoriesDir) {
    console.error(
      "[SKIP] routing-gates: Could not resolve Brain memories directory",
    );
    return 0;
  }

  // Pre-check: graceful degradation when sessions directory is absent
  const sessionsDir = join(memoriesDir, "sessions");
  const sessionsDirCheck =
    await Bun.spawn(["test", "-d", sessionsDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (sessionsDirCheck !== 0) {
    console.error(
      `[SKIP] routing-gates: ${sessionsDir} not found ` +
        "(sessions directory missing)",
    );
    return 0;
  }

  // Gate 2: QA Validation (for PR creation)
  if (command.includes("gh pr create")) {
    let qaBypassed = false;

    // Bypass 1: Environment variable override
    if (process.env["SKIP_QA_GATE"] === "true") {
      await writeAuditLog(
        "RoutingGates",
        "QA gate bypassed via SKIP_QA_GATE environment variable",
      );
      qaBypassed = true;
    }

    // Bypass 2: Documentation-only changes
    if (!qaBypassed && (await checkDocumentationOnly())) {
      qaBypassed = true;
    }

    // Main check: QA evidence required
    if (!qaBypassed && !(await checkQaEvidence(memoriesDir))) {
      const output = {
        decision: "deny",
        reason:
          "QA VALIDATION GATE: QA evidence required before PR creation.\n\n" +
          "Invoke the QA agent to verify changes:\n" +
          "  #runSubagent with subagentType=qa prompt='Verify changes for PR'\n\n" +
          "Or create a QA report file in the qa/ memories folder\n\n" +
          "Bypass conditions:\n" +
          "- Documentation-only PRs (auto-detected based on file extensions)\n" +
          "- Set SKIP_QA_GATE=true environment variable (requires justification)",
      };
      console.log(JSON.stringify(output));
      return 0;
    }
  }

  // Gate 3: Critic Review (for PR merge)
  if (command.includes("gh pr merge")) {
    // Bypass 1: Environment variable override
    if (process.env["SKIP_CRITIC_GATE"] === "true") {
      await writeAuditLog(
        "RoutingGates",
        "Critic gate bypassed via SKIP_CRITIC_GATE environment variable",
      );
      return 0;
    }

    // Bypass 2: Documentation-only changes
    if (await checkDocumentationOnly()) {
      return 0;
    }

    // Main check: Critic evidence required
    if (!(await checkCriticEvidence(memoriesDir))) {
      const output = {
        decision: "deny",
        reason:
          "CRITIC REVIEW GATE: Critic validation required before merge.\n\n" +
          "Run: Task(subagent_type='critic', prompt='Validate this PR " +
          "for merge readiness')\n\n" +
          "Expected verdict: APPROVED / REJECTED / NEEDS WORK\n\n" +
          "Or create a critique file in the critique/ memories folder\n\n" +
          "Bypass conditions:\n" +
          "- Documentation-only PRs (auto-detected based on file extensions)\n" +
          "- Set SKIP_CRITIC_GATE=true environment variable " +
          "(requires justification)",
      };
      console.log(JSON.stringify(output));
      return 0;
    }
  }

  // Gate 4: ADR Existence (for feature PR creation)
  if (command.includes("gh pr create")) {
    // Bypass 1: Environment variable override
    if (process.env["SKIP_ADR_GATE"] === "true") {
      await writeAuditLog(
        "RoutingGates",
        "ADR gate bypassed via SKIP_ADR_GATE environment variable",
      );
      return 0;
    }

    let branch: string;
    try {
      branch = await getCurrentBranch();
    } catch (exc) {
      const excType =
        exc instanceof Error ? exc.constructor.name : typeof exc;
      const msg = `get_current_branch failed: ${excType} - ${exc}`;
      console.error(`routing_gates: ${msg}`);
      const output = {
        decision: "deny",
        reason:
          `ADR EXISTENCE GATE FAILED due to an internal error: ` +
          `${excType}. PR creation blocked as a precaution.`,
      };
      console.log(JSON.stringify(output));
      return 0;
    }

    if (!isFeatureBranch(branch)) {
      return 0;
    }

    // Bypass 3: Documentation-only changes
    if (await checkDocumentationOnly()) {
      return 0;
    }

    // Main check: ADR evidence required for feature branches
    if (!(await checkAdrEvidence(memoriesDir))) {
      const output = {
        decision: "deny",
        reason:
          "ADR EXISTENCE GATE: Architecture decision record required " +
          "before creating a feature PR.\n\n" +
          `Feature branch detected: ${branch}\n\n` +
          "Invoke the architect agent to create an ADR:\n" +
          "  Task(subagent_type='architect', prompt='Create ADR for " +
          "this feature')\n\n" +
          "Or create an ADR file in the decisions/ memories folder (ADR-NNN-*.md)\n\n" +
          "Bypass conditions:\n" +
          "- Non-feature branches (fix/*, docs/*, chore/*, etc.)\n" +
          "- Documentation-only PRs (auto-detected)\n" +
          "- Set SKIP_ADR_GATE=true environment variable " +
          "(requires justification)",
      };
      console.log(JSON.stringify(output));
      return 0;
    }
  }

  return 0;
}

process.exit(await main());
