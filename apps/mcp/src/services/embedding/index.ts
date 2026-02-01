/**
 * Embedding service module exports.
 * Provides text embedding generation functionality.
 */

export type { BatchResult, ProgressCallback } from "./batchGenerate";
export { batchGenerate } from "./batchGenerate";
export { generateEmbedding } from "./generateEmbedding";
export type { QueueItem } from "./queue";

// Queue functions for offline mode
export {
	createEmbeddingQueueTable,
	dequeueEmbedding,
	enqueueEmbedding,
	getQueueLength,
	incrementAttempts,
	markEmbeddingProcessed,
} from "./queue";
// Retry logic with exponential backoff
export {
	BASE_DELAY_MS,
	MAX_RETRIES,
	processEmbeddingQueue,
	processWithRetry,
} from "./retry";
export { triggerEmbedding } from "./triggerEmbedding";
