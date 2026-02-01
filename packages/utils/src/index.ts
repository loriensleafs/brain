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
  type ResolveOptions,
  getBrainConfigPath,
  getProjectCodePaths,
  loadBrainConfig,
  resolveProject,
  resolveProjectFromCwd,
} from "./project-resolver";
