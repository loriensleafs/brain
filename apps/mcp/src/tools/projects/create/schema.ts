/**
 * Schema for create_project tool
 *
 * Notes path supports three modes:
 * - 'DEFAULT': ${default_notes_path}/${project_name} (from brain-config.json)
 * - 'CODE': ${code_path}/docs
 * - Custom absolute path
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Notes path options:
 * - 'DEFAULT': Use default_notes_path from config + project name
 * - 'CODE': Use code_path/docs
 * - Any other string: Treat as absolute path
 */
export type NotesPathOption = "DEFAULT" | "CODE" | string;

export const CreateProjectArgsSchema = z.object({
  name: z.string().describe("Project name to create"),
  code_path: z
    .string()
    .describe("Code directory path (use ~ for home). Required."),
  notes_path: z
    .string()
    .optional()
    .describe(
      "Notes directory path. Options: 'DEFAULT' (${default_notes_path}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT'."
    ),
});

export type CreateProjectArgs = z.infer<typeof CreateProjectArgsSchema>;

export const toolDefinition: Tool = {
  name: "create_project",
  description: `Create a new Brain memory project.

Required parameters:
- name: Project name to create
- code_path: Code directory path for CWD-based project resolution

Optional parameters:
- notes_path: Notes directory location. Options:
  - 'DEFAULT': \${default_notes_path}/\${project_name} (from brain-config.json, typically ~/memories) - this is the default
  - 'CODE': \${code_path}/docs
  - Absolute path: Any custom absolute path

The notes directory will be created if it doesn't exist.

BREAKING CHANGE (v1.x): Default changed from 'CODE' to 'DEFAULT'. To restore old behavior, explicitly pass notes_path='CODE'.

Examples:
- Create with default (memories folder): create_project with name="myproject", code_path="~/Dev/myproject"
- Create in code/docs: create_project with name="myproject", code_path="~/Dev/myproject", notes_path="CODE"
- Create with custom path: create_project with name="myproject", code_path="~/Dev/myproject", notes_path="~/custom/notes"`,
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
      notes_path: {
        type: "string",
        description:
          "Notes directory path. Options: 'DEFAULT' (${default_notes_path}/${name}), 'CODE' (${code_path}/docs), or absolute path. Defaults to 'DEFAULT'.",
      },
    },
    required: ["name", "code_path"],
  },
};
