/**
 * Schema for get_project tool
 */
import { z } from "zod";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

export const GetProjectArgsSchema = z.object({});

export type GetProjectArgs = z.infer<typeof GetProjectArgsSchema>;

export const toolDefinition: Tool = {
  name: "get_project",
  description:
    "Get the currently active project and list all available projects.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};
