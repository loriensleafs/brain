/**
 * Ollama auto-start service.
 * Ensures Ollama is running and has the required model.
 */

import { spawn, spawnSync } from "node:child_process";
import { ollamaConfig } from "../../config/ollama";
import { logger } from "../../utils/internal/logger";

const OLLAMA_MODEL = "nomic-embed-text";
const STARTUP_TIMEOUT_MS = 30000;
const HEALTH_CHECK_INTERVAL_MS = 500;

/**
 * Find the Ollama binary path.
 * Checks common installation locations.
 */
function findOllamaBinary(): string | null {
  // Check if in PATH
  const whichResult = spawnSync("which", ["ollama"]);
  if (whichResult.status === 0) {
    return whichResult.stdout.toString().trim();
  }

  // Check Homebrew locations
  const homebrewPaths = ["/opt/homebrew/bin/ollama", "/usr/local/bin/ollama"];

  for (const path of homebrewPaths) {
    const testResult = spawnSync("test", ["-x", path]);
    if (testResult.status === 0) {
      return path;
    }
  }

  return null;
}

/**
 * Check if Ollama server is responding.
 */
async function isOllamaRunning(): Promise<boolean> {
  try {
    const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Check if the required model is available.
 */
async function hasRequiredModel(): Promise<boolean> {
  try {
    const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = (await response.json()) as { models?: { name: string }[] };
    return data.models?.some((m) => m.name.includes(OLLAMA_MODEL)) ?? false;
  } catch {
    return false;
  }
}

/**
 * Pull the required model.
 */
async function pullModel(ollamaPath: string): Promise<boolean> {
  logger.info({ model: OLLAMA_MODEL }, "Pulling Ollama model...");

  return new Promise((resolve) => {
    const proc = spawn(ollamaPath, ["pull", OLLAMA_MODEL], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    proc.stdout?.on("data", (data) => {
      output += data.toString();
    });
    proc.stderr?.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        logger.info({ model: OLLAMA_MODEL }, "Model pulled successfully");
        resolve(true);
      } else {
        logger.error({ model: OLLAMA_MODEL, output }, "Failed to pull model");
        resolve(false);
      }
    });

    // Timeout after 5 minutes for model download
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 300000);
  });
}

/**
 * Start Ollama server process.
 */
async function startOllamaServer(ollamaPath: string): Promise<boolean> {
  logger.info("Starting Ollama server...");

  // Start ollama serve in background
  const proc = spawn(ollamaPath, ["serve"], {
    detached: true,
    stdio: "ignore",
  });

  // Unref so Node can exit independently
  proc.unref();

  // Wait for server to be ready
  const startTime = Date.now();
  while (Date.now() - startTime < STARTUP_TIMEOUT_MS) {
    if (await isOllamaRunning()) {
      logger.info("Ollama server started successfully");
      return true;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS),
    );
  }

  logger.error("Ollama server failed to start within timeout");
  return false;
}

/**
 * Ensure Ollama is running and has the required model.
 * Will auto-start Ollama if installed but not running.
 * Will auto-pull the model if missing.
 *
 * @returns true if Ollama is ready for embeddings
 */
export async function ensureOllama(): Promise<boolean> {
  // Check if already running with model
  if (await isOllamaRunning()) {
    if (await hasRequiredModel()) {
      logger.info("Ollama is running with required model");
      return true;
    }

    // Running but missing model - try to pull
    const ollamaPath = findOllamaBinary();
    if (ollamaPath) {
      const pulled = await pullModel(ollamaPath);
      return pulled;
    }

    logger.warn(
      { model: OLLAMA_MODEL },
      "Ollama running but model missing. Run: ollama pull nomic-embed-text",
    );
    return false;
  }

  // Not running - try to start
  const ollamaPath = findOllamaBinary();
  if (!ollamaPath) {
    logger.warn(
      "Ollama not installed. Semantic search disabled. Install with: brew install ollama",
    );
    return false;
  }

  // Start the server
  const started = await startOllamaServer(ollamaPath);
  if (!started) {
    return false;
  }

  // Check for model
  if (await hasRequiredModel()) {
    return true;
  }

  // Pull the model
  return pullModel(ollamaPath);
}
