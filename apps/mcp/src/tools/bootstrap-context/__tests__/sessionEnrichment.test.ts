/**
 * Tests for session enrichment in bootstrap_context tool
 *
 * Tests:
 * - buildSessionEnrichment with no session state
 * - buildSessionEnrichment with activeTask
 * - buildSessionEnrichment with activeFeature
 * - buildSessionEnrichment with orchestratorWorkflow
 * - Agent history extraction
 * - extractTaskWikilinks helper
 * - Feature task enrichment
 */

import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgentInvocation } from "../../../services/session/types";
import {
  createDefaultSessionState,
  createEmptyWorkflow,
} from "../../../services/session/types";
import {
  buildSessionEnrichment,
  extractTaskWikilinks,
} from "../sessionEnrichment";

// Mock the basic-memory client
const mockCallTool = vi.fn(() =>
  Promise.resolve({ content: [{ type: "text", text: '{"results":[]}' }] }),
);

vi.mock("../../../proxy/client", () => ({
  getBasicMemoryClient: () =>
    Promise.resolve({
      callTool: mockCallTool,
    }),
}));

describe("Session Enrichment", () => {
  beforeEach(() => {
    mockCallTool.mockClear();
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: '{"results":[]}' }],
    });
  });

  describe("buildSessionEnrichment", () => {
    test("returns empty arrays when no activeTask/activeFeature", async () => {
      const sessionState = createDefaultSessionState();

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(result.sessionState).toBe(sessionState);
      expect(result.taskNotes).toEqual([]);
      expect(result.featureNotes).toEqual([]);
      expect(result.featuresWithTasks).toEqual([]);
      expect(result.recentAgentHistory).toEqual([]);
    });

    test("queries task notes when activeTask is set", async () => {
      const sessionState = createDefaultSessionState();
      sessionState.activeTask = "TASK-001";

      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results: [
                {
                  type: "entity",
                  title: "TASK-001 Implementation",
                  permalink: "tasks/TASK-001",
                  content: "Task details",
                },
              ],
            }),
          },
        ],
      });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(mockCallTool).toHaveBeenCalledWith({
        name: "search_notes",
        arguments: expect.objectContaining({
          query: "TASK-001",
        }),
      });
      expect(result.taskNotes.length).toBe(1);
      expect(result.taskNotes[0].title).toBe("TASK-001 Implementation");
    });

    test("queries feature notes when activeFeature is set", async () => {
      const sessionState = createDefaultSessionState();
      sessionState.activeFeature = "oauth-integration";

      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results: [
                {
                  type: "entity",
                  title: "OAuth Integration Feature",
                  permalink: "features/oauth-integration",
                  content: "Feature details",
                },
                {
                  type: "entity",
                  title: "OAuth API Design",
                  permalink: "features/oauth-integration/design",
                  content: "Design notes",
                },
              ],
            }),
          },
        ],
      });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(mockCallTool).toHaveBeenCalledWith({
        name: "search_notes",
        arguments: expect.objectContaining({
          query: "oauth-integration",
        }),
      });
      expect(result.featureNotes.length).toBe(2);
    });

    test("extracts agent history from orchestrator workflow", async () => {
      const sessionState = createDefaultSessionState();
      const workflow = createEmptyWorkflow();

      // Add some agent history
      const invocation1: AgentInvocation = {
        agent: "analyst",
        startedAt: "2026-01-19T10:00:00Z",
        completedAt: "2026-01-19T10:05:00Z",
        status: "completed",
        input: { prompt: "Analyze requirements", context: {}, artifacts: [] },
        output: {
          artifacts: [],
          summary: "Analysis complete",
          recommendations: [],
          blockers: [],
        },
        handoffFrom: null,
        handoffTo: "planner",
        handoffReason: "Analysis done",
      };

      const invocation2: AgentInvocation = {
        agent: "planner",
        startedAt: "2026-01-19T10:05:00Z",
        completedAt: null,
        status: "in_progress",
        input: { prompt: "Create plan", context: {}, artifacts: [] },
        output: null,
        handoffFrom: "analyst",
        handoffTo: null,
        handoffReason: "",
      };

      workflow.agentHistory = [invocation1, invocation2];
      workflow.activeAgent = "planner";
      sessionState.orchestratorWorkflow = workflow;

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(result.recentAgentHistory.length).toBe(2);
      // Most recent first (reversed)
      expect(result.recentAgentHistory[0].agent).toBe("planner");
      expect(result.recentAgentHistory[0].status).toBe("in_progress");
      expect(result.recentAgentHistory[1].agent).toBe("analyst");
      expect(result.recentAgentHistory[1].status).toBe("completed");
      expect(result.recentAgentHistory[1].summary).toBe("Analysis complete");
    });

    test("limits agent history to maxAgentHistory", async () => {
      const sessionState = createDefaultSessionState();
      const workflow = createEmptyWorkflow();

      // Use valid agent types for the test
      const agentTypes = [
        "analyst",
        "planner",
        "implementer",
        "qa",
        "architect",
        "critic",
        "security",
        "devops",
        "retrospective",
        "memory",
      ] as const;

      // Add 10 agent invocations using valid agent types
      workflow.agentHistory = agentTypes.map((agent, i) => ({
        agent,
        startedAt: `2026-01-19T10:0${i}:00Z`,
        completedAt: `2026-01-19T10:0${i + 1}:00Z`,
        status: "completed" as const,
        input: { prompt: "", context: {}, artifacts: [] },
        output: {
          artifacts: [],
          summary: `Summary ${i}`,
          recommendations: [],
          blockers: [],
        },
        handoffFrom: null,
        handoffTo: null,
        handoffReason: "",
      }));

      sessionState.orchestratorWorkflow = workflow;

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
        maxAgentHistory: 3,
      });

      expect(result.recentAgentHistory.length).toBe(3);
    });

    test("returns empty agentHistory when no workflow", async () => {
      const sessionState = createDefaultSessionState();
      sessionState.orchestratorWorkflow = null;

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(result.recentAgentHistory).toEqual([]);
    });

    test("enriches features with their task notes", async () => {
      const sessionState = createDefaultSessionState();
      sessionState.activeFeature = "oauth-integration";

      // search_notes for feature (returns feature with task wikilinks)
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results: [
                {
                  type: "entity",
                  title: "OAuth Integration Feature",
                  permalink: "features/oauth-integration",
                  content:
                    "Feature details with tasks: [[TASK-001]] and [[TASK-002]]",
                },
              ],
            }),
          },
        ],
      });

      // read_note calls for fullContent enrichment and relation expansion
      // Return content with task wikilinks
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "Feature details with tasks: [[TASK-001]] and [[TASK-002]] - full content",
          },
        ],
      });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      // Verify featuresWithTasks is populated when there are feature notes
      expect(result.featuresWithTasks.length).toBeGreaterThanOrEqual(1);

      // Find the OAuth feature in results
      const oauthFeature = result.featuresWithTasks.find(
        (f) => f.feature.title === "OAuth Integration Feature",
      );
      expect(oauthFeature).toBeDefined();
    });

    test("handles missing task notes gracefully", async () => {
      const sessionState = createDefaultSessionState();
      sessionState.activeFeature = "test-feature";

      // search_notes for feature
      mockCallTool.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              results: [
                {
                  type: "entity",
                  title: "Test Feature",
                  permalink: "features/test-feature",
                  content: "References [[TASK-999]] which does not exist",
                },
              ],
            }),
          },
        ],
      });

      // read_note and additional search_notes calls return content without task results
      // (mimics missing task scenario)
      mockCallTool.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ results: [] }),
          },
        ],
      });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      // Verify featuresWithTasks is populated even when tasks are missing
      expect(result.featuresWithTasks.length).toBeGreaterThanOrEqual(1);

      // Find the test feature and verify its tasks array exists (may be empty)
      const testFeature = result.featuresWithTasks.find(
        (f) => f.feature.title === "Test Feature",
      );
      expect(testFeature).toBeDefined();
      expect(testFeature?.tasks).toBeDefined();
    });
  });

  describe("extractTaskWikilinks", () => {
    test("extracts simple task wikilinks", () => {
      const content = "This feature has [[TASK-001]] and [[TASK-002]] tasks.";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual(["TASK-001", "TASK-002"]);
    });

    test("extracts task wikilinks with hyphenated numbers", () => {
      const content = "Working on [[TASK-1-2]] and [[TASK-10-5]].";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual(["TASK-1-2", "TASK-10-5"]);
    });

    test("handles case-insensitive task patterns", () => {
      const content = "Tasks: [[task-001]] and [[Task-002]]";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual(["TASK-001", "TASK-002"]);
    });

    test("extracts tasks from path wikilinks", () => {
      const content = "See [[tasks/TASK-001]] for details.";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual(["TASK-001"]);
    });

    test("deduplicates task IDs", () => {
      const content = "[[TASK-001]] appears twice [[TASK-001]].";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual(["TASK-001"]);
    });

    test("ignores non-task wikilinks", () => {
      const content = "See [[Feature-OAuth]] and [[ADR-001]] for context.";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual([]);
    });

    test("returns empty array for undefined content", () => {
      const tasks = extractTaskWikilinks(undefined);
      expect(tasks).toEqual([]);
    });

    test("returns empty array for content without wikilinks", () => {
      const content = "No wikilinks here, just plain text.";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual([]);
    });

    test("extracts tasks folder references without TASK pattern", () => {
      const content = "See [[tasks/setup-database]] for schema.";
      const tasks = extractTaskWikilinks(content);
      expect(tasks).toEqual(["tasks/setup-database"]);
    });
  });
});
