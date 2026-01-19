/**
 * Type definitions for Ollama HTTP client.
 * Provides configuration, response types, and custom error handling.
 */

/**
 * Configuration options for OllamaClient
 */
export interface OllamaConfig {
  /** Base URL for Ollama API (default: http://localhost:11434) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Response structure from Ollama embeddings API
 */
export interface EmbeddingResponse {
  /** The embedding vector as an array of numbers */
  embedding: number[];
}

/**
 * Custom error class for Ollama API errors.
 * Includes HTTP status code for error handling decisions.
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "OllamaError";
  }
}
