/**
 * Unit tests for SearchService.
 *
 * Tests the unified search abstraction including:
 * - Mode selection (auto, semantic, keyword, hybrid)
 * - Folder filtering
 * - Singleton and factory patterns
 * - Error handling
 *
 * @see ADR-001: Search Service Abstraction
 */

import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import {
  SearchService,
  getSearchService,
  createSearchService,
} from "../index";
import type { SearchOptions } from "../types";

// Mock modules
const mockCallTool = mock(() =>
  Promise.resolve({
    content: [
      {
        type: "text",
        text: JSON.stringify({
          results: [
            {
              title: "Test Note",
              permalink: "notes/test-note",
              content: "Test content snippet",
              score: 0.85,
            },
            {
              title: "Feature Note",
              permalink: "features/test-feature",
              content: "Feature content",
              score: 0.75,
            },
          ],
          total: 2,
          page: 1,
          page_size: 10,
        }),
      },
    ],
  })
);

const mockGenerateEmbedding = mock(() =>
  Promise.resolve(Array.from({ length: 768 }, () => 0.5))
);

const mockDbQuery = mock(() => ({
  all: () => [
    { entity_id: "notes/semantic-result", distance: 0.1 },
    { entity_id: "features/semantic-feature", distance: 0.2 },
  ],
  get: () => ({ count: 2 }),
}));

const mockDb = {
  query: mockDbQuery,
  close: mock(() => {}),
};

// Mock the dependencies
mock.module("../../../proxy/client", () => ({
  getBasicMemoryClient: mock(() =>
    Promise.resolve({
      callTool: mockCallTool,
    })
  ),
}));

mock.module("../../../db", () => ({
  createVectorConnection: mock(() => mockDb),
}));

mock.module("../../embedding/generateEmbedding", () => ({
  generateEmbedding: mockGenerateEmbedding,
}));

mock.module("../../../project/resolve", () => ({
  resolveProject: mock(() => "test-project"),
}));

describe("SearchService", () => {
  let service: SearchService;

  beforeEach(() => {
    service = new SearchService();
    mockCallTool.mockClear();
    mockGenerateEmbedding.mockClear();
    mockDbQuery.mockClear();
  });

  describe("constructor", () => {
    test("creates instance without default project", () => {
      const s = new SearchService();
      expect(s).toBeInstanceOf(SearchService);
    });

    test("creates instance with default project", () => {
      const s = new SearchService("my-project");
      expect(s).toBeInstanceOf(SearchService);
    });
  });

  describe("search method", () => {
    test("returns search response with results", async () => {
      const response = await service.search("test query");

      expect(response).toBeDefined();
      expect(response.query).toBe("test query");
      expect(response.total).toBeGreaterThanOrEqual(0);
      expect(response.mode).toBe("auto");
      expect(response.depth).toBe(0);
    });

    test("applies keyword mode when specified", async () => {
      const response = await service.search("test", { mode: "keyword" });

      expect(response.mode).toBe("keyword");
      expect(response.actualSource).toBe("keyword");
    });

    test("applies default options", async () => {
      const response = await service.search("test");

      expect(response.mode).toBe("auto");
      expect(response.depth).toBe(0);
    });

    test("overrides defaults with provided options", async () => {
      const options: SearchOptions = {
        limit: 20,
        threshold: 0.5,
        mode: "keyword",
        depth: 1,
      };

      const response = await service.search("test", options);

      expect(response.mode).toBe("keyword");
      expect(response.depth).toBe(1);
    });
  });

  describe("folder filtering", () => {
    test("filters results by single folder", async () => {
      const response = await service.search("test", {
        mode: "keyword",
        folders: ["features/"],
      });

      // Results should only include items from features/ folder
      for (const result of response.results) {
        expect(result.permalink.startsWith("features/")).toBe(true);
      }
    });

    test("filters results by multiple folders", async () => {
      const response = await service.search("test", {
        mode: "keyword",
        folders: ["features/", "notes/"],
      });

      // Results should only include items from features/ or notes/ folders
      for (const result of response.results) {
        const matchesFolder =
          result.permalink.startsWith("features/") ||
          result.permalink.startsWith("notes/");
        expect(matchesFolder).toBe(true);
      }
    });

    test("handles folder without trailing slash", async () => {
      const response = await service.search("test", {
        mode: "keyword",
        folders: ["features"],
      });

      // Should still match features/ items
      for (const result of response.results) {
        expect(
          result.permalink.startsWith("features/") ||
            result.permalink.startsWith("features")
        ).toBe(true);
      }
    });
  });

  describe("semanticSearch method", () => {
    test("returns empty array when no embeddings", async () => {
      // Override mock to return count of 0
      mockDbQuery.mockImplementation(() => ({
        all: () => [],
        get: () => ({ count: 0 }),
      }));

      const results = await service.semanticSearch("test");
      expect(results).toEqual([]);
    });

    test("uses custom limit and threshold", async () => {
      const results = await service.semanticSearch("test", 5, 0.8);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("keywordSearch method", () => {
    test("returns keyword search results", async () => {
      const results = await service.keywordSearch("test");

      expect(Array.isArray(results)).toBe(true);
      for (const result of results) {
        expect(result.source).toBe("keyword");
      }
    });

    test("uses custom limit", async () => {
      const results = await service.keywordSearch("test", 5);
      expect(Array.isArray(results)).toBe(true);
    });

    test("uses project parameter", async () => {
      const results = await service.keywordSearch("test", 10, "other-project");
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("hasEmbeddings method", () => {
    test("returns true when embeddings exist", () => {
      mockDbQuery.mockImplementation(() => ({
        all: () => [],
        get: () => ({ count: 5 }),
      }));

      // Need to create new instance to use updated mock
      const s = new SearchService();
      const has = s.hasEmbeddings();
      expect(has).toBe(true);
    });

    test("returns false when no embeddings", () => {
      mockDbQuery.mockImplementation(() => ({
        all: () => [],
        get: () => ({ count: 0 }),
      }));

      const s = new SearchService();
      const has = s.hasEmbeddings();
      expect(has).toBe(false);
    });
  });
});

describe("getSearchService (singleton)", () => {
  test("returns SearchService instance", () => {
    const service = getSearchService();
    expect(service).toBeInstanceOf(SearchService);
  });

  test("returns same instance on multiple calls", () => {
    const service1 = getSearchService();
    const service2 = getSearchService();
    expect(service1).toBe(service2);
  });
});

describe("createSearchService (factory)", () => {
  test("creates new instance", () => {
    const service = createSearchService();
    expect(service).toBeInstanceOf(SearchService);
  });

  test("creates instance with project", () => {
    const service = createSearchService("my-project");
    expect(service).toBeInstanceOf(SearchService);
  });

  test("creates different instances on each call", () => {
    const service1 = createSearchService();
    const service2 = createSearchService();
    expect(service1).not.toBe(service2);
  });
});

describe("SearchResult structure", () => {
  test("keyword results have correct structure", async () => {
    const service = new SearchService();
    const response = await service.search("test", { mode: "keyword" });

    for (const result of response.results) {
      expect(typeof result.permalink).toBe("string");
      expect(typeof result.title).toBe("string");
      expect(typeof result.similarity_score).toBe("number");
      expect(typeof result.snippet).toBe("string");
      expect(["semantic", "keyword", "related", "hybrid"]).toContain(result.source);
    }
  });
});

describe("SearchResponse structure", () => {
  test("has all required fields", async () => {
    const service = new SearchService();
    const response = await service.search("test");

    expect(response).toHaveProperty("results");
    expect(response).toHaveProperty("total");
    expect(response).toHaveProperty("query");
    expect(response).toHaveProperty("mode");
    expect(response).toHaveProperty("depth");
    expect(response).toHaveProperty("actualSource");

    expect(Array.isArray(response.results)).toBe(true);
    expect(typeof response.total).toBe("number");
    expect(response.query).toBe("test");
  });
});

describe("fullContent option", () => {
  let service: SearchService;
  let callCount: number;

  // Helper to create mock implementation for fullContent tests
  const createFullContentMock = () => {
    return (call: unknown) => {
      const typedCall = call as { name: string; arguments: Record<string, unknown> };
      if (typedCall.name === "search_notes") {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                results: [
                  {
                    title: "Test Note",
                    permalink: "notes/test-note",
                    content: "Test content snippet",
                    score: 0.85,
                  },
                  {
                    title: "Feature Note",
                    permalink: "features/test-feature",
                    content: "Feature content",
                    score: 0.75,
                  },
                ],
                total: 2,
                page: 1,
                page_size: 10,
              }),
            },
          ],
        });
      }

      if (typedCall.name === "read_note") {
        callCount++;
        const permalink = typedCall.arguments.identifier as string;
        const content =
          permalink === "notes/test-note"
            ? "# Test Note\n\nThis is the full content of the test note with more details."
            : "# Feature Note\n\nThis is the full content of the feature note.";
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        });
      }

      return Promise.resolve({ content: [] });
    };
  };

  beforeEach(() => {
    service = new SearchService();
    service.clearFullContentCache();
    callCount = 0;

    // Configure mock to handle both search_notes and read_note calls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCallTool.mockImplementation(createFullContentMock() as any);
  });

  afterEach(() => {
    mockCallTool.mockClear();
  });

  test("fullContent=false returns snippets without fullContent field", async () => {
    const response = await service.search("test", { mode: "keyword", fullContent: false });

    expect(response.results.length).toBeGreaterThan(0);
    for (const result of response.results) {
      expect(result.fullContent).toBeUndefined();
      expect(result.snippet).toBeDefined();
    }
  });

  test("fullContent defaults to false", async () => {
    const response = await service.search("test", { mode: "keyword" });

    expect(response.results.length).toBeGreaterThan(0);
    for (const result of response.results) {
      expect(result.fullContent).toBeUndefined();
    }
  });

  test("fullContent=true fetches and includes full note content", async () => {
    const response = await service.search("test", { mode: "keyword", fullContent: true });

    expect(response.results.length).toBeGreaterThan(0);

    // Check that fullContent is populated
    const resultWithContent = response.results.find(r => r.permalink === "notes/test-note");
    expect(resultWithContent).toBeDefined();
    expect(resultWithContent!.fullContent).toContain("# Test Note");
    expect(resultWithContent!.fullContent).toContain("full content");
  });

  test("fullContent caches results per permalink", async () => {
    // First search with fullContent
    await service.search("test", { mode: "keyword", fullContent: true });
    const firstCallCount = callCount;

    // Second search with same permalinks - should use cache
    await service.search("test", { mode: "keyword", fullContent: true });
    const secondCallCount = callCount;

    // Call count should not increase (cache hit)
    expect(secondCallCount).toBe(firstCallCount);
  });

  test("clearFullContentCache clears cached content", async () => {
    // First search with fullContent
    await service.search("test", { mode: "keyword", fullContent: true });
    const firstCallCount = callCount;

    // Clear cache
    service.clearFullContentCache();

    // Second search should fetch again
    await service.search("test", { mode: "keyword", fullContent: true });
    const secondCallCount = callCount;

    // Call count should double (cache was cleared)
    expect(secondCallCount).toBe(firstCallCount * 2);
  });

  test("fullContent enforces character limit", async () => {
    const longContent = "x".repeat(6000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCallTool.mockImplementation(((call: unknown) => {
      const typedCall = call as { name: string; arguments: Record<string, unknown> };
      if (typedCall.name === "search_notes") {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                results: [
                  {
                    title: "Long Note",
                    permalink: "notes/long-note",
                    content: "Short snippet",
                    score: 0.9,
                  },
                ],
                total: 1,
                page: 1,
                page_size: 10,
              }),
            },
          ],
        });
      }

      if (typedCall.name === "read_note") {
        return Promise.resolve({
          content: [{ type: "text", text: longContent }],
        });
      }

      return Promise.resolve({ content: [] });
    }) as any);

    const svc = new SearchService();
    const response = await svc.search("test", { mode: "keyword", fullContent: true });

    expect(response.results.length).toBe(1);
    const result = response.results[0];
    expect(result.fullContent).toBeDefined();
    // Content should be truncated to 5000 chars
    expect(result.fullContent!.length).toBe(5000);
  });

  test("fullContent handles read errors gracefully", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockCallTool.mockImplementation(((call: unknown) => {
      const typedCall = call as { name: string };
      if (typedCall.name === "search_notes") {
        return Promise.resolve({
          content: [
            {
              type: "text",
              text: JSON.stringify({
                results: [
                  {
                    title: "Error Note",
                    permalink: "notes/error-note",
                    content: "Snippet",
                    score: 0.9,
                  },
                ],
                total: 1,
                page: 1,
                page_size: 10,
              }),
            },
          ],
        });
      }

      if (typedCall.name === "read_note") {
        return Promise.reject(new Error("Read failed"));
      }

      return Promise.resolve({ content: [] });
    }) as any);

    const svc = new SearchService();
    const response = await svc.search("test", { mode: "keyword", fullContent: true });

    expect(response.results.length).toBe(1);
    // Should not throw - gracefully handles error
    expect(response.results[0].fullContent).toBeUndefined();
  });

  test("fullContent works with project parameter", async () => {
    const projectName = "my-project";

    const svc = new SearchService();
    const response = await svc.search("test", {
      mode: "keyword",
      fullContent: true,
      project: projectName,
    });

    expect(response.results.length).toBeGreaterThan(0);
    // Verify read_note was called with project
    const readNoteCalls = (mockCallTool.mock.calls as unknown[][]).filter(
      (c: unknown[]) => {
        const arg = c[0] as { name: string } | undefined;
        return arg?.name === "read_note";
      }
    );
    expect(readNoteCalls.length).toBeGreaterThan(0);
    for (const call of readNoteCalls) {
      const arg = call[0] as { arguments: Record<string, unknown> };
      expect(arg.arguments.project).toBe(projectName);
    }
  });
});
