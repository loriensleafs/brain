/**
 * Worktree Memories Path Override
 *
 * When a project is resolved via worktree detection AND uses CODE memories mode,
 * the memories path must be overridden to the actual worktree's docs/ directory
 * (not the main repo's docs/).
 *
 * This module manages the runtime override state and applies it before
 * basic-memory API calls.
 *
 * Key distinction:
 * - effectiveCwd = main repo path (used for project identification only)
 * - actualCwd = the real worktree path where the user is working
 * - For CODE mode: memories path = actualCwd + "/docs"
 *
 * @see TASK-006 MCP Server Runtime Override
 * @see FEAT-003 Worktree-Aware Project Resolution
 */

import * as path from "node:path";
import { loadBrainConfigSync } from "../config/brain-config";
import { logger } from "../utils/internal/logger";

/**
 * State for a worktree override session.
 */
export interface WorktreeOverride {
  /** The project name (from config matching) */
  projectName: string;
  /** The actual CWD (worktree directory) where the user is working */
  actualCwd: string;
  /** The effective CWD (main repo path) used for project identification */
  effectiveCwd: string;
  /** The overridden memories path (actualCwd + "/docs") */
  memoriesPath: string;
}

/**
 * In-memory override state.
 * Key: project name
 * Value: worktree override details
 *
 * Only one override per project name is active at a time.
 * Multiple concurrent worktree sessions for different projects are supported.
 */
const overrideMap = new Map<string, WorktreeOverride>();

/**
 * Check if a project should have its memories path overridden for worktree CODE mode.
 *
 * Conditions:
 * 1. The project was resolved via worktree detection (isWorktreeResolved = true)
 * 2. The project uses CODE memories_mode
 *
 * @param projectName - The resolved project name
 * @param isWorktreeResolved - Whether the project was resolved via worktree detection
 * @param actualCwd - The actual CWD (worktree directory)
 * @param effectiveCwd - The effective CWD (main repo path)
 * @returns WorktreeOverride if override should be applied, null otherwise
 */
export function computeWorktreeOverride(
  projectName: string,
  isWorktreeResolved: boolean,
  actualCwd: string,
  effectiveCwd: string,
): WorktreeOverride | null {
  if (!isWorktreeResolved) {
    return null;
  }

  // Load Brain config to check memories_mode
  const config = loadBrainConfigSync();
  const projectConfig = config.projects[projectName];

  if (!projectConfig) {
    logger.debug({ projectName }, "Worktree override: project not found in Brain config");
    return null;
  }

  // Determine effective memories mode (project-level or global default)
  const memoriesMode = projectConfig.memories_mode || config.defaults.memories_mode || "DEFAULT";

  if (memoriesMode !== "CODE") {
    logger.debug(
      { projectName, memoriesMode },
      "Worktree override: not CODE mode, skipping override",
    );
    return null;
  }

  const memoriesPath = path.join(actualCwd, "docs");

  logger.debug(
    { projectName, actualCwd, effectiveCwd, memoriesPath },
    "Worktree CODE mode override computed",
  );

  return {
    projectName,
    actualCwd,
    effectiveCwd,
    memoriesPath,
  };
}

/**
 * Set the active worktree override for a project.
 *
 * @param override - The override to apply
 */
export function setWorktreeOverride(override: WorktreeOverride): void {
  overrideMap.set(override.projectName, override);
  logger.info(
    {
      projectName: override.projectName,
      actualCwd: override.actualCwd,
      memoriesPath: override.memoriesPath,
    },
    "Worktree CODE mode override active",
  );
}

/**
 * Get the active worktree override for a project, if any.
 *
 * @param projectName - The project name to check
 * @returns The active override, or null if none
 */
export function getWorktreeOverride(projectName: string): WorktreeOverride | null {
  return overrideMap.get(projectName) ?? null;
}

/**
 * Clear the worktree override for a project.
 *
 * @param projectName - The project name to clear
 */
export function clearWorktreeOverride(projectName: string): void {
  if (overrideMap.delete(projectName)) {
    logger.debug({ projectName }, "Worktree override cleared");
  }
}

/**
 * Clear all worktree overrides.
 */
export function clearAllWorktreeOverrides(): void {
  overrideMap.clear();
  logger.debug("All worktree overrides cleared");
}

/**
 * Get all active worktree overrides (for debugging/status display).
 */
export function getAllWorktreeOverrides(): ReadonlyMap<string, WorktreeOverride> {
  return overrideMap;
}
