/**
 * Project directory resolution, git command detection, and session log utilities.
 *
 * Migrated from utilities.py. Pure Bun runtime -- no Node fs imports.
 */

import { resolve, join } from "path";
import { $, Glob } from "bun";

const GIT_COMMIT_PATTERN = /(?:^|\s)git\s+(commit|ci)/;
const GIT_PUSH_PATTERN = /(?:^|\s)git\s+push(?:\s|$)/;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve the project root directory. Never returns undefined.
 *
 * Checks CLAUDE_PROJECT_DIR env var first, then walks up from cwd
 * looking for a .git directory. Falls back to cwd with a warning.
 */
async function getProjectDirectory(): Promise<string> {
  const envDir = (process.env["CLAUDE_PROJECT_DIR"] ?? "").trim();
  if (envDir) {
    return resolve(envDir);
  }

  try {
    let current = resolve(process.cwd());
    for (;;) {
      const gitPath = join(current, ".git");
      // .git can be a file (worktree) or directory. `test -e` handles both.
      const check = await $`test -e ${gitPath}`.nothrow().quiet();
      if (check.exitCode === 0) {
        return current;
      }

      const parent = resolve(current, "..");
      if (parent === current) {
        break;
      }
      current = parent;
    }
  } catch (error) {
    console.warn(
      `Failed to locate project directory: ${error}. Using current directory as fallback.`,
    );
    return resolve(process.cwd());
  }

  console.warn(
    "Project root (.git directory) not found. Using current directory as fallback.",
  );
  return resolve(process.cwd());
}

/**
 * Check if a command string is a git commit or git ci command.
 */
function isGitCommitCommand(command: string | null | undefined): boolean {
  if (!command) {
    return false;
  }
  return GIT_COMMIT_PATTERN.test(command);
}

/**
 * Check if a command string is a git push command.
 */
function isGitPushCommand(command: string | null | undefined): boolean {
  if (!command) {
    return false;
  }
  return GIT_PUSH_PATTERN.test(command);
}

/**
 * Check if a command string is a git commit, ci, or push command.
 */
function isGitCommitOrPushCommand(
  command: string | null | undefined,
): boolean {
  return isGitCommitCommand(command) || isGitPushCommand(command);
}

/**
 * Find the most recent session log for the given date.
 *
 * Returns the absolute path with the latest modification time,
 * or null if no logs are found.
 */
async function getTodaySessionLog(
  sessionsDir: string,
  date?: string,
): Promise<string | null> {
  const effectiveDate = date ?? new Date().toISOString().slice(0, 10);

  if (date !== undefined && !DATE_FORMAT.test(date)) {
    throw new Error(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
  }

  try {
    const glob = new Glob(`${effectiveDate}-session-*.json`);
    const matches: Array<{ path: string; mtime: number }> = [];

    for await (const entry of glob.scan({ cwd: sessionsDir })) {
      const fullPath = join(sessionsDir, entry);
      const file = Bun.file(fullPath);
      matches.push({ path: fullPath, mtime: file.lastModified });
    }

    if (matches.length === 0) {
      return null;
    }

    matches.sort((a, b) => b.mtime - a.mtime);
    return matches[0].path;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("No such file") ||
        error.message.includes("ENOENT"))
    ) {
      console.warn(`Session directory not found: ${sessionsDir}`);
      return null;
    }
    console.warn(
      `Failed to read session logs from ${sessionsDir}: ${error}`,
    );
    return null;
  }
}

/**
 * Find all session logs for today's date.
 *
 * Returns absolute paths. Returns empty array on error.
 */
async function getTodaySessionLogs(
  sessionsDir: string,
): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);

  try {
    const glob = new Glob(`${today}-session-*.json`);
    const results: string[] = [];

    for await (const entry of glob.scan({ cwd: sessionsDir })) {
      results.push(join(sessionsDir, entry));
    }

    return results;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("No such file") ||
        error.message.includes("ENOENT"))
    ) {
      console.warn(`Session directory not found: ${sessionsDir}`);
      return [];
    }
    console.warn(
      `Failed to read session logs from ${sessionsDir}: ${error}`,
    );
    return [];
  }
}

export {
  getProjectDirectory,
  isGitCommitCommand,
  isGitPushCommand,
  isGitCommitOrPushCommand,
  getTodaySessionLog,
  getTodaySessionLogs,
};
