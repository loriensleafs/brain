/**
 * HTTP client for Ollama API.
 * Provides embedding generation and health check functionality.
 */

import { OllamaConfig, EmbeddingResponse, OllamaError } from "./types";

/**
 * Client for interacting with Ollama API.
 * Uses native fetch with AbortSignal for timeout handling.
 */
export class OllamaClient {
  private baseUrl: string;
  private timeout: number;

  constructor(config: OllamaConfig = {}) {
    this.baseUrl = config.baseUrl ?? "http://localhost:11434";
    this.timeout = config.timeout ?? 30000;
  }

  /**
   * Generate embedding vector for given text.
   * @param text - Input text to embed
   * @param model - Ollama model name (default: nomic-embed-text)
   * @returns Embedding vector as array of numbers
   * @throws OllamaError on API errors or timeouts
   */
  async generateEmbedding(
    text: string,
    model: string = "nomic-embed-text"
  ): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      throw new OllamaError(
        `Ollama API error: ${response.status}`,
        response.status
      );
    }

    const data = (await response.json()) as EmbeddingResponse;
    return data.embedding;
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
