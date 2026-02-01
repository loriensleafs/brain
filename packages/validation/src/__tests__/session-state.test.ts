/**
 * Tests for SessionState AJV validators
 *
 * Validates that JSON Schema validators behave correctly for session state types.
 */
import { describe, test, expect } from "bun:test";
import {
  validateSessionState,
  parseSessionState,
  safeParseSessionState,
  getSessionStateErrors,
  isAgentType,
  isWorkflowMode,
  isSessionState,
} from "../validate";

describe("SessionState validation", () => {
  const validSessionState = {
    currentMode: "analysis",
    modeHistory: [{ mode: "analysis", timestamp: "2026-01-18T10:00:00.000Z" }],
    protocolStartComplete: false,
    protocolEndComplete: false,
    protocolStartEvidence: {},
    protocolEndEvidence: {},
    orchestratorWorkflow: null,
    version: 1,
    createdAt: "2026-01-18T10:00:00.000Z",
    updatedAt: "2026-01-18T10:00:00.000Z",
  };

  describe("validateSessionState", () => {
    test("returns true for valid minimal session state", () => {
      expect(validateSessionState(validSessionState)).toBe(true);
    });

    test("returns true with optional fields", () => {
      const stateWithOptionals = {
        ...validSessionState,
        activeFeature: "feature-123",
        activeTask: "task-456",
      };
      expect(validateSessionState(stateWithOptionals)).toBe(true);
    });

    test("returns false for missing required fields", () => {
      const invalid = {
        currentMode: "analysis",
        // missing other required fields
      };
      expect(validateSessionState(invalid)).toBe(false);
    });

    test("returns false for invalid mode", () => {
      const invalid = {
        ...validSessionState,
        currentMode: "invalid-mode",
      };
      expect(validateSessionState(invalid)).toBe(false);
    });

    test("returns false for invalid timestamp format", () => {
      const invalid = {
        ...validSessionState,
        createdAt: "not-a-timestamp",
      };
      expect(validateSessionState(invalid)).toBe(false);
    });
  });

  describe("parseSessionState", () => {
    test("returns validated data for valid input", () => {
      const result = parseSessionState(validSessionState);
      expect(result.currentMode).toBe("analysis");
      expect(result.version).toBe(1);
    });

    test("throws for invalid input", () => {
      expect(() => parseSessionState({ currentMode: "invalid" })).toThrow();
    });
  });

  describe("safeParseSessionState", () => {
    test("returns data for valid input", () => {
      const result = safeParseSessionState(validSessionState);
      expect(result).not.toBeNull();
      expect(result!.currentMode).toBe("analysis");
    });

    test("returns null for invalid input", () => {
      const result = safeParseSessionState({ currentMode: "invalid" });
      expect(result).toBeNull();
    });
  });

  describe("getSessionStateErrors", () => {
    test("returns empty array for valid data", () => {
      const errors = getSessionStateErrors(validSessionState);
      expect(errors).toEqual([]);
    });

    test("returns errors for invalid data", () => {
      const errors = getSessionStateErrors({ currentMode: "invalid" });
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toHaveProperty("field");
      expect(errors[0]).toHaveProperty("constraint");
      expect(errors[0]).toHaveProperty("message");
    });
  });

  describe("orchestratorWorkflow validation", () => {
    test("validates session with orchestrator workflow", () => {
      const stateWithWorkflow = {
        ...validSessionState,
        orchestratorWorkflow: {
          activeAgent: "analyst",
          workflowPhase: "planning",
          agentHistory: [],
          decisions: [],
          verdicts: [],
          pendingHandoffs: [],
          compactionHistory: [],
          startedAt: "2026-01-18T10:00:00.000Z",
          lastAgentChange: "2026-01-18T10:00:00.000Z",
        },
      };
      expect(validateSessionState(stateWithWorkflow)).toBe(true);
    });

    test("validates workflow with agent invocation", () => {
      const stateWithInvocation = {
        ...validSessionState,
        orchestratorWorkflow: {
          activeAgent: "implementer",
          workflowPhase: "implementation",
          agentHistory: [
            {
              agent: "analyst",
              startedAt: "2026-01-18T10:00:00.000Z",
              completedAt: "2026-01-18T10:30:00.000Z",
              status: "completed",
              input: {
                prompt: "Analyze this issue",
                context: {},
                artifacts: [],
              },
              output: {
                artifacts: [".agents/analysis/001-analysis.md"],
                summary: "Analysis complete",
                recommendations: ["Proceed with implementation"],
                blockers: [],
              },
              handoffFrom: null,
              handoffTo: "implementer",
              handoffReason: "Analysis complete, ready for implementation",
            },
          ],
          decisions: [],
          verdicts: [],
          pendingHandoffs: [],
          compactionHistory: [],
          startedAt: "2026-01-18T10:00:00.000Z",
          lastAgentChange: "2026-01-18T10:30:00.000Z",
        },
      };
      expect(validateSessionState(stateWithInvocation)).toBe(true);
    });

    test("rejects invalid agent type in workflow", () => {
      const stateWithInvalidAgent = {
        ...validSessionState,
        orchestratorWorkflow: {
          activeAgent: "invalid-agent",
          workflowPhase: "planning",
          agentHistory: [],
          decisions: [],
          verdicts: [],
          pendingHandoffs: [],
          compactionHistory: [],
          startedAt: "2026-01-18T10:00:00.000Z",
          lastAgentChange: "2026-01-18T10:00:00.000Z",
        },
      };
      expect(validateSessionState(stateWithInvalidAgent)).toBe(false);
    });
  });
});

describe("Type guards", () => {
  describe("isAgentType", () => {
    test("returns true for valid agent types", () => {
      expect(isAgentType("orchestrator")).toBe(true);
      expect(isAgentType("analyst")).toBe(true);
      expect(isAgentType("implementer")).toBe(true);
      expect(isAgentType("independent-thinker")).toBe(true);
    });

    test("returns false for invalid values", () => {
      expect(isAgentType("invalid")).toBe(false);
      expect(isAgentType(123)).toBe(false);
      expect(isAgentType(null)).toBe(false);
      expect(isAgentType(undefined)).toBe(false);
    });
  });

  describe("isWorkflowMode", () => {
    test("returns true for valid modes", () => {
      expect(isWorkflowMode("analysis")).toBe(true);
      expect(isWorkflowMode("planning")).toBe(true);
      expect(isWorkflowMode("coding")).toBe(true);
      expect(isWorkflowMode("disabled")).toBe(true);
    });

    test("returns false for invalid values", () => {
      expect(isWorkflowMode("invalid")).toBe(false);
      expect(isWorkflowMode(123)).toBe(false);
      expect(isWorkflowMode(null)).toBe(false);
    });
  });

  describe("isSessionState", () => {
    test("returns true for valid session state", () => {
      const validState = {
        currentMode: "analysis",
        modeHistory: [{ mode: "analysis", timestamp: "2026-01-18T10:00:00.000Z" }],
        protocolStartComplete: false,
        protocolEndComplete: false,
        protocolStartEvidence: {},
        protocolEndEvidence: {},
        orchestratorWorkflow: null,
        version: 1,
        createdAt: "2026-01-18T10:00:00.000Z",
        updatedAt: "2026-01-18T10:00:00.000Z",
      };
      expect(isSessionState(validState)).toBe(true);
    });

    test("returns false for invalid values", () => {
      expect(isSessionState({ currentMode: "invalid" })).toBe(false);
      expect(isSessionState(null)).toBe(false);
      expect(isSessionState("string")).toBe(false);
    });
  });
});
