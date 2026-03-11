#!/usr/bin/env bun
/**
 * Block git commit when staged files match security-sensitive patterns without review.
 *
 * Claude Code PreToolUse hook that enforces the security commit gate.
 * Complements invoke_security_gate.ts (Edit/Write) by also checking
 * at commit time whether staged files touch auth/security paths.
 *
 * Hook Type: PreToolUse
 * Matcher: Bash(git commit*)
 * Exit Codes:
 *   0 = Always (uses JSON decision payload for deny/allow semantics)
 */

import { join } from "path";
import { Glob } from "bun";
import { getMemoriesDir } from "../../lib/utilities.ts";
import { skipIfConsumerRepo } from "../../lib/guards.ts";

// Security-sensitive file path patterns
const SECURITY_PATH_PATTERNS = [
  /(^|[/\\])[Aa]uth[/\\]/,
  /(^|[/\\])[Ss]ecurity[/\\]/,
  /\.env($|\.)/,
  /(^|[/\\])\.githooks[/\\]/,
  /(^|[/\\])secrets[/\\]/,
  /password/i,
  /(^|[/\\])token/,
  /(^|[/\\])[Oo]auth[/\\]/,
  /(^|[/\\])[Jj]wt[/\\]/,
];

// Session log patterns indicating security review
const SECURITY_REVIEW_PATTERNS = [
  /security.*review/i,
  /security.*agent/i,
  /threat.*model/i,
  /OWASP/i,
  /\/security-scan/,
  /subagent_type.*security/i,
];

async function getStagedFiles(): Promise<string[]> {
  const proc = Bun.spawn(["git", "diff", "--cached", "--name-only"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`git diff --cached failed with exit code ${exitCode}`);
  }

  const stdout = (await new Response(proc.stdout).text()).trim();
  if (!stdout) {
    return [];
  }
  return stdout.split("\n");
}

function matchSecurityPaths(files: string[]): string[] {
  const matched: string[] = [];
  for (const f of files) {
    for (const pattern of SECURITY_PATH_PATTERNS) {
      if (pattern.test(f)) {
        matched.push(f);
        break;
      }
    }
  }
  return matched;
}

async function findSecurityEvidence(
  memoriesDir: string,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);

  // Check 1: Security report exists for today
  const securityDir = join(memoriesDir, "security");
  const secDirCheck =
    await Bun.spawn(["test", "-d", securityDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (secDirCheck === 0) {
    try {
      const glob = new Glob(`*${today}*`);
      for await (const _entry of glob.scan({ cwd: securityDir })) {
        return true;
      }
    } catch {
      // ignore glob errors
    }
  }

  // Check 2: Session log contains security review evidence
  const sessionsDir = join(memoriesDir, "sessions");
  const sessDirCheck =
    await Bun.spawn(["test", "-d", sessionsDir], {
      stdout: "pipe",
      stderr: "pipe",
    }).exited;

  if (sessDirCheck === 0) {
    try {
      const glob = new Glob(`${today}-session-*.json`);
      const logPaths: Array<{ path: string; mtime: number }> = [];
      for await (const entry of glob.scan({ cwd: sessionsDir })) {
        const fullPath = join(sessionsDir, entry);
        logPaths.push({
          path: fullPath,
          mtime: Bun.file(fullPath).lastModified,
        });
      }
      logPaths.sort((a, b) => b.mtime - a.mtime);

      for (const logEntry of logPaths) {
        const content = await Bun.file(logEntry.path).text();
        for (const pattern of SECURITY_REVIEW_PATTERNS) {
          if (pattern.test(content)) {
            return true;
          }
        }
      }
    } catch {
      // ignore errors
    }
  }

  return false;
}

async function main(): Promise<number> {
  // Bypass: environment variable
  if (process.env["SKIP_SECURITY_GATE"] === "true") {
    return 0;
  }

  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) {
      return 0;
    }

    const inputData = JSON.parse(inputJson);
    const stdinCwd: string | undefined = inputData?.cwd;

    if (await skipIfConsumerRepo("security-commit-gate", stdinCwd)) {
      return 0;
    }

    const toolInput = inputData?.tool_input;
    if (typeof toolInput !== "object" || toolInput === null) {
      return 0;
    }

    const command: string = toolInput.command ?? "";
    if (!command.includes("git commit")) {
      return 0;
    }

    const staged = await getStagedFiles();
    if (staged.length === 0) {
      return 0;
    }

    const securityFiles = matchSecurityPaths(staged);
    if (securityFiles.length === 0) {
      return 0;
    }

    const memoriesDir = await getMemoriesDir(stdinCwd);
    if (!memoriesDir) {
      // Can't check evidence, fail-open
      return 0;
    }

    if (await findSecurityEvidence(memoriesDir)) {
      return 0;
    }

    // Security files staged without review evidence: deny
    const fileList = securityFiles.map((f) => `  - ${f}`).join("\n");
    const output = {
      decision: "deny",
      reason:
        "SECURITY COMMIT GATE: Security review required before committing " +
        "security-sensitive files.\n\n" +
        `Matched files:\n${fileList}\n\n` +
        "Invoke the security agent:\n" +
        "  Task(subagent_type='security', prompt='Review security-sensitive " +
        "changes')\n\n" +
        "Or create a security report in the security/ memories folder\n\n" +
        "Bypass: Set SKIP_SECURITY_GATE=true (requires justification)",
    };
    console.log(JSON.stringify(output));
    return 0;
  } catch (exc) {
    // Fail-closed on infrastructure errors
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.error(
      `Security commit gate error: ${excType} - ${exc}`,
    );
    const output = {
      decision: "deny",
      reason:
        `SECURITY COMMIT GATE FAILED due to an internal error: ` +
        `${excType}. Commit blocked as a security precaution.`,
    };
    console.log(JSON.stringify(output));
    return 0;
  }
}

process.exit(await main());
