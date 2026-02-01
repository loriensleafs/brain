/**
 * Ollama service module exports.
 * Provides HTTP client for local embedding generation.
 */

export { checkOllamaHealth } from "./checkHealth";
export { OllamaClient } from "./client";
export { ensureOllama } from "./ensureOllama";
export type { EmbeddingResponse, OllamaConfig } from "./types";
export { OllamaError } from "./types";
