/**
 * Tests for validate.ts
 *
 * Ported from packages/validation/internal/validate_session_test.go.
 */
import { describe, expect, it } from "vitest";
import { validateStopReadiness, validateSession } from "../validate.js";
import type { WorkflowState } from "../types.js";

describe("validateStopReadiness", () => {
  it("returns valid=true even with null state (never blocks)", () => {
    const result = validateStopReadiness(null);
    expect(result.valid).toBe(true);
    expect(result.message).toBe("Session can be paused safely");
  });

  it("returns valid=true with valid state", () => {
    const state: WorkflowState = {
      mode: "coding",
      task: "Implement feature",
      sessionId: "abc123",
      updatedAt: "2026-02-04T10:00:00Z",
    };
    const result = validateStopReadiness(state);
    expect(result.valid).toBe(true);
    expect(result.checks.length).toBeGreaterThanOrEqual(2);
  });

  it("includes state_available check", () => {
    const state: WorkflowState = { mode: "analysis" };
    const result = validateStopReadiness(state);
    const stateCheck = result.checks.find((c) => c.name === "state_available");
    expect(stateCheck).toBeTruthy();
    expect(stateCheck!.passed).toBe(true);
    expect(stateCheck!.message).toContain("mode=analysis");
  });

  it("marks state_available as failed when null", () => {
    const result = validateStopReadiness(null);
    const stateCheck = result.checks.find((c) => c.name === "state_available");
    expect(stateCheck).toBeTruthy();
    expect(stateCheck!.passed).toBe(false);
  });
});

describe("validateSession", () => {
  it("passes with valid state", () => {
    const state: WorkflowState = {
      mode: "coding",
      task: "Research API",
      updatedAt: "2026-02-04T10:00:00Z",
    };
    const result = validateSession(state);
    expect(result.valid).toBe(true);
    expect(result.message).toBe("Session ready to end");
  });

  it("passes with null state", () => {
    const result = validateSession(null);
    expect(result.valid).toBe(true);
  });

  it("passes with empty mode", () => {
    const state: WorkflowState = { mode: "" };
    const result = validateSession(state);
    expect(result.valid).toBe(true);
  });

  it("fails for analysis mode with no updatedAt", () => {
    const state: WorkflowState = {
      mode: "analysis",
    };
    const result = validateSession(state);
    expect(result.valid).toBe(false);
    expect(result.message).toBe("Session validation failed");
    expect(result.remediation).toContain("Capture observations");
  });

  it("fails for planning mode with no updatedAt", () => {
    const state: WorkflowState = {
      mode: "planning",
    };
    const result = validateSession(state);
    expect(result.valid).toBe(false);
  });

  it("passes for coding mode with no updatedAt", () => {
    const state: WorkflowState = {
      mode: "coding",
    };
    const result = validateSession(state);
    expect(result.valid).toBe(true);
  });

  it("includes workflow_state check", () => {
    const state: WorkflowState = { mode: "coding" };
    const result = validateSession(state);
    const wfCheck = result.checks.find((c) => c.name === "workflow_state");
    expect(wfCheck).toBeTruthy();
    expect(wfCheck!.passed).toBe(true);
    expect(wfCheck!.message).toContain("coding");
  });

  it("includes task_status check", () => {
    const state: WorkflowState = {
      mode: "coding",
      task: "Implement feature X",
    };
    const result = validateSession(state);
    const taskCheck = result.checks.find((c) => c.name === "task_status");
    expect(taskCheck).toBeTruthy();
    expect(taskCheck!.message).toContain("Implement feature X");
  });
});
