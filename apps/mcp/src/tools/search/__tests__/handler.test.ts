import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createEmbeddingsTable } from "../../../db/schema";
import { type ChunkEmbeddingInput, storeChunkedEmbeddings } from "../../../db/vectors";

// Note: These tests require sqlite-vec native extension.
// - With Bun: Tests are excluded (vitest.config.ts)
// - With Node.js: Run via `bun run test:integration` (vitest.integration.config.ts)

/**
 * Create an embedding with variation for more realistic cosine distance calculations.
 * Constant embeddings (fill(x)) cause numerical precision issues.
 */
function createEmbedding(baseValue: number): Float32Array {
  const arr = new Float32Array(768);
  for (let i = 0; i < 768; i++) {
    arr[i] = baseValue + (i % 10) * 0.01;
  }
  return arr;
}

describe("search handler integration", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
    createEmbeddingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  test("checkEmbeddingsExist returns false when table is empty", () => {
    const count = db.query("SELECT COUNT(*) as c FROM brain_embeddings").get() as { c: number };
    expect(count.c).toBe(0);
  });

  test("checkEmbeddingsExist returns true after storing embedding", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Test content",
        embedding: new Float32Array(768).fill(0.1),
      },
    ];
    storeChunkedEmbeddings(db, "test-entity", chunks);

    const count = db.query("SELECT COUNT(*) as c FROM brain_embeddings").get() as { c: number };
    expect(count.c).toBe(1);
  });

  test("vector search returns results when embeddings exist", () => {
    // Store a test embedding
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Test content",
        embedding: new Float32Array(768).fill(0.5),
      },
    ];
    storeChunkedEmbeddings(db, "test-entity", chunks);

    // Query with same embedding should return high similarity
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const results = db
      .query(`
      SELECT entity_id, vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      ORDER BY distance
      LIMIT 10
    `)
      .all(queryEmbedding) as Array<{ entity_id: string; distance: number }>;

    expect(results.length).toBe(1);
    expect(results[0].entity_id).toBe("test-entity");
    expect(results[0].distance).toBeLessThan(0.01); // Very similar
  });

  test("vector search returns empty when no embeddings", () => {
    const queryEmbedding = new Float32Array(768).fill(0.5);

    const results = db
      .query(`
      SELECT entity_id, vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      ORDER BY distance
      LIMIT 10
    `)
      .all(queryEmbedding) as Array<{ entity_id: string; distance: number }>;

    expect(results.length).toBe(0);
  });

  test("vector search deduplicates by entity when multiple chunks match", () => {
    // Store multiple chunks for same entity with varied embeddings
    // (constant embeddings cause numerical precision issues in cosine distance)
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 2,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "First chunk",
        embedding: createEmbedding(0.1), // Very different from query
      },
      {
        chunkIndex: 1,
        totalChunks: 2,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Second chunk",
        embedding: createEmbedding(0.5), // Same as query
      },
    ];
    storeChunkedEmbeddings(db, "test-entity", chunks);

    // Query returns both chunks
    const queryEmbedding = createEmbedding(0.5);
    const results = db
      .query(`
      SELECT entity_id, chunk_index, vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      ORDER BY distance
      LIMIT 10
    `)
      .all(queryEmbedding) as Array<{
      entity_id: string;
      chunk_index: number;
      distance: number;
    }>;

    // Both chunks should be returned
    expect(results.length).toBe(2);
    // Both belong to same entity
    expect(results[0].entity_id).toBe("test-entity");
    expect(results[1].entity_id).toBe("test-entity");
    // First result should be chunk 1 (better match)
    expect(results[0].chunk_index).toBe(1);
  });
});
