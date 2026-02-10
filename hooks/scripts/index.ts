/**
 * Brain hooks barrel export.
 *
 * Exports all hook handlers and shared utilities for use
 * by adapters and tests.
 */

// Shared utilities
export { execCommand, setExecCommand, resetExecCommand } from "./exec.ts";
export {
  resolveProjectFromEnv,
  resolveProjectFromCwd,
  resolveProjectWithCwd,
  loadBrainConfig,
  getEnv,
  setGetEnv,
} from "./project-resolve.ts";
export {
  performGateCheck,
  checkToolBlocked,
  isReadOnlyTool,
  getBrainSessionState,
  formatBlockMessage,
} from "./gate-check.ts";
export { detectScenario } from "./detect-scenario.ts";
export { validateStopReadiness, validateSession } from "./validate.ts";
export {
  normalizeEvent,
  detectPlatform,
  getBlockingSemantics,
  readAndNormalize,
} from "./normalize.ts";

// Hook handlers
export { runSessionStart } from "./session-start.ts";
export { runUserPrompt, processUserPrompt } from "./user-prompt.ts";
export { runPreToolUse, processPreToolUse } from "./pre-tool-use.ts";
export { runStop, processStop } from "./stop.ts";
export { runDetectScenario } from "./detect-scenario-cmd.ts";
export { runLoadSkills } from "./load-skills.ts";
export { runAnalyze } from "./analyze.ts";
export { runValidateSession } from "./validate-session.ts";

// Types
export type * from "./types.ts";
export type {
  Platform,
  NormalizedEventName,
  NormalizedHookEvent,
  BlockingSemantics,
} from "./normalize.ts";
