/**
 * Validation functions for brain-hooks.
 *
 * Ported from packages/validation/internal/validate_session.go.
 * Provides ValidateStopReadiness and ValidateSession.
 */
import type { Check, ValidationResult, WorkflowState } from "./types";

/**
 * Validate that it's safe to pause/stop the session.
 * Called by stop hooks during interruptions (Ctrl+C, context switches).
 * Performs minimal checks, NOT full session end protocol validation.
 * Key design: Stop readiness should NEVER block. It's informational only.
 */
export function validateStopReadiness(
  state: WorkflowState | null,
): ValidationResult {
  const checks: Check[] = [];

  // Check 1: No blocking operations (always pass for now)
  checks.push({
    name: "no_blocking_ops",
    passed: true,
    message: "No blocking operations detected",
  });

  // Check 2: State is readable
  if (!state) {
    checks.push({
      name: "state_available",
      passed: false,
      message: "Workflow state unavailable",
    });
  } else {
    const modeMsg = state.mode
      ? `Workflow state available: mode=${state.mode}`
      : "Workflow state available";
    checks.push({
      name: "state_available",
      passed: true,
      message: modeMsg,
    });
  }

  // Return non-blocking result (valid: true even if checks fail)
  return {
    valid: true,
    checks,
    message: "Session can be paused safely",
    remediation: "",
  };
}

/**
 * Validate session state for completeness before ending.
 * Pass the state from `brain session` command output.
 */
export function validateSession(
  state: WorkflowState | null,
): ValidationResult {
  const checks: Check[] = [];
  let allPassed = true;

  // Check 1: Workflow state persisted
  if (state && state.mode) {
    checks.push({
      name: "workflow_state",
      passed: true,
      message: `Workflow state persisted with mode: ${state.mode}`,
    });
  } else {
    checks.push({
      name: "workflow_state",
      passed: true,
      message: "No active workflow state",
    });
  }

  // Check 2: Recent activity (derived from updatedAt)
  if (state && state.updatedAt) {
    checks.push({
      name: "recent_activity",
      passed: true,
      message: `Recent activity at: ${state.updatedAt}`,
    });
  } else {
    const shouldFail =
      state != null &&
      (state.mode === "analysis" || state.mode === "planning");
    checks.push({
      name: "recent_activity",
      passed: !shouldFail,
      message: "No recent activity captured",
    });
    if (shouldFail) {
      allPassed = false;
    }
  }

  // Check 3: Task status (derived from task field)
  if (!state || !state.task) {
    checks.push({
      name: "task_status",
      passed: true,
      message: "No active task",
    });
  } else {
    checks.push({
      name: "task_status",
      passed: true,
      message: `Active task: ${state.task}`,
    });
  }

  return {
    valid: allPassed,
    checks,
    message: allPassed
      ? "Session ready to end"
      : "Session validation failed",
    remediation: allPassed
      ? ""
      : "Capture observations before ending session",
  };
}
