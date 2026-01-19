/**
 * Embedding service module exports.
 * Provides text embedding generation functionality.
 */

export { generateEmbedding } from "./generateEmbedding";
export { batchGenerate } from "./batchGenerate";
export { triggerEmbedding } from "./triggerEmbedding";
export type { BatchResult, ProgressCallback } from "./batchGenerate";

// Queue functions for offline mode
export {
  createEmbeddingQueueTable,
  enqueueEmbedding,
  dequeueEmbedding,
  markEmbeddingProcessed,
  incrementAttempts,
  getQueueLength,
} from "./queue";
export type { QueueItem } from "./queue";

// Retry logic with exponential backoff
export {
  processWithRetry,
  processEmbeddingQueue,
  MAX_RETRIES,
  BASE_DELAY_MS,
} from "./retry";
