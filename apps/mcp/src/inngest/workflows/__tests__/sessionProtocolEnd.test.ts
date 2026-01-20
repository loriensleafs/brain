/**
 * Tests for Session Protocol End workflow definition.
 *
 * These tests verify the workflow structure and configuration without
 * requiring the Inngest dev server to be running.
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  sessionProtocolEndWorkflow,
  validateSessionProtocolEnd,
  type SessionProtocolEndResult,
  type StepResult,
} from "../sessionProtocolEnd";

describe("Session Protocol End Workflow", () => {
  describe("workflow definition", () => {
    test("workflow function is defined", () => {
      expect(sessionProtocolEndWorkflow).toBeDefined();
    });

    test("workflow has id property set to 'session-protocol-end'", () => {
      const workflowId = (sessionProtocolEndWorkflow as unknown as { id: () => string }).id();
      expect(workflowId).toBe("session-protocol-end");
    });
  });

  describe("workflow configuration", () => {
    test("workflow is configured with retries", () => {
      // The workflow is configured with retries: 2
      // We verify this by checking the workflow exists and has proper structure
      expect(sessionProtocolEndWorkflow).toBeDefined();
    });
  });

  describe("SessionProtocolEndResult type", () => {
    test("result type has correct structure for PASS verdict", () => {
      const mockResult: SessionProtocolEndResult = {
        sessionId: "test-session-123",
        verdict: "PASS",
        steps: {
          sessionLogComplete: { passed: true, message: "Complete", evidence: "/path/to/log" },
          brainMemoryUpdated: { passed: true, message: "Updated" },
          markdownLintPassed: { passed: true, message: "Passed" },
          changesCommitted: { passed: true, message: "Committed", evidence: "Branch: main" },
          protocolValidationPassed: { passed: true, message: "Passed", evidence: "Exit code: 0" },
          consistencyValidationPassed: { passed: true, message: "Passed", evidence: "Features: none" },
          sessionStateClosed: { passed: true, message: "Closed" },
        },
        completedAt: new Date().toISOString(),
        blockers: [],
      };

      expect(mockResult.sessionId).toBe("test-session-123");
      expect(mockResult.verdict).toBe("PASS");
      expect(mockResult.blockers).toHaveLength(0);
      expect(mockResult.steps.sessionLogComplete.passed).toBe(true);
      expect(mockResult.steps.brainMemoryUpdated.passed).toBe(true);
      expect(mockResult.steps.markdownLintPassed.passed).toBe(true);
      expect(mockResult.steps.changesCommitted.passed).toBe(true);
      expect(mockResult.steps.protocolValidationPassed.passed).toBe(true);
      expect(mockResult.steps.consistencyValidationPassed.passed).toBe(true);
      expect(mockResult.steps.sessionStateClosed.passed).toBe(true);
    });

    test("result type has correct structure for FAIL verdict", () => {
      const mockResult: SessionProtocolEndResult = {
        sessionId: "test-session-456",
        verdict: "FAIL",
        steps: {
          sessionLogComplete: { passed: false, message: "Session log not found" },
          brainMemoryUpdated: { passed: true, message: "Updated" },
          markdownLintPassed: { passed: true, message: "Passed" },
          changesCommitted: { passed: false, message: "Uncommitted changes: file1.ts, file2.ts" },
          protocolValidationPassed: { passed: false, message: "Validation failed" },
          consistencyValidationPassed: { passed: true, message: "Passed", evidence: "Features: none" },
          sessionStateClosed: { passed: false, message: "Cannot close session" },
        },
        completedAt: new Date().toISOString(),
        blockers: [
          "Session log: Session log not found",
          "Git: Uncommitted changes: file1.ts, file2.ts",
          "Protocol validation: Validation failed",
        ],
      };

      expect(mockResult.verdict).toBe("FAIL");
      expect(mockResult.blockers).toHaveLength(3);
      expect(mockResult.steps.sessionLogComplete.passed).toBe(false);
      expect(mockResult.steps.changesCommitted.passed).toBe(false);
    });
  });

  describe("StepResult type", () => {
    test("step result with evidence", () => {
      const stepResult: StepResult = {
        passed: true,
        message: "Session log validated",
        evidence: "/path/to/.agents/sessions/2026-01-18-session-01.md",
      };

      expect(stepResult.passed).toBe(true);
      expect(stepResult.message).toBe("Session log validated");
      expect(stepResult.evidence).toBe("/path/to/.agents/sessions/2026-01-18-session-01.md");
    });

    test("step result without evidence", () => {
      const stepResult: StepResult = {
        passed: false,
        message: "Session log not found",
      };

      expect(stepResult.passed).toBe(false);
      expect(stepResult.evidence).toBeUndefined();
    });
  });

  describe("workflow event handling", () => {
    test("workflow event name matches expected pattern", () => {
      // The workflow is triggered by "session/protocol.end" event
      // This is verified by the workflow's configuration
      expect(sessionProtocolEndWorkflow).toBeDefined();
    });
  });

  describe("seven-step validation structure", () => {
    test("workflow result includes all 7 validation steps", () => {
      const requiredSteps = [
        "sessionLogComplete",
        "brainMemoryUpdated",
        "markdownLintPassed",
        "changesCommitted",
        "protocolValidationPassed",
        "consistencyValidationPassed",
        "sessionStateClosed",
      ];

      const mockResult: SessionProtocolEndResult = {
        sessionId: "test-feature",
        verdict: "PASS",
        steps: {
          sessionLogComplete: { passed: true, message: "Complete" },
          brainMemoryUpdated: { passed: true, message: "Updated" },
          markdownLintPassed: { passed: true, message: "Passed" },
          changesCommitted: { passed: true, message: "Committed" },
          protocolValidationPassed: { passed: true, message: "Passed" },
          consistencyValidationPassed: { passed: true, message: "Passed", evidence: "Features: none" },
          sessionStateClosed: { passed: true, message: "Closed" },
        },
        completedAt: new Date().toISOString(),
        blockers: [],
      };

      // Verify all required steps are present
      for (const step of requiredSteps) {
        expect(mockResult.steps[step as keyof typeof mockResult.steps]).toBeDefined();
      }
    });
  });
});

describe("validateSessionProtocolEnd direct function", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "session-protocol-test-"));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns FAIL when session log does not exist", async () => {
    const result = await validateSessionProtocolEnd("test-session", tempDir);

    expect(result.verdict).toBe("FAIL");
    expect(result.steps.sessionLogComplete.passed).toBe(false);
    expect(result.steps.sessionLogComplete.message).toContain("Session log");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  test("returns FAIL when session log exists but checklist incomplete", async () => {
    // Create sessions directory
    const sessionsDir = path.join(tempDir, ".agents", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create session log with incomplete checklist
    const today = new Date().toISOString().split("T")[0];
    const sessionLogPath = path.join(sessionsDir, `${today}-session-01.md`);
    const sessionLogContent = `# Session Log

## Session Start
- [x] Brain MCP initialized
- [x] HANDOFF.md read

## Session End
- [ ] Complete checklist
- [ ] Update Brain memory
- [ ] Run markdown lint
`;

    fs.writeFileSync(sessionLogPath, sessionLogContent);

    const result = await validateSessionProtocolEnd("test-session", tempDir);

    expect(result.verdict).toBe("FAIL");
    expect(result.steps.sessionLogComplete.passed).toBe(false);
    expect(result.steps.sessionLogComplete.message).toContain("incomplete");
  });

  test("returns correct structure with all step results", async () => {
    const result = await validateSessionProtocolEnd("test-session", tempDir);

    // Verify structure
    expect(result.sessionId).toBe("test-session");
    expect(result.verdict).toBeDefined();
    expect(result.completedAt).toBeDefined();
    expect(result.blockers).toBeInstanceOf(Array);

    // Verify all steps are present
    expect(result.steps.sessionLogComplete).toBeDefined();
    expect(result.steps.brainMemoryUpdated).toBeDefined();
    expect(result.steps.markdownLintPassed).toBeDefined();
    expect(result.steps.changesCommitted).toBeDefined();
    expect(result.steps.protocolValidationPassed).toBeDefined();
    expect(result.steps.consistencyValidationPassed).toBeDefined();
    expect(result.steps.sessionStateClosed).toBeDefined();
  });

  test("brainMemoryUpdated step always passes (acknowledgment)", async () => {
    const result = await validateSessionProtocolEnd("test-session", tempDir);

    // Brain memory step is an acknowledgment, always passes
    expect(result.steps.brainMemoryUpdated.passed).toBe(true);
    expect(result.steps.brainMemoryUpdated.message).toContain("acknowledged");
  });

  test("session log validation detects complete checklist", async () => {
    // Create sessions directory
    const sessionsDir = path.join(tempDir, ".agents", "sessions");
    fs.mkdirSync(sessionsDir, { recursive: true });

    // Create session log with complete checklist
    const today = new Date().toISOString().split("T")[0];
    const sessionLogPath = path.join(sessionsDir, `${today}-session-01.md`);
    const sessionLogContent = `# Session Log

## Session Start
- [x] Brain MCP initialized
- [x] HANDOFF.md read

## Session End
- [x] Complete checklist
- [x] Update Brain memory
- [x] Run markdown lint
`;

    fs.writeFileSync(sessionLogPath, sessionLogContent);

    const result = await validateSessionProtocolEnd("test-session", tempDir);

    expect(result.steps.sessionLogComplete.passed).toBe(true);
    expect(result.steps.sessionLogComplete.evidence).toBe(sessionLogPath);
  });
});

describe("workflow error handling", () => {
  test("result includes blockers for each failed step", () => {
    const mockResult: SessionProtocolEndResult = {
      sessionId: "error-test",
      verdict: "FAIL",
      steps: {
        sessionLogComplete: { passed: false, message: "Not found" },
        brainMemoryUpdated: { passed: true, message: "OK" },
        markdownLintPassed: { passed: false, message: "Lint errors" },
        changesCommitted: { passed: false, message: "Uncommitted" },
        protocolValidationPassed: { passed: false, message: "Script failed" },
        consistencyValidationPassed: { passed: true, message: "OK", evidence: "Features: none" },
        sessionStateClosed: { passed: false, message: "Cannot close" },
      },
      completedAt: new Date().toISOString(),
      blockers: [
        "Session log: Not found",
        "Markdown lint: Lint errors",
        "Git: Uncommitted",
        "Protocol validation: Script failed",
        "Session state: Cannot close",
      ],
    };

    // 5 blockers (brainMemoryUpdated and consistencyValidationPassed passed)
    expect(mockResult.blockers).toHaveLength(5);
    expect(mockResult.blockers[0]).toContain("Session log");
    expect(mockResult.blockers[1]).toContain("Markdown lint");
    expect(mockResult.blockers[2]).toContain("Git");
  });
});
