/**
 * Configuration for Ollama embedding service.
 * Loads settings from environment variables with sensible defaults.
 */

import { OllamaConfig } from "../services/ollama/types";

/**
 * Ollama configuration loaded from environment variables.
 * - OLLAMA_BASE_URL: API base URL (default: http://localhost:11434)
 * - OLLAMA_TIMEOUT: Request timeout in ms (default: 30000)
 */
export const ollamaConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  timeout: parseInt(process.env.OLLAMA_TIMEOUT ?? "30000", 10),
};
