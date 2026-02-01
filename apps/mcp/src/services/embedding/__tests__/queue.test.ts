/**
 * Unit tests for embedding queue functions.
 * Tests queue CRUD operations and retry logic.
 */

import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import * as connectionModule from "../../../db/connection";
import {
  createEmbeddingQueueTable,
  dequeueEmbedding,
  enqueueEmbedding,
  getQueueLength,
  incrementAttempts,
  markEmbeddingProcessed,
} from "../queue";

describe("embedding queue", () => {
  let db: Database;
  let createVectorConnectionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create fresh in-memory database for each test
    db = new Database(":memory:");
    sqliteVec.load(db);

    // Spy on createVectorConnection to return our test database
    // Return a wrapper that prevents actual close() to keep db available for assertions
    createVectorConnectionSpy = vi
      .spyOn(connectionModule, "createVectorConnection")
      .mockImplementation(() => {
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
  });

  afterEach(() => {
    createVectorConnectionSpy.mockRestore();
    db.close();
  });

  describe("createEmbeddingQueueTable", () => {
    test("creates table if not exists", () => {
      createEmbeddingQueueTable();

      // Verify table exists by querying sqlite_master
      const result = db
        .query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='embedding_queue'",
        )
        .get();
      expect(result).not.toBeNull();
    });

    test("does not error when table already exists", () => {
      createEmbeddingQueueTable();
      expect(() => createEmbeddingQueueTable()).not.toThrow();
    });

    test("creates table with correct columns", () => {
      createEmbeddingQueueTable();

      // Verify column structure
      const columns = db
        .query("PRAGMA table_info(embedding_queue)")
        .all() as Array<{ name: string; type: string; notnull: number }>;

      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("note_id");
      expect(columnNames).toContain("created_at");
      expect(columnNames).toContain("attempts");
      expect(columnNames).toContain("last_error");
    });
  });

  describe("enqueueEmbedding", () => {
    beforeEach(() => {
      createEmbeddingQueueTable();
    });

    test("adds item to queue", () => {
      enqueueEmbedding("note-1");

      const result = db
        .query("SELECT note_id FROM embedding_queue WHERE note_id = ?")
        .get("note-1") as { note_id: string } | null;
      expect(result?.note_id).toBe("note-1");
    });

    test("updates existing item on conflict", () => {
      enqueueEmbedding("note-1");

      // Increment attempts manually to verify reset
      db.run("UPDATE embedding_queue SET attempts = 5 WHERE note_id = ?", [
        "note-1",
      ]);

      // Re-enqueue should reset attempts
      enqueueEmbedding("note-1");

      const result = db
        .query("SELECT attempts FROM embedding_queue WHERE note_id = ?")
        .get("note-1") as { attempts: number } | null;
      expect(result?.attempts).toBe(0);
    });

    test("maintains unique constraint on note_id", () => {
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-1");

      const count = db
        .query(
          "SELECT COUNT(*) as count FROM embedding_queue WHERE note_id = ?",
        )
        .get("note-1") as { count: number };
      expect(count.count).toBe(1);
    });

    test("sets default values correctly", () => {
      enqueueEmbedding("note-1");

      const result = db
        .query(
          "SELECT attempts, last_error FROM embedding_queue WHERE note_id = ?",
        )
        .get("note-1") as { attempts: number; last_error: string | null };
      expect(result.attempts).toBe(0);
      expect(result.last_error).toBeNull();
    });
  });

  describe("dequeueEmbedding", () => {
    beforeEach(() => {
      createEmbeddingQueueTable();
    });

    test("returns oldest item", () => {
      // Add items with explicit timestamps to control order
      db.run(
        "INSERT INTO embedding_queue (note_id, created_at) VALUES (?, ?)",
        ["note-2", "2024-01-02T00:00:00Z"],
      );
      db.run(
        "INSERT INTO embedding_queue (note_id, created_at) VALUES (?, ?)",
        ["note-1", "2024-01-01T00:00:00Z"],
      );
      db.run(
        "INSERT INTO embedding_queue (note_id, created_at) VALUES (?, ?)",
        ["note-3", "2024-01-03T00:00:00Z"],
      );

      const result = dequeueEmbedding();
      expect(result?.noteId).toBe("note-1");
    });

    test("returns null when queue is empty", () => {
      const result = dequeueEmbedding();
      expect(result).toBeNull();
    });

    test("returns correct QueueItem structure", () => {
      enqueueEmbedding("note-1");

      // Get the id for incrementAttempts
      const item = db
        .query("SELECT id FROM embedding_queue WHERE note_id = ?")
        .get("note-1") as { id: number };
      db.run(
        "UPDATE embedding_queue SET attempts = 1, last_error = ? WHERE id = ?",
        ["some error", item.id],
      );

      const result = dequeueEmbedding();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("noteId");
      expect(result).toHaveProperty("createdAt");
      expect(result).toHaveProperty("attempts");
      expect(result).toHaveProperty("lastError");
      expect(result?.noteId).toBe("note-1");
      expect(result?.attempts).toBe(1);
      expect(result?.lastError).toBe("some error");
    });

    test("does not remove item from queue", () => {
      enqueueEmbedding("note-1");

      dequeueEmbedding();

      const count = db
        .query("SELECT COUNT(*) as count FROM embedding_queue")
        .get() as { count: number };
      expect(count.count).toBe(1);
    });
  });

  describe("markEmbeddingProcessed", () => {
    beforeEach(() => {
      createEmbeddingQueueTable();
    });

    test("removes item from queue", () => {
      enqueueEmbedding("note-1");
      const item = dequeueEmbedding();
      expect(item).not.toBeNull();

      markEmbeddingProcessed(item?.id);

      const result = db
        .query("SELECT * FROM embedding_queue WHERE id = ?")
        .get(item?.id);
      expect(result).toBeNull();
    });

    test("does not error for non-existent id", () => {
      expect(() => markEmbeddingProcessed(999)).not.toThrow();
    });

    test("only removes specified item", () => {
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-2");

      const item = dequeueEmbedding();
      markEmbeddingProcessed(item?.id);

      const count = db
        .query("SELECT COUNT(*) as count FROM embedding_queue")
        .get() as { count: number };
      expect(count.count).toBe(1);
    });
  });

  describe("incrementAttempts", () => {
    beforeEach(() => {
      createEmbeddingQueueTable();
    });

    test("increments attempt count", () => {
      enqueueEmbedding("note-1");
      const item = dequeueEmbedding();

      incrementAttempts(item?.id);
      incrementAttempts(item?.id);

      const result = db
        .query("SELECT attempts FROM embedding_queue WHERE id = ?")
        .get(item?.id) as { attempts: number } | null;
      expect(result?.attempts).toBe(2);
    });

    test("records error message", () => {
      enqueueEmbedding("note-1");
      const item = dequeueEmbedding();

      incrementAttempts(item?.id, "Connection refused");

      const result = db
        .query("SELECT last_error FROM embedding_queue WHERE id = ?")
        .get(item?.id) as { last_error: string | null } | null;
      expect(result?.last_error).toBe("Connection refused");
    });

    test("updates error message on subsequent attempts", () => {
      enqueueEmbedding("note-1");
      const item = dequeueEmbedding();

      incrementAttempts(item?.id, "First error");
      incrementAttempts(item?.id, "Second error");

      const result = db
        .query("SELECT last_error FROM embedding_queue WHERE id = ?")
        .get(item?.id) as { last_error: string | null } | null;
      expect(result?.last_error).toBe("Second error");
    });

    test("sets null error when not provided", () => {
      enqueueEmbedding("note-1");
      const item = dequeueEmbedding();

      incrementAttempts(item?.id, "Some error");
      incrementAttempts(item?.id); // No error

      const result = db
        .query("SELECT last_error FROM embedding_queue WHERE id = ?")
        .get(item?.id) as { last_error: string | null } | null;
      expect(result?.last_error).toBeNull();
    });

    test("does not error for non-existent id", () => {
      expect(() => incrementAttempts(999, "error")).not.toThrow();
    });
  });

  describe("getQueueLength", () => {
    beforeEach(() => {
      createEmbeddingQueueTable();
    });

    test("returns 0 for empty queue", () => {
      const length = getQueueLength();
      expect(length).toBe(0);
    });

    test("returns correct count", () => {
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-2");
      enqueueEmbedding("note-3");

      const length = getQueueLength();
      expect(length).toBe(3);
    });

    test("reflects changes after processing", () => {
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-2");
      expect(getQueueLength()).toBe(2);

      const item = dequeueEmbedding();
      markEmbeddingProcessed(item?.id);

      expect(getQueueLength()).toBe(1);
    });

    test("does not count duplicate enqueues", () => {
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-1");
      enqueueEmbedding("note-1");

      const length = getQueueLength();
      expect(length).toBe(1);
    });
  });
});
