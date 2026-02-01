/**
 * Schema for edit_project tool
 *
 * Memories path supports three modes:
 * - 'DEFAULT': ${default_memories_location}/${project_name} (from brain config)
 * - 'CODE': ${code_path}/docs
 * - Custom absolute path
 *
 * Migrated from Zod to JSON Schema + AJV per ADR-022.
 * JSON Schema source: packages/validation/schemas/tools/projects/edit-project.schema.json
 */

import {
	type EditProjectArgs,
	parseEditProjectArgs,
	validateEditProjectArgs,
} from "@brain/validation";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export { validateEditProjectArgs, parseEditProjectArgs, type EditProjectArgs };

/**
 * Memories path options:
 * - 'DEFAULT': Use default_memories_location from config + project name
 * - 'CODE': Use code_path/docs
 * - Any other string: Treat as absolute path
 */
export type MemoriesPathOption = "DEFAULT" | "CODE" | string;

// Re-export for backward compatibility
export const EditProjectArgsSchema = {
	parse: parseEditProjectArgs,
	safeParse: (data: unknown) => {
		try {
			return { success: true as const, data: parseEditProjectArgs(data) };
		} catch (error) {
			return { success: false as const, error };
		}
	},
};

export const toolDefinition: Tool = {
	name: "edit_project",
	description: `Edit project metadata and configuration.

Required parameters:
- name: Project name to edit
- code_path: Code directory path for CWD-based project resolution

Optional parameters:
- memories_path: Memories directory location. Options:
  - 'DEFAULT': \${default_memories_location}/\${project_name} (from brain config)
  - 'CODE': \${code_path}/docs
  - Absolute path: Any custom absolute path

Default behavior when memories_path not specified:
- Defaults to 'DEFAULT' mode (\${default_memories_location}/\${project_name})
- Exception: If memories_path was \${old_code_path}/docs and code_path changes, auto-updates to \${new_code_path}/docs

Examples:
- Set code path (memories defaults to DEFAULT): edit_project with name="brain", code_path="~/Dev/brain"
- Keep memories in code: edit_project with name="brain", code_path="~/Dev/brain", memories_path="CODE"
- Set custom path: edit_project with name="brain", code_path="~/Dev/brain", memories_path="~/custom/memories"`,
	inputSchema: {
		type: "object" as const,
		properties: {
			name: {
				type: "string",
				description: "Project name to edit",
			},
			code_path: {
				type: "string",
				description:
					"Code directory path (use ~ for home). Required for editing.",
			},
			memories_path: {
				type: "string",
				description:
					"Memories directory path. Options: 'DEFAULT' (${default_memories_location}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT' when not specified, except auto-updates to new code_path/docs if was ${old_code_path}/docs.",
			},
		},
		required: ["name", "code_path"],
	},
};
