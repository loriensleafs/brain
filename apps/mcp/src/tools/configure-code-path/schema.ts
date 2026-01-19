/**
 * Schema for configure_code_path tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const ConfigureCodePathArgsSchema = z.object({
  project: z.string().describe("Project name"),
  code_path: z.string().optional().describe("Path to code directory (supports ~ for home)"),
  remove: z.boolean().optional().describe("If true, remove the mapping instead of setting it"),
});

export type ConfigureCodePathArgs = z.infer<typeof ConfigureCodePathArgsSchema>;

export const toolDefinition: Tool = {
  name: "configure_code_path",
  description:
    "Map a project to a code directory for automatic CWD-based resolution. When you cd into a code directory, Brain will automatically use the associated project.",
  inputSchema: {
    type: "object" as const,
    properties: {
      project: {
        type: "string",
        description: "Project name",
      },
      code_path: {
        type: "string",
        description: "Path to code directory (supports ~ for home)",
      },
      remove: {
        type: "boolean",
        description: "If true, remove the mapping instead of setting it",
      },
    },
    required: ["project"],
  },
};
