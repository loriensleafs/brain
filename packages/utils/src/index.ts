// Config utilities
export {
  type BasicMemoryConfig,
  getAvailableProjects,
  getConfigPath,
  getDefaultProject,
  readConfig,
} from "./config";

// Path resolution utilities
export {
  detectProjectFromPath,
  getProjectMemoriesPath,
  ProjectNotFoundError,
  resolveProjectMemoriesPath,
} from "./path-resolver";
