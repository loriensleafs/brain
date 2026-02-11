// Config utilities (legacy basic-memory config)
export {
  type BasicMemoryConfig,
  getAvailableProjects,
  getConfigPath,
  getDefaultProject,
  readConfig,
} from "./config";

// Path resolution utilities (legacy basic-memory)
export {
  detectProjectFromPath,
  getProjectMemoriesPath,
  ProjectNotFoundError,
  resolveProjectMemoriesPath,
} from "./path-resolver";

// Project resolution utilities (Brain config)
export {
  type BrainConfig,
  type BrainProjectConfig,
  type CwdMatchResult,
  getBrainConfigPath,
  getProjectCodePaths,
  loadBrainConfig,
  type ResolveOptions,
  resolveProject,
  resolveProjectFromCwd,
  resolveProjectWithContext,
} from "./project-resolver";

// Worktree detection utilities
export {
  detectWorktreeMainPath,
  type WorktreeDetectionResult,
} from "./worktree-detector";
