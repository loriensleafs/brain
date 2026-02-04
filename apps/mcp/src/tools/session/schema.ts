/**
 * Schema for session tool
 *
 * Unified session management tool with get/set operations.
 *
 * Validation: Uses JSON Schema via AJV from @brain/validation
 */

import { parseSessionArgs as _parseSessionArgs, type SessionArgs } from "@brain/validation";
import sessionSchema from "@brain/validation/schemas/tools/session.schema.json";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Re-export type for backward compatibility
export type { SessionArgs };

/**
 * SessionArgsSchema provides Zod-compatible interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const SessionArgsSchema = {
  parse: _parseSessionArgs,
  safeParse: (
    data: unknown,
  ): { success: true; data: SessionArgs } | { success: false; error: Error } => {
    try {
      return { success: true, data: _parseSessionArgs(data) };
    } catch (e) {
      return {
        success: false,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  },
};

export const toolDefinition: Tool = {
  name: "session",
  description: `Manage session state and lifecycle.

**Lifecycle Operations:**
- **get**: Retrieve session state (openSessions, activeSession, mode, task, feature)
- **create**: Create new session (auto-pauses any active session). Requires: topic
- **pause**: Pause active session. Requires: sessionId
- **resume**: Resume paused session (auto-pauses any active session). Requires: sessionId
- **complete**: Complete active session. Requires: sessionId

**Workflow Operations:**
- **set**: Update workflow mode, task, or feature

**Session Lifecycle:**
- Only ONE session can be IN_PROGRESS at a time
- create/resume auto-pause any existing IN_PROGRESS session
- Status transitions: IN_PROGRESS <-> PAUSED -> COMPLETE

**Modes control what tools are allowed:**
- **analysis**: Read-only exploration. Blocks Edit, Write, Bash. Default mode.
- **planning**: Design phase. Blocks Edit, Write. Allows Bash for research.
- **coding**: Full access. All tools allowed.
- **disabled**: Mode enforcement disabled. All tools allowed.

Use 'create' to start a new work session, 'complete' when done.`,
  inputSchema: sessionSchema as Tool["inputSchema"],
};
