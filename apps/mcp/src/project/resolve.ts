/**
 * Project resolution with hierarchy.
 *
 * Resolution is delegated to @brain/utils which implements:
 * 1. Explicit parameter
 * 2. Brain CLI active project (via "brain config get active-project")
 * 3. BRAIN_PROJECT env var
 * 4. BM_PROJECT env var
 * 5. CWD matching against Brain config code_paths
 * 6. null → caller shows error
 *
 * This module adds MCP-specific session state management on top.
 *
 * @see ADR-020 for configuration architecture
 */

// Re-export from utils - this is the canonical implementation
export { type ResolveOptions, resolveProject } from "@brain/utils";

import { logger } from "../utils/internal/logger";

// Session state (in-memory, per-process)
// This is MCP-server specific and augments the utils resolution.
let activeProject: string | null = null;

/**
 * Set the active project for this session.
 * Sets BM_PROJECT env var so utils resolveProject() picks it up at level 4.
 */
export function setActiveProject(project: string): void {
  activeProject = project;
  process.env.BM_PROJECT = project;
  logger.info({ project }, "Active project set");
}

/**
 * Clear the active project session state.
 */
export function clearActiveProject(): void {
  activeProject = null;
  delete process.env.BM_PROJECT;
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
    "2. Brain CLI active project",
    `3. BRAIN_PROJECT env: ${process.env.BRAIN_PROJECT || "none"}`,
    `4. BM_PROJECT env: ${process.env.BM_PROJECT || "none"} (session: ${activeProject || "none"})`,
    "5. CWD matching against Brain config",
    "6. null (error)",
  ];
}
