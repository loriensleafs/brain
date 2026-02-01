/**
 * Embedding queue for offline mode.
 * Queues notes for embedding generation when Ollama is unavailable.
 * Supports retry logic with attempt tracking.
 */

import { createVectorConnection } from "../../db/connection";

export interface QueueItem {
	id: number;
	noteId: string;
	createdAt: string;
	attempts: number;
	lastError: string | null;
}

/**
 * Create embedding queue table if not exists.
 */
export function createEmbeddingQueueTable(): void {
	const db = createVectorConnection();
	try {
		db.run(`
      CREATE TABLE IF NOT EXISTS embedding_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        last_error TEXT
      )
    `);
	} finally {
		db.close();
	}
}

/**
 * Add note to embedding queue.
 * Uses upsert pattern: inserts new item or resets existing item.
 */
export function enqueueEmbedding(noteId: string): void {
	const db = createVectorConnection();
	try {
		db.run(
			`
      INSERT INTO embedding_queue (note_id) VALUES (?)
      ON CONFLICT(note_id) DO UPDATE SET created_at = CURRENT_TIMESTAMP, attempts = 0
    `,
			[noteId],
		);
	} finally {
		db.close();
	}
}

/**
 * Get oldest unprocessed item from queue.
 * Returns null if queue is empty.
 */
export function dequeueEmbedding(): QueueItem | null {
	const db = createVectorConnection();
	try {
		const result = db
			.query<QueueItem, []>(
				`
      SELECT id, note_id as noteId, created_at as createdAt, attempts, last_error as lastError
      FROM embedding_queue ORDER BY created_at ASC LIMIT 1
    `,
			)
			.get();
		return result ?? null;
	} finally {
		db.close();
	}
}

/**
 * Remove item from queue after successful processing.
 */
export function markEmbeddingProcessed(id: number): void {
	const db = createVectorConnection();
	try {
		db.run("DELETE FROM embedding_queue WHERE id = ?", [id]);
	} finally {
		db.close();
	}
}

/**
 * Increment attempt count and record error.
 */
export function incrementAttempts(id: number, error?: string): void {
	const db = createVectorConnection();
	try {
		db.run(
			`
      UPDATE embedding_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?
    `,
			[error ?? null, id],
		);
	} finally {
		db.close();
	}
}

/**
 * Get queue length.
 */
export function getQueueLength(): number {
	const db = createVectorConnection();
	try {
		const result = db
			.query<{ count: number }, []>(
				"SELECT COUNT(*) as count FROM embedding_queue",
			)
			.get();
		return result?.count ?? 0;
	} finally {
		db.close();
	}
}
