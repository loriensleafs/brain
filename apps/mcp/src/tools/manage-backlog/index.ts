/**
 * Handler for manage_backlog tool
 *
 * Manages feature backlog with operations for querying order, setting priorities,
 * and managing dependencies between features.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { executeBacklogOperation } from "../organizer/modes/backlog";
import type { BacklogConfig } from "../organizer/types";
import type { ManageBacklogArgs } from "./schema";

/**
 * Main handler for the manage_backlog tool
 */
export async function handler(
	args: ManageBacklogArgs,
): Promise<CallToolResult> {
	if (!args.operation) {
		return {
			content: [{ type: "text" as const, text: "operation is required" }],
			isError: true,
		};
	}

	const project = args.project || resolveProject();

	if (!project) {
		return {
			content: [{ type: "text" as const, text: "No project specified." }],
			isError: true,
		};
	}

	// Build backlog config from args
	const config: BacklogConfig = {
		project,
		operation: args.operation,
		feature_id: args.feature_id,
		priority: args.priority,
		dependency_target: args.dependency_target,
	};

	// Execute the operation
	const result = await executeBacklogOperation(config);

	if (!result.success) {
		return {
			content: [
				{ type: "text" as const, text: result.error || "Operation failed" },
			],
			isError: true,
		};
	}

	// Format output based on operation type
	const output = formatOperationResult(result);

	return {
		structuredContent: result.data as unknown as { [x: string]: unknown },
		content: [{ type: "text" as const, text: output }],
	};
}

/**
 * Format operation result as human-readable text
 */
function formatOperationResult(result: any): string {
	const lines: string[] = [];

	switch (result.operation) {
		case "QUERY_ORDER": {
			const { features, cycles, warnings, total } = result.data;

			lines.push(`## Feature Backlog Order`);
			lines.push(``);
			lines.push(`**Total Features:** ${total}`);

			if (cycles && cycles.length > 0) {
				lines.push(``);
				lines.push(`### ⚠️ Dependency Cycles Detected`);
				for (const cycle of cycles) {
					lines.push(`- ${cycle.join(" → ")}`);
				}
			}

			if (warnings && warnings.length > 0) {
				lines.push(``);
				lines.push(`### ⚠️ Warnings`);
				for (const warning of warnings) {
					lines.push(`- ${warning}`);
				}
			}

			lines.push(``);
			lines.push(`### Ordered Features`);
			lines.push(``);

			for (const feature of features) {
				const statusBadge = feature.status
					? `[${feature.status}]`
					: "[UNKNOWN]";
				const priorityStars = "★".repeat(feature.priority || 3);

				lines.push(`**${feature.rank}. ${feature.title}** ${statusBadge}`);
				lines.push(`   Priority: ${priorityStars} (${feature.priority || 3})`);
				lines.push(`   Permalink: ${feature.permalink}`);

				if (feature.blocked_by && feature.blocked_by.length > 0) {
					lines.push(`   🔒 Blocked by: ${feature.blocked_by.join(", ")}`);
				}

				if (feature.blocks && feature.blocks.length > 0) {
					lines.push(`   🚧 Blocks: ${feature.blocks.join(", ")}`);
				}

				lines.push(``);
			}

			break;
		}

		case "SET_PRIORITY": {
			const { feature, oldPriority, newPriority } = result.data;
			lines.push(`## Priority Updated`);
			lines.push(``);
			lines.push(`**Feature:** ${feature}`);
			lines.push(`**Old Priority:** ${oldPriority || "not set"}`);
			lines.push(`**New Priority:** ${newPriority}`);
			break;
		}

		case "ADD_DEPENDENCY": {
			const { source, target, message } = result.data;
			lines.push(`## Dependency Added`);
			lines.push(``);
			lines.push(`**Source:** ${source}`);
			lines.push(`**Target:** ${target}`);
			lines.push(``);
			lines.push(message);
			break;
		}

		case "REMOVE_DEPENDENCY": {
			const { source, target, message } = result.data;
			lines.push(`## Dependency Removed`);
			lines.push(``);
			lines.push(`**Source:** ${source}`);
			lines.push(`**Target:** ${target}`);
			lines.push(``);
			lines.push(message);
			break;
		}

		default:
			lines.push(`Operation completed: ${result.operation}`);
	}

	return lines.join("\n");
}

export { toolDefinition } from "./schema";
