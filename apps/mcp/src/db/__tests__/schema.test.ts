import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createEmbeddingsTable } from "../schema";

// Note: These tests require sqlite-vec native extension.
// - With Bun: Tests are excluded (vitest.config.ts)
// - With Node.js: Run via `bun run test:integration` (vitest.integration.config.ts)

describe("brain_embeddings schema", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
  });

  afterEach(() => {
    db.close();
  });

  test("creates brain_embeddings virtual table", () => {
    createEmbeddingsTable(db);

    const result = db
      .query("SELECT name FROM sqlite_master WHERE type='table' AND name='brain_embeddings'")
      .get() as { name: string } | undefined;

    expect(result?.name).toBe("brain_embeddings");
  });

  test("can insert and query embeddings", () => {
    createEmbeddingsTable(db);

    // Create a test embedding (768 dimensions)
    const embedding = new Float32Array(768).fill(0.1);

    // Insert using the new schema with chunk_id as primary key
    db.run(
      `INSERT INTO brain_embeddings (
        chunk_id, embedding, entity_id, chunk_index,
        chunk_start, chunk_end, total_chunks, chunk_text
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["test-entity-1#chunk-0", embedding, "test-entity-1", 0, 0, 100, 1, "Test content"],
    );

    // Query
    const result = db
      .query("SELECT entity_id FROM brain_embeddings WHERE entity_id = ?")
      .get("test-entity-1") as { entity_id: string };

    expect(result?.entity_id).toBe("test-entity-1");
  });
});
