/**
 * Schema for session tool
 *
 * Unified session management tool with get/set operations.
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const SessionArgsSchema = z.object({
  operation: z
    .enum(["get", "set"])
    .describe("Operation: 'get' retrieves session state, 'set' updates it"),
  mode: z
    .enum(["analysis", "planning", "coding", "disabled"])
    .optional()
    .describe(
      "Workflow mode (for set operation): analysis (read-only), planning (design), coding (full access), disabled (no restrictions)"
    ),
  task: z
    .string()
    .optional()
    .describe("Description of current task (for set operation)"),
  feature: z
    .string()
    .optional()
    .describe("Active feature slug/path (for set operation)"),
});

export type SessionArgs = z.infer<typeof SessionArgsSchema>;

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
  inputSchema: {
    type: "object" as const,
    properties: {
      operation: {
        type: "string",
        enum: ["get", "set"],
        description:
          "Operation: 'get' retrieves session state, 'set' updates it",
      },
      mode: {
        type: "string",
        enum: ["analysis", "planning", "coding", "disabled"],
        description:
          "Workflow mode (for set operation): analysis (read-only), planning (design), coding (full access), disabled (no restrictions)",
      },
      task: {
        type: "string",
        description: "Description of current task (for set operation)",
      },
      feature: {
        type: "string",
        description: "Active feature slug/path (for set operation)",
      },
    },
    required: ["operation"],
  },
};
