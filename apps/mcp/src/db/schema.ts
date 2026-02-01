import type { Database } from "bun:sqlite";

/**
 * Create brain_embeddings virtual table for semantic search.
 * Uses sqlite-vec vec0 module for native vector operations.
 *
 * Schema supports chunked embeddings:
 * - chunk_id: unique identifier (entity_id#chunk-N)
 * - embedding: 768-dimension vector
 * - entity_id: note permalink (e.g., "patterns/auth-flow")
 * - chunk_index: zero-based chunk index within the note
 * - chunk_start: start character offset in original text (auxiliary)
 * - chunk_end: end character offset in original text (auxiliary)
 * - total_chunks: total chunks for this note (auxiliary)
 * - chunk_text: the chunk's text content for snippet display (auxiliary)
 *
 * This allows multiple embeddings per note while maintaining uniqueness.
 */
export function createEmbeddingsTable(db: Database): void {
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS brain_embeddings USING vec0(
      chunk_id TEXT PRIMARY KEY,
      embedding FLOAT[768],
      entity_id TEXT,
      chunk_index INTEGER,
      +chunk_start INTEGER,
      +chunk_end INTEGER,
      +total_chunks INTEGER,
      +chunk_text TEXT
    )
  `);
}

/**
 * Ensure the embedding table exists.
 * Creates the chunked embeddings table if it does not exist.
 */
export function ensureEmbeddingTables(db: Database): void {
  createEmbeddingsTable(db);
}

/**
 * TypeScript type for chunked embedding records.
 */
export interface ChunkedEmbedding {
  chunk_id: string;
  entity_id: string;
  chunk_index: number;
  embedding: Float32Array;
  chunk_start: number;
  chunk_end: number;
  total_chunks: number;
  chunk_text: string;
}

/**
 * Generate a unique chunk ID from entity_id and chunk_index.
 */
export function makeChunkId(entityId: string, chunkIndex: number): string {
  return `${entityId}#chunk-${chunkIndex}`;
}

/**
 * Parse a chunk ID back to entity_id and chunk_index.
 */
export function parseChunkId(
  chunkId: string,
): { entityId: string; chunkIndex: number } | null {
  const match = chunkId.match(/^(.+)#chunk-(\d+)$/);
  if (!match) return null;
  return {
    entityId: match[1],
    chunkIndex: parseInt(match[2], 10),
  };
}
