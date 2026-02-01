/**
 * session tool implementation
 *
 * Unified session management with get/set operations.
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
	getRecentModeHistory,
	getSession,
	MODE_DESCRIPTIONS,
	setSession,
} from "../../services/session";
import { SessionArgsSchema } from "./schema";

export async function handler(
	rawArgs: Record<string, unknown>,
): Promise<CallToolResult> {
	// Validate and parse input
	const args = SessionArgsSchema.parse(rawArgs);
	if (args.operation === "get") {
		const state = await getSession();

		if (!state) {
			return {
				content: [
					{
						type: "text" as const,
						text: "Session not initialized. No active session found.",
					},
				],
				isError: true,
			};
		}

		const recentHistory = getRecentModeHistory(state, 5);

		const response = {
			mode: state.currentMode,
			modeDescription: MODE_DESCRIPTIONS[state.currentMode],
			task: state.activeTask,
			feature: state.activeFeature,
			updatedAt: state.updatedAt,
			recentModeHistory: recentHistory,
		};

		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(response, null, 2),
				},
			],
		};
	}

	// operation === "set"

	// Build updates from provided args
	const updates: { mode?: typeof args.mode; task?: string; feature?: string } =
		{};

	if (args.mode !== undefined) {
		updates.mode = args.mode;
	}
	if (args.task !== undefined) {
		updates.task = args.task;
	}
	if (args.feature !== undefined) {
		updates.feature = args.feature;
	}

	// Check if any updates provided
	if (Object.keys(updates).length === 0) {
		return {
			content: [
				{
					type: "text" as const,
					text: "No updates provided. Specify mode, task, or feature to update.",
				},
			],
			isError: true,
		};
	}

	const state = await setSession(updates);

	if (!state) {
		return {
			content: [
				{
					type: "text" as const,
					text: "Failed to update session state.",
				},
			],
			isError: true,
		};
	}

	// Build response message
	const parts: string[] = [];

	if (updates.mode) {
		parts.push(`Mode set to "${state.currentMode}"`);
		parts.push(MODE_DESCRIPTIONS[state.currentMode]);
	}
	if (updates.task !== undefined) {
		parts.push(updates.task ? `Task: ${state.activeTask}` : "Task cleared");
	}
	if (updates.feature !== undefined) {
		parts.push(
			updates.feature ? `Feature: ${state.activeFeature}` : "Feature cleared",
		);
	}

	return {
		content: [
			{
				type: "text" as const,
				text: parts.join("\n"),
			},
		],
	};
}

export { toolDefinition } from "./schema";
