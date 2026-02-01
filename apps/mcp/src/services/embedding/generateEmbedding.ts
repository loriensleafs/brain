/**
 * Embedding generation service.
 * Provides high-level text embedding functionality using Ollama.
 *
 * Text chunking is handled by the caller (embed tool uses chunking.ts).
 * This service expects pre-chunked text within model token limits.
 */

import { ollamaConfig } from "../../config/ollama";
import { logger } from "../../utils/internal/logger";
import { OllamaClient } from "../ollama/client";
import { OllamaError } from "../ollama/types";

/** Maximum retry attempts for transient errors */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (1s, 2s, 4s) */
const BASE_DELAY_MS = 1000;

/** Module-level singleton client for connection reuse */
let sharedClient: OllamaClient | null = null;

/**
 * Get or create the shared OllamaClient instance.
 * Reusing a single client prevents connection overhead per request.
 */
function getOllamaClient(): OllamaClient {
	if (!sharedClient) {
		sharedClient = new OllamaClient(ollamaConfig);
	}
	return sharedClient;
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (5xx server errors).
 */
function isRetryableError(error: unknown): boolean {
	if (error instanceof OllamaError) {
		return error.statusCode >= 500 && error.statusCode < 600;
	}
	return false;
}

/**
 * Generate a 768-dimension embedding for the given text using nomic-embed-text.
 *
 * Expects pre-chunked text. Chunking is handled by the embed tool using
 * the chunking service (~2000 chars per chunk with 15% overlap).
 *
 * Implements retry with exponential backoff for transient 5xx errors.
 * Retry delays: 1s, 2s, 4s (3 retries total).
 *
 * @param text - Input text to embed (should be pre-chunked)
 * @returns Embedding vector or null if text is empty
 * @throws OllamaError on non-retryable errors or after max retries exceeded
 */
export async function generateEmbedding(
	text: string,
): Promise<number[] | null> {
	if (!text || text.trim().length === 0) {
		return null;
	}

	const client = getOllamaClient();
	let lastError: Error | null = null;

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			return await client.generateEmbedding(
				text,
				"search_document",
				"nomic-embed-text",
			);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (!isRetryableError(error)) {
				// Non-retryable error (4xx client errors, etc.) - fail immediately
				throw error;
			}

			// Calculate exponential backoff delay
			const delay = BASE_DELAY_MS * 2 ** attempt;
			const statusCode =
				error instanceof OllamaError ? error.statusCode : "unknown";

			logger.warn(
				{
					attempt: attempt + 1,
					maxRetries: MAX_RETRIES,
					delay,
					statusCode,
				},
				"Ollama server error, retrying with backoff",
			);

			await sleep(delay);
		}
	}

	// All retries exhausted
	logger.error(
		{ maxRetries: MAX_RETRIES, lastError: lastError?.message },
		"Max retries exceeded for embedding generation",
	);
	throw lastError ?? new OllamaError("Max retries exceeded", 500);
}

/**
 * Reset the shared client (useful for testing or reconfiguration).
 */
export function resetOllamaClient(): void {
	sharedClient = null;
}
