/**
 * Schema for active_project tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const ActiveProjectArgsSchema = z.object({
  operation: z
    .enum(["get", "set", "clear"])
    .default("get")
    .describe("Operation to perform: get (default), set, or clear"),
  project: z
    .string()
    .optional()
    .describe("Project name (required for set operation)"),
});

export type ActiveProjectArgs = z.infer<typeof ActiveProjectArgsSchema>;

export const toolDefinition: Tool = {
  name: "active_project",
  description: `Manage the active project for this session.

Operations:
- get: Returns current active project, resolution hierarchy, and code paths
- set: Sets the active project (requires project parameter)
- clear: Clears the active project, forcing re-selection

Example usage:
- Get current: active_project (or active_project with operation="get")
- Set: active_project with operation="set", project="myproject"
- Clear: active_project with operation="clear"`,
  inputSchema: {
    type: "object" as const,
    properties: {
      operation: {
        type: "string",
        enum: ["get", "set", "clear"],
        default: "get",
        description: "Operation to perform: get (default), set, or clear",
      },
      project: {
        type: "string",
        description: "Project name (required for set operation)",
      },
    },
  },
};
