/**
 * Configuration for Ollama embedding service.
 * Loads settings from environment variables with sensible defaults.
 */

/// <reference types="node" />

import type { OllamaConfig } from "../services/ollama/types";

/**
 * Ollama configuration loaded from environment variables.
 * - OLLAMA_BASE_URL: API base URL (default: http://localhost:11434)
 * - OLLAMA_TIMEOUT: Request timeout in ms (default: 60000 / 60 seconds)
 *
 * Timeout reduced from 10 minutes to 60 seconds for fail-fast error detection.
 * Batch embedding operations complete in <1 second per request with batch API.
 */
export const ollamaConfig: OllamaConfig = {
	baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
	timeout: parseInt(process.env.OLLAMA_TIMEOUT ?? "60000", 10),
};
