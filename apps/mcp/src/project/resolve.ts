/**
 * Project resolution with 5-level hierarchy.
 *
 * Resolution priority (same as Python memory_wrapper):
 * 1. Explicit parameter
 * 2. Session state (in-memory)
 * 3. BM_PROJECT env var
 * 4. BM_ACTIVE_PROJECT env var (legacy)
 * 5. CWD match against code_paths (deepest first)
 * 6. null → caller prompts user
 */

import * as path from "path";
import { getCodePaths } from "./config";
import { logger } from "../utils/internal/logger";

// Session state (in-memory, per-process)
let activeProject: string | null = null;

/**
 * Resolve project using the 5-level hierarchy.
 *
 * @param explicit - Explicitly specified project name (highest priority)
 * @param cwd - Current working directory for path matching
 * @returns Resolved project name or null if none found
 */
export function resolveProject(
  explicit?: string,
  cwd?: string
): string | null {
  // 1. Explicit parameter always wins
  if (explicit) {
    logger.debug({ project: explicit }, "Project from explicit parameter");
    return explicit;
  }

  // 2. Session state
  if (activeProject) {
    logger.debug({ project: activeProject }, "Project from session state");
    return activeProject;
  }

  // 3. BM_PROJECT env var (preferred)
  const envProject = process.env.BM_PROJECT;
  if (envProject) {
    logger.debug({ project: envProject }, "Project from BM_PROJECT env");
    return envProject;
  }

  // 4. BM_ACTIVE_PROJECT env var (legacy/internal)
  const envActive = process.env.BM_ACTIVE_PROJECT;
  if (envActive) {
    logger.debug({ project: envActive }, "Project from BM_ACTIVE_PROJECT env");
    return envActive;
  }

  // 5. CWD match against code_paths
  const checkCwd = cwd || process.cwd();
  const matched = matchCwdToProject(checkCwd);
  if (matched) {
    logger.debug({ project: matched, cwd: checkCwd }, "Project from CWD match");
    return matched;
  }

  // 6. No project resolved
  logger.debug("No project resolved");
  return null;
}

/**
 * Set the active project for this session.
 * Also sets BM_ACTIVE_PROJECT env var for child processes.
 */
export function setActiveProject(project: string): void {
  activeProject = project;
  process.env.BM_ACTIVE_PROJECT = project;
  logger.info({ project }, "Active project set");
}

/**
 * Clear the active project session state.
 */
export function clearActiveProject(): void {
  activeProject = null;
  delete process.env.BM_ACTIVE_PROJECT;
  logger.info("Active project cleared");
}

/**
 * Get the currently active project (session state only).
 */
export function getActiveProject(): string | null {
  return activeProject;
}

/**
 * Match a working directory to a project by code path.
 *
 * Returns the project whose code_path is the deepest (most specific)
 * ancestor of cwd. This handles nested project directories correctly.
 */
function matchCwdToProject(cwd: string): string | null {
  const codePaths = getCodePaths();

  if (Object.keys(codePaths).length === 0) {
    return null;
  }

  let bestMatch: { project: string; depth: number } | null = null;
  const normalizedCwd = path.resolve(cwd);

  for (const [project, codePath] of Object.entries(codePaths)) {
    if (!codePath) continue;

    const normalizedCodePath = path.resolve(codePath);

    // Check if cwd is inside or equals code_path
    if (
      normalizedCwd === normalizedCodePath ||
      normalizedCwd.startsWith(normalizedCodePath + path.sep)
    ) {
      const depth = normalizedCodePath.split(path.sep).length;

      if (!bestMatch || depth > bestMatch.depth) {
        bestMatch = { project, depth };
      }
    }
  }

  return bestMatch?.project || null;
}

/**
 * Get the resolution hierarchy for debugging/display.
 */
export function getResolutionHierarchy(): string[] {
  return [
    "1. Explicit parameter",
    `2. Session state: ${activeProject || "none"}`,
    `3. BM_PROJECT env: ${process.env.BM_PROJECT || "none"}`,
    `4. BM_ACTIVE_PROJECT env: ${process.env.BM_ACTIVE_PROJECT || "none"}`,
    "5. CWD match against code_paths",
    "6. null (prompt user)",
  ];
}
