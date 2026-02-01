/**
 * Batch embedding generation service.
 * Provides chunked embedding generation with progress tracking.
 */

import { generateEmbedding } from "./generateEmbedding";

/** Result of batch embedding generation */
export interface BatchResult {
  /** Array of embeddings, null for failed items */
  embeddings: (number[] | null)[];
  /** Indices of texts that failed to embed */
  failed: number[];
}

/** Callback for tracking batch progress */
export type ProgressCallback = (completed: number, total: number) => void;

/**
 * Generate embeddings for multiple texts in batches.
 * @param texts - Array of texts to embed
 * @param batchSize - Number of texts per batch (default 100)
 * @param onProgress - Optional progress callback
 * @returns BatchResult with embeddings array and failed indices
 */
export async function batchGenerate(
  texts: string[],
  batchSize: number = 100,
  onProgress?: ProgressCallback,
): Promise<BatchResult> {
  const embeddings: (number[] | null)[] = [];
  const failed: number[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((text) => generateEmbedding(text)),
    );

    results.forEach((result, idx) => {
      const globalIdx = i + idx;
      if (result.status === "fulfilled") {
        embeddings.push(result.value);
      } else {
        embeddings.push(null);
        failed.push(globalIdx);
      }
    });

    onProgress?.(Math.min(i + batchSize, texts.length), texts.length);
  }

  return { embeddings, failed };
}
