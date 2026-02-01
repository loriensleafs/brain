/**
 * Schema for create_project tool
 *
 * Memories path supports three modes:
 * - 'DEFAULT': ${default_memories_location}/${project_name} (from brain config)
 * - 'CODE': ${code_path}/docs
 * - Custom absolute path
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/projects/create-project.schema.json
 */

import {
	type CreateProjectArgs,
	parseCreateProjectArgs,
	validateCreateProjectArgs,
} from "@brain/validation";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export {
	validateCreateProjectArgs,
	parseCreateProjectArgs,
	type CreateProjectArgs,
};

/**
 * Memories path options:
 * - 'DEFAULT': Use default_memories_location from config + project name
 * - 'CODE': Use code_path/docs
 * - Any other string: Treat as absolute path
 */
export type MemoriesPathOption = "DEFAULT" | "CODE" | string;

// Re-export for backward compatibility
export const CreateProjectArgsSchema = {
	parse: parseCreateProjectArgs,
	safeParse: (data: unknown) => {
		try {
			return { success: true as const, data: parseCreateProjectArgs(data) };
		} catch (error) {
			return { success: false as const, error };
		}
	},
};

export const toolDefinition: Tool = {
	name: "create_project",
	description: `Create a new Brain memory project.

Required parameters:
- name: Project name to create
- code_path: Code directory path for CWD-based project resolution

Optional parameters:
- memories_path: Memories directory location. Options:
  - 'DEFAULT': \${default_memories_location}/\${project_name} (from brain config, typically ~/memories) - this is the default
  - 'CODE': \${code_path}/docs
  - Absolute path: Any custom absolute path

The memories directory will be created if it doesn't exist.

BREAKING CHANGE (v1.x): Default changed from 'CODE' to 'DEFAULT'. To restore old behavior, explicitly pass memories_path='CODE'.

Examples:
- Create with default (memories folder): create_project with name="myproject", code_path="~/Dev/myproject"
- Create in code/docs: create_project with name="myproject", code_path="~/Dev/myproject", memories_path="CODE"
- Create with custom path: create_project with name="myproject", code_path="~/Dev/myproject", memories_path="~/custom/memories"`,
	inputSchema: {
		type: "object" as const,
		properties: {
			name: {
				type: "string",
				description: "Project name to create",
			},
			code_path: {
				type: "string",
				description: "Code directory path (use ~ for home). Required.",
			},
			memories_path: {
				type: "string",
				description:
					"Memories directory path. Options: 'DEFAULT' (${default_memories_location}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT'.",
			},
		},
		required: ["name", "code_path"],
	},
};
