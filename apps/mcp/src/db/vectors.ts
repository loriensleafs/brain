import { Database } from "bun:sqlite";

const VECTOR_DIM = 768;

/**
 * Convert raw bytes to Float32Array.
 * sqlite-vec returns embeddings as Uint8Array (raw bytes).
 */
function bytesToFloat32Array(bytes: Uint8Array): Float32Array {
  return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
}

/**
 * Store or update an embedding for an entity.
 * Uses DELETE + INSERT pattern since vec0 virtual tables
 * do not support INSERT OR REPLACE.
 */
export function storeEmbedding(
  db: Database,
  entityId: string,
  embedding: number[] | Float32Array
): boolean {
  const arr = embedding instanceof Float32Array
    ? embedding
    : new Float32Array(embedding);

  if (arr.length !== VECTOR_DIM) {
    throw new Error(`Expected ${VECTOR_DIM} dimensions, got ${arr.length}`);
  }

  // Delete existing entry if present (upsert pattern for vec0)
  db.run("DELETE FROM brain_embeddings WHERE entity_id = ?", [entityId]);

  const stmt = db.prepare(`
    INSERT INTO brain_embeddings (entity_id, embedding)
    VALUES (?, ?)
  `);

  const result = stmt.run(entityId, arr);
  return result.changes > 0;
}

/**
 * Get embedding for an entity.
 * Returns Float32Array converted from raw bytes.
 */
export function getEmbedding(
  db: Database,
  entityId: string
): Float32Array | null {
  const row = db.query(
    "SELECT embedding FROM brain_embeddings WHERE entity_id = ?"
  ).get(entityId) as { embedding: Uint8Array } | null;

  if (!row?.embedding) {
    return null;
  }

  return bytesToFloat32Array(row.embedding);
}

/**
 * Delete embedding for an entity.
 */
export function deleteEmbedding(
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
 * Update embedding (alias for storeEmbedding with upsert).
 */
export function updateEmbedding(
  db: Database,
  entityId: string,
  embedding: number[] | Float32Array
): boolean {
  return storeEmbedding(db, entityId, embedding);
}
