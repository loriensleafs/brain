/**
 * Retry logic with exponential backoff for embedding generation.
 * Processes queued embeddings with configurable retry limits.
 */

import { generateEmbedding } from "./generateEmbedding";
import { storeEmbedding } from "../../db/vectors";
import { createVectorConnection } from "../../db/connection";
import {
  dequeueEmbedding,
  markEmbeddingProcessed,
  incrementAttempts,
} from "./queue";
import { logger } from "../../utils/internal/logger";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Process a single queue item with retry logic.
 * @param noteId - Note identifier
 * @param content - Note content to embed
 * @param attempts - Current attempt count
 * @returns true if successful, false if should retry
 */
export async function processWithRetry(
  noteId: string,
  content: string,
  attempts: number = 0
): Promise<boolean> {
  if (attempts >= MAX_RETRIES) {
    logger.warn(`Max retries (${MAX_RETRIES}) exceeded for note ${noteId}`);
    return false;
  }

  try {
    const embedding = await generateEmbedding(content);
    if (embedding) {
      const db = createVectorConnection();
      try {
        storeEmbedding(db, noteId, embedding);
        logger.info(`Embedding retry succeeded for note ${noteId}`);
        return true;
      } finally {
        db.close();
      }
    }
    return true; // null embedding (empty content) is still "success"
  } catch (error) {
    const delay = BASE_DELAY_MS * Math.pow(2, attempts);
    logger.warn(
      `Retry ${attempts + 1}/${MAX_RETRIES} for note ${noteId}. Next in ${delay}ms`
    );
    await sleep(delay);
    return false;
  }
}

/**
 * Process entire embedding queue.
 * @param fetchContent - Function to fetch note content by ID
 */
export async function processEmbeddingQueue(
  fetchContent: (noteId: string) => Promise<string | null>
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  let item = dequeueEmbedding();

  while (item) {
    const { id, noteId, attempts } = item;

    if (attempts >= MAX_RETRIES) {
      logger.warn(
        `Removing note ${noteId} from queue after ${MAX_RETRIES} failures`
      );
      markEmbeddingProcessed(id);
      failed++;
      item = dequeueEmbedding();
      continue;
    }

    const content = await fetchContent(noteId);
    if (!content) {
      logger.warn(`Could not fetch content for note ${noteId}`);
      markEmbeddingProcessed(id);
      failed++;
      item = dequeueEmbedding();
      continue;
    }

    const success = await processWithRetry(noteId, content, attempts);
    if (success) {
      markEmbeddingProcessed(id);
      processed++;
    } else {
      incrementAttempts(id, "Retry failed");
    }

    item = dequeueEmbedding();
  }

  return { processed, failed };
}

export { MAX_RETRIES, BASE_DELAY_MS };
