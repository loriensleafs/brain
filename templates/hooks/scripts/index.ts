/**
 * Brain hooks barrel export.
 *
 * Exports all hook handlers and shared utilities for use
 * by adapters and tests.
 */

// Shared utilities
export { execCommand, setExecCommand, resetExecCommand } from "./exec";
export {
  resolveProjectFromEnv,
  resolveProjectFromCwd,
  resolveProjectWithCwd,
  loadBrainConfig,
  getEnv,
  setGetEnv,
} from "./project-resolve";
export {
  performGateCheck,
  checkToolBlocked,
  isReadOnlyTool,
  getBrainSessionState,
  formatBlockMessage,
} from "./gate-check";
export { detectScenario } from "./detect-scenario";
export { validateStopReadiness, validateSession } from "./validate";
export {
  normalizeEvent,
  detectPlatform,
  getBlockingSemantics,
  readAndNormalize,
} from "./normalize";

// Hook handlers
export { runSessionStart } from "./session-start";
export { runUserPrompt, processUserPrompt } from "./user-prompt";
export { runPreToolUse, processPreToolUse } from "./pre-tool-use";
export { runStop, processStop } from "./stop";
export { runDetectScenario } from "./detect-scenario-cmd";
export { runLoadSkills } from "./load-skills";
export { runAnalyze } from "./analyze";
export { runValidateSession } from "./validate-session";

// Types
export type * from "./types";
export type {
  Platform,
  NormalizedEventName,
  NormalizedHookEvent,
  BlockingSemantics,
} from "./normalize";
