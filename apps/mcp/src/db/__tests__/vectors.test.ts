import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import { createEmbeddingsTable, makeChunkId } from "../schema";
import {
  storeChunkedEmbeddings,
  getChunkedEmbeddings,
  deleteChunkedEmbeddings,
  hasEmbeddings,
  countChunksForEntity,
  semanticSearchChunked,
  deduplicateByEntity,
  type ChunkEmbeddingInput,
} from "../vectors";

// Note: Custom SQLite is configured in test preload (src/__tests__/setup.ts)

describe("chunked embedding CRUD operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
    createEmbeddingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  test("storeChunkedEmbeddings stores single chunk", () => {
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

    const result = storeChunkedEmbeddings(db, "entity-1", chunks);
    expect(result).toBe(1);
  });

  test("storeChunkedEmbeddings stores multiple chunks", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 3,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Chunk 0",
        embedding: new Float32Array(768).fill(0.1),
      },
      {
        chunkIndex: 1,
        totalChunks: 3,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Chunk 1",
        embedding: new Float32Array(768).fill(0.2),
      },
      {
        chunkIndex: 2,
        totalChunks: 3,
        chunkStart: 180,
        chunkEnd: 300,
        chunkText: "Chunk 2",
        embedding: new Float32Array(768).fill(0.3),
      },
    ];

    const result = storeChunkedEmbeddings(db, "entity-1", chunks);
    expect(result).toBe(3);
  });

  test("storeChunkedEmbeddings validates dimension", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Test",
        embedding: new Float32Array(512).fill(0.5), // Wrong dimension
      },
    ];

    expect(() => storeChunkedEmbeddings(db, "entity-1", chunks)).toThrow("Expected 768");
  });

  test("storeChunkedEmbeddings replaces existing chunks", () => {
    // Store initial chunks
    const initial: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 2,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Initial 0",
        embedding: new Float32Array(768).fill(0.1),
      },
      {
        chunkIndex: 1,
        totalChunks: 2,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Initial 1",
        embedding: new Float32Array(768).fill(0.2),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", initial);
    expect(countChunksForEntity(db, "entity-1")).toBe(2);

    // Store replacement (single chunk)
    const replacement: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 50,
        chunkText: "Replacement",
        embedding: new Float32Array(768).fill(0.9),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", replacement);
    expect(countChunksForEntity(db, "entity-1")).toBe(1);
  });

  test("getChunkedEmbeddings retrieves all chunks ordered", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 2,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "First",
        embedding: new Float32Array(768).fill(0.1),
      },
      {
        chunkIndex: 1,
        totalChunks: 2,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Second",
        embedding: new Float32Array(768).fill(0.2),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", chunks);

    const retrieved = getChunkedEmbeddings(db, "entity-1");
    expect(retrieved.length).toBe(2);
    expect(retrieved[0].chunk_index).toBe(0);
    expect(retrieved[0].chunk_text).toBe("First");
    expect(retrieved[1].chunk_index).toBe(1);
    expect(retrieved[1].chunk_text).toBe("Second");
  });

  test("getChunkedEmbeddings returns empty for missing entity", () => {
    const result = getChunkedEmbeddings(db, "nonexistent");
    expect(result).toEqual([]);
  });

  test("deleteChunkedEmbeddings removes all chunks", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 2,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "First",
        embedding: new Float32Array(768).fill(0.1),
      },
      {
        chunkIndex: 1,
        totalChunks: 2,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Second",
        embedding: new Float32Array(768).fill(0.2),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", chunks);

    const deleted = deleteChunkedEmbeddings(db, "entity-1");
    expect(deleted).toBe(true);

    const result = getChunkedEmbeddings(db, "entity-1");
    expect(result).toEqual([]);
  });

  test("hasEmbeddings returns false when empty", () => {
    expect(hasEmbeddings(db)).toBe(false);
  });

  test("hasEmbeddings returns true when embeddings exist", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Test",
        embedding: new Float32Array(768).fill(0.5),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", chunks);

    expect(hasEmbeddings(db)).toBe(true);
  });

  test("countChunksForEntity returns correct count", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 3,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Chunk 0",
        embedding: new Float32Array(768).fill(0.1),
      },
      {
        chunkIndex: 1,
        totalChunks: 3,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Chunk 1",
        embedding: new Float32Array(768).fill(0.2),
      },
      {
        chunkIndex: 2,
        totalChunks: 3,
        chunkStart: 180,
        chunkEnd: 300,
        chunkText: "Chunk 2",
        embedding: new Float32Array(768).fill(0.3),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", chunks);

    expect(countChunksForEntity(db, "entity-1")).toBe(3);
    expect(countChunksForEntity(db, "nonexistent")).toBe(0);
  });
});

describe("semantic search with chunked embeddings", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
    sqliteVec.load(db);
    createEmbeddingsTable(db);
  });

  afterEach(() => {
    db.close();
  });

  test("semanticSearchChunked returns matching chunks", () => {
    // Store embeddings for two entities
    const entity1Chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Entity 1 content",
        embedding: new Float32Array(768).fill(0.5),
      },
    ];
    const entity2Chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Entity 2 content",
        embedding: new Float32Array(768).fill(0.1),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", entity1Chunks);
    storeChunkedEmbeddings(db, "entity-2", entity2Chunks);

    // Search with embedding similar to entity-1
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const results = semanticSearchChunked(db, queryEmbedding, 10, 0.5);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entityId).toBe("entity-1");
    expect(results[0].similarity).toBeGreaterThan(0.9);
  });

  test("semanticSearchChunked respects threshold", () => {
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Test",
        embedding: new Float32Array(768).fill(0.5),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", chunks);

    // High threshold should filter out low similarity results
    const dissimilarQuery = new Float32Array(768).fill(-0.5);
    const results = semanticSearchChunked(db, dissimilarQuery, 10, 0.9);

    expect(results.length).toBe(0);
  });

  test("deduplicateByEntity keeps best chunk per entity", () => {
    // Store multiple chunks for same entity
    const chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 2,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Chunk 0",
        embedding: new Float32Array(768).fill(0.3),
      },
      {
        chunkIndex: 1,
        totalChunks: 2,
        chunkStart: 80,
        chunkEnd: 200,
        chunkText: "Chunk 1",
        embedding: new Float32Array(768).fill(0.5),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", chunks);

    // Query will match chunk 1 better
    const queryEmbedding = new Float32Array(768).fill(0.5);
    const rawResults = semanticSearchChunked(db, queryEmbedding, 10, 0.5);

    const deduplicated = deduplicateByEntity(rawResults);

    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0].entityId).toBe("entity-1");
    expect(deduplicated[0].chunkIndex).toBe(1); // Better matching chunk
  });

  test("deduplicateByEntity preserves multiple entities", () => {
    // Store chunks for two entities
    const entity1Chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Entity 1",
        embedding: new Float32Array(768).fill(0.5),
      },
    ];
    const entity2Chunks: ChunkEmbeddingInput[] = [
      {
        chunkIndex: 0,
        totalChunks: 1,
        chunkStart: 0,
        chunkEnd: 100,
        chunkText: "Entity 2",
        embedding: new Float32Array(768).fill(0.4),
      },
    ];
    storeChunkedEmbeddings(db, "entity-1", entity1Chunks);
    storeChunkedEmbeddings(db, "entity-2", entity2Chunks);

    const queryEmbedding = new Float32Array(768).fill(0.5);
    const rawResults = semanticSearchChunked(db, queryEmbedding, 10, 0.5);
    const deduplicated = deduplicateByEntity(rawResults);

    // Should have both entities
    const entityIds = deduplicated.map((r) => r.entityId);
    expect(entityIds).toContain("entity-1");
    expect(entityIds).toContain("entity-2");
  });
});

describe("makeChunkId", () => {
  test("generates correct chunk ID format", () => {
    expect(makeChunkId("entity-1", 0)).toBe("entity-1#chunk-0");
    expect(makeChunkId("path/to/note", 5)).toBe("path/to/note#chunk-5");
  });
});
