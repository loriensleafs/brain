/**
 * Schema for workflow MCP tools.
 *
 * Defines tools for listing, triggering, and monitoring Inngest workflows.
 * All operations are LOCAL-ONLY via the Inngest dev server.
 *
 * Validation: Uses JSON Schema via AJV from @brain/validation
 */

import {
	parseGetWorkflowArgs as _parseGetWorkflowArgs,
	parseListWorkflowsArgs as _parseListWorkflowsArgs,
	parseSendWorkflowEventArgs as _parseSendWorkflowEventArgs,
	type GetWorkflowArgs,
	type ListWorkflowsArgs,
	type SendWorkflowEventArgs,
} from "@brain/validation";
import getWorkflowSchema from "@brain/validation/schemas/tools/get-workflow.schema.json";
import listWorkflowsSchema from "@brain/validation/schemas/tools/list-workflows.schema.json";
import sendWorkflowEventSchema from "@brain/validation/schemas/tools/send-workflow-event.schema.json";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

// Re-export types for backward compatibility
export type { ListWorkflowsArgs, SendWorkflowEventArgs, GetWorkflowArgs };

// ============================================================================
// Input Schemas (Zod-compatible interface, AJV validation under the hood)
// ============================================================================

/**
 * ListWorkflowsArgsSchema provides Zod-compatible interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const ListWorkflowsArgsSchema = {
	parse: _parseListWorkflowsArgs,
	safeParse: (
		data: unknown,
	):
		| { success: true; data: ListWorkflowsArgs }
		| { success: false; error: Error } => {
		try {
			return { success: true, data: _parseListWorkflowsArgs(data) };
		} catch (e) {
			return {
				success: false,
				error: e instanceof Error ? e : new Error(String(e)),
			};
		}
	},
};

/**
 * SendWorkflowEventArgsSchema provides Zod-compatible interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const SendWorkflowEventArgsSchema = {
	parse: _parseSendWorkflowEventArgs,
	safeParse: (
		data: unknown,
	):
		| { success: true; data: SendWorkflowEventArgs }
		| { success: false; error: Error } => {
		try {
			return { success: true, data: _parseSendWorkflowEventArgs(data) };
		} catch (e) {
			return {
				success: false,
				error: e instanceof Error ? e : new Error(String(e)),
			};
		}
	},
};

/**
 * GetWorkflowArgsSchema provides Zod-compatible interface.
 * Uses AJV validation under the hood for 5-18x better performance.
 */
export const GetWorkflowArgsSchema = {
	parse: _parseGetWorkflowArgs,
	safeParse: (
		data: unknown,
	):
		| { success: true; data: GetWorkflowArgs }
		| { success: false; error: Error } => {
		try {
			return { success: true, data: _parseGetWorkflowArgs(data) };
		} catch (e) {
			return {
				success: false,
				error: e instanceof Error ? e : new Error(String(e)),
			};
		}
	},
};

// ============================================================================
// Tool Definitions
// ============================================================================

export const listWorkflowsToolDefinition: Tool = {
	name: "list_workflows",
	description:
		"Lists all available workflow functions and their event triggers. Returns workflow IDs, names, and event triggers.",
	inputSchema: listWorkflowsSchema as Tool["inputSchema"],
};

export const sendWorkflowEventToolDefinition: Tool = {
	name: "send_workflow_event",
	description:
		"Triggers a single workflow by sending an event. Returns the run ID(s) created.",
	inputSchema: sendWorkflowEventSchema as Tool["inputSchema"],
};

export const getWorkflowToolDefinition: Tool = {
	name: "get_workflow",
	description:
		"Gets full workflow run details including status, timing, steps, and output.",
	inputSchema: getWorkflowSchema as Tool["inputSchema"],
};
