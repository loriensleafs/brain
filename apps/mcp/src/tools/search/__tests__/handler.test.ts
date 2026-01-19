import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { createEmbeddingsTable } from "../../../db/schema";
import { storeEmbedding } from "../../../db/vectors";

// Note: Custom SQLite is configured in test preload (src/__tests__/setup.ts)

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
    const embedding = new Float32Array(768).fill(0.1);
    storeEmbedding(db, "test-entity", embedding);

    const count = db.query("SELECT COUNT(*) as c FROM brain_embeddings").get() as { c: number };
    expect(count.c).toBe(1);
  });

  test("vector search returns results when embeddings exist", () => {
    // Store a test embedding
    const embedding = new Float32Array(768).fill(0.5);
    storeEmbedding(db, "test-entity", embedding);

    // Query with same embedding should return high similarity
    const results = db.query(`
      SELECT entity_id, vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      ORDER BY distance
      LIMIT 10
    `).all(embedding) as Array<{ entity_id: string; distance: number }>;

    expect(results.length).toBe(1);
    expect(results[0].entity_id).toBe("test-entity");
    expect(results[0].distance).toBeLessThan(0.01); // Very similar
  });

  test("vector search returns empty when no embeddings", () => {
    const queryEmbedding = new Float32Array(768).fill(0.5);

    const results = db.query(`
      SELECT entity_id, vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      ORDER BY distance
      LIMIT 10
    `).all(queryEmbedding) as Array<{ entity_id: string; distance: number }>;

    expect(results.length).toBe(0);
  });
});
