import { Database } from "bun:sqlite";
import { makeChunkId, type ChunkedEmbedding } from "./schema";

const VECTOR_DIM = 768;

/**
 * Convert raw bytes to Float32Array.
 * sqlite-vec returns embeddings as Uint8Array (raw bytes).
 */
function bytesToFloat32Array(bytes: Uint8Array): Float32Array {
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/**
 * Input for storing a single chunk embedding.
 */
export interface ChunkEmbeddingInput {
  chunkIndex: number;
  totalChunks: number;
  chunkStart: number;
  chunkEnd: number;
  chunkText: string;
  embedding: number[] | Float32Array;
}

/**
 * Store chunked embeddings for an entity.
 * Deletes all existing chunks for the entity, then inserts new ones.
 *
 * @param db - Database connection
 * @param entityId - Note permalink
 * @param chunks - Array of chunk data with embeddings
 * @returns Number of chunks stored
 */
export function storeChunkedEmbeddings(
  db: Database,
  entityId: string,
  chunks: ChunkEmbeddingInput[]
): number {
  if (chunks.length === 0) {
    return 0;
  }

  // Validate all embeddings have correct dimensions
  for (const chunk of chunks) {
    const arr =
      chunk.embedding instanceof Float32Array
        ? chunk.embedding
        : new Float32Array(chunk.embedding);
    if (arr.length !== VECTOR_DIM) {
      throw new Error(
        `Chunk ${chunk.chunkIndex}: Expected ${VECTOR_DIM} dimensions, got ${arr.length}`
      );
    }
  }

  // Wrap DELETE + INSERT in transaction for virtual table safety
  const upsert = db.transaction(() => {
    // Delete all existing chunks for this entity
    db.run("DELETE FROM brain_embeddings WHERE entity_id = ?", [entityId]);

    const stmt = db.prepare(`
      INSERT INTO brain_embeddings (
        chunk_id, embedding, entity_id, chunk_index,
        chunk_start, chunk_end, total_chunks, chunk_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    for (const chunk of chunks) {
      const chunkId = makeChunkId(entityId, chunk.chunkIndex);
      const arr =
        chunk.embedding instanceof Float32Array
          ? chunk.embedding
          : new Float32Array(chunk.embedding);

      stmt.run(
        chunkId,
        arr,
        entityId,
        chunk.chunkIndex,
        chunk.chunkStart,
        chunk.chunkEnd,
        chunk.totalChunks,
        chunk.chunkText
      );
      inserted++;
    }

    return inserted;
  });

  return upsert();
}

/**
 * Delete all chunked embeddings for an entity.
 */
export function deleteChunkedEmbeddings(
  db: Database,
  entityId: string
): boolean {
  const result = db.run(
    "DELETE FROM brain_embeddings WHERE entity_id = ?",
    [entityId]
  );
  return result.changes > 0;
}

/**
 * Get all chunk embeddings for an entity.
 */
export function getChunkedEmbeddings(
  db: Database,
  entityId: string
): ChunkedEmbedding[] {
  const rows = db
    .query(
      `SELECT chunk_id, entity_id, chunk_index, embedding,
              chunk_start, chunk_end, total_chunks, chunk_text
       FROM brain_embeddings
       WHERE entity_id = ?
       ORDER BY chunk_index ASC`
    )
    .all(entityId) as Array<{
    chunk_id: string;
    entity_id: string;
    chunk_index: number;
    embedding: Uint8Array;
    chunk_start: number;
    chunk_end: number;
    total_chunks: number;
    chunk_text: string;
  }>;

  return rows.map((row) => ({
    chunk_id: row.chunk_id,
    entity_id: row.entity_id,
    chunk_index: row.chunk_index,
    embedding: bytesToFloat32Array(row.embedding),
    chunk_start: row.chunk_start,
    chunk_end: row.chunk_end,
    total_chunks: row.total_chunks,
    chunk_text: row.chunk_text,
  }));
}

/**
 * Check if embeddings table has any entries.
 */
export function hasEmbeddings(db: Database): boolean {
  try {
    const row = db
      .query("SELECT COUNT(*) as count FROM brain_embeddings")
      .get() as { count: number } | null;
    return row ? row.count > 0 : false;
  } catch {
    return false;
  }
}

/**
 * Count existing chunk embeddings for an entity.
 */
export function countChunksForEntity(db: Database, entityId: string): number {
  const row = db
    .query(
      "SELECT COUNT(*) as count FROM brain_embeddings WHERE entity_id = ?"
    )
    .get(entityId) as { count: number } | null;
  return row?.count ?? 0;
}

/**
 * Semantic search result with chunk metadata.
 */
export interface SemanticSearchResult {
  entityId: string;
  chunkId: string;
  chunkIndex: number;
  totalChunks: number;
  chunkText: string;
  distance: number;
  similarity: number;
}

/**
 * Perform semantic vector search across all embeddings.
 * Returns results sorted by similarity (highest first).
 *
 * @param db - Database connection
 * @param queryEmbedding - Query embedding vector
 * @param limit - Maximum results to return
 * @param threshold - Minimum similarity threshold (0-1)
 * @returns Array of search results with chunk metadata
 */
export function semanticSearchChunked(
  db: Database,
  queryEmbedding: number[] | Float32Array,
  limit: number,
  threshold: number
): SemanticSearchResult[] {
  const embeddingArr =
    queryEmbedding instanceof Float32Array
      ? queryEmbedding
      : new Float32Array(queryEmbedding);

  // Convert threshold to distance (cosine distance = 1 - similarity)
  const maxDistance = 1 - threshold;

  const rows = db
    .query(
      `
      SELECT * FROM (
        SELECT
          chunk_id,
          entity_id,
          chunk_index,
          total_chunks,
          chunk_text,
          vec_distance_cosine(embedding, ?) as distance
        FROM brain_embeddings
      )
      WHERE distance <= ?
      ORDER BY distance ASC
      LIMIT ?
      `
    )
    .all(embeddingArr, maxDistance, limit) as Array<{
    chunk_id: string;
    entity_id: string;
    chunk_index: number;
    total_chunks: number;
    chunk_text: string;
    distance: number;
  }>;

  return rows.map((row) => ({
    entityId: row.entity_id,
    chunkId: row.chunk_id,
    chunkIndex: row.chunk_index,
    totalChunks: row.total_chunks,
    chunkText: row.chunk_text,
    distance: row.distance,
    similarity: 1 - row.distance,
  }));
}

/**
 * Deduplicate semantic search results by entity.
 * Keeps the best matching chunk (highest similarity) for each entity.
 *
 * @param results - Raw search results (may have multiple chunks per entity)
 * @returns Deduplicated results with one entry per entity
 */
export function deduplicateByEntity(
  results: SemanticSearchResult[]
): SemanticSearchResult[] {
  const bestByEntity = new Map<string, SemanticSearchResult>();

  for (const result of results) {
    const existing = bestByEntity.get(result.entityId);
    if (!existing || result.similarity > existing.similarity) {
      bestByEntity.set(result.entityId, result);
    }
  }

  // Return sorted by similarity (highest first)
  return Array.from(bestByEntity.values()).sort(
    (a, b) => b.similarity - a.similarity
  );
}
