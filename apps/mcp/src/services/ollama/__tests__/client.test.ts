/**
 * Unit tests for OllamaClient.
 * Tests configuration, error handling, and API interactions.
 */

import { describe, test, expect, mock, afterEach } from "bun:test";
import { OllamaClient } from "../client";
import { OllamaError } from "../types";

// Helper to create a typed mock for fetch
const createFetchMock = (impl: () => unknown) => {
  const mockFn = mock(impl);
  return mockFn as unknown as typeof fetch;
};

describe("OllamaClient", () => {
  describe("constructor", () => {
    test("uses default config when none provided", () => {
      const client = new OllamaClient();
      // Access private fields via type assertion for testing
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe(
        "http://localhost:11434"
      );
      expect((client as unknown as { timeout: number }).timeout).toBe(30000);
    });

    test("uses custom config when provided", () => {
      const client = new OllamaClient({
        baseUrl: "http://custom:9999",
        timeout: 5000,
      });
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe(
        "http://custom:9999"
      );
      expect((client as unknown as { timeout: number }).timeout).toBe(5000);
    });

    test("applies partial config with defaults for missing values", () => {
      const client = new OllamaClient({ baseUrl: "http://partial:8080" });
      expect((client as unknown as { baseUrl: string }).baseUrl).toBe(
        "http://partial:8080"
      );
      expect((client as unknown as { timeout: number }).timeout).toBe(30000);
    });
  });

  describe("healthCheck", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("returns false on connection error", async () => {
      globalThis.fetch = createFetchMock(() => {
        throw new Error("Connection refused");
      });

      const client = new OllamaClient();
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    test("returns false on non-OK response", async () => {
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({ ok: false, status: 500 } as Response)
      );

      const client = new OllamaClient();
      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    test("returns true on OK response", async () => {
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({ ok: true, status: 200 } as Response)
      );

      const client = new OllamaClient();
      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    test("calls correct endpoint", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({ ok: true, status: 200 } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = new OllamaClient({ baseUrl: "http://test:1234" });
      await client.healthCheck();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      expect(callArgs[0]).toBe("http://test:1234/api/tags");
    });
  });

  describe("generateEmbedding", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    test("returns embedding array on success", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: mockEmbedding }),
        } as Response)
      );

      const client = new OllamaClient();
      const result = await client.generateEmbedding("test text");
      expect(result).toEqual(mockEmbedding);
    });

    test("throws OllamaError on non-OK response", async () => {
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({
          ok: false,
          status: 503,
        } as Response)
      );

      const client = new OllamaClient();
      await expect(client.generateEmbedding("test")).rejects.toThrow(
        OllamaError
      );
    });

    test("OllamaError contains status code", async () => {
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({
          ok: false,
          status: 404,
        } as Response)
      );

      const client = new OllamaClient();
      try {
        await client.generateEmbedding("test");
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(OllamaError);
        expect((error as OllamaError).statusCode).toBe(404);
        expect((error as OllamaError).message).toBe("Ollama API error: 404");
      }
    });

    test("sends correct request body with default model", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: [0.1] }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = new OllamaClient();
      await client.generateEmbedding("my text");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      expect(callArgs[0]).toBe("http://localhost:11434/api/embeddings");
      expect(callArgs[1].method).toBe("POST");
      expect(callArgs[1].headers).toEqual({
        "Content-Type": "application/json",
      });
      expect(JSON.parse(callArgs[1].body as string)).toEqual({
        model: "nomic-embed-text",
        prompt: "my text",
      });
    });

    test("sends correct request body with custom model", async () => {
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: [0.1] }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const client = new OllamaClient();
      await client.generateEmbedding("my text", "mxbai-embed-large");

      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      expect(JSON.parse(callArgs[1].body as string)).toEqual({
        model: "mxbai-embed-large",
        prompt: "my text",
      });
    });
  });
});

describe("OllamaError", () => {
  test("has correct name property", () => {
    const error = new OllamaError("test error", 500);
    expect(error.name).toBe("OllamaError");
  });

  test("has correct message property", () => {
    const error = new OllamaError("test error message", 500);
    expect(error.message).toBe("test error message");
  });

  test("has correct statusCode property", () => {
    const error = new OllamaError("test", 418);
    expect(error.statusCode).toBe(418);
  });

  test("is instanceof Error", () => {
    const error = new OllamaError("test", 500);
    expect(error).toBeInstanceOf(Error);
  });
});
