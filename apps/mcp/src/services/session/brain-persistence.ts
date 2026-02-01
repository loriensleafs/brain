/**
 * Brain Note Persistence for Session State
 *
 * Persists session state to Brain MCP notes as the single source of truth.
 * Uses fixed paths - one session per project.
 *
 * Key responsibilities:
 * - Write session state to Brain note at `sessions/session`
 * - Read session state from Brain notes
 * - Store agent invocation context in separate notes at `sessions/agent-{type}`
 *
 * Security model:
 * - Single-user environment with filesystem trust model
 * - No HMAC signing required (removed per simplification)
 *
 * Conflict Resolution:
 * - Last-Write-Wins: No optimistic locking, latest write overwrites previous
 *
 * Requirements:
 * - REQ-005: Brain note persistence model for session state
 * - DESIGN-001: Component 2 - Brain Note Persistence
 *
 * @see TASK-003: Implement Brain note persistence for session state
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getBasicMemoryClient } from "../../proxy/client";
import { logger } from "../../utils/internal/logger";
import type { AgentInvocation, AgentType, SessionState } from "./types";

// ============================================================================
// Constants
// ============================================================================

/**
 * Brain note path for session storage (fixed - one per project).
 */
const SESSION_PATH = "sessions/session";

/**
 * Brain note path prefix for agent context storage.
 */
const AGENT_CONTEXT_PREFIX = "sessions/agent-";

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when Brain MCP is unavailable.
 */
export class BrainUnavailableError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "BrainUnavailableError";
  }
}

/**
 * Error thrown when session is not found.
 */
export class SessionNotFoundError extends Error {
  constructor() {
    super("Session not found");
    this.name = "SessionNotFoundError";
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Response structure from read_note tool.
 */
interface ReadNoteResult {
  content?: Array<{ type: string; text?: string }>;
}

/**
 * Options for BrainSessionPersistence constructor.
 */
export interface BrainPersistenceOptions {
  /**
   * Optional custom Brain MCP client. If not provided, uses shared client.
   */
  client?: Client;

  /**
   * Project path for Brain notes. Defaults to process.cwd().
   */
  projectPath?: string;
}

// ============================================================================
// BrainSessionPersistence Class
// ============================================================================

/**
 * Persistence layer for session state using Brain MCP notes.
 *
 * Provides methods to save, load, and manage session state in Brain notes.
 * Uses fixed paths - one session per project.
 *
 * @example
 * ```typescript
 * const persistence = new BrainSessionPersistence();
 *
 * // Save session
 * await persistence.saveSession(sessionState);
 *
 * // Load session
 * const state = await persistence.loadSession();
 * ```
 */
export class BrainSessionPersistence {
  private client: Client | null = null;
  private readonly projectPath: string;
  private readonly customClient?: Client;

  constructor(options: BrainPersistenceOptions = {}) {
    this.customClient = options.client;
    this.projectPath = options.projectPath ?? process.cwd();
  }

  /**
   * Get Brain MCP client, creating connection if needed.
   *
   * @returns Connected Brain MCP client
   * @throws BrainUnavailableError if connection fails
   */
  private async getClient(): Promise<Client> {
    if (this.customClient) {
      return this.customClient;
    }

    try {
      this.client = await getBasicMemoryClient();
      return this.client;
    } catch (error) {
      throw new BrainUnavailableError(
        "Failed to connect to Brain MCP",
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Save session state to Brain note.
   *
   * Writes to fixed path `sessions/session`.
   * Uses Last-Write-Wins conflict resolution.
   *
   * @param session - Session state to save
   * @throws BrainUnavailableError if Brain MCP is unavailable
   */
  async saveSession(session: SessionState): Promise<void> {
    const client = await this.getClient();

    logger.debug(
      { notePath: SESSION_PATH, version: session.version },
      "Saving session to Brain note",
    );

    // Write session state to Brain note
    await client.callTool({
      name: "write_note",
      arguments: {
        path: SESSION_PATH,
        content: JSON.stringify(session, null, 2),
        project: this.projectPath,
      },
    });

    logger.info({ version: session.version }, "Session saved to Brain note");
  }

  /**
   * Load session state from Brain note.
   *
   * Reads from fixed path `sessions/session`.
   *
   * @returns Session state or null if not found
   * @throws BrainUnavailableError if Brain MCP is unavailable
   */
  async loadSession(): Promise<SessionState | null> {
    const client = await this.getClient();

    logger.debug({ notePath: SESSION_PATH }, "Loading session from Brain note");

    try {
      const result = (await client.callTool({
        name: "read_note",
        arguments: {
          identifier: SESSION_PATH,
          project: this.projectPath,
        },
      })) as ReadNoteResult;

      // Extract content from response
      const textContent = result.content?.find((c) => c.type === "text")?.text;
      if (!textContent) {
        logger.debug("Session note empty or not found");
        return null;
      }

      // Parse JSON
      let state: SessionState;
      try {
        state = JSON.parse(textContent) as SessionState;
      } catch {
        logger.warn("Failed to parse session state JSON");
        return null;
      }

      logger.debug(
        { version: state.version },
        "Session loaded from Brain note",
      );

      return state;
    } catch (error) {
      // Log and return null for errors (note not found, etc.)
      logger.debug({ error }, "Failed to load session - may not exist");
      return null;
    }
  }

  /**
   * Delete session state from Brain note.
   *
   * Writes a tombstone to the fixed path.
   *
   * @throws BrainUnavailableError if Brain MCP is unavailable
   */
  async deleteSession(): Promise<void> {
    const client = await this.getClient();

    logger.debug(
      { notePath: SESSION_PATH },
      "Deleting session from Brain note",
    );

    // Write tombstone content to mark as deleted
    const tombstone = {
      deleted: true,
      deletedAt: new Date().toISOString(),
    };

    await client.callTool({
      name: "write_note",
      arguments: {
        path: SESSION_PATH,
        content: JSON.stringify(tombstone, null, 2),
        project: this.projectPath,
      },
    });

    logger.info("Session deleted from Brain note");
  }

  /**
   * Save agent invocation context to a separate Brain note.
   *
   * Used by brain specialist agents to persist their context for
   * later reconstruction after context compaction.
   *
   * @param agent - Agent type
   * @param invocation - Agent invocation data
   * @throws BrainUnavailableError if Brain MCP is unavailable
   */
  async saveAgentContext(
    agent: AgentType,
    invocation: AgentInvocation,
  ): Promise<void> {
    const client = await this.getClient();

    const notePath = `${AGENT_CONTEXT_PREFIX}${agent}`;

    logger.debug({ agent, notePath }, "Saving agent context to Brain note");

    await client.callTool({
      name: "write_note",
      arguments: {
        path: notePath,
        content: JSON.stringify(invocation, null, 2),
        project: this.projectPath,
      },
    });

    logger.info({ agent }, "Agent context saved to Brain note");
  }

  /**
   * Load agent invocation context from Brain note.
   *
   * @param agent - Agent type
   * @returns Agent invocation or null if not found
   * @throws BrainUnavailableError if Brain MCP is unavailable
   */
  async loadAgentContext(agent: AgentType): Promise<AgentInvocation | null> {
    const client = await this.getClient();

    const notePath = `${AGENT_CONTEXT_PREFIX}${agent}`;

    try {
      const result = (await client.callTool({
        name: "read_note",
        arguments: {
          identifier: notePath,
          project: this.projectPath,
        },
      })) as ReadNoteResult;

      const textContent = result.content?.find((c) => c.type === "text")?.text;
      if (!textContent) {
        return null;
      }

      return JSON.parse(textContent) as AgentInvocation;
    } catch {
      logger.debug({ agent }, "Agent context not found");
      return null;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultPersistence: BrainSessionPersistence | null = null;

/**
 * Get the default BrainSessionPersistence instance.
 *
 * Creates a singleton instance on first call.
 *
 * @returns Default persistence instance
 */
export function getDefaultPersistence(): BrainSessionPersistence {
  if (!defaultPersistence) {
    defaultPersistence = new BrainSessionPersistence();
  }
  return defaultPersistence;
}

/**
 * Reset the default persistence instance.
 * Primarily for testing.
 */
export function resetDefaultPersistence(): void {
  defaultPersistence = null;
}
