/**
 * Embedding generation service.
 * Provides high-level text embedding functionality using Ollama.
 */

import { OllamaClient } from "../ollama/client";
import { ollamaConfig } from "../../config/ollama";

/** Maximum text length in characters (~8192 tokens at 4 chars/token average) */
const MAX_TEXT_LENGTH = 32000;

/**
 * Generate a 768-dimension embedding for the given text using nomic-embed-text.
 * @param text - Input text to embed
 * @returns Embedding vector or null if text is empty
 * @throws OllamaError on API errors
 */
export async function generateEmbedding(
  text: string
): Promise<number[] | null> {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Truncate to max length to stay within token limit
  const truncatedText =
    text.length > MAX_TEXT_LENGTH ? text.slice(0, MAX_TEXT_LENGTH) : text;

  const client = new OllamaClient(ollamaConfig);
  return client.generateEmbedding(truncatedText, "nomic-embed-text");
}
