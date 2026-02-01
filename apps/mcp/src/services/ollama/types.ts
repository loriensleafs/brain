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
 * Response structure from Ollama embeddings API (single-text)
 */
export interface EmbeddingResponse {
  /** The embedding vector as an array of numbers */
  embedding: number[];
}

/**
 * Response structure from Ollama batch embed API
 */
export interface BatchEmbedResponse {
  /** Model used for embedding */
  model: string;
  /** Array of embedding vectors, one per input text */
  embeddings: number[][];
}

/**
 * Task type for embedding context (ADR-003 compatibility).
 * Prefixes are prepended to text for task-specific embeddings.
 */
export type TaskType = "search_document" | "search_query";

/**
 * Custom error class for Ollama API errors.
 * Includes HTTP status code for error handling decisions.
 */
export class OllamaError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}
