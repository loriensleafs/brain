import { Database } from "bun:sqlite";

/**
 * Create brain_embeddings virtual table for semantic search.
 * Uses sqlite-vec vec0 module for native vector operations.
 */
export function createEmbeddingsTable(db: Database): void {
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS brain_embeddings USING vec0(
      entity_id TEXT PRIMARY KEY,
      embedding FLOAT[768]
    )
  `);
}

/**
 * TypeScript type for embedding records.
 */
export interface BrainEmbedding {
  entity_id: string;
  embedding: Float32Array;
}
