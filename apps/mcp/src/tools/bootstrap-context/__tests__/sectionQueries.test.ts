/**
 * Tests for sectionQueries in bootstrap_context tool
 *
 * Tests:
 * - queryOpenSessions with sessions having status: in_progress
 * - queryOpenSessions with no open sessions (empty array)
 * - queryOpenSessions backward compatibility (missing status = complete)
 * - Branch extraction from session content
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

import { queryOpenSessions } from "../sectionQueries";

describe("sectionQueries", () => {
  beforeEach(() => {
    mockSearchService.search.mockClear();
    mockSearchService.search.mockResolvedValue({
      results: [],
      total: 0,
      source: "keyword" as const,
    });
  });

  describe("queryOpenSessions", () => {
    test("returns sessions with status: in_progress", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-2026-02-04_01-feature-work",
            permalink: "sessions/SESSION-2026-02-04_01-feature-work",
            snippet: "Working on feature...",
            fullContent: `---
title: SESSION-2026-02-04_01-feature-work
type: session
---

## Status

**IN_PROGRESS**

## Branch

\`feature/session-resume\`

Working on the session resume capability.`,
            score: 0.9,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(mockSearchService.search).toHaveBeenCalledWith(
        "session status in_progress",
        expect.objectContaining({
          project: "test-project",
          folders: ["sessions/"],
        }),
      );
      expect(result.length).toBe(1);
      expect(result[0].title).toBe("SESSION-2026-02-04_01-feature-work");
      expect(result[0].date).toBe("2026-02-04");
      expect(result[0].branch).toBe("feature/session-resume");
    });

    test("returns empty array when no open sessions exist", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [],
        total: 0,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result).toEqual([]);
    });

    test("treats sessions without status as complete (backward compatible)", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-2026-02-03_01-old-session",
            permalink: "sessions/SESSION-2026-02-03_01-old-session",
            snippet: "Old session content...",
            fullContent: `---
title: SESSION-2026-02-03_01-old-session
type: session
---

# Old Session

No status section in this note.`,
            score: 0.85,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      // Should not include sessions without explicit in_progress status
      expect(result).toEqual([]);
    });

    test("excludes sessions with complete status", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-2026-02-02_01-done-session",
            permalink: "sessions/SESSION-2026-02-02_01-done-session",
            snippet: "Completed session...",
            fullContent: `---
title: SESSION-2026-02-02_01-done-session
type: session
---

## Status

**COMPLETE**

Session finished successfully.`,
            score: 0.9,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result).toEqual([]);
    });

    test("handles multiple open sessions", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-2026-02-04_01-feature-a",
            permalink: "sessions/SESSION-2026-02-04_01-feature-a",
            fullContent: `## Status\n\n**IN_PROGRESS**\n\nBranch: main`,
            score: 0.9,
          },
          {
            title: "SESSION-2026-02-04_02-feature-b",
            permalink: "sessions/SESSION-2026-02-04_02-feature-b",
            fullContent: `## Status\n\n**IN_PROGRESS**\n\n**Branch:** \`feature/xyz\``,
            score: 0.85,
          },
        ],
        total: 2,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result.length).toBe(2);
      expect(result[0].title).toBe("SESSION-2026-02-04_01-feature-a");
      expect(result[0].branch).toBe("main");
      expect(result[1].title).toBe("SESSION-2026-02-04_02-feature-b");
      expect(result[1].branch).toBe("feature/xyz");
    });

    test("extracts date from session title", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-2026-01-15_03-debugging",
            permalink: "sessions/SESSION-2026-01-15_03-debugging",
            fullContent: `## Status\n\n**IN_PROGRESS**`,
            score: 0.9,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result[0].date).toBe("2026-01-15");
    });

    test("handles session without date in title", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-custom-name",
            permalink: "sessions/SESSION-custom-name",
            fullContent: `## Status\n\n**IN_PROGRESS**`,
            score: 0.9,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result[0].date).toBe("");
    });

    test("handles session without branch info", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "SESSION-2026-02-04_01-no-branch",
            permalink: "sessions/SESSION-2026-02-04_01-no-branch",
            fullContent: `## Status\n\n**IN_PROGRESS**\n\nNo branch info here.`,
            score: 0.9,
          },
        ],
        total: 1,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result[0].branch).toBeUndefined();
    });

    test("extracts branch from various formats", async () => {
      // Test different branch format patterns
      const testCases = [
        { content: "Branch: feature/test", expected: "feature/test" },
        { content: "**Branch:** `main`", expected: "main" },
        { content: "**Branch:** develop", expected: "develop" },
        { content: "git branch: `hotfix/123`", expected: "hotfix/123" },
      ];

      for (const { content, expected } of testCases) {
        mockSearchService.search.mockResolvedValueOnce({
          results: [
            {
              title: "SESSION-2026-02-04_01-test",
              permalink: "sessions/SESSION-2026-02-04_01-test",
              fullContent: `## Status\n\n**IN_PROGRESS**\n\n${content}`,
              score: 0.9,
            },
          ],
          total: 1,
          source: "keyword" as const,
        });

        const result = await queryOpenSessions({ project: "test-project" });
        expect(result[0].branch).toBe(expected);
      }
    });

    test("skips results without title or permalink", async () => {
      mockSearchService.search.mockResolvedValueOnce({
        results: [
          {
            title: "",
            permalink: "sessions/no-title",
            fullContent: `## Status\n\n**IN_PROGRESS**`,
            score: 0.9,
          },
          {
            title: "SESSION-2026-02-04_01-valid",
            permalink: "",
            fullContent: `## Status\n\n**IN_PROGRESS**`,
            score: 0.85,
          },
          {
            title: "SESSION-2026-02-04_02-valid",
            permalink: "sessions/SESSION-2026-02-04_02-valid",
            fullContent: `## Status\n\n**IN_PROGRESS**`,
            score: 0.8,
          },
        ],
        total: 3,
        source: "keyword" as const,
      });

      const result = await queryOpenSessions({ project: "test-project" });

      expect(result.length).toBe(1);
      expect(result[0].title).toBe("SESSION-2026-02-04_02-valid");
    });
  });
});
