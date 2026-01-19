/**
 * Fire-and-forget embedding trigger for note create/update.
 * Generates and stores embedding asynchronously without blocking.
 */

import { generateEmbedding } from "./generateEmbedding";
import { storeEmbedding } from "../../db/vectors";
import { createVectorConnection } from "../../db/connection";
import { logger } from "../../utils/internal/logger";

// Import will be added when queue is implemented (TASK-2-6)
// For now, just log failed embeddings

/**
 * Trigger embedding generation for a note (fire-and-forget).
 * Does not throw on failure - logs warning instead.
 * @param noteId - Unique identifier for the note (permalink)
 * @param content - Note content to embed
 */
export function triggerEmbedding(noteId: string, content: string): void {
  // Check if embedding is enabled (will be implemented in TASK-2-4)
  // For now, always attempt

  generateEmbedding(content)
    .then((embedding) => {
      if (embedding) {
        const db = createVectorConnection();
        try {
          storeEmbedding(db, noteId, embedding);
          logger.debug(`Embedding stored for note: ${noteId}`);
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
