/**
 * Unit tests for Session MCP Tool Handler
 *
 * Tests the MCP tool layer that wraps the session service.
 * Verifies:
 * - Tool definition schema correctness
 * - Operation routing (get, create, pause, resume, complete)
 * - Input validation (missing required fields)
 * - Error response formatting
 * - Success response formatting
 *
 * Uses mocks for session service to test handler logic in isolation.
 *
 * @see FEATURE-001: Session Management - Milestone 4
 */

import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Mock the session service
vi.mock("../../../services/session", () => ({
  getSession: vi.fn(),
  setSession: vi.fn(),
  getRecentModeHistory: vi.fn(),
  MODE_DESCRIPTIONS: {
    analysis: "Read-only exploration. Blocks Edit, Write, Bash.",
    planning: "Design phase. Blocks Edit, Write. Allows Bash for research.",
    coding: "Full access. All tools allowed.",
    disabled: "Mode enforcement disabled. All tools allowed.",
  },
  createSession: vi.fn(),
  pauseSession: vi.fn(),
  resumeSession: vi.fn(),
  completeSession: vi.fn(),
  queryOpenSessions: vi.fn(),
  queryActiveSession: vi.fn(),
  AutoPauseFailedError: class AutoPauseFailedError extends Error {
    constructor(
      message: string,
      public readonly sessionId: string,
      public readonly cause?: Error,
    ) {
      super(message);
      this.name = "AutoPauseFailedError";
    }
  },
  SessionNotFoundError: class SessionNotFoundError extends Error {
    constructor(sessionId: string) {
      super(`Session not found: ${sessionId}`);
      this.name = "SessionNotFoundError";
    }
  },
  InvalidStatusTransitionError: class InvalidStatusTransitionError extends Error {
    constructor(sessionId: string, fromStatus: string, toStatus: string) {
      super(`Invalid status transition for ${sessionId}: ${fromStatus} -> ${toStatus}`);
      this.name = "InvalidStatusTransitionError";
    }
  },
}));

// Import mocked service functions
import {
  AutoPauseFailedError,
  completeSession,
  createSession,
  getRecentModeHistory,
  getSession,
  InvalidStatusTransitionError,
  pauseSession,
  queryActiveSession,
  queryOpenSessions,
  resumeSession,
  SessionNotFoundError,
  setSession,
} from "../../../services/session";

// Import handler under test (after mocks)
import { handler } from "../index";
import { toolDefinition } from "../schema";

describe("Session Tool Definition", () => {
  test("has correct name", () => {
    expect(toolDefinition.name).toBe("session");
  });

  test("has description covering all operations", () => {
    expect(toolDefinition.description).toBeDefined();
    expect(toolDefinition.description).toContain("get");
    expect(toolDefinition.description).toContain("create");
    expect(toolDefinition.description).toContain("pause");
    expect(toolDefinition.description).toContain("resume");
    expect(toolDefinition.description).toContain("complete");
  });

  test("has input schema with required operation property", () => {
    expect(toolDefinition.inputSchema.type).toBe("object");
    expect(toolDefinition.inputSchema.required).toContain("operation");
  });

  test("has all operation values in schema", () => {
    const properties = toolDefinition.inputSchema.properties as Record<string, unknown>;
    const operationSchema = properties.operation as { enum: string[] };
    expect(operationSchema.enum).toContain("get");
    expect(operationSchema.enum).toContain("set");
    expect(operationSchema.enum).toContain("create");
    expect(operationSchema.enum).toContain("pause");
    expect(operationSchema.enum).toContain("resume");
    expect(operationSchema.enum).toContain("complete");
  });

  test("has sessionId property for lifecycle operations", () => {
    const properties = toolDefinition.inputSchema.properties as Record<string, unknown>;
    expect(properties.sessionId).toBeDefined();
  });

  test("has topic property for create operation", () => {
    const properties = toolDefinition.inputSchema.properties as Record<string, unknown>;
    expect(properties.topic).toBeDefined();
  });
});

describe("Session Tool Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("get operation", () => {
    test("returns openSessions and activeSession", async () => {
      const mockOpenSessions = [
        {
          sessionId: "SESSION-2026-02-04_01-feature",
          status: "IN_PROGRESS",
          date: "2026-02-04",
          branch: "main",
          topic: "feature",
          permalink: "sessions/SESSION-2026-02-04_01-feature",
        },
      ];
      const mockActiveSession = {
        sessionId: "SESSION-2026-02-04_01-feature",
        status: "IN_PROGRESS",
        path: "sessions/SESSION-2026-02-04_01-feature",
        date: "2026-02-04",
        topic: "feature",
        isValid: true,
        checks: [],
      };
      const mockSessionState = {
        currentMode: "coding",
        modeHistory: [{ mode: "coding", timestamp: "2026-02-04T10:00:00Z" }],
        version: 1,
        createdAt: "2026-02-04T10:00:00Z",
        updatedAt: "2026-02-04T10:00:00Z",
      };

      (queryOpenSessions as Mock).mockResolvedValue(mockOpenSessions);
      (queryActiveSession as Mock).mockResolvedValue(mockActiveSession);
      (getSession as Mock).mockResolvedValue(mockSessionState);
      (getRecentModeHistory as Mock).mockReturnValue(mockSessionState.modeHistory);

      const result = await handler({ operation: "get" });

      expect(result.isError).toBeFalsy();
      expect(result.content).toHaveLength(1);

      const response = JSON.parse(result.content[0].text);
      expect(response.openSessions).toEqual(mockOpenSessions);
      expect(response.activeSession).toEqual(mockActiveSession);
    });

    test("returns null activeSession when none active", async () => {
      (queryOpenSessions as Mock).mockResolvedValue([]);
      (queryActiveSession as Mock).mockResolvedValue(null);
      (getSession as Mock).mockResolvedValue({
        currentMode: "analysis",
        modeHistory: [],
        version: 1,
        createdAt: "2026-02-04T10:00:00Z",
        updatedAt: "2026-02-04T10:00:00Z",
      });
      (getRecentModeHistory as Mock).mockReturnValue([]);

      const result = await handler({ operation: "get" });

      expect(result.isError).toBeFalsy();
      const response = JSON.parse(result.content[0].text);
      expect(response.activeSession).toBeNull();
      expect(response.openSessions).toEqual([]);
    });
  });

  describe("create operation", () => {
    test("creates session and returns success response", async () => {
      const mockResult = {
        success: true,
        sessionId: "SESSION-2026-02-04_01-new-feature",
        path: "sessions/SESSION-2026-02-04_01-new-feature",
        autoPaused: null,
      };
      (createSession as Mock).mockResolvedValue(mockResult);

      const result = await handler({ operation: "create", topic: "new feature" });

      expect(result.isError).toBeFalsy();
      expect(createSession).toHaveBeenCalledWith("new feature");

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.sessionId).toBe("SESSION-2026-02-04_01-new-feature");
      expect(response.path).toBe("sessions/SESSION-2026-02-04_01-new-feature");
      expect(response.autoPaused).toBeNull();
    });

    test("returns autoPaused session ID when auto-pause occurs", async () => {
      const mockResult = {
        success: true,
        sessionId: "SESSION-2026-02-04_02-new-feature",
        path: "sessions/SESSION-2026-02-04_02-new-feature",
        autoPaused: "SESSION-2026-02-04_01-old-feature",
      };
      (createSession as Mock).mockResolvedValue(mockResult);

      const result = await handler({ operation: "create", topic: "new feature" });

      const response = JSON.parse(result.content[0].text);
      expect(response.autoPaused).toBe("SESSION-2026-02-04_01-old-feature");
    });

    test("returns error when topic is missing", async () => {
      const result = await handler({ operation: "create" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Topic is required");
      expect(createSession).not.toHaveBeenCalled();
    });

    test("returns AUTO_PAUSE_FAILED error when auto-pause fails", async () => {
      (createSession as Mock).mockRejectedValue(
        new AutoPauseFailedError(
          "Failed to auto-pause session SESSION-2026-02-04_01-old",
          "SESSION-2026-02-04_01-old",
        ),
      );

      const result = await handler({ operation: "create", topic: "new feature" });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("AUTO_PAUSE_FAILED");
      expect(response.message).toContain("SESSION-2026-02-04_01-old");
    });
  });

  describe("pause operation", () => {
    test("pauses session and returns status change", async () => {
      const mockResult = {
        success: true,
        sessionId: "SESSION-2026-02-04_01-feature",
        previousStatus: "IN_PROGRESS",
        newStatus: "PAUSED",
      };
      (pauseSession as Mock).mockResolvedValue(mockResult);

      const result = await handler({
        operation: "pause",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBeFalsy();
      expect(pauseSession).toHaveBeenCalledWith("SESSION-2026-02-04_01-feature");

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.previousStatus).toBe("IN_PROGRESS");
      expect(response.newStatus).toBe("PAUSED");
    });

    test("returns error when sessionId is missing", async () => {
      const result = await handler({ operation: "pause" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("sessionId is required");
      expect(pauseSession).not.toHaveBeenCalled();
    });

    test("returns SESSION_NOT_FOUND error when session does not exist", async () => {
      (pauseSession as Mock).mockRejectedValue(
        new SessionNotFoundError("SESSION-2026-02-04_99-nonexistent"),
      );

      const result = await handler({
        operation: "pause",
        sessionId: "SESSION-2026-02-04_99-nonexistent",
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("SESSION_NOT_FOUND");
    });

    test("returns INVALID_STATUS_TRANSITION when session already paused", async () => {
      (pauseSession as Mock).mockRejectedValue(
        new InvalidStatusTransitionError("SESSION-2026-02-04_01-feature", "PAUSED", "PAUSED"),
      );

      const result = await handler({
        operation: "pause",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("INVALID_STATUS_TRANSITION");
    });
  });

  describe("resume operation", () => {
    test("resumes session and returns status change", async () => {
      const mockResult = {
        success: true,
        sessionId: "SESSION-2026-02-04_01-feature",
        previousStatus: "PAUSED",
        newStatus: "IN_PROGRESS",
      };
      (resumeSession as Mock).mockResolvedValue(mockResult);

      const result = await handler({
        operation: "resume",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBeFalsy();
      expect(resumeSession).toHaveBeenCalledWith("SESSION-2026-02-04_01-feature");

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.previousStatus).toBe("PAUSED");
      expect(response.newStatus).toBe("IN_PROGRESS");
    });

    test("returns error when sessionId is missing", async () => {
      const result = await handler({ operation: "resume" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("sessionId is required");
      expect(resumeSession).not.toHaveBeenCalled();
    });

    test("returns INVALID_STATUS_TRANSITION when session not paused", async () => {
      (resumeSession as Mock).mockRejectedValue(
        new InvalidStatusTransitionError(
          "SESSION-2026-02-04_01-feature",
          "IN_PROGRESS",
          "IN_PROGRESS",
        ),
      );

      const result = await handler({
        operation: "resume",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("INVALID_STATUS_TRANSITION");
    });

    test("returns AUTO_PAUSE_FAILED error when auto-pause fails", async () => {
      (resumeSession as Mock).mockRejectedValue(
        new AutoPauseFailedError(
          "Failed to auto-pause session SESSION-2026-02-04_02-other",
          "SESSION-2026-02-04_02-other",
        ),
      );

      const result = await handler({
        operation: "resume",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("AUTO_PAUSE_FAILED");
    });
  });

  describe("complete operation", () => {
    test("completes session and returns status change", async () => {
      const mockResult = {
        success: true,
        sessionId: "SESSION-2026-02-04_01-feature",
        previousStatus: "IN_PROGRESS",
        newStatus: "COMPLETE",
      };
      (completeSession as Mock).mockResolvedValue(mockResult);

      const result = await handler({
        operation: "complete",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBeFalsy();
      expect(completeSession).toHaveBeenCalledWith("SESSION-2026-02-04_01-feature");

      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(true);
      expect(response.previousStatus).toBe("IN_PROGRESS");
      expect(response.newStatus).toBe("COMPLETE");
    });

    test("returns error when sessionId is missing", async () => {
      const result = await handler({ operation: "complete" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("sessionId is required");
      expect(completeSession).not.toHaveBeenCalled();
    });

    test("returns INVALID_STATUS_TRANSITION when session not in progress", async () => {
      (completeSession as Mock).mockRejectedValue(
        new InvalidStatusTransitionError("SESSION-2026-02-04_01-feature", "PAUSED", "COMPLETE"),
      );

      const result = await handler({
        operation: "complete",
        sessionId: "SESSION-2026-02-04_01-feature",
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("INVALID_STATUS_TRANSITION");
    });

    test("returns SESSION_NOT_FOUND error when session does not exist", async () => {
      (completeSession as Mock).mockRejectedValue(
        new SessionNotFoundError("SESSION-2026-02-04_99-nonexistent"),
      );

      const result = await handler({
        operation: "complete",
        sessionId: "SESSION-2026-02-04_99-nonexistent",
      });

      expect(result.isError).toBe(true);
      const response = JSON.parse(result.content[0].text);
      expect(response.success).toBe(false);
      expect(response.error).toBe("SESSION_NOT_FOUND");
    });
  });

  describe("set operation (legacy)", () => {
    test("updates workflow mode", async () => {
      const mockState = {
        currentMode: "coding",
        modeHistory: [{ mode: "coding", timestamp: "2026-02-04T10:00:00Z" }],
        version: 1,
        createdAt: "2026-02-04T10:00:00Z",
        updatedAt: "2026-02-04T10:00:00Z",
      };
      (setSession as Mock).mockResolvedValue(mockState);

      const result = await handler({ operation: "set", mode: "coding" });

      expect(result.isError).toBeFalsy();
      expect(setSession).toHaveBeenCalledWith({ mode: "coding" });
      expect(result.content[0].text).toContain("Mode set to");
      expect(result.content[0].text).toContain("coding");
    });

    test("updates task", async () => {
      const mockState = {
        currentMode: "coding",
        activeTask: "implement feature X",
        version: 1,
        createdAt: "2026-02-04T10:00:00Z",
        updatedAt: "2026-02-04T10:00:00Z",
      };
      (setSession as Mock).mockResolvedValue(mockState);

      const result = await handler({ operation: "set", task: "implement feature X" });

      expect(result.isError).toBeFalsy();
      expect(setSession).toHaveBeenCalledWith({ task: "implement feature X" });
      expect(result.content[0].text).toContain("Task:");
    });

    test("returns error when no updates provided", async () => {
      const result = await handler({ operation: "set" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("No updates provided");
      expect(setSession).not.toHaveBeenCalled();
    });
  });

  describe("input validation", () => {
    test("rejects invalid operation", async () => {
      await expect(handler({ operation: "invalid" })).rejects.toThrow();
    });

    test("rejects missing operation", async () => {
      await expect(handler({})).rejects.toThrow();
    });
  });
});
