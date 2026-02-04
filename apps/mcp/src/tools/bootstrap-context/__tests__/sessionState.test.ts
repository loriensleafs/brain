/**
 * Tests for session state integration in bootstrap_context tool
 *
 * Tests:
 * - structuredOutput includes openSessions and activeSession fields
 * - formattedOutput renders session state section correctly
 * - activeSession is null when no session is IN_PROGRESS
 * - Multiple open sessions are listed with status
 *
 * @see FEATURE-001-session-management
 */

import { describe, expect, test } from "vitest";

import type { ActiveSession, OpenSession } from "../../../services/session/types";
import { buildFormattedOutput, type FormattedOutputInput } from "../formattedOutput";
import { buildStructuredOutput, type StructuredOutputInput } from "../structuredOutput";

// Test fixtures
const mockOpenSessions: OpenSession[] = [
  {
    sessionId: "SESSION-2026-02-04_01-feature-work",
    status: "IN_PROGRESS",
    date: "2026-02-04",
    branch: "feature/session-resume",
    topic: "feature-work",
    permalink: "sessions/SESSION-2026-02-04_01-feature-work",
  },
  {
    sessionId: "SESSION-2026-02-03_02-bugfix",
    status: "PAUSED",
    date: "2026-02-03",
    branch: "fix/memory-leak",
    topic: "bugfix",
    permalink: "sessions/SESSION-2026-02-03_02-bugfix",
  },
];

const mockActiveSession: ActiveSession = {
  sessionId: "SESSION-2026-02-04_01-feature-work",
  status: "IN_PROGRESS",
  path: "sessions/SESSION-2026-02-04_01-feature-work",
  mode: "coding",
  task: "Implement session integration",
  branch: "feature/session-resume",
  date: "2026-02-04",
  topic: "feature-work",
  isValid: true,
  checks: [
    { name: "brain_mcp_initialized", passed: true },
    { name: "session_log_created", passed: true },
  ],
};

function createBaseStructuredInput(
  overrides: Partial<StructuredOutputInput> = {},
): StructuredOutputInput {
  return {
    project: "test-project",
    timeframe: "5d",
    openSessions: [],
    activeSession: null,
    activeFeatures: [],
    recentDecisions: [],
    openBugs: [],
    recentActivity: [],
    referencedNotes: [],
    ...overrides,
  };
}

function createBaseFormattedInput(
  overrides: Partial<FormattedOutputInput> = {},
): FormattedOutputInput {
  return {
    project: "test-project",
    openSessions: [],
    activeSession: null,
    activeFeatures: [],
    recentDecisions: [],
    openBugs: [],
    recentActivity: [],
    referencedNotes: [],
    ...overrides,
  };
}

describe("structuredOutput", () => {
  describe("session fields", () => {
    test("includes empty openSessions array when no sessions", () => {
      const input = createBaseStructuredInput();
      const result = buildStructuredOutput(input);

      expect(result.open_sessions).toEqual([]);
    });

    test("includes null activeSession when no active session", () => {
      const input = createBaseStructuredInput();
      const result = buildStructuredOutput(input);

      expect(result.active_session).toBeNull();
    });

    test("includes openSessions from session service", () => {
      const input = createBaseStructuredInput({
        openSessions: mockOpenSessions,
      });
      const result = buildStructuredOutput(input);

      expect(result.open_sessions).toHaveLength(2);
      expect(result.open_sessions[0].sessionId).toBe("SESSION-2026-02-04_01-feature-work");
      expect(result.open_sessions[0].status).toBe("IN_PROGRESS");
      expect(result.open_sessions[1].sessionId).toBe("SESSION-2026-02-03_02-bugfix");
      expect(result.open_sessions[1].status).toBe("PAUSED");
    });

    test("includes activeSession from session service", () => {
      const input = createBaseStructuredInput({
        openSessions: mockOpenSessions,
        activeSession: mockActiveSession,
      });
      const result = buildStructuredOutput(input);

      expect(result.active_session).not.toBeNull();
      expect(result.active_session?.sessionId).toBe("SESSION-2026-02-04_01-feature-work");
      expect(result.active_session?.status).toBe("IN_PROGRESS");
      expect(result.active_session?.branch).toBe("feature/session-resume");
    });

    test("activeSession is null when all sessions are PAUSED", () => {
      const pausedSessions: OpenSession[] = [
        {
          sessionId: "SESSION-2026-02-03_01-paused",
          status: "PAUSED",
          date: "2026-02-03",
          branch: "main",
          topic: "paused",
          permalink: "sessions/SESSION-2026-02-03_01-paused",
        },
      ];
      const input = createBaseStructuredInput({
        openSessions: pausedSessions,
        activeSession: null,
      });
      const result = buildStructuredOutput(input);

      expect(result.open_sessions).toHaveLength(1);
      expect(result.active_session).toBeNull();
    });
  });
});

describe("formattedOutput", () => {
  describe("session state rendering", () => {
    test("renders session state section when activeSession present", () => {
      const input = createBaseFormattedInput({
        openSessions: mockOpenSessions,
        activeSession: mockActiveSession,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("### Session State");
      expect(result).toContain("**Active Session**: SESSION-2026-02-04_01-feature-work");
      expect(result).toContain("(IN_PROGRESS)");
    });

    test("renders session state section when only openSessions present", () => {
      const pausedSessions: OpenSession[] = [
        {
          sessionId: "SESSION-2026-02-03_01-paused",
          status: "PAUSED",
          date: "2026-02-03",
          branch: "main",
          topic: "paused work",
          permalink: "sessions/SESSION-2026-02-03_01-paused",
        },
      ];
      const input = createBaseFormattedInput({
        openSessions: pausedSessions,
        activeSession: null,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("### Session State");
      expect(result).toContain("**Active Session**: None");
      expect(result).toContain("SESSION-2026-02-03_01-paused");
      expect(result).toContain("(PAUSED)");
    });

    test("shows open sessions count", () => {
      const input = createBaseFormattedInput({
        openSessions: mockOpenSessions,
        activeSession: mockActiveSession,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("**Open Sessions**: 2 sessions available");
    });

    test("shows singular session count for one session", () => {
      const singleSession: OpenSession[] = [mockOpenSessions[0]];
      const input = createBaseFormattedInput({
        openSessions: singleSession,
        activeSession: mockActiveSession,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("**Open Sessions**: 1 session available");
    });

    test("shows no sessions when empty", () => {
      const input = createBaseFormattedInput({
        openSessions: [],
        activeSession: null,
      });
      const result = buildFormattedOutput(input);

      // No session state section when both are empty/null
      expect(result).not.toContain("### Session State");
    });

    test("includes branch info in session list", () => {
      const input = createBaseFormattedInput({
        openSessions: mockOpenSessions,
        activeSession: mockActiveSession,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("(branch: `feature/session-resume`)");
      expect(result).toContain("(branch: `fix/memory-leak`)");
    });

    test("includes topic in active session display", () => {
      const input = createBaseFormattedInput({
        openSessions: mockOpenSessions,
        activeSession: mockActiveSession,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("SESSION-2026-02-04_01-feature-work - feature-work");
    });

    test("handles session without topic gracefully", () => {
      const sessionWithoutTopic: ActiveSession = {
        ...mockActiveSession,
        topic: undefined,
      };
      const input = createBaseFormattedInput({
        openSessions: [],
        activeSession: sessionWithoutTopic,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain(
        "**Active Session**: SESSION-2026-02-04_01-feature-work (IN_PROGRESS)",
      );
      expect(result).not.toContain(" - feature-work");
    });

    test("handles session without branch gracefully", () => {
      const sessionWithoutBranch: OpenSession[] = [
        {
          sessionId: "SESSION-2026-02-04_01-no-branch",
          status: "IN_PROGRESS",
          date: "2026-02-04",
          topic: "no-branch",
          permalink: "sessions/SESSION-2026-02-04_01-no-branch",
        },
      ];
      const input = createBaseFormattedInput({
        openSessions: sessionWithoutBranch,
        activeSession: null,
      });
      const result = buildFormattedOutput(input);

      expect(result).toContain("SESSION-2026-02-04_01-no-branch");
      expect(result).not.toContain("(branch:");
    });
  });
});
