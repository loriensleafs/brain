/**
 * HTTP client for Ollama API.
 * Provides embedding generation and health check functionality.
 */

import {
  type BatchEmbedResponse,
  type OllamaConfig,
  OllamaError,
  type TaskType,
} from "./types";

/**
 * Client for interacting with Ollama API.
 * Uses native fetch with AbortSignal for timeout handling.
 */
export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl ?? "http://localhost:11434";
    this.timeout = config.timeout ?? 60000; // 60 seconds (reduced from 10 min for fail-fast)
  }

  /**
   * Generate embedding vector for given text.
   * Delegates to batch method for consistency.
   *
   * @param text - Input text to embed
   * @param taskType - Task context for embedding (default: search_document)
   * @param model - Ollama model name (default: nomic-embed-text)
   * @returns Embedding vector as array of numbers
   * @throws OllamaError on API errors or timeouts
   */
  async generateEmbedding(
    text: string,
    taskType: TaskType = "search_document",
    model: string = "nomic-embed-text",
  ): Promise<number[]> {
    const [embedding] = await this.generateBatchEmbeddings(
      [text],
      taskType,
      model,
    );
    return embedding;
  }

  /**
   * Generate embeddings for multiple texts in a single request.
   * Uses the /api/embed endpoint which supports batch input.
   * Each text is prefixed with task type for context (ADR-003 compatibility).
   *
   * @param texts - Array of texts to embed
   * @param taskType - Task context for embedding (default: search_document)
   * @param model - Ollama model name (default: nomic-embed-text)
   * @returns Array of embedding vectors (same order as input)
   * @throws OllamaError on API errors or timeouts
   */
  async generateBatchEmbeddings(
    texts: string[],
    taskType: TaskType = "search_document",
    model: string = "nomic-embed-text",
  ): Promise<number[][]> {
    // Optimize empty input - no API call needed
    if (texts.length === 0) {
      return [];
    }

    // Prefix texts with task type for ADR-003 compatibility
    const prefixedTexts = texts.map((t) => `${taskType}: ${t}`);

    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: prefixedTexts,
        truncate: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new OllamaError(
        `Ollama API error: ${response.status}`,
        response.status,
      );
    }

    const data = (await response.json()) as BatchEmbedResponse;

    // Validate index alignment (critical for correctness)
    if (data.embeddings.length !== texts.length) {
      throw new OllamaError(
        `Embedding count mismatch: expected ${texts.length}, got ${data.embeddings.length}`,
        500,
      );
    }

    return data.embeddings;
  }

  /**
   * Check if Ollama server is reachable and responding.
   * Uses a short 5-second timeout for quick health checks.
   * @returns true if server is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
