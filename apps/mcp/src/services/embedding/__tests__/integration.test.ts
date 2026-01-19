/**
 * Integration tests for embedding services.
 * Tests component interactions with mock Ollama responses.
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import * as connectionModule from "../../../db/connection";
import { generateEmbedding } from "../generateEmbedding";
import { batchGenerate } from "../batchGenerate";
import {
  createEmbeddingQueueTable,
  enqueueEmbedding,
  dequeueEmbedding,
  getQueueLength,
  markEmbeddingProcessed,
} from "../queue";

/** Mock 768-dim embedding for deterministic tests */
const MOCK_EMBEDDING = Array.from({ length: 768 }, (_, i) => i * 0.001);

/** Helper to create mock fetch */
const createFetchMock = (impl: () => unknown) =>
  mock(impl) as unknown as typeof fetch;

describe("Embedding Integration Tests", () => {
  const originalFetch = globalThis.fetch;
  let db: Database;
  let createVectorConnectionSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new Database(":memory:");
    sqliteVec.load(db);

    // Spy on createVectorConnection to return our test database
    createVectorConnectionSpy = spyOn(
      connectionModule,
      "createVectorConnection"
    ).mockImplementation(() => {
      return {
        run: (...args: Parameters<Database["run"]>) => db.run(...args),
        query: (...args: Parameters<Database["query"]>) => db.query(...args),
        prepare: (...args: Parameters<Database["prepare"]>) =>
          db.prepare(...args),
        close: () => {
          /* no-op for tests */
        },
      } as unknown as Database;
    });

    // Default: Ollama available with mock embedding
    globalThis.fetch = createFetchMock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ embedding: MOCK_EMBEDDING }),
      } as Response)
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    createVectorConnectionSpy.mockRestore();
    db.close();
  });

  describe("generateEmbedding integration", () => {
    test("returns 768-dimension array on success", async () => {
      const result = await generateEmbedding("test content");
      expect(result).toHaveLength(768);
      expect(result![0]).toBe(0);
      expect(result![767]).toBeCloseTo(0.767, 3);
    });

    test("returns null for empty content", async () => {
      const result = await generateEmbedding("");
      expect(result).toBeNull();
    });

    test("returns null for whitespace-only content", async () => {
      const result = await generateEmbedding("   \t\n  ");
      expect(result).toBeNull();
    });

    test("handles long text by truncating", async () => {
      const longText = "a".repeat(35000);
      const mockFetch = mock(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: MOCK_EMBEDDING }),
        } as Response)
      );
      globalThis.fetch = mockFetch as unknown as typeof fetch;

      const result = await generateEmbedding(longText);

      expect(result).toHaveLength(768);
      // Verify truncation occurred by checking the request body
      const callArgs = mockFetch.mock.calls[0] as unknown as [
        string,
        RequestInit
      ];
      const body = JSON.parse(callArgs[1].body as string);
      expect(body.prompt.length).toBe(32000);
    });
  });

  describe("batchGenerate integration", () => {
    test("processes multiple texts successfully", async () => {
      const texts = ["text1", "text2", "text3"];
      const result = await batchGenerate(texts, 2);

      expect(result.embeddings).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      result.embeddings.forEach((emb) => {
        expect(emb).toHaveLength(768);
      });
    });

    test("tracks failed indices on partial failure", async () => {
      let callCount = 0;
      globalThis.fetch = createFetchMock(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({ ok: false, status: 500 } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: MOCK_EMBEDDING }),
        } as Response);
      });

      const texts = ["text1", "text2", "text3"];
      const result = await batchGenerate(texts, 3);

      expect(result.failed).toContain(1);
      expect(result.embeddings[0]).toHaveLength(768);
      expect(result.embeddings[1]).toBeNull();
      expect(result.embeddings[2]).toHaveLength(768);
    });

    test("handles all failures gracefully", async () => {
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({ ok: false, status: 503 } as Response)
      );

      const texts = ["text1", "text2"];
      const result = await batchGenerate(texts, 10);

      expect(result.embeddings).toEqual([null, null]);
      expect(result.failed).toEqual([0, 1]);
    });

    test("reports progress correctly", async () => {
      const progressCalls: [number, number][] = [];
      const onProgress = (completed: number, total: number) => {
        progressCalls.push([completed, total]);
      };

      const texts = ["t1", "t2", "t3", "t4", "t5"];
      await batchGenerate(texts, 2, onProgress);

      // Batches: [0,2), [2,4), [4,5]
      expect(progressCalls).toEqual([
        [2, 5],
        [4, 5],
        [5, 5],
      ]);
    });
  });

  describe("queue integration", () => {
    test("enqueue and dequeue work correctly", () => {
      createEmbeddingQueueTable();

      enqueueEmbedding("note-1");
      enqueueEmbedding("note-2");

      expect(getQueueLength()).toBe(2);

      const item = dequeueEmbedding();
      expect(item?.noteId).toBe("note-1");
    });

    test("dequeue returns oldest item first (FIFO)", () => {
      createEmbeddingQueueTable();

      // Add items with explicit timestamps to control order
      db.run(
        "INSERT INTO embedding_queue (note_id, created_at) VALUES (?, ?)",
        ["note-2", "2024-01-02T00:00:00Z"]
      );
      db.run(
        "INSERT INTO embedding_queue (note_id, created_at) VALUES (?, ?)",
        ["note-1", "2024-01-01T00:00:00Z"]
      );

      const item = dequeueEmbedding();
      expect(item?.noteId).toBe("note-1");
    });

    test("re-enqueue resets attempts", () => {
      createEmbeddingQueueTable();

      enqueueEmbedding("note-1");

      // Manually increment attempts
      db.run("UPDATE embedding_queue SET attempts = 5 WHERE note_id = ?", [
        "note-1",
      ]);

      // Re-enqueue should reset
      enqueueEmbedding("note-1");

      const result = db
        .query("SELECT attempts FROM embedding_queue WHERE note_id = ?")
        .get("note-1") as { attempts: number };
      expect(result.attempts).toBe(0);
    });

    test("markEmbeddingProcessed removes item", () => {
      createEmbeddingQueueTable();

      enqueueEmbedding("note-1");
      const item = dequeueEmbedding();
      expect(item).not.toBeNull();

      markEmbeddingProcessed(item!.id);

      expect(getQueueLength()).toBe(0);
    });
  });

  describe("end-to-end flow", () => {
    test("full embedding pipeline works", async () => {
      // 1. Generate embedding
      const embedding = await generateEmbedding("Hello world");
      expect(embedding).toHaveLength(768);

      // 2. Batch generate
      const batchResult = await batchGenerate(["a", "b"], 10);
      expect(batchResult.embeddings).toHaveLength(2);
      expect(batchResult.failed).toHaveLength(0);

      // 3. Queue operations work
      createEmbeddingQueueTable();
      enqueueEmbedding("test-note");
      expect(getQueueLength()).toBe(1);

      const item = dequeueEmbedding();
      expect(item?.noteId).toBe("test-note");
    });

    test("mixed success and failure flow", async () => {
      // Set up partial failure scenario
      let callCount = 0;
      globalThis.fetch = createFetchMock(() => {
        callCount++;
        // First call succeeds, second fails, third succeeds
        if (callCount === 2) {
          return Promise.resolve({ ok: false, status: 503 } as Response);
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: MOCK_EMBEDDING }),
        } as Response);
      });

      // Batch with mixed results
      const result = await batchGenerate(["text1", "text2", "text3"], 5);

      expect(result.embeddings[0]).toHaveLength(768);
      expect(result.embeddings[1]).toBeNull();
      expect(result.embeddings[2]).toHaveLength(768);
      expect(result.failed).toEqual([1]);
    });

    test("queue can track failed embeddings", async () => {
      createEmbeddingQueueTable();

      // Simulate failure scenario
      globalThis.fetch = createFetchMock(() =>
        Promise.resolve({ ok: false, status: 503 } as Response)
      );

      // Queue notes that would fail
      enqueueEmbedding("failed-note-1");
      enqueueEmbedding("failed-note-2");

      expect(getQueueLength()).toBe(2);

      // Dequeue and process (would fail in real scenario)
      const item = dequeueEmbedding();
      expect(item?.noteId).toBe("failed-note-1");

      // Mark as processed to remove from queue
      markEmbeddingProcessed(item!.id);
      expect(getQueueLength()).toBe(1);
    });

    test("embedding dimensions are consistent", async () => {
      // Generate multiple embeddings and verify dimensions
      const texts = ["short", "a longer text with more words", "x".repeat(1000)];
      const result = await batchGenerate(texts, 10);

      result.embeddings.forEach((emb) => {
        expect(emb).not.toBeNull();
        expect(emb).toHaveLength(768);
        // Verify deterministic values from mock
        expect(emb![0]).toBe(0);
        expect(emb![767]).toBeCloseTo(0.767, 3);
      });
    });
  });

  describe("error handling integration", () => {
    test("network errors do not crash batch processing", async () => {
      let callCount = 0;
      globalThis.fetch = createFetchMock(() => {
        callCount++;
        if (callCount === 2) {
          throw new Error("Network error");
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ embedding: MOCK_EMBEDDING }),
        } as Response);
      });

      const texts = ["text1", "text2", "text3"];
      const result = await batchGenerate(texts, 5);

      // Second text should fail due to network error
      expect(result.embeddings[0]).toHaveLength(768);
      expect(result.embeddings[1]).toBeNull();
      expect(result.embeddings[2]).toHaveLength(768);
      expect(result.failed).toContain(1);
    });

    test("queue handles concurrent enqueues", () => {
      createEmbeddingQueueTable();

      // Enqueue same note multiple times
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-1");

      // Should only have one entry due to UNIQUE constraint
      expect(getQueueLength()).toBe(1);
    });
  });
});
