/**
 * Ollama health check for server startup.
 * Verifies Ollama availability and nomic-embed-text model presence.
 */

import { ollamaConfig } from "../../config/ollama";
import { logger } from "../../utils/internal/logger";
import { OllamaClient } from "./client";

/**
 * Response structure from Ollama /api/tags endpoint.
 */
interface TagsResponse {
	models: { name: string }[];
}

/**
 * Check Ollama health and model availability.
 * Performs two checks:
 * 1. Server reachability via healthCheck()
 * 2. nomic-embed-text model availability via /api/tags
 *
 * @returns true if Ollama is healthy and nomic-embed-text is available
 */
export async function checkOllamaHealth(): Promise<boolean> {
	const client = new OllamaClient(ollamaConfig);

	const isHealthy = await client.healthCheck();
	if (!isHealthy) {
		logger.warn("Ollama not available. Semantic search disabled.");
		logger.warn("Start Ollama with: ollama serve");
		return false;
	}

	try {
		const response = await fetch(
			`${ollamaConfig.baseUrl ?? "http://localhost:11434"}/api/tags`,
			{
				signal: AbortSignal.timeout(5000),
			},
		);
		const data = (await response.json()) as TagsResponse;
		const hasModel = data.models?.some((m) =>
			m.name.includes("nomic-embed-text"),
		);

		if (!hasModel) {
			logger.warn("nomic-embed-text model not found.");
			logger.warn("Run: ollama pull nomic-embed-text");
			return false;
		}

		logger.info("Ollama health check passed. Semantic search enabled.");
		return true;
	} catch {
		logger.warn("Failed to check Ollama models.");
		return false;
	}
}
