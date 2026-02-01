/**
 * Retry logic with exponential backoff for embedding generation.
 * Processes queued embeddings with configurable retry limits.
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
import {
  dequeueEmbedding,
  incrementAttempts,
  markEmbeddingProcessed,
} from "./queue";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
 * Process a single queue item with retry logic.
 * @param noteId - Note identifier
 * @param content - Note content to embed
 * @param attempts - Current attempt count
 * @returns true if successful, false if should retry
 */
export async function processWithRetry(
  noteId: string,
  content: string,
  attempts: number = 0,
): Promise<boolean> {
  if (attempts >= MAX_RETRIES) {
    logger.warn(`Max retries (${MAX_RETRIES}) exceeded for note ${noteId}`);
    return false;
  }

  try {
    const chunkEmbeddings = await generateChunkedEmbeddings(content);
    if (chunkEmbeddings && chunkEmbeddings.length > 0) {
      const db = createVectorConnection();
      try {
        ensureEmbeddingTables(db);
        storeChunkedEmbeddings(db, noteId, chunkEmbeddings);
        logger.info(
          `Embedding retry succeeded for note ${noteId} (${chunkEmbeddings.length} chunks)`,
        );
        return true;
      } finally {
        db.close();
      }
    }
    return true; // null embedding (empty content) is still "success"
  } catch (_error) {
    const delay = BASE_DELAY_MS * 2 ** attempts;
    logger.warn(
      `Retry ${attempts + 1}/${MAX_RETRIES} for note ${noteId}. Next in ${delay}ms`,
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
  fetchContent: (noteId: string) => Promise<string | null>,
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  let item = dequeueEmbedding();

  while (item) {
    const { id, noteId, attempts } = item;

    if (attempts >= MAX_RETRIES) {
      logger.warn(
        `Removing note ${noteId} from queue after ${MAX_RETRIES} failures`,
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
