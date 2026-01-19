/**
 * Schema for workflow MCP tools.
 *
 * Defines tools for listing, triggering, and monitoring Inngest workflows.
 * All operations are LOCAL-ONLY via the Inngest dev server.
 */

import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// Input Schemas
// ============================================================================

export const ListWorkflowsArgsSchema = z.object({});
export type ListWorkflowsArgs = z.infer<typeof ListWorkflowsArgsSchema>;

export const SendWorkflowEventArgsSchema = z.object({
  event_name: z.string().describe("The event name to trigger"),
  data: z.record(z.unknown()).optional().describe("The payload for the workflow"),
});
export type SendWorkflowEventArgs = z.infer<typeof SendWorkflowEventArgsSchema>;

export const GetWorkflowArgsSchema = z.object({
  run_id: z.string().describe("The workflow run ID"),
});
export type GetWorkflowArgs = z.infer<typeof GetWorkflowArgsSchema>;

// ============================================================================
// Tool Definitions
// ============================================================================

export const listWorkflowsToolDefinition: Tool = {
  name: "list_workflows",
  description:
    "Lists all available workflow functions and their event triggers. Returns workflow IDs, names, and event triggers.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export const sendWorkflowEventToolDefinition: Tool = {
  name: "send_workflow_event",
  description:
    "Triggers a single workflow by sending an event. Returns the run ID(s) created.",
  inputSchema: {
    type: "object" as const,
    properties: {
      event_name: {
        type: "string",
        description: "The event name to trigger (e.g., 'feature/completion.requested')",
      },
      data: {
        type: "object",
        description: "The payload required by the workflow",
        additionalProperties: true,
      },
    },
    required: ["event_name"],
  },
};

export const getWorkflowToolDefinition: Tool = {
  name: "get_workflow",
  description:
    "Gets full workflow run details including status, timing, steps, and output.",
  inputSchema: {
    type: "object" as const,
    properties: {
      run_id: {
        type: "string",
        description: "The workflow run ID to get details for",
      },
    },
    required: ["run_id"],
  },
};
