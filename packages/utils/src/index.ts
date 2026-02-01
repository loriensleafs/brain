// Config utilities
export {
  readConfig,
  getConfigPath,
  getAvailableProjects,
  getDefaultProject,
  type BasicMemoryConfig,
} from "./config";

// Path resolution utilities
export {
  getProjectMemoriesPath,
  resolveProjectMemoriesPath,
  detectProjectFromPath,
  ProjectNotFoundError,
} from "./path-resolver";
