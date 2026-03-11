#!/usr/bin/env bun
/**
 * Enforce session protocol initialization at session start.
 *
 * Claude Code SessionStart hook that warns against working on main/master
 * branches and injects git state into Claude's context.
 *
 * Checks:
 * 1. Current branch is not main/master (WARNING injected into context)
 * 2. Session log status for today (reported, not blocking)
 *
 * NOTE: SessionStart hooks cannot block (exit 2 only shows stderr as error,
 * does not block the session, and prevents stdout from being injected).
 *
 * Hook Type: SessionStart
 * Exit Codes:
 *   0 = Success (stdout injected into Claude's context)
 */

import { join } from "path";
import { Glob } from "bun";
import {
  getProjectDirectory,
  getMemoriesDir,
  getTodaySessionLog,
} from "../../lib/utilities.ts";
import { skipIfConsumerRepo } from "../../lib/guards.ts";

const PROTECTED_BRANCHES = ["main", "master"];

async function getCurrentBranch(): Promise<string | null> {
  try {
    const proc = Bun.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const text = await new Response(proc.stdout).text();
      return text.trim();
    }
  } catch {
    // git not available
  }
  return null;
}

function isProtectedBranch(branch: string | null): boolean {
  if (!branch) {
    return false;
  }
  return PROTECTED_BRANCHES.includes(branch);
}

async function getSessionStatus(memoriesDir: string | null): Promise<string> {
  if (!memoriesDir) return "none (Brain memories not configured)";
  const sessionsDir = join(memoriesDir, "sessions");
  const sessionLog = await getTodaySessionLog(sessionsDir);
  if (sessionLog === null) {
    return "none (run /session-init)";
  }
  // Extract filename from full path
  const parts = sessionLog.split("/");
  return parts[parts.length - 1];
}

async function main(): Promise<number> {
  const input = await Bun.file("/dev/stdin").json().catch(() => ({}));
  const cwd: string | undefined = input?.cwd;

  if (await skipIfConsumerRepo("session-init-enforcer", cwd)) {
    return 0;
  }

  try {
    const projectDir = await getProjectDirectory(cwd);
    const memoriesDir = await getMemoriesDir(cwd);
    const currentBranch = await getCurrentBranch();

    if (isProtectedBranch(currentBranch)) {
      console.log(
        `\n## WARNING: On Protected Branch\n\n` +
          `**Current Branch**: \`${currentBranch}\` ` +
          `- Switch to feature branch. Commits blocked by pre-commit hooks.\n\n` +
          "```bash\ngit checkout -b feat/your-feature-name\n```",
      );
      return 0;
    }

    const sessionStatus = await getSessionStatus(memoriesDir);

    // Run brain bootstrap to inject full context into the conversation
    try {
      const bootstrap = Bun.spawn(["brain", "bootstrap"], {
        cwd: projectDir,
        stdout: "pipe",
        stderr: "pipe",
      });
      const exitCode = await bootstrap.exited;
      if (exitCode === 0) {
        const output = await new Response(bootstrap.stdout).text();
        if (output.trim()) {
          console.log(output.trim());
          return 0;
        }
      }
    } catch {
      // brain CLI not available, fall back to status line
    }

    // Fallback if bootstrap fails
    console.log(
      `Branch: \`${currentBranch}\` | Session: ${sessionStatus} | Status: ready`,
    );
    return 0;
  } catch (exc) {
    const excType =
      exc instanceof Error ? exc.constructor.name : typeof exc;
    console.log(
      `Session initialization enforcer error: ${excType} - ${exc}`,
    );
    return 0;
  }
}

process.exit(await main());
