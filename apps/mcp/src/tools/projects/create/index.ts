/**
 * create_project tool implementation
 *
 * Creates a new project with required code_path and optional memories_path.
 * Memories path supports enum options: DEFAULT, CODE, or absolute path.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getProjectMemoriesPath, ProjectNotFoundError } from "@brain/utils";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getDefaultMemoriesLocation } from "../../../config/brain-config";
import { getCodePath, setCodePath } from "../../../project/config";
import type { CreateProjectArgs, MemoriesPathOption } from "./schema";

export {
	type CreateProjectArgs,
	CreateProjectArgsSchema,
	type MemoriesPathOption,
	toolDefinition,
} from "./schema";

// getDefaultMemoriesLocation is imported from ../../../config/brain-config

/**
 * Check if a project exists in basic-memory config
 * @returns memories path if project exists, null otherwise
 */
async function getExistingMemoriesPath(
	project: string,
): Promise<string | null> {
	try {
		return await getProjectMemoriesPath(project);
	} catch (error) {
		if (error instanceof ProjectNotFoundError) {
			return null;
		}
		throw error;
	}
}

/**
 * Set memories path for a project in basic-memory config
 */
function setMemoriesPath(project: string, memoriesPath: string): void {
	const configPath = path.join(os.homedir(), ".basic-memory", "config.json");
	try {
		let config: Record<string, unknown> = {};
		if (fs.existsSync(configPath)) {
			const content = fs.readFileSync(configPath, "utf-8");
			config = JSON.parse(content);
		}

		if (!config.projects || typeof config.projects !== "object") {
			config.projects = {};
		}

		// Expand ~ and resolve to absolute path
		let resolved = memoriesPath;
		if (resolved.startsWith("~")) {
			resolved = path.join(os.homedir(), resolved.slice(1));
		}
		resolved = path.resolve(resolved);

		(config.projects as Record<string, string>)[project] = resolved;
		fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
	} catch (error) {
		throw new Error(
			`Failed to update memories path: ${error instanceof Error ? error.message : String(error)}`,
		);
	}
}

/**
 * Resolve a path, expanding ~ and making it absolute
 */
function resolvePath(inputPath: string): string {
	let resolved = inputPath;
	if (resolved.startsWith("~")) {
		resolved = path.join(os.homedir(), resolved.slice(1));
	}
	return path.resolve(resolved);
}

/**
 * Resolve memories_path option to an actual path
 *
 * BREAKING CHANGE: Default changed from 'CODE' to 'DEFAULT' mode.
 * To restore old behavior, explicitly pass memories_path='CODE'.
 *
 * @param option - MemoriesPathOption: 'DEFAULT', 'CODE', or absolute path
 * @param projectName - Project name (for DEFAULT option)
 * @param resolvedCodePath - Resolved code path (for CODE option)
 */
function resolveMemoriesPathOption(
	option: MemoriesPathOption | undefined,
	projectName: string,
	resolvedCodePath: string,
): string {
	// Handle explicit CODE mode
	if (option === "CODE") {
		return path.join(resolvedCodePath, "docs");
	}

	// Default to DEFAULT mode if not specified, or explicit DEFAULT
	if (!option || option === "DEFAULT") {
		const defaultMemoriesPath = getDefaultMemoriesLocation();
		const resolved = resolvePath(defaultMemoriesPath);
		return path.join(resolved, projectName);
	}

	// Treat as absolute path
	return resolvePath(option);
}

export async function handler(
	args: CreateProjectArgs,
): Promise<CallToolResult> {
	const { name, code_path, memories_path } = args;

	// Check if project already exists in basic-memory config
	const existingMemoriesPath = await getExistingMemoriesPath(name);
	if (existingMemoriesPath) {
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							error: `Project "${name}" already exists. Use edit_project to modify it, or delete_project to remove it first.`,
							suggestion: "Use edit_project to update configuration",
							existing_memories_path: existingMemoriesPath,
							existing_code_path: getCodePath(name) || null,
						},
						null,
						2,
					),
				},
			],
			isError: true,
		};
	}

	// Check if project exists in brain-config code_paths
	const existingCodePath = getCodePath(name);
	if (existingCodePath) {
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						{
							error: `Project "${name}" already exists. Use edit_project to modify it, or delete_project to remove it first.`,
							suggestion: "Use edit_project to update configuration",
							existing_memories_path: null,
							existing_code_path: existingCodePath,
						},
						null,
						2,
					),
				},
			],
			isError: true,
		};
	}

	const resolvedCodePath = resolvePath(code_path);

	// Resolve memories_path using enum logic
	const resolvedMemoriesPath = resolveMemoriesPathOption(
		memories_path as MemoriesPathOption | undefined,
		name,
		resolvedCodePath,
	);

	// Create memories directory if it doesn't exist
	if (!fs.existsSync(resolvedMemoriesPath)) {
		try {
			fs.mkdirSync(resolvedMemoriesPath, { recursive: true });
		} catch (error) {
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								error: `Failed to create memories directory: ${error instanceof Error ? error.message : String(error)}`,
								attempted_path: resolvedMemoriesPath,
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

	// Set memories path in basic-memory config
	setMemoriesPath(name, resolvedMemoriesPath);

	// Set code path in brain config
	setCodePath(name, code_path);

	const response = {
		project: name,
		code_path: resolvedCodePath,
		memories_path: resolvedMemoriesPath,
		memories_path_mode: memories_path || "DEFAULT",
		created: true,
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
