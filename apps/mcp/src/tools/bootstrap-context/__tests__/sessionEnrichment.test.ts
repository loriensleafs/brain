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

import type { Mock } from "vitest";
import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * Mock result type for tests - simplified from SearchResult
 * Uses 'score' field which gets mapped to 'similarity_score' internally
 */
interface MockSearchResult {
  title: string;
  permalink: string;
  snippet?: string;
  fullContent?: string;
  score: number;
}

interface MockSearchResponse {
  results: MockSearchResult[];
  total: number;
  source: "keyword" | "semantic" | "hybrid";
}

// Use vi.hoisted() to ensure mocks are available before vi.mock() hoisting
const { mockSearchService } = vi.hoisted(() => {
  const emptyResponse: MockSearchResponse = {
    results: [],
    total: 0,
    source: "keyword",
  };

  const mockSearch: Mock<() => Promise<MockSearchResponse>> = vi.fn(() =>
    Promise.resolve(emptyResponse),
  );

  const mockSearchService = {
    search: mockSearch,
    semanticSearch: vi.fn(() => Promise.resolve([] as MockSearchResult[])),
    keywordSearch: vi.fn(() => Promise.resolve(emptyResponse)),
    hybridSearch: vi.fn(() => Promise.resolve(emptyResponse)),
  };

  return { mockSearchService };
});

// Mock the SearchService singleton
vi.mock("../../../services/search", () => ({
  getSearchService: () => mockSearchService,
  SearchService: vi.fn(() => mockSearchService),
}));

import type { AgentInvocation } from "../../../services/session/types";
import { createDefaultSessionState, createEmptyWorkflow } from "../../../services/session/types";
import { buildSessionEnrichment, extractTaskWikilinks } from "../sessionEnrichment";

describe("Session Enrichment", () => {
  beforeEach(() => {
    mockSearchService.search.mockClear();
    mockSearchService.search.mockResolvedValue({
      results: [],
      total: 0,
      source: "keyword" as const,
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

      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "TASK-001 Implementation",
            permalink: "tasks/TASK-001",
            snippet: "Task details",
            score: 0.85,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        "TASK-001",
        expect.objectContaining({
          project: "test-project",
        }),
      );
      expect(result.taskNotes.length).toBe(1);
      expect(result.taskNotes[0].title).toBe("TASK-001 Implementation");
    });

    test("queries feature notes when activeFeature is set", async () => {
      const sessionState = createDefaultSessionState();
      sessionState.activeFeature = "oauth-integration";

      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "OAuth Integration Feature",
            permalink: "features/oauth-integration",
            snippet: "Feature details",
            score: 0.9,
          },
          {
            title: "OAuth API Design",
            permalink: "features/oauth-integration/design",
            snippet: "Design notes",
            score: 0.85,
          },
        ],
        total: 2,
        source: "keyword" as const,
      });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        "oauth-integration",
        expect.objectContaining({
          project: "test-project",
        }),
      );
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

      // Search returns feature with task wikilinks in snippet
      mockSearchService.search.mockResolvedValue({
        results: [
          {
            title: "OAuth Integration Feature",
            permalink: "features/oauth-integration",
            snippet: "Feature details with tasks: [[TASK-001]] and [[TASK-002]]",
            score: 0.9,
          },
        ],
        total: 1,
        source: "keyword" as const,
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

      // First call returns feature with task reference, subsequent calls return empty
      mockSearchService.search
        .mockResolvedValueOnce({
          results: [
            {
              title: "Test Feature",
              permalink: "features/test-feature",
              snippet: "References [[TASK-999]] which does not exist",
              score: 0.9,
            },
          ],
          total: 1,
          source: "keyword" as const,
        })
        .mockResolvedValue({
          results: [],
          total: 0,
          source: "keyword" as const,
        });

      const result = await buildSessionEnrichment({
        project: "test-project",
        sessionState,
      });

      // Verify featuresWithTasks is populated even when tasks are missing
      expect(result.featuresWithTasks.length).toBeGreaterThanOrEqual(1);

      // Find the test feature and verify its tasks array exists (may be empty)
      const testFeature = result.featuresWithTasks.find((f) => f.feature.title === "Test Feature");
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
