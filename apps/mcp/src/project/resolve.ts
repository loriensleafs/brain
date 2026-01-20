/**
 * Project resolution with 3-level hierarchy.
 *
 * Resolution priority:
 * 1. Explicit parameter
 * 2. Session state (in-memory)
 * 3. BM_PROJECT env var
 * 4. BM_ACTIVE_PROJECT env var (legacy)
 * 5. null → caller shows error
 *
 * CWD matching was removed to make resolution more explicit and less confusing.
 */

import { logger } from "../utils/internal/logger";

// Session state (in-memory, per-process)
let activeProject: string | null = null;

/**
 * Resolve project using the hierarchy.
 *
 * @param explicit - Explicitly specified project name (highest priority)
 * @returns Resolved project name or null if none found
 */
export function resolveProject(explicit?: string): string | null {
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

  // 5. No project resolved
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
 * Get the resolution hierarchy for debugging/display.
 */
export function getResolutionHierarchy(): string[] {
  return [
    "1. Explicit parameter",
    `2. Session state: ${activeProject || "none"}`,
    `3. BM_PROJECT env: ${process.env.BM_PROJECT || "none"}`,
    `4. BM_ACTIVE_PROJECT env: ${process.env.BM_ACTIVE_PROJECT || "none"}`,
    "5. null (error)",
  ];
}
