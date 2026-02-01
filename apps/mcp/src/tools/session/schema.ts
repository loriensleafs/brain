/**
 * Schema for session tool
 *
 * Unified session management tool with get/set operations.
 *
 * Validation: Uses JSON Schema via AJV from @brain/validation
 */

import {
  parseSessionArgs as _parseSessionArgs,
  type SessionArgs,
} from "@brain/validation";
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
  ):
    | { success: true; data: SessionArgs }
    | { success: false; error: Error } => {
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
  description: `Manage session state including workflow mode, active task, and feature.

Operations:
- **get**: Retrieve current session state (mode, task, feature, history)
- **set**: Update session state (mode, task, feature)

Modes control what tools are allowed:
- **analysis**: Read-only exploration. Blocks Edit, Write, Bash. Default mode.
- **planning**: Design phase. Blocks Edit, Write. Allows Bash for research.
- **coding**: Full access. All tools allowed.
- **disabled**: Mode enforcement disabled. All tools allowed.

Use 'set' with mode='coding' before starting implementation work.`,
  inputSchema: sessionSchema as Tool["inputSchema"],
};
