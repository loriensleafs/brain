/**
 * Fire-and-forget embedding trigger for note create/update.
 * Generates and stores embedding asynchronously without blocking.
 *
 * Uses chunked embeddings for content that exceeds model token limits.
 */

import { createVectorConnection } from "../../db/connection";
import { ensureEmbeddingTables } from "../../db/schema";
import {
	type ChunkEmbeddingInput,
	storeChunkedEmbeddings,
} from "../../db/vectors";
import { logger } from "../../utils/internal/logger";
import { chunkText } from "./chunking";
import { generateEmbedding } from "./generateEmbedding";

// Import will be added when queue is implemented (TASK-2-6)
// For now, just log failed embeddings

/**
 * Generate embeddings for all chunks of content.
 * @param content - Full content to chunk and embed
 * @returns Array of chunk embeddings or null if any chunk fails
 */
async function generateChunkedEmbeddings(
	content: string,
): Promise<ChunkEmbeddingInput[] | null> {
	const chunks = chunkText(content);
	const results: ChunkEmbeddingInput[] = [];

	for (const chunk of chunks) {
		const embedding = await generateEmbedding(chunk.text);
		if (!embedding) {
			return null;
		}

		results.push({
			chunkIndex: chunk.chunkIndex,
			totalChunks: chunk.totalChunks,
			chunkStart: chunk.start,
			chunkEnd: chunk.end,
			chunkText: chunk.text,
			embedding,
		});
	}

	return results;
}

/**
 * Trigger embedding generation for a note (fire-and-forget).
 * Does not throw on failure - logs warning instead.
 * @param noteId - Unique identifier for the note (permalink)
 * @param content - Note content to embed
 */
export function triggerEmbedding(noteId: string, content: string): void {
	// Check if embedding is enabled (will be implemented in TASK-2-4)
	// For now, always attempt

	generateChunkedEmbeddings(content)
		.then((chunkEmbeddings) => {
			if (chunkEmbeddings && chunkEmbeddings.length > 0) {
				const db = createVectorConnection();
				try {
					ensureEmbeddingTables(db);
					storeChunkedEmbeddings(db, noteId, chunkEmbeddings);
					logger.debug(
						`Embedding stored for note: ${noteId} (${chunkEmbeddings.length} chunks)`,
					);
				} finally {
					db.close();
				}
			}
		})
		.catch((error: Error) => {
			logger.warn(`Embedding failed for note ${noteId}: ${error.message}`);
			// Queue for retry will be added in TASK-2-6
		});
}
