/**
 * Unit tests for generateEmbedding function.
 * Tests empty input handling, truncation, retry logic, and Ollama integration.
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { OllamaError } from "../../ollama/types";
import { generateEmbedding, resetOllamaClient } from "../generateEmbedding";

describe("generateEmbedding", () => {
  const originalFetch = globalThis.fetch;

  // Helper to create mock fetch response
  // Uses embeddings array format (batch API endpoint)
  const mockFetchSuccess = (embedding: number[]) => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embeddings: [embedding] }),
      } as Response),
    ) as unknown as typeof fetch;
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
    test("returns null for empty string", async () => {
      const result = await generateEmbedding("");
      expect(result).toBeNull();
    });

    test("returns null for whitespace-only string", async () => {
      const result = await generateEmbedding("   \t\n  ");
      expect(result).toBeNull();
    });

    test("returns null for undefined-like empty input", async () => {
      // Edge case: string that becomes empty after trim check
      const result = await generateEmbedding("     ");
      expect(result).toBeNull();
    });
  });

  describe("successful embedding generation", () => {
    test("returns 768-dimension array for valid text", async () => {
      // Create a mock 768-dimension embedding
      const mockEmbedding = Array.from({ length: 768 }, (_, i) => i * 0.001);
      mockFetchSuccess(mockEmbedding);

      const result = await generateEmbedding("Hello world");
      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(768);
    });

    test("returns embedding for single word", async () => {
      const mockEmbedding = Array.from({ length: 768 }, () => Math.random());
      mockFetchSuccess(mockEmbedding);

      const result = await generateEmbedding("test");
      expect(result).not.toBeNull();
      expect(result).toHaveLength(768);
    });
  });

  describe("model selection", () => {
    test("passes nomic-embed-text model to OllamaClient", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embeddings: [mockEmbedding] }),
        } as Response),
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding("test text");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.model).toBe("nomic-embed-text");
    });
  });

  describe("text passthrough (no truncation)", () => {
    // Note: Truncation/chunking is handled by the caller (embed tool uses chunking.ts).
    // This service expects pre-chunked text within model token limits.

    test("passes long text directly to Ollama without truncation", async () => {
      // Create text longer than typical chunk size
      const longText = "a".repeat(35000);
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embeddings: [[0.1]] }),
        } as Response),
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding(longText);

      const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);
      // Text is passed through without truncation - caller is responsible for chunking
      // Batch API uses input array, text is prefixed with task type
      expect(body.input[0]).toContain(longText);
    });

    test("passes short text directly to Ollama", async () => {
      const shortText = "a".repeat(1000);
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embeddings: [[0.1]] }),
        } as Response),
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding(shortText);

      const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.input[0]).toContain(shortText);
    });

    test("handles arbitrary length text", async () => {
      const exactText = "a".repeat(32000);
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embeddings: [[0.1]] }),
        } as Response),
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding(exactText);

      const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.input[0]).toContain(exactText);
    });
  });

  describe("error propagation", () => {
    test("retries on 5xx errors and eventually throws after max retries", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      }) as unknown as typeof fetch;

      // Await the rejection and verify error
      await expect(generateEmbedding("test")).rejects.toThrow(OllamaError);
      // Should have retried 3 times (MAX_RETRIES = 3)
      expect(callCount).toBe(3);
    }, 15000); // Increase timeout for retry delays

    test("succeeds after transient 5xx error", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      let callCount = 0;
      globalThis.fetch = vi.fn(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embeddings: [mockEmbedding] }),
        } as Response);
      }) as unknown as typeof fetch;

      const result = await generateEmbedding("test");
      expect(result).toEqual(mockEmbedding);
      // First fails with 500, second succeeds
      expect(callCount).toBe(2);
    }, 10000);

    test("does not retry on 4xx client errors", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 404,
        } as Response);
      }) as unknown as typeof fetch;

      try {
        await generateEmbedding("test");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(OllamaError);
        expect((error as OllamaError).statusCode).toBe(404);
        expect(callCount).toBe(1); // No retry on 4xx
      }
    });

    test("propagates network errors without retry", async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn(() => {
        callCount++;
        throw new Error("Network error");
      }) as unknown as typeof fetch;

      await expect(generateEmbedding("test")).rejects.toThrow("Network error");
      expect(callCount).toBe(1); // Network errors are not OllamaError, not retried
    });
  });

  describe("client reuse", () => {
    test("reuses the same client for multiple calls", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      mockFetchSuccess(mockEmbedding);

      await generateEmbedding("test1");
      await generateEmbedding("test2");

      // Both calls should use the same URL pattern (same client)
      const mockFn = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });
});
