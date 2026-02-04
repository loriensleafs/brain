/**
 * Unit tests for Session Service Lifecycle Methods
 *
 * Tests session lifecycle management:
 * - Session status types and guards
 * - OpenSession and ActiveSession types
 * - createSession, pauseSession, resumeSession, completeSession
 * - Auto-pause behavior
 * - Error handling
 *
 * Uses mocks for Brain MCP client and SearchService to test
 * business logic in isolation.
 */

import type { Mock } from "vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  ActiveSession,
  CreateSessionResult,
  ExtendedSessionState,
  OpenSession,
  SessionStatusChangeResult,
} from "../index";
import {
  AutoPauseFailedError,
  InvalidStatusTransitionError,
  isSessionStatus,
  SESSION_STATUS_VALUES,
  SessionNotFoundError,
} from "../index";

// Mock the dependencies
vi.mock("../../../proxy/client", () => ({
  getBasicMemoryClient: vi.fn(),
}));

vi.mock("../../search", () => ({
  getSearchService: vi.fn(),
}));

// Import mocked modules
import { getBasicMemoryClient } from "../../../proxy/client";
import { getSearchService } from "../../search";

// Import functions to test (after mocks are set up)
import {
  completeSession,
  createSession,
  getExtendedSession,
  pauseSession,
  queryActiveSession,
  queryOpenSessions,
  resumeSession,
} from "../index";

describe("Session Status Types", () => {
  describe("SESSION_STATUS_VALUES", () => {
    test("contains all valid status values", () => {
      expect(SESSION_STATUS_VALUES).toContain("IN_PROGRESS");
      expect(SESSION_STATUS_VALUES).toContain("PAUSED");
      expect(SESSION_STATUS_VALUES).toContain("COMPLETE");
      expect(SESSION_STATUS_VALUES).toHaveLength(3);
    });
  });

  describe("isSessionStatus", () => {
    test("returns true for valid status values", () => {
      expect(isSessionStatus("IN_PROGRESS")).toBe(true);
      expect(isSessionStatus("PAUSED")).toBe(true);
      expect(isSessionStatus("COMPLETE")).toBe(true);
    });

    test("returns false for invalid status values", () => {
      expect(isSessionStatus("INVALID")).toBe(false);
      expect(isSessionStatus("in_progress")).toBe(false); // Case-sensitive
      expect(isSessionStatus("")).toBe(false);
      expect(isSessionStatus(null)).toBe(false);
      expect(isSessionStatus(undefined)).toBe(false);
      expect(isSessionStatus(123)).toBe(false);
    });
  });
});

describe("Error Classes", () => {
  describe("AutoPauseFailedError", () => {
    test("creates error with message and session ID", () => {
      const error = new AutoPauseFailedError(
        "Failed to pause session",
        "SESSION-2026-02-04_01-test",
      );

      expect(error.name).toBe("AutoPauseFailedError");
      expect(error.message).toBe("Failed to pause session");
      expect(error.sessionId).toBe("SESSION-2026-02-04_01-test");
      expect(error.cause).toBeUndefined();
    });

    test("creates error with cause", () => {
      const cause = new Error("Network error");
      const error = new AutoPauseFailedError(
        "Failed to pause session",
        "SESSION-2026-02-04_01-test",
        cause,
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe("SessionNotFoundError", () => {
    test("creates error with session ID in message", () => {
      const error = new SessionNotFoundError("SESSION-2026-02-04_01-test");

      expect(error.name).toBe("SessionNotFoundError");
      expect(error.message).toContain("SESSION-2026-02-04_01-test");
    });
  });

  describe("InvalidStatusTransitionError", () => {
    test("creates error with transition details", () => {
      const error = new InvalidStatusTransitionError(
        "SESSION-2026-02-04_01-test",
        "PAUSED",
        "COMPLETE",
      );

      expect(error.name).toBe("InvalidStatusTransitionError");
      expect(error.message).toContain("SESSION-2026-02-04_01-test");
      expect(error.message).toContain("PAUSED");
      expect(error.message).toContain("COMPLETE");
    });
  });
});

describe("Session Lifecycle Methods", () => {
  let mockClient: {
    callTool: Mock;
  };
  let mockSearchService: {
    search: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock Brain MCP client
    mockClient = {
      callTool: vi.fn(),
    };
    (getBasicMemoryClient as Mock).mockResolvedValue(mockClient);

    // Set up mock SearchService
    mockSearchService = {
      search: vi.fn(),
    };
    (getSearchService as Mock).mockReturnValue(mockSearchService);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("queryOpenSessions", () => {
    test("returns empty array when no sessions found", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });

      const result = await queryOpenSessions();

      expect(result).toEqual([]);
      expect(mockSearchService.search).toHaveBeenCalledWith(
        "session status",
        expect.objectContaining({
          folders: ["sessions/"],
          fullContent: true,
        }),
      );
    });

    test("returns only IN_PROGRESS and PAUSED sessions", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-active",
            permalink: "sessions/SESSION-2026-02-04_01-active",
            fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
          },
          {
            title: "SESSION-2026-02-03_01-paused",
            permalink: "sessions/SESSION-2026-02-03_01-paused",
            fullContent: "---\nstatus: PAUSED\n---\nContent",
          },
          {
            title: "SESSION-2026-02-02_01-complete",
            permalink: "sessions/SESSION-2026-02-02_01-complete",
            fullContent: "---\nstatus: COMPLETE\n---\nContent",
          },
        ],
        total: 3,
      });

      const result = await queryOpenSessions();

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe("SESSION-2026-02-04_01-active");
      expect(result[0].status).toBe("IN_PROGRESS");
      expect(result[1].sessionId).toBe("SESSION-2026-02-03_01-paused");
      expect(result[1].status).toBe("PAUSED");
    });

    test("treats missing status as COMPLETE (backward compatibility)", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-legacy",
            permalink: "sessions/SESSION-2026-02-04_01-legacy",
            fullContent: "---\ntype: session\n---\nNo status field",
          },
        ],
        total: 1,
      });

      const result = await queryOpenSessions();

      expect(result).toHaveLength(0); // Treated as COMPLETE, not open
    });

    test("extracts date, topic, and branch from session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-feature-xyz",
            permalink: "sessions/SESSION-2026-02-04_01-feature-xyz",
            fullContent: "---\nstatus: IN_PROGRESS\n---\n## Branch\n\n`feature/xyz`\n",
          },
        ],
        total: 1,
      });

      const result = await queryOpenSessions();

      expect(result[0].date).toBe("2026-02-04");
      expect(result[0].topic).toBe("feature-xyz");
      expect(result[0].branch).toBe("feature/xyz");
    });

    test("filters out non-session notes", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-test",
            permalink: "sessions/SESSION-2026-02-04_01-test",
            fullContent: "---\nstatus: IN_PROGRESS\n---\n",
          },
          {
            title: "Some Other Note",
            permalink: "sessions/some-other-note",
            fullContent: "---\nstatus: IN_PROGRESS\n---\n",
          },
        ],
        total: 2,
      });

      const result = await queryOpenSessions();

      expect(result).toHaveLength(1);
      expect(result[0].sessionId).toBe("SESSION-2026-02-04_01-test");
    });
  });

  describe("queryActiveSession", () => {
    test("returns null when no active session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });

      const result = await queryActiveSession();

      expect(result).toBeNull();
    });

    test("returns the IN_PROGRESS session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-active",
            permalink: "sessions/SESSION-2026-02-04_01-active",
            fullContent: "---\nstatus: IN_PROGRESS\n---\n## Branch\n\n`main`\n",
          },
          {
            title: "SESSION-2026-02-03_01-paused",
            permalink: "sessions/SESSION-2026-02-03_01-paused",
            fullContent: "---\nstatus: PAUSED\n---\n",
          },
        ],
        total: 2,
      });

      const result = await queryActiveSession();

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe("SESSION-2026-02-04_01-active");
      expect(result?.status).toBe("IN_PROGRESS");
      expect(result?.path).toBe("sessions/SESSION-2026-02-04_01-active");
    });

    test("returns null when only PAUSED sessions exist", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-03_01-paused",
            permalink: "sessions/SESSION-2026-02-03_01-paused",
            fullContent: "---\nstatus: PAUSED\n---\n",
          },
        ],
        total: 1,
      });

      const result = await queryActiveSession();

      expect(result).toBeNull();
    });
  });

  describe("createSession", () => {
    test("creates session with IN_PROGRESS status", async () => {
      // No active session to auto-pause
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });
      mockClient.callTool.mockResolvedValue({});

      const result = await createSession("Test Feature");

      expect(result.success).toBe(true);
      expect(result.sessionId).toMatch(/^SESSION-\d{4}-\d{2}-\d{2}_\d{2}-test-feature$/);
      expect(result.autoPaused).toBeNull();

      // Verify write_note was called
      expect(mockClient.callTool).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "write_note",
          arguments: expect.objectContaining({
            folder: "sessions",
          }),
        }),
      );
    });

    test("auto-pauses existing IN_PROGRESS session", async () => {
      // First call: query for auto-pause check
      // Second call: query for session number
      mockSearchService.search
        .mockResolvedValueOnce({
          results: [
            {
              title: "SESSION-2026-02-04_01-existing",
              permalink: "sessions/SESSION-2026-02-04_01-existing",
              fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          results: [],
          total: 0,
        });

      // read_note for existing session (to update status)
      mockClient.callTool.mockImplementation(async (args: { name: string }) => {
        if (args.name === "read_note") {
          return {
            content: [{ type: "text", text: "---\nstatus: IN_PROGRESS\n---\nContent" }],
          };
        }
        return {};
      });

      const result = await createSession("New Feature");

      expect(result.success).toBe(true);
      expect(result.autoPaused).toBe("SESSION-2026-02-04_01-existing");
    });

    test("sanitizes topic for session ID", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });
      mockClient.callTool.mockResolvedValue({});

      const result = await createSession("Feature: Test! @Special#Chars");

      expect(result.sessionId).toMatch(
        /^SESSION-\d{4}-\d{2}-\d{2}_\d{2}-feature-test-special-chars$/,
      );
    });
  });

  describe("pauseSession", () => {
    test("pauses IN_PROGRESS session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-test",
            permalink: "sessions/SESSION-2026-02-04_01-test",
            fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
          },
        ],
        total: 1,
      });

      mockClient.callTool.mockImplementation(async (args: { name: string }) => {
        if (args.name === "read_note") {
          return {
            content: [{ type: "text", text: "---\nstatus: IN_PROGRESS\n---\nContent" }],
          };
        }
        return {};
      });

      const result = await pauseSession("SESSION-2026-02-04_01-test");

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe("IN_PROGRESS");
      expect(result.newStatus).toBe("PAUSED");
    });

    test("throws SessionNotFoundError for non-existent session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });

      await expect(pauseSession("SESSION-2026-02-04_99-nonexistent")).rejects.toThrow(
        SessionNotFoundError,
      );
    });

    test("throws InvalidStatusTransitionError for PAUSED session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-test",
            permalink: "sessions/SESSION-2026-02-04_01-test",
            fullContent: "---\nstatus: PAUSED\n---\nContent",
          },
        ],
        total: 1,
      });

      await expect(pauseSession("SESSION-2026-02-04_01-test")).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  describe("resumeSession", () => {
    test("resumes PAUSED session", async () => {
      // First call: check for session to resume
      // Second call: check for active session to auto-pause
      mockSearchService.search
        .mockResolvedValueOnce({
          results: [
            {
              title: "SESSION-2026-02-04_01-test",
              permalink: "sessions/SESSION-2026-02-04_01-test",
              fullContent: "---\nstatus: PAUSED\n---\nContent",
            },
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          results: [], // No active session to auto-pause
          total: 0,
        });

      mockClient.callTool.mockImplementation(async (args: { name: string }) => {
        if (args.name === "read_note") {
          return {
            content: [{ type: "text", text: "---\nstatus: PAUSED\n---\nContent" }],
          };
        }
        return {};
      });

      const result = await resumeSession("SESSION-2026-02-04_01-test");

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe("PAUSED");
      expect(result.newStatus).toBe("IN_PROGRESS");
    });

    test("throws SessionNotFoundError for non-existent session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });

      await expect(resumeSession("SESSION-2026-02-04_99-nonexistent")).rejects.toThrow(
        SessionNotFoundError,
      );
    });

    test("throws InvalidStatusTransitionError for IN_PROGRESS session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-test",
            permalink: "sessions/SESSION-2026-02-04_01-test",
            fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
          },
        ],
        total: 1,
      });

      await expect(resumeSession("SESSION-2026-02-04_01-test")).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });

    test("auto-pauses existing active session before resuming", async () => {
      // First call: check for session to resume
      mockSearchService.search
        .mockResolvedValueOnce({
          results: [
            {
              title: "SESSION-2026-02-04_01-paused",
              permalink: "sessions/SESSION-2026-02-04_01-paused",
              fullContent: "---\nstatus: PAUSED\n---\nContent",
            },
            {
              title: "SESSION-2026-02-04_02-active",
              permalink: "sessions/SESSION-2026-02-04_02-active",
              fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
            },
          ],
          total: 2,
        })
        // Second call: auto-pause check finds active session
        .mockResolvedValueOnce({
          results: [
            {
              title: "SESSION-2026-02-04_02-active",
              permalink: "sessions/SESSION-2026-02-04_02-active",
              fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
            },
          ],
          total: 1,
        });

      mockClient.callTool.mockImplementation(
        async (args: { name: string; arguments: { identifier?: string } }) => {
          if (args.name === "read_note") {
            // Return appropriate content based on which note is being read
            if (args.arguments?.identifier?.includes("active")) {
              return {
                content: [{ type: "text", text: "---\nstatus: IN_PROGRESS\n---\nContent" }],
              };
            }
            return {
              content: [{ type: "text", text: "---\nstatus: PAUSED\n---\nContent" }],
            };
          }
          return {};
        },
      );

      const result = await resumeSession("SESSION-2026-02-04_01-paused");

      expect(result.success).toBe(true);
      // Verify write_note was called twice (once for auto-pause, once for resume)
      const writeNoteCalls = mockClient.callTool.mock.calls.filter(
        (call: unknown[]) => (call[0] as { name: string }).name === "write_note",
      );
      expect(writeNoteCalls.length).toBe(2);
    });
  });

  describe("completeSession", () => {
    test("completes IN_PROGRESS session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-test",
            permalink: "sessions/SESSION-2026-02-04_01-test",
            fullContent: "---\nstatus: IN_PROGRESS\n---\nContent",
          },
        ],
        total: 1,
      });

      mockClient.callTool.mockImplementation(async (args: { name: string }) => {
        if (args.name === "read_note") {
          return {
            content: [{ type: "text", text: "---\nstatus: IN_PROGRESS\n---\nContent" }],
          };
        }
        return {};
      });

      const result = await completeSession("SESSION-2026-02-04_01-test");

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe("IN_PROGRESS");
      expect(result.newStatus).toBe("COMPLETE");
    });

    test("throws SessionNotFoundError for non-existent session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [],
        total: 0,
      });

      await expect(completeSession("SESSION-2026-02-04_99-nonexistent")).rejects.toThrow(
        SessionNotFoundError,
      );
    });

    test("throws InvalidStatusTransitionError for PAUSED session", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-test",
            permalink: "sessions/SESSION-2026-02-04_01-test",
            fullContent: "---\nstatus: PAUSED\n---\nContent",
          },
        ],
        total: 1,
      });

      await expect(completeSession("SESSION-2026-02-04_01-test")).rejects.toThrow(
        InvalidStatusTransitionError,
      );
    });
  });

  describe("getExtendedSession", () => {
    test("returns combined session state with computed fields", async () => {
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "SESSION-2026-02-04_01-active",
            permalink: "sessions/SESSION-2026-02-04_01-active",
            fullContent: "---\nstatus: IN_PROGRESS\n---\n",
          },
          {
            title: "SESSION-2026-02-03_01-paused",
            permalink: "sessions/SESSION-2026-02-03_01-paused",
            fullContent: "---\nstatus: PAUSED\n---\n",
          },
        ],
        total: 2,
      });

      const result = await getExtendedSession();

      expect(result.openSessions).toHaveLength(2);
      expect(result.activeSession).not.toBeNull();
      expect(result.activeSession?.sessionId).toBe("SESSION-2026-02-04_01-active");
    });
  });
});

describe("Type Definitions", () => {
  test("OpenSession has required fields", () => {
    const session: OpenSession = {
      sessionId: "SESSION-2026-02-04_01-test",
      status: "IN_PROGRESS",
      date: "2026-02-04",
      permalink: "sessions/SESSION-2026-02-04_01-test",
    };

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe("IN_PROGRESS");
    expect(session.date).toBe("2026-02-04");
  });

  test("ActiveSession has required fields", () => {
    const session: ActiveSession = {
      sessionId: "SESSION-2026-02-04_01-test",
      status: "IN_PROGRESS",
      path: "sessions/SESSION-2026-02-04_01-test",
      date: "2026-02-04",
      isValid: true,
      checks: [],
    };

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe("IN_PROGRESS");
    expect(session.path).toBeDefined();
  });

  test("CreateSessionResult has required fields", () => {
    const result: CreateSessionResult = {
      success: true,
      sessionId: "SESSION-2026-02-04_01-test",
      path: "sessions/SESSION-2026-02-04_01-test",
      autoPaused: null,
    };

    expect(result.success).toBe(true);
    expect(result.sessionId).toBeDefined();
  });

  test("SessionStatusChangeResult has required fields", () => {
    const result: SessionStatusChangeResult = {
      success: true,
      sessionId: "SESSION-2026-02-04_01-test",
      previousStatus: "IN_PROGRESS",
      newStatus: "PAUSED",
    };

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe("IN_PROGRESS");
    expect(result.newStatus).toBe("PAUSED");
  });

  test("ExtendedSessionState has required fields", () => {
    const state: ExtendedSessionState = {
      sessionState: null,
      openSessions: [],
      activeSession: null,
    };

    expect(state.openSessions).toEqual([]);
    expect(state.activeSession).toBeNull();
  });
});
