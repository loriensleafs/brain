/**
 * config_rollback tool implementation
 *
 * Rolls back Brain configuration to a previous state using
 * the ConfigRollbackManager.
 *
 * @see ADR-020 for configuration architecture
 * @see TASK-020-19 for implementation requirements
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { rollbackManager } from "../../config/rollback";
import type { ConfigRollbackArgs } from "./schema";

export {
	type ConfigRollbackArgs,
	ConfigRollbackArgsSchema,
	configRollbackToolDefinition as toolDefinition,
} from "./schema";

/**
 * Handler for config_rollback tool.
 *
 * @param args - Tool arguments
 * @returns CallToolResult with rollback result or error
 */
export async function handler(
	args: ConfigRollbackArgs,
): Promise<CallToolResult> {
	const { target } = args;

	// Check if rollback manager is initialized
	if (!rollbackManager.isInitialized()) {
		try {
			await rollbackManager.initialize();
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error:
									"Rollback manager not initialized and failed to initialize",
								details: error instanceof Error ? error.message : String(error),
							},
							null,
							2,
						),
					},
				],
				isError: true,
			};
		}
	}

	// Check available snapshots based on target
	if (target === "lastKnownGood") {
		const lastKnownGood = rollbackManager.getLastKnownGood();
		if (!lastKnownGood) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "No lastKnownGood snapshot available",
								hint: "A snapshot is created on MCP server startup. If the server just started, there may not be a baseline yet.",
							},
							null,
							2,
						),
					},
				],
				isError: true,
			};
		}
	} else if (target === "previous") {
		const history = rollbackManager.getHistory();
		if (history.length === 0) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: "No snapshots in rollback history",
								hint: "Snapshots are created before config changes. No changes have been made since startup.",
							},
							null,
							2,
						),
					},
				],
				isError: true,
			};
		}
	}

	// Perform rollback
	const result = await rollbackManager.rollback(target);

	if (!result.success) {
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							error: `Rollback failed: ${result.error}`,
							target,
						},
						null,
						2,
					),
				},
			],
			isError: true,
		};
	}

	// Build success response
	const response: Record<string, unknown> = {
		success: true,
		target,
		restored_from: {
			id: result.snapshot?.id,
			created_at: result.snapshot?.createdAt.toISOString(),
			reason: result.snapshot?.reason,
		},
	};

	// Include summary of restored config
	if (result.restoredConfig) {
		response.restored_config = {
			version: result.restoredConfig.version,
			projects: Object.keys(result.restoredConfig.projects),
			defaults: result.restoredConfig.defaults,
			logging_level: result.restoredConfig.logging.level,
		};
	}

	// Include rollback history info
	const history = rollbackManager.getHistory();
	response.rollback_history = {
		total_snapshots: history.length,
		available_targets: [
			"lastKnownGood",
			...(history.length > 0 ? ["previous"] : []),
		],
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
