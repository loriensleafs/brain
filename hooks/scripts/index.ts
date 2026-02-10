/**
 * Brain hooks barrel export.
 *
 * Exports all hook handlers and shared utilities for use
 * by adapters and tests.
 */

// Shared utilities
export { execCommand, setExecCommand, resetExecCommand } from "./exec.js";
export {
  resolveProjectFromEnv,
  resolveProjectFromCwd,
  resolveProjectWithCwd,
  loadBrainConfig,
  getEnv,
  setGetEnv,
} from "./project-resolve.js";
export {
  performGateCheck,
  checkToolBlocked,
  isReadOnlyTool,
  getBrainSessionState,
  formatBlockMessage,
} from "./gate-check.js";
export { detectScenario } from "./detect-scenario.js";
export { validateStopReadiness, validateSession } from "./validate.js";
export {
  normalizeEvent,
  detectPlatform,
  getBlockingSemantics,
  readAndNormalize,
} from "./normalize.js";

// Hook handlers
export { runSessionStart } from "./session-start.js";
export { runUserPrompt, processUserPrompt } from "./user-prompt.js";
export { runPreToolUse, processPreToolUse } from "./pre-tool-use.js";
export { runStop, processStop } from "./stop.js";
export { runDetectScenario } from "./detect-scenario-cmd.js";
export { runLoadSkills } from "./load-skills.js";
export { runAnalyze } from "./analyze.js";
export { runValidateSession } from "./validate-session.js";

// Types
export type * from "./types.js";
export type {
  Platform,
  NormalizedEventName,
  NormalizedHookEvent,
  BlockingSemantics,
} from "./normalize.js";
