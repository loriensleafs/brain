/**
 * Unit tests for generateEmbedding function.
 * Tests empty input handling, truncation, and Ollama integration.
 */

import { describe, test, expect, mock, afterEach } from "bun:test";
import { generateEmbedding } from "../generateEmbedding";
import { OllamaError } from "../../ollama/types";

describe("generateEmbedding", () => {
  const originalFetch = globalThis.fetch;

  // Helper to create mock fetch response
  const mockFetchSuccess = (embedding: number[]) => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embedding }),
      } as Response)
    ) as unknown as typeof fetch;
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: mockEmbedding }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding("test text");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.model).toBe("nomic-embed-text");
    });
  });

  describe("text truncation", () => {
    test("truncates text exceeding MAX_TEXT_LENGTH (32000 chars)", async () => {
      // Create text longer than 32000 characters
      const longText = "a".repeat(35000);
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: [0.1] }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding(longText);

      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.prompt.length).toBe(32000);
    });

    test("does not truncate text under MAX_TEXT_LENGTH", async () => {
      const shortText = "a".repeat(1000);
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: [0.1] }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding(shortText);

      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.prompt.length).toBe(1000);
    });

    test("handles text exactly at MAX_TEXT_LENGTH", async () => {
      const exactText = "a".repeat(32000);
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: [0.1] }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      await generateEmbedding(exactText);

      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.prompt.length).toBe(32000);
    });
  });

  describe("error propagation", () => {
    test("propagates OllamaError on API failure", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)
      ) as unknown as typeof fetch;

      expect(generateEmbedding("test")).rejects.toThrow(OllamaError);
    });

    test("propagates OllamaError with status code on 404", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response)
      ) as unknown as typeof fetch;

      try {
        await generateEmbedding("test");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(OllamaError);
        expect((error as OllamaError).statusCode).toBe(404);
      }
    });

    test("propagates network errors", async () => {
      globalThis.fetch = mock(() => {
        throw new Error("Network error");
      }) as unknown as typeof fetch;

      expect(generateEmbedding("test")).rejects.toThrow("Network error");
    });
  });
});
