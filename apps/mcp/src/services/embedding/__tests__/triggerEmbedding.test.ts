/**
 * Unit tests for triggerEmbedding function.
 * Tests fire-and-forget behavior, success storage, and error handling.
 */

import { describe, test, expect, mock, afterEach, beforeEach, spyOn } from "bun:test";
import { triggerEmbedding } from "../triggerEmbedding";
import * as vectorsModule from "../../../db/vectors";
import * as connectionModule from "../../../db/connection";
import { logger } from "../../../utils/internal/logger";

describe("triggerEmbedding", () => {
  const originalFetch = globalThis.fetch;
  let mockDb: { close: ReturnType<typeof mock> };
  let storeEmbeddingSpy: ReturnType<typeof spyOn>;
  let createVectorConnectionSpy: ReturnType<typeof spyOn>;
  let loggerDebugSpy: ReturnType<typeof spyOn>;
  let loggerWarnSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Create mock database
    mockDb = { close: mock(() => {}) };

    // Spy on storeEmbedding
    storeEmbeddingSpy = spyOn(vectorsModule, "storeEmbedding").mockReturnValue(true);

    // Spy on createVectorConnection
    createVectorConnectionSpy = spyOn(connectionModule, "createVectorConnection").mockReturnValue(mockDb as any);

    // Spy on logger methods
    loggerDebugSpy = spyOn(logger, "debug").mockImplementation(() => {});
    loggerWarnSpy = spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    storeEmbeddingSpy.mockRestore();
    createVectorConnectionSpy.mockRestore();
    loggerDebugSpy.mockRestore();
    loggerWarnSpy.mockRestore();
  });

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

  // Helper to wait for async operations
  const waitForAsync = () => new Promise((resolve) => setTimeout(resolve, 50));

  describe("successful embedding", () => {
    test("calls generateEmbedding with content", async () => {
      const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
      mockFetchSuccess(mockEmbedding);

      triggerEmbedding("note-123", "Test content");
      await waitForAsync();

      // Verify fetch was called (generateEmbedding uses fetch internally)
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    test("calls storeEmbedding on success", async () => {
      const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
      mockFetchSuccess(mockEmbedding);

      triggerEmbedding("note-123", "Test content");
      await waitForAsync();

      expect(storeEmbeddingSpy).toHaveBeenCalledWith(
        mockDb,
        "note-123",
        mockEmbedding
      );
    });

    test("logs debug message on success", async () => {
      const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
      mockFetchSuccess(mockEmbedding);

      triggerEmbedding("note-123", "Test content");
      await waitForAsync();

      expect(loggerDebugSpy).toHaveBeenCalledWith("Embedding stored for note: note-123");
    });

    test("closes database connection after storing", async () => {
      const mockEmbedding = Array.from({ length: 768 }, () => 0.5);
      mockFetchSuccess(mockEmbedding);

      triggerEmbedding("note-123", "Test content");
      await waitForAsync();

      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  describe("fire-and-forget behavior", () => {
    test("does not throw on failure", () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Network error"))
      ) as unknown as typeof fetch;

      // Should not throw - fire and forget
      expect(() => triggerEmbedding("note-123", "Test content")).not.toThrow();
    });

    test("logs warning on failure", async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("Connection refused"))
      ) as unknown as typeof fetch;

      triggerEmbedding("note-123", "Test content");
      await waitForAsync();

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        "Embedding failed for note note-123: Connection refused"
      );
    });

    test("does not call storeEmbedding when generateEmbedding fails", async () => {
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("API error"))
      ) as unknown as typeof fetch;

      triggerEmbedding("note-123", "Test content");
      await waitForAsync();

      expect(storeEmbeddingSpy).not.toHaveBeenCalled();
    });
  });

  describe("empty content handling", () => {
    test("does not store embedding for empty content", async () => {
      // generateEmbedding returns null for empty content
      triggerEmbedding("note-123", "");
      await waitForAsync();

      expect(storeEmbeddingSpy).not.toHaveBeenCalled();
    });

    test("does not store embedding for whitespace-only content", async () => {
      triggerEmbedding("note-123", "   \n\t  ");
      await waitForAsync();

      expect(storeEmbeddingSpy).not.toHaveBeenCalled();
    });
  });
});
