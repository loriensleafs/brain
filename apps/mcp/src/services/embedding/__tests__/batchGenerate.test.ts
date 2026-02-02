/**
 * Unit tests for batchGenerate function.
 * Tests batch processing, failure handling, and progress callbacks.
 *
 * Note: Since generateEmbedding now has retry logic with exponential backoff,
 * tests that simulate failures need to use 4xx errors (non-retryable) or
 * consistently fail all retry attempts for 5xx errors.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { batchGenerate } from "../batchGenerate";
import { resetOllamaClient } from "../generateEmbedding";

describe("batchGenerate", () => {
  const originalFetch = globalThis.fetch;

  // Helper to create mock fetch response (batch API format)
  const mockFetchSuccess = (embedding: number[]) => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embeddings: [embedding] }),
      } as Response),
    ) as unknown as typeof fetch;
  };

  // Helper to create mock fetch that fails on specific text indices (not call indices)
  // Uses 400 Bad Request (non-retryable) to ensure immediate failure
  const mockFetchWithFailures = (embedding: number[], failTextIndices: Set<number>) => {
    // Track which text index we're processing based on successful calls
    let textIndex = 0;
    globalThis.fetch = vi.fn(() => {
      const currentTextIndex = textIndex++;
      if (failTextIndices.has(currentTextIndex)) {
        return Promise.resolve({
          ok: false,
          status: 400, // Use 400 (client error) which is non-retryable
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embeddings: [embedding] }),
      } as Response);
    }) as unknown as typeof fetch;
  };

  beforeEach(() => {
    // Reset singleton client before each test to ensure clean state
    resetOllamaClient();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetOllamaClient();
  });

  describe("empty input handling", () => {
    test("returns empty result for empty array", async () => {
      const result = await batchGenerate([]);
      expect(result.embeddings).toEqual([]);
      expect(result.failed).toEqual([]);
    });
  });

  describe("single text handling", () => {
    test("returns one embedding for single text", async () => {
      const mockEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
      mockFetchSuccess(mockEmbedding);

      const result = await batchGenerate(["Hello world"]);

      expect(result.embeddings).toHaveLength(1);
      expect(result.embeddings[0]).toEqual(mockEmbedding);
      expect(result.failed).toEqual([]);
    });
  });

  describe("multiple texts handling", () => {
    test("returns multiple embeddings for multiple texts", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetchSuccess(mockEmbedding);

      const texts = ["text1", "text2", "text3"];
      const result = await batchGenerate(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toEqual(mockEmbedding);
      expect(result.embeddings[1]).toEqual(mockEmbedding);
      expect(result.embeddings[2]).toEqual(mockEmbedding);
      expect(result.failed).toEqual([]);
    });
  });

  describe("partial failure handling", () => {
    test("handles partial failures and tracks failed indices", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      // Fail on indices 1 and 3
      mockFetchWithFailures(mockEmbedding, new Set([1, 3]));

      const texts = ["text0", "text1", "text2", "text3", "text4"];
      const result = await batchGenerate(texts);

      expect(result.embeddings).toHaveLength(5);
      expect(result.embeddings[0]).toEqual(mockEmbedding);
      expect(result.embeddings[1]).toBeNull();
      expect(result.embeddings[2]).toEqual(mockEmbedding);
      expect(result.embeddings[3]).toBeNull();
      expect(result.embeddings[4]).toEqual(mockEmbedding);
      expect(result.failed).toEqual([1, 3]);
    });

    test("handles all failures", async () => {
      mockFetchWithFailures([0.1], new Set([0, 1, 2]));

      const texts = ["text0", "text1", "text2"];
      const result = await batchGenerate(texts);

      expect(result.embeddings).toEqual([null, null, null]);
      expect(result.failed).toEqual([0, 1, 2]);
    });
  });

  describe("batch size handling", () => {
    test("respects custom batch size", async () => {
      const mockEmbedding = [0.1];
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: mockEmbedding }),
        } as Response),
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const texts = ["t1", "t2", "t3", "t4", "t5"];
      await batchGenerate(texts, 2);

      // With batch size 2: batches are [t1,t2], [t3,t4], [t5]
      // Total 5 calls
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });

    test("handles batch size larger than input", async () => {
      const mockEmbedding = [0.1];
      mockFetchSuccess(mockEmbedding);

      const texts = ["t1", "t2"];
      const result = await batchGenerate(texts, 100);

      expect(result.embeddings).toHaveLength(2);
      expect(result.failed).toEqual([]);
    });

    test("handles batch size of 1", async () => {
      const mockEmbedding = [0.1];
      mockFetchSuccess(mockEmbedding);

      const texts = ["t1", "t2", "t3"];
      const result = await batchGenerate(texts, 1);

      expect(result.embeddings).toHaveLength(3);
      expect(result.failed).toEqual([]);
    });
  });

  describe("progress callback", () => {
    test("calls progress callback for each batch", async () => {
      const mockEmbedding = [0.1];
      mockFetchSuccess(mockEmbedding);

      const progressCalls: [number, number][] = [];
      const onProgress = (completed: number, total: number) => {
        progressCalls.push([completed, total]);
      };

      const texts = ["t1", "t2", "t3", "t4", "t5"];
      await batchGenerate(texts, 2, onProgress);

      // Batches: [0,2), [2,4), [4,5]
      // Expected progress: (2,5), (4,5), (5,5)
      expect(progressCalls).toEqual([
        [2, 5],
        [4, 5],
        [5, 5],
      ]);
    });

    test("calls progress callback once for single batch", async () => {
      const mockEmbedding = [0.1];
      mockFetchSuccess(mockEmbedding);

      const progressCalls: [number, number][] = [];
      const onProgress = (completed: number, total: number) => {
        progressCalls.push([completed, total]);
      };

      const texts = ["t1", "t2"];
      await batchGenerate(texts, 100, onProgress);

      expect(progressCalls).toEqual([[2, 2]]);
    });

    test("does not error when progress callback is undefined", async () => {
      const mockEmbedding = [0.1];
      mockFetchSuccess(mockEmbedding);

      const texts = ["t1", "t2"];
      const result = await batchGenerate(texts, 2, undefined);

      expect(result.embeddings).toHaveLength(2);
    });
  });

  describe("empty text handling", () => {
    test("returns null for empty strings in batch", async () => {
      const mockEmbedding = [0.1];
      mockFetchSuccess(mockEmbedding);

      const texts = ["valid", "", "also valid"];
      const result = await batchGenerate(texts);

      expect(result.embeddings).toHaveLength(3);
      expect(result.embeddings[0]).toEqual(mockEmbedding);
      expect(result.embeddings[1]).toBeNull(); // Empty string returns null
      expect(result.embeddings[2]).toEqual(mockEmbedding);
      expect(result.failed).toEqual([]); // Empty string is not a failure
    });
  });
});
