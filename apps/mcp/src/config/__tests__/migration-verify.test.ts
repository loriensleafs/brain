/**
 * Unit tests for Migration Verification module.
 *
 * Tests TASK-020-10 requirements:
 * - verifyMemoryIndexing(): Check that migrated memories are searchable
 * - Search by title using SearchService
 * - Verify content match (first 100 chars)
 * - Return list of missing/mismatched memories
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { SearchResponse, SearchResult } from "../../services/search/types";

// Mock SearchService
const mockSearch = mock(
  async (): Promise<SearchResponse> => ({
    results: [],
    total: 0,
    query: "",
    mode: "auto",
    depth: 0,
    actualSource: "keyword",
  })
) as ReturnType<
  typeof mock<(query: string, opts: unknown) => Promise<SearchResponse>>
>;

const MockSearchService = mock(() => ({
  search: mockSearch,
}));

mock.module("../../services/search", () => ({
  SearchService: MockSearchService,
}));

// Mock proxy client
const mockCallTool = mock(async () => ({
  content: [{ type: "text", text: "Test content for memory" }],
})) as ReturnType<
  typeof mock<(args: unknown) => Promise<{ content: { type: string; text: string }[] }>>
>;

mock.module("../../proxy/client", () => ({
  getBasicMemoryClient: async () => ({
    callTool: mockCallTool,
  }),
}));

// Mock logger
mock.module("../../utils/internal/logger", () => ({
  logger: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  },
}));

import {
  verifyMemoryIndexing,
  isMemoryIndexed,
  getProblematicMemories,
  type MemoryToVerify,
  type VerificationSummary,
} from "../migration-verify";

describe("verifyMemoryIndexing", () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockCallTool.mockReset();
    MockSearchService.mockClear();

    // Default: return empty results
    mockSearch.mockResolvedValue({
      results: [],
      total: 0,
      query: "",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Test content" }],
    });
  });

  test("returns success when all memories are found and match", async () => {
    const memories: MemoryToVerify[] = [
      {
        title: "Authentication Patterns",
        permalink: "patterns/auth",
        content: "Test content for authentication",
      },
    ];

    // Mock search to return matching result
    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "patterns/auth",
          title: "Authentication Patterns",
          similarity_score: 0.95,
          snippet: "Test content",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Authentication Patterns",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    // Mock content fetch to return matching content
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Test content for authentication" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.success).toBe(true);
    expect(summary.total).toBe(1);
    expect(summary.found).toBe(1);
    expect(summary.missing).toBe(0);
    expect(summary.mismatched).toBe(0);
  });

  test("identifies missing memories when search returns no results", async () => {
    const memories: MemoryToVerify[] = [
      {
        title: "Missing Memory",
        permalink: "patterns/missing",
        content: "This content should exist",
      },
    ];

    // Mock search to return empty
    mockSearch.mockResolvedValue({
      results: [],
      total: 0,
      query: "Missing Memory",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.success).toBe(false);
    expect(summary.found).toBe(0);
    expect(summary.missing).toBe(1);
    expect(summary.results[0].status).toBe("missing");
  });

  test("identifies mismatched memories when content differs", async () => {
    const memories: MemoryToVerify[] = [
      {
        title: "Database Design",
        permalink: "decisions/db",
        content: "Expected content for database design document",
      },
    ];

    // Mock search to return matching permalink
    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "decisions/db",
          title: "Database Design",
          similarity_score: 0.9,
          snippet: "Different content",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Database Design",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    // Mock content fetch to return different content
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Completely different content that does not match" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.success).toBe(false);
    expect(summary.found).toBe(0);
    expect(summary.mismatched).toBe(1);
    expect(summary.results[0].status).toBe("mismatched");
    expect(summary.results[0].error).toContain("Content prefix does not match");
  });

  test("handles multiple memories with mixed results", async () => {
    const memories: MemoryToVerify[] = [
      { title: "Found Memory", permalink: "found/memory", content: "Found content" },
      { title: "Missing Memory", permalink: "missing/memory", content: "Missing content" },
      { title: "Mismatched Memory", permalink: "mismatched/memory", content: "Expected" },
    ];

    // Mock search to return results based on query
    mockSearch.mockImplementation(async (query: string) => {
      if (query === "Found Memory") {
        return {
          results: [
            {
              permalink: "found/memory",
              title: "Found Memory",
              similarity_score: 0.9,
              snippet: "Found",
              source: "keyword" as const,
            },
          ],
          total: 1,
          query,
          mode: "auto" as const,
          depth: 0,
          actualSource: "keyword" as const,
        };
      }
      if (query === "Mismatched Memory") {
        return {
          results: [
            {
              permalink: "mismatched/memory",
              title: "Mismatched Memory",
              similarity_score: 0.8,
              snippet: "Different",
              source: "keyword" as const,
            },
          ],
          total: 1,
          query,
          mode: "auto" as const,
          depth: 0,
          actualSource: "keyword" as const,
        };
      }
      return {
        results: [],
        total: 0,
        query,
        mode: "auto" as const,
        depth: 0,
        actualSource: "keyword" as const,
      };
    });

    // Mock content fetch based on permalink
    mockCallTool.mockImplementation(async (args: unknown) => {
      const typedArgs = args as { arguments?: { identifier?: string } };
      const permalink = typedArgs.arguments?.identifier;
      if (permalink === "found/memory") {
        return { content: [{ type: "text", text: "Found content" }] };
      }
      if (permalink === "mismatched/memory") {
        return { content: [{ type: "text", text: "Completely different content" }] };
      }
      return { content: [{ type: "text", text: "" }] };
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.total).toBe(3);
    expect(summary.found).toBe(1);
    expect(summary.missing).toBe(1);
    expect(summary.mismatched).toBe(1);
    expect(summary.success).toBe(false);
  });

  test("handles search errors gracefully", async () => {
    const memories: MemoryToVerify[] = [
      { title: "Error Memory", permalink: "error/memory", content: "Content" },
    ];

    // Mock search to throw error
    mockSearch.mockRejectedValue(new Error("Search service unavailable"));

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.success).toBe(false);
    expect(summary.missing).toBe(1);
    expect(summary.results[0].status).toBe("missing");
    expect(summary.results[0].error).toContain("Search service unavailable");
  });

  test("normalizes permalinks for comparison", async () => {
    const memories: MemoryToVerify[] = [
      { title: "Normalized Test", permalink: "/patterns/test/", content: "Test content" },
    ];

    // Mock search to return permalink without slashes
    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "patterns/test",
          title: "Normalized Test",
          similarity_score: 0.9,
          snippet: "Test",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Normalized Test",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Test content" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    // Should match despite slash differences
    expect(summary.found).toBe(1);
    expect(summary.results[0].status).toBe("found");
  });

  test("includes verification timestamp", async () => {
    const beforeTime = new Date();
    const memories: MemoryToVerify[] = [];

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.verifiedAt).toBeInstanceOf(Date);
    expect(summary.verifiedAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
  });

  test("detects memory at different permalink", async () => {
    const memories: MemoryToVerify[] = [
      { title: "Moved Memory", permalink: "old/location", content: "Content" },
    ];

    // Mock search to return memory at different permalink but same title
    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "new/location",
          title: "Moved Memory",
          similarity_score: 0.9,
          snippet: "Content",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Moved Memory",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Content" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.mismatched).toBe(1);
    expect(summary.results[0].error).toContain("different permalink");
    expect(summary.results[0].error).toContain("new/location");
  });
});

describe("isMemoryIndexed", () => {
  beforeEach(() => {
    mockSearch.mockReset();
    MockSearchService.mockClear();
  });

  test("returns true when memory is found at expected permalink", async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "patterns/auth",
          title: "Auth Patterns",
          similarity_score: 0.9,
          snippet: "...",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Auth Patterns",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    const indexed = await isMemoryIndexed("Auth Patterns", "patterns/auth");

    expect(indexed).toBe(true);
  });

  test("returns false when memory is not found", async () => {
    mockSearch.mockResolvedValue({
      results: [],
      total: 0,
      query: "Missing",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    const indexed = await isMemoryIndexed("Missing", "not/found");

    expect(indexed).toBe(false);
  });

  test("returns false when found at different permalink", async () => {
    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "other/location",
          title: "Some Title",
          similarity_score: 0.9,
          snippet: "...",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Some Title",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    const indexed = await isMemoryIndexed("Some Title", "expected/location");

    expect(indexed).toBe(false);
  });

  test("handles errors gracefully", async () => {
    mockSearch.mockRejectedValue(new Error("Network error"));

    const indexed = await isMemoryIndexed("Error Test", "test/path");

    expect(indexed).toBe(false);
  });
});

describe("getProblematicMemories", () => {
  test("returns only missing and mismatched memories", () => {
    const summary: VerificationSummary = {
      total: 4,
      found: 2,
      missing: 1,
      mismatched: 1,
      success: false,
      verifiedAt: new Date(),
      results: [
        { title: "Found 1", permalink: "found/1", status: "found" },
        { title: "Found 2", permalink: "found/2", status: "found" },
        { title: "Missing", permalink: "missing/1", status: "missing", error: "Not found" },
        {
          title: "Mismatched",
          permalink: "mismatched/1",
          status: "mismatched",
          error: "Content mismatch",
        },
      ],
    };

    const problems = getProblematicMemories(summary);

    expect(problems).toHaveLength(2);
    expect(problems.map((p) => p.title)).toEqual(["Missing", "Mismatched"]);
  });

  test("returns empty array when all memories found", () => {
    const summary: VerificationSummary = {
      total: 2,
      found: 2,
      missing: 0,
      mismatched: 0,
      success: true,
      verifiedAt: new Date(),
      results: [
        { title: "Found 1", permalink: "found/1", status: "found" },
        { title: "Found 2", permalink: "found/2", status: "found" },
      ],
    };

    const problems = getProblematicMemories(summary);

    expect(problems).toHaveLength(0);
  });
});

describe("content normalization", () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockCallTool.mockReset();
    MockSearchService.mockClear();
  });

  test("normalizes whitespace in content comparison", async () => {
    const memories: MemoryToVerify[] = [
      {
        title: "Whitespace Test",
        permalink: "test/whitespace",
        content: "Content with   multiple    spaces",
      },
    ];

    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "test/whitespace",
          title: "Whitespace Test",
          similarity_score: 0.9,
          snippet: "...",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Whitespace Test",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    // Return content with different whitespace
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Content with multiple spaces" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.found).toBe(1);
    expect(summary.results[0].status).toBe("found");
  });

  test("normalizes line endings in content comparison", async () => {
    const memories: MemoryToVerify[] = [
      {
        title: "Line Ending Test",
        permalink: "test/lines",
        content: "Line one\r\nLine two",
      },
    ];

    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "test/lines",
          title: "Line Ending Test",
          similarity_score: 0.9,
          snippet: "...",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Line Ending Test",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    // Return content with Unix line endings
    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "Line one\nLine two" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.found).toBe(1);
    expect(summary.results[0].status).toBe("found");
  });

  test("case-insensitive content comparison", async () => {
    const memories: MemoryToVerify[] = [
      {
        title: "Case Test",
        permalink: "test/case",
        content: "Content with UPPERCASE",
      },
    ];

    mockSearch.mockResolvedValue({
      results: [
        {
          permalink: "test/case",
          title: "Case Test",
          similarity_score: 0.9,
          snippet: "...",
          source: "keyword",
        },
      ],
      total: 1,
      query: "Case Test",
      mode: "auto",
      depth: 0,
      actualSource: "keyword",
    });

    mockCallTool.mockResolvedValue({
      content: [{ type: "text", text: "content with uppercase" }],
    });

    const summary = await verifyMemoryIndexing(memories);

    expect(summary.found).toBe(1);
    expect(summary.results[0].status).toBe("found");
  });
});
