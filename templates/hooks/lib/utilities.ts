/**
 * Project directory resolution, git command detection, and session log utilities.
 *
 * Migrated from utilities.py. Pure Bun runtime -- no Node fs imports.
 */

import { resolve, join } from "path";
import { Glob } from "bun";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";

const GIT_COMMIT_PATTERN = /(?:^|\s)git\s+(commit|ci)/;
const GIT_PUSH_PATTERN = /(?:^|\s)git\s+push(?:\s|$)/;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Resolve the project root directory. Never returns undefined.
 *
 * Checks CLAUDE_PROJECT_DIR env var first, then walks up from cwd
 * looking for a .git directory. Falls back to cwd.
 */
async function getProjectDirectory(stdinCwd?: string): Promise<string> {
  // Check explicit env var first (set by Claude Code for hooks)
  const envDir = (process.env["CLAUDE_PROJECT_DIR"] ?? "").trim();
  if (envDir) {
    return resolve(envDir);
  }

  // Use stdin cwd from Claude Code hook JSON, fall back to process.cwd()
  const effectiveCwd = stdinCwd?.trim() || process.cwd();

  // Walk up from effective CWD looking for .git
  // Use existsSync instead of Bun shell to avoid stderr noise
  let current = resolve(effectiveCwd);
  for (;;) {
    const gitPath = join(current, ".git");
    if (existsSync(gitPath)) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return resolve(effectiveCwd);
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
      console.log(`Session directory not found: ${sessionsDir}`);
      return null;
    }
    console.log(
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
      console.log(`Session directory not found: ${sessionsDir}`);
      return [];
    }
    console.log(
      `Failed to read session logs from ${sessionsDir}: ${error}`,
    );
    return [];
  }
}

/**
 * Resolve the Brain memories directory for the current project.
 *
 * Reads Brain config (~/.config/brain/config.json) to find the memories
 * path based on project mode (CODE, DEFAULT, CUSTOM). Falls back to
 * checking for a docs/ directory in the project root.
 *
 * Returns null if no memories directory can be resolved.
 */
async function getMemoriesDir(stdinCwd?: string): Promise<string | null> {
  const projectDir = await getProjectDirectory(stdinCwd);

  const configHome =
    (process.env["XDG_CONFIG_HOME"] ?? "").trim() ||
    join(homedir(), ".config");
  const configPath = join(configHome, "brain", "config.json");

  try {
    if (!existsSync(configPath)) {
      // No Brain config, fall back to docs/ check
      const docsPath = join(projectDir, "docs");
      if (existsSync(docsPath)) return docsPath;
      return null;
    }

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const projects = config?.projects;
    if (typeof projects !== "object" || projects === null) {
      const docsPath = join(projectDir, "docs");
      if (existsSync(docsPath)) return docsPath;
      return null;
    }

    for (const [name, project] of Object.entries(projects)) {
      const proj = project as Record<string, unknown>;
      if (!proj?.code_path || typeof proj.code_path !== "string") continue;

      const codePath = resolve(proj.code_path);
      if (projectDir !== codePath && !projectDir.startsWith(codePath + "/")) {
        continue;
      }

      const mode = String(proj.memories_mode ?? "DEFAULT");
      if (mode === "CODE") return join(codePath, "docs");
      if (mode === "CUSTOM" && typeof proj.memories_path === "string") {
        return resolve(proj.memories_path);
      }

      // DEFAULT mode
      const defaultLocation =
        typeof config.defaults?.memories_location === "string"
          ? config.defaults.memories_location
          : join(homedir(), ".local", "share", "brain", "memories");
      return join(defaultLocation, name);
    }
  } catch {
    // Config not available or malformed
  }

  // Fallback: check if docs/ exists in project dir
  const docsPath = join(projectDir, "docs");
  if (existsSync(docsPath)) return docsPath;

  return null;
}

export {
  getProjectDirectory,
  getMemoriesDir,
  isGitCommitCommand,
  isGitPushCommand,
  isGitCommitOrPushCommand,
  getTodaySessionLog,
  getTodaySessionLogs,
};
