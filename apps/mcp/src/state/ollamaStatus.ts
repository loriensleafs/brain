/**
 * Global state for Ollama embedding availability.
 * Set during server startup based on health check results.
 */

/** Global flag indicating whether embedding generation is available */
export let embeddingEnabled = false;

/**
 * Update the embedding availability flag.
 * Called after Ollama health check completes.
 *
 * @param enabled - true if Ollama is available with nomic-embed-text model
 */
export function setEmbeddingEnabled(enabled: boolean): void {
	embeddingEnabled = enabled;
}
