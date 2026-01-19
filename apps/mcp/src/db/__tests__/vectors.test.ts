import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { createEmbeddingsTable } from "../schema";
import { storeEmbedding, getEmbedding, deleteEmbedding, updateEmbedding } from "../vectors";

// Note: Custom SQLite is configured in test preload (src/__tests__/setup.ts)

describe("vector CRUD operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
    createEmbeddingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  test("storeEmbedding stores new embedding", () => {
    const embedding = new Float32Array(768).fill(0.5);
    const result = storeEmbedding(db, "entity-1", embedding);
    expect(result).toBe(true);
  });

  test("storeEmbedding validates dimension", () => {
    const wrongDim = new Float32Array(512).fill(0.5);
    expect(() => storeEmbedding(db, "entity-1", wrongDim)).toThrow("Expected 768");
  });

  test("getEmbedding retrieves stored embedding", () => {
    const embedding = new Float32Array(768).fill(0.3);
    storeEmbedding(db, "entity-1", embedding);

    const retrieved = getEmbedding(db, "entity-1");
    expect(retrieved).not.toBeNull();
    expect(retrieved?.length).toBe(768);
  });

  test("getEmbedding returns null for missing", () => {
    const result = getEmbedding(db, "nonexistent");
    expect(result).toBeNull();
  });

  test("deleteEmbedding removes embedding", () => {
    const embedding = new Float32Array(768).fill(0.1);
    storeEmbedding(db, "entity-1", embedding);

    const deleted = deleteEmbedding(db, "entity-1");
    expect(deleted).toBe(true);

    const result = getEmbedding(db, "entity-1");
    expect(result).toBeNull();
  });

  test("updateEmbedding updates existing", () => {
    const original = new Float32Array(768).fill(0.1);
    const updated = new Float32Array(768).fill(0.9);

    storeEmbedding(db, "entity-1", original);
    updateEmbedding(db, "entity-1", updated);

    const result = getEmbedding(db, "entity-1");
    expect(result?.[0]).toBeCloseTo(0.9, 5);
  });
});
