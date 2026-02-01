/**
 * Config Diff Detection
 *
 * Detects changes between Brain configuration versions to support:
 * - Live reconfiguration after manual edits
 * - Migration decisions (which projects affected)
 * - Rollback targeting (what changed since last known good)
 *
 * @see ADR-020 for the config change protocol
 * @see TASK-020-23 for acceptance criteria
 */

import type { BrainConfig, ProjectConfig } from "./schema";

/**
 * Result of comparing two Brain configurations.
 *
 * Provides granular change detection for targeted reconfiguration.
 */
export interface ConfigDiff {
  /** Projects that exist in new config but not in old */
  projectsAdded: string[];

  /** Projects that exist in old config but not in new */
  projectsRemoved: string[];

  /** Projects that exist in both configs but have different field values */
  projectsModified: string[];

  /** Top-level fields that changed (defaults, sync, logging, watcher) */
  globalFieldsChanged: string[];

  /** Whether the diff contains any changes */
  hasChanges: boolean;

  /** Whether the changes require migration (path changes, project adds/removes) */
  requiresMigration: boolean;
}

/**
 * Detailed change information for a single project.
 */
export interface ProjectFieldChanges {
  /** Fields that were added (didn't exist before) */
  fieldsAdded: string[];

  /** Fields that were removed (existed before but not now) */
  fieldsRemoved: string[];

  /** Fields that changed values */
  fieldsModified: string[];
}

/**
 * Extended diff with per-project change details.
 */
export interface DetailedConfigDiff extends ConfigDiff {
  /** Per-project field changes for modified projects */
  projectChanges: Record<string, ProjectFieldChanges>;

  /** Specific global field changes with old and new values */
  globalChanges: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

/**
 * Detect differences between two Brain configurations.
 *
 * This function compares old and new configurations to identify:
 * - Added/removed/modified projects
 * - Changed global fields (defaults, sync, logging, watcher)
 *
 * @param oldConfig - Previous configuration (or null for initial)
 * @param newConfig - New configuration to compare
 * @returns ConfigDiff describing all changes
 *
 * @example
 * ```typescript
 * const diff = detectConfigDiff(oldConfig, newConfig);
 * if (diff.projectsAdded.length > 0) {
 *   console.log("New projects:", diff.projectsAdded);
 * }
 * if (diff.requiresMigration) {
 *   console.log("Migration required for path changes");
 * }
 * ```
 */
export function detectConfigDiff(
  oldConfig: BrainConfig | null,
  newConfig: BrainConfig,
): ConfigDiff {
  // Handle null oldConfig (initial configuration)
  if (oldConfig === null) {
    const projectNames = Object.keys(newConfig.projects ?? {});
    return {
      projectsAdded: projectNames,
      projectsRemoved: [],
      projectsModified: [],
      globalFieldsChanged: ["defaults", "sync", "logging", "watcher"],
      hasChanges: true,
      requiresMigration: projectNames.length > 0,
    };
  }

  const projectsAdded: string[] = [];
  const projectsRemoved: string[] = [];
  const projectsModified: string[] = [];
  const globalFieldsChanged: string[] = [];

  // Detect project changes
  const oldProjectNames = new Set(Object.keys(oldConfig.projects ?? {}));
  const newProjectNames = new Set(Object.keys(newConfig.projects ?? {}));

  // Projects added in new config
  for (const name of newProjectNames) {
    if (!oldProjectNames.has(name)) {
      projectsAdded.push(name);
    }
  }

  // Projects removed from new config
  for (const name of oldProjectNames) {
    if (!newProjectNames.has(name)) {
      projectsRemoved.push(name);
    }
  }

  // Projects that exist in both - check for modifications
  for (const name of oldProjectNames) {
    if (newProjectNames.has(name)) {
      const oldProject = oldConfig.projects?.[name];
      const newProject = newConfig.projects?.[name];
      if (
        oldProject &&
        newProject &&
        !projectConfigsEqual(oldProject, newProject)
      ) {
        projectsModified.push(name);
      }
    }
  }

  // Detect global field changes
  if (!defaultsEqual(oldConfig.defaults, newConfig.defaults)) {
    globalFieldsChanged.push("defaults");
  }
  if (!syncEqual(oldConfig.sync, newConfig.sync)) {
    globalFieldsChanged.push("sync");
  }
  if (!loggingEqual(oldConfig.logging, newConfig.logging)) {
    globalFieldsChanged.push("logging");
  }
  if (!watcherEqual(oldConfig.watcher, newConfig.watcher)) {
    globalFieldsChanged.push("watcher");
  }

  const hasChanges =
    projectsAdded.length > 0 ||
    projectsRemoved.length > 0 ||
    projectsModified.length > 0 ||
    globalFieldsChanged.length > 0;

  // Migration is required when:
  // - Projects are added (need to set up memories path)
  // - Projects are removed (may need to clean up)
  // - Project paths change (code_path or memories_path)
  // - Default memories_location changes (affects DEFAULT mode projects)
  const requiresMigration =
    projectsAdded.length > 0 ||
    projectsRemoved.length > 0 ||
    projectsModified.some((name) => {
      const oldProject = oldConfig.projects?.[name];
      const newProject = newConfig.projects?.[name];
      if (!oldProject || !newProject) return false;
      return pathFieldsChanged(oldProject, newProject);
    }) ||
    (globalFieldsChanged.includes("defaults") &&
      oldConfig.defaults.memories_location !==
        newConfig.defaults.memories_location);

  return {
    projectsAdded,
    projectsRemoved,
    projectsModified,
    globalFieldsChanged,
    hasChanges,
    requiresMigration,
  };
}

/**
 * Detect detailed differences including per-field changes.
 *
 * Use this for detailed logging or debugging. For normal operation,
 * detectConfigDiff() is sufficient and more efficient.
 *
 * @param oldConfig - Previous configuration (or null for initial)
 * @param newConfig - New configuration to compare
 * @returns DetailedConfigDiff with per-field change information
 */
export function detectDetailedConfigDiff(
  oldConfig: BrainConfig | null,
  newConfig: BrainConfig,
): DetailedConfigDiff {
  const baseDiff = detectConfigDiff(oldConfig, newConfig);
  const projectChanges: Record<string, ProjectFieldChanges> = {};
  const globalChanges: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[] = [];

  // Get detailed changes for modified projects
  for (const name of baseDiff.projectsModified) {
    const oldProject = oldConfig!.projects[name];
    const newProject = newConfig.projects[name];
    if (oldProject && newProject) {
      projectChanges[name] = getProjectFieldChanges(oldProject, newProject);
    }
  }

  // Get detailed global changes
  if (oldConfig !== null) {
    if (baseDiff.globalFieldsChanged.includes("defaults")) {
      if (
        oldConfig.defaults.memories_location !==
        newConfig.defaults.memories_location
      ) {
        globalChanges.push({
          field: "defaults.memories_location",
          oldValue: oldConfig.defaults.memories_location,
          newValue: newConfig.defaults.memories_location,
        });
      }
      if (
        oldConfig.defaults.memories_mode !== newConfig.defaults.memories_mode
      ) {
        globalChanges.push({
          field: "defaults.memories_mode",
          oldValue: oldConfig.defaults.memories_mode,
          newValue: newConfig.defaults.memories_mode,
        });
      }
    }

    if (baseDiff.globalFieldsChanged.includes("sync")) {
      if (oldConfig.sync.enabled !== newConfig.sync.enabled) {
        globalChanges.push({
          field: "sync.enabled",
          oldValue: oldConfig.sync.enabled,
          newValue: newConfig.sync.enabled,
        });
      }
      if (oldConfig.sync.delay_ms !== newConfig.sync.delay_ms) {
        globalChanges.push({
          field: "sync.delay_ms",
          oldValue: oldConfig.sync.delay_ms,
          newValue: newConfig.sync.delay_ms,
        });
      }
    }

    if (baseDiff.globalFieldsChanged.includes("logging")) {
      if (oldConfig.logging.level !== newConfig.logging.level) {
        globalChanges.push({
          field: "logging.level",
          oldValue: oldConfig.logging.level,
          newValue: newConfig.logging.level,
        });
      }
    }

    if (baseDiff.globalFieldsChanged.includes("watcher")) {
      if (oldConfig.watcher.enabled !== newConfig.watcher.enabled) {
        globalChanges.push({
          field: "watcher.enabled",
          oldValue: oldConfig.watcher.enabled,
          newValue: newConfig.watcher.enabled,
        });
      }
      if (oldConfig.watcher.debounce_ms !== newConfig.watcher.debounce_ms) {
        globalChanges.push({
          field: "watcher.debounce_ms",
          oldValue: oldConfig.watcher.debounce_ms,
          newValue: newConfig.watcher.debounce_ms,
        });
      }
    }
  }

  return {
    ...baseDiff,
    projectChanges,
    globalChanges,
  };
}

/**
 * Get a list of affected project names from a diff.
 *
 * Useful for determining which projects need reconfiguration.
 *
 * @param diff - Config diff to analyze
 * @returns Array of all affected project names
 */
export function getAffectedProjects(diff: ConfigDiff): string[] {
  return [
    ...diff.projectsAdded,
    ...diff.projectsRemoved,
    ...diff.projectsModified,
  ];
}

/**
 * Check if a specific project is affected by a diff.
 *
 * @param diff - Config diff to check
 * @param projectName - Project name to look for
 * @returns true if project is affected
 */
export function isProjectAffected(
  diff: ConfigDiff,
  projectName: string,
): boolean {
  return (
    diff.projectsAdded.includes(projectName) ||
    diff.projectsRemoved.includes(projectName) ||
    diff.projectsModified.includes(projectName)
  );
}

/**
 * Check if the diff indicates path-related changes for DEFAULT mode projects.
 *
 * When the default memories_location changes, all projects using DEFAULT mode
 * need their basic-memory paths updated.
 *
 * @param diff - Config diff to check
 * @param oldConfig - Previous config (needed to check mode)
 * @param newConfig - New config
 * @returns Array of project names using DEFAULT mode that are affected
 */
export function getDefaultModeAffectedProjects(
  diff: ConfigDiff,
  oldConfig: BrainConfig | null,
  newConfig: BrainConfig,
): string[] {
  // If memories_location didn't change, no DEFAULT mode projects are affected
  if (
    !diff.globalFieldsChanged.includes("defaults") ||
    oldConfig === null ||
    oldConfig.defaults.memories_location ===
      newConfig.defaults.memories_location
  ) {
    return [];
  }

  // Find all projects using DEFAULT mode
  const affected: string[] = [];
  for (const [name, project] of Object.entries(newConfig.projects)) {
    if (!project) continue;
    // DEFAULT is the mode when memories_mode is not set or explicitly "DEFAULT"
    if (!project.memories_mode || project.memories_mode === "DEFAULT") {
      affected.push(name);
    }
  }

  return affected;
}

// --- Internal comparison functions ---

/**
 * Compare two project configurations for equality.
 */
function projectConfigsEqual(a: ProjectConfig, b: ProjectConfig): boolean {
  return (
    a.code_path === b.code_path &&
    a.memories_path === b.memories_path &&
    a.memories_mode === b.memories_mode
  );
}

/**
 * Check if path-related fields changed between project configs.
 */
function pathFieldsChanged(
  oldProject: ProjectConfig,
  newProject: ProjectConfig,
): boolean {
  return (
    oldProject.code_path !== newProject.code_path ||
    oldProject.memories_path !== newProject.memories_path ||
    oldProject.memories_mode !== newProject.memories_mode
  );
}

/**
 * Get detailed field changes for a project.
 */
function getProjectFieldChanges(
  oldProject: ProjectConfig,
  newProject: ProjectConfig,
): ProjectFieldChanges {
  const fieldsAdded: string[] = [];
  const fieldsRemoved: string[] = [];
  const fieldsModified: string[] = [];

  // Check code_path
  if (oldProject.code_path !== newProject.code_path) {
    fieldsModified.push("code_path");
  }

  // Check memories_path
  if (
    oldProject.memories_path === undefined &&
    newProject.memories_path !== undefined
  ) {
    fieldsAdded.push("memories_path");
  } else if (
    oldProject.memories_path !== undefined &&
    newProject.memories_path === undefined
  ) {
    fieldsRemoved.push("memories_path");
  } else if (oldProject.memories_path !== newProject.memories_path) {
    fieldsModified.push("memories_path");
  }

  // Check memories_mode
  if (
    oldProject.memories_mode === undefined &&
    newProject.memories_mode !== undefined
  ) {
    fieldsAdded.push("memories_mode");
  } else if (
    oldProject.memories_mode !== undefined &&
    newProject.memories_mode === undefined
  ) {
    fieldsRemoved.push("memories_mode");
  } else if (oldProject.memories_mode !== newProject.memories_mode) {
    fieldsModified.push("memories_mode");
  }

  return { fieldsAdded, fieldsRemoved, fieldsModified };
}

/**
 * Compare defaults sections for equality.
 */
function defaultsEqual(
  a: BrainConfig["defaults"],
  b: BrainConfig["defaults"],
): boolean {
  return (
    a.memories_location === b.memories_location &&
    a.memories_mode === b.memories_mode
  );
}

/**
 * Compare sync sections for equality.
 */
function syncEqual(a: BrainConfig["sync"], b: BrainConfig["sync"]): boolean {
  return a.enabled === b.enabled && a.delay_ms === b.delay_ms;
}

/**
 * Compare logging sections for equality.
 */
function loggingEqual(
  a: BrainConfig["logging"],
  b: BrainConfig["logging"],
): boolean {
  return a.level === b.level;
}

/**
 * Compare watcher sections for equality.
 */
function watcherEqual(
  a: BrainConfig["watcher"],
  b: BrainConfig["watcher"],
): boolean {
  return a.enabled === b.enabled && a.debounce_ms === b.debounce_ms;
}

/**
 * Create a human-readable summary of config changes.
 *
 * Useful for logging and user feedback.
 *
 * @param diff - Config diff to summarize
 * @returns Multi-line string describing changes
 */
export function summarizeConfigDiff(diff: ConfigDiff): string {
  if (!diff.hasChanges) {
    return "No configuration changes detected.";
  }

  const lines: string[] = [];

  if (diff.projectsAdded.length > 0) {
    lines.push(`Projects added: ${diff.projectsAdded.join(", ")}`);
  }
  if (diff.projectsRemoved.length > 0) {
    lines.push(`Projects removed: ${diff.projectsRemoved.join(", ")}`);
  }
  if (diff.projectsModified.length > 0) {
    lines.push(`Projects modified: ${diff.projectsModified.join(", ")}`);
  }
  if (diff.globalFieldsChanged.length > 0) {
    lines.push(
      `Global settings changed: ${diff.globalFieldsChanged.join(", ")}`,
    );
  }

  if (diff.requiresMigration) {
    lines.push("Migration required: Yes");
  }

  return lines.join("\n");
}
