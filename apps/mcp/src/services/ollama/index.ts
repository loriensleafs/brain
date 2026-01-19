/**
 * Ollama service module exports.
 * Provides HTTP client for local embedding generation.
 */

export { OllamaClient } from "./client";
export type { OllamaConfig, EmbeddingResponse } from "./types";
export { OllamaError } from "./types";
export { checkOllamaHealth } from "./checkHealth";
export { ensureOllama } from "./ensureOllama";
