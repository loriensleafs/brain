/**
 * Inngest client initialization for Brain MCP server.
 *
 * LOCAL ONLY - connects to local Inngest dev server.
 * Run `npx inngest-cli@latest dev` to start the dev server.
 *
 * No cloud connections. No event keys. No signing keys.
 *
 * Graceful degradation: Server continues functioning when Inngest unavailable.
 * Workflow features are disabled, but core note operations work.
 */

import { Inngest } from "inngest";
import { logger } from "../utils/internal/logger";

/**
 * App ID for the Inngest client.
 */
const APP_ID = "🧠 brain";

/**
 * Default timeout for Inngest availability check (ms).
 */
const AVAILABILITY_CHECK_TIMEOUT = 3000;

/**
 * Inngest dev server URL for health checks.
 */
const INNGEST_DEV_SERVER_URL =
  process.env.INNGEST_DEV_SERVER_URL || "http://127.0.0.1:8288";

/**
 * Tracks whether Inngest is currently available.
 * Updated by checkInngestAvailability().
 */
let inngestAvailable = false;

/**
 * Inngest client instance - local dev mode only.
 *
 * Usage:
 * ```typescript
 * import { inngest } from "./inngest";
 *
 * // Send events
 * await inngest.send({ name: "note.created", data: { noteId: "123" } });
 *
 * // Define functions
 * export const processNote = inngest.createFunction(
 *   { id: "process-note" },
 *   { event: "note.created" },
 *   async ({ event }) => { ... }
 * );
 * ```
 */
export const inngest = new Inngest({
  id: APP_ID,
  isDev: true,
});

/**
 * Check if Inngest dev server is available.
 *
 * Performs a health check against the local Inngest dev server.
 * Updates internal availability state and returns result.
 *
 * @param timeout - Timeout in milliseconds (default: 3000)
 * @returns Promise<boolean> - true if Inngest is available
 */
export async function checkInngestAvailability(
  timeout: number = AVAILABILITY_CHECK_TIMEOUT
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${INNGEST_DEV_SERVER_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      inngestAvailable = true;
      logger.info(
        { url: INNGEST_DEV_SERVER_URL },
        "Inngest dev server available"
      );
      return true;
    }

    inngestAvailable = false;
    logger.warn(
      { url: INNGEST_DEV_SERVER_URL, status: response.status },
      "Inngest dev server returned non-OK status"
    );
    return false;
  } catch (error) {
    inngestAvailable = false;
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(
      { url: INNGEST_DEV_SERVER_URL, error: message },
      "Inngest dev server unavailable - workflow features disabled"
    );
    return false;
  }
}

/**
 * Check if Inngest is currently available.
 *
 * Returns cached availability state from last checkInngestAvailability() call.
 * Does not perform network request.
 *
 * @returns boolean - true if Inngest was available at last check
 */
export function isInngestAvailable(): boolean {
  return inngestAvailable;
}

/**
 * Get the Inngest dev server URL being used.
 *
 * @returns string - The Inngest dev server URL
 */
export function getInngestDevServerUrl(): string {
  return INNGEST_DEV_SERVER_URL;
}

logger.debug({ appId: APP_ID }, "Inngest client initialized (local dev mode)");
