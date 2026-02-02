/**
 * Tool registration and discovery
 *
 * Auto-discovers wrapper tools from subdirectories and proxies basic-memory tools.
 * Each wrapper tool lives in its own folder with schema.ts and index.ts.
 */

import { type PatternType, validateNamingPattern } from "@brain/validation";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { config } from "../config";
import { resolveProject, setActiveProject } from "../project/resolve";
import { getBasicMemoryClient } from "../proxy/client";
import { triggerEmbedding } from "../services/embedding/triggerEmbedding";
import { logger } from "../utils/internal/logger";
import { checkForDuplicates, formatGuardError } from "../utils/security/searchGuard";
import * as analyzeProject from "./analyze-project";
import * as bootstrapContext from "./bootstrap-context";
import { invalidateCache as invalidateBootstrapCache } from "./bootstrap-context/sessionCache";
import * as configTools from "./config";
import * as consolidateNotes from "./consolidate-notes";
import * as embed from "./embed";
import * as findDuplicates from "./find-duplicates";
import * as listFeaturesByPriority from "./list-features-by-priority";
import * as maintainKnowledgeGraph from "./maintain-knowledge-graph";
import * as manageBacklog from "./manage-backlog";
// Unified projects tools (each tool in its own subdirectory)
import * as projects from "./projects";
import * as search from "./search";
// Import wrapper tool modules
import * as session from "./session";
import * as validateImport from "./validate-import";
import * as workflow from "./workflow";

/**
 * Wrapper tool registry - maps tool name to handler and definition
 */
interface WrapperTool {
  definition: Tool;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

const WRAPPER_TOOLS: Map<string, WrapperTool> = new Map([
  [
    "session",
    {
      definition: session.toolDefinition,
      handler: session.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  [
    "bootstrap_context",
    {
      definition: bootstrapContext.toolDefinition,
      handler: bootstrapContext.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "list_features_by_priority",
    {
      definition: listFeaturesByPriority.toolDefinition,
      handler: listFeaturesByPriority.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "analyze_project",
    {
      definition: analyzeProject.toolDefinition,
      handler: analyzeProject.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  [
    "validate_import",
    {
      definition: validateImport.toolDefinition,
      handler: validateImport.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  [
    "consolidate_notes",
    {
      definition: consolidateNotes.toolDefinition,
      handler: consolidateNotes.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "maintain_knowledge_graph",
    {
      definition: maintainKnowledgeGraph.toolDefinition,
      handler: maintainKnowledgeGraph.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "find_duplicates",
    {
      definition: findDuplicates.toolDefinition,
      handler: findDuplicates.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  [
    "manage_backlog",
    {
      definition: manageBacklog.toolDefinition,
      handler: manageBacklog.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  [
    "search",
    {
      definition: search.toolDefinition,
      handler: search.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  [
    "generate_embeddings",
    {
      definition: embed.toolDefinition,
      handler: embed.handler as (args: Record<string, unknown>) => Promise<CallToolResult>,
    },
  ],
  // Workflow tools
  [
    "list_workflows",
    {
      definition: workflow.listWorkflowsToolDefinition,
      handler: workflow.listWorkflowsHandler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "send_workflow_event",
    {
      definition: workflow.sendWorkflowEventToolDefinition,
      handler: workflow.sendWorkflowEventHandler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "get_workflow",
    {
      definition: workflow.getWorkflowToolDefinition,
      handler: workflow.getWorkflowHandler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  // Unified projects tools
  [
    "active_project",
    {
      definition: projects.activeProject.toolDefinition,
      handler: projects.activeProject.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "list_projects",
    {
      definition: projects.listProjects.toolDefinition,
      handler: projects.listProjects.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "get_project_details",
    {
      definition: projects.getProjectDetails.toolDefinition,
      handler: projects.getProjectDetails.handler as unknown as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "edit_project",
    {
      definition: projects.editProject.toolDefinition,
      handler: projects.editProject.handler as unknown as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "create_project",
    {
      definition: projects.createProject.toolDefinition,
      handler: projects.createProject.handler as unknown as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "delete_project",
    {
      definition: projects.deleteProject.toolDefinition,
      handler: projects.deleteProject.handler as unknown as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  // Config tools
  [
    "config_get",
    {
      definition: configTools.configGet.toolDefinition,
      handler: configTools.configGet.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "config_set",
    {
      definition: configTools.configSet.toolDefinition,
      handler: configTools.configSet.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "config_reset",
    {
      definition: configTools.configReset.toolDefinition,
      handler: configTools.configReset.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "config_rollback",
    {
      definition: configTools.configRollback.toolDefinition,
      handler: configTools.configRollback.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "config_update_project",
    {
      definition: configTools.configUpdateProject.toolDefinition,
      handler: configTools.configUpdateProject.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "config_update_global",
    {
      definition: configTools.configUpdateGlobal.toolDefinition,
      handler: configTools.configUpdateGlobal.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
  [
    "migrate_config",
    {
      definition: configTools.configMigrate.toolDefinition,
      handler: configTools.configMigrate.handler as (
        args: Record<string, unknown>,
      ) => Promise<CallToolResult>,
    },
  ],
]);

/**
 * Tools that accept a 'project' parameter and need automatic injection
 */
const PROJECT_TOOLS = new Set([
  "write_note",
  "read_note",
  "read_content",
  "view_note",
  "edit_note",
  "move_note",
  "delete_note",
  "build_context",
  "recent_activity",
  "list_directory",
  "canvas",
  "create_memory_project",
  "delete_project",
  "search",
]);

/**
 * Enhanced descriptions for key tools to reinforce proactive memory behavior.
 * These are prefixed onto the basic-memory descriptions.
 */
const ENHANCED_DESCRIPTIONS: Record<string, string> = {
  write_note: `Create a new note in the knowledge base.

⚠️ MANDATORY: ALWAYS call search BEFORE write_note!
Check if a note on this topic already exists. If so, use edit_note instead.

The ratio should be 80% edit_note, 20% write_note. If you're creating many
new notes, you're probably fragmenting the knowledge graph.

Requirements for every note:
- Clear, descriptive title
- 3-5 observations minimum with [category] tags
- 2-3 relations minimum using exact entity titles
- Search for exact entity titles before writing relations

Use edit_note to append to existing notes rather than creating duplicates.`,

  edit_note: `Edit an existing note incrementally without rewriting entire content.

✓ PREFERRED over write_note for adding information to existing topics.

Operations:
- append: Add to end (most common - use for new observations/relations)
- prepend: Add to beginning (for urgent updates)
- find_replace: Replace specific text
- replace_section: Replace markdown section by heading

Progressive knowledge building pattern:
1. Search for existing note on topic
2. Use append to add new observations
3. Only create new note if topic is truly distinct`,
};

/**
 * Tools to hide from clients but keep available internally.
 * These are proxied basic-memory tools that we don't want exposed.
 * Example: search_notes is replaced by the unified 'search' tool.
 */
const HIDDEN_TOOLS = new Set(["search_notes"]);

// Store discovered tools for the list handler
let discoveredTools: Tool[] = [];

/**
 * Discover all tools from basic-memory and register handlers on our server.
 * Uses low-level handlers for ALL tools (wrapper + proxied).
 */
export async function discoverAndRegisterTools(server: McpServer): Promise<void> {
  const client = await getBasicMemoryClient();
  const { tools } = await client.listTools();

  logger.info({ count: tools.length }, "Discovered basic-memory tools");

  // Filter out tools we handle ourselves and hidden tools, store for listing
  const wrapperNames = new Set(WRAPPER_TOOLS.keys());
  discoveredTools = tools.filter(
    (tool) => !wrapperNames.has(tool.name) && !HIDDEN_TOOLS.has(tool.name),
  );

  // Register tools/list handler with enhanced descriptions
  server.server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Apply enhanced descriptions to discovered tools (prefix our guidance, keep original)
    const enhancedTools = discoveredTools.map((tool) => {
      if (ENHANCED_DESCRIPTIONS[tool.name]) {
        return {
          ...tool,
          description: `${ENHANCED_DESCRIPTIONS[tool.name]}\n\n---\n\n${tool.description}`,
        };
      }
      return tool;
    });

    // Get wrapper tool definitions
    const wrapperDefinitions = Array.from(WRAPPER_TOOLS.values()).map((t) => t.definition);

    return {
      tools: [...wrapperDefinitions, ...enhancedTools],
    };
  });

  // Register tools/call handler - handles ALL tools
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    // Handle wrapper tools directly
    const wrapperTool = WRAPPER_TOOLS.get(name);
    if (wrapperTool) {
      return wrapperTool.handler(args as Record<string, unknown>);
    }

    // Proxy other tools to basic-memory
    return callProxiedTool(name, args as Record<string, unknown>);
  });

  logger.debug(
    { wrapper: WRAPPER_TOOLS.size, proxied: discoveredTools.length },
    "Registered tool handlers",
  );
}

/**
 * Call a proxied tool with project injection if needed
 */
async function callProxiedTool(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const client = await getBasicMemoryClient();

  try {
    // Inject resolved project if this tool needs it
    const resolvedArgs = PROJECT_TOOLS.has(name) ? await injectProject(args) : args;

    // Naming pattern validation for write_note (ADR-023 Phase 3)
    if (name === "write_note") {
      const title = resolvedArgs.title as string | undefined;
      const folder = resolvedArgs.folder as string | undefined;

      if (title) {
        const fileName = `${title}.md`;
        const patternType = folderToPatternType(folder);

        // Only validate if we have a known pattern type for this folder
        if (patternType) {
          const validation = validateNamingPattern({
            fileName,
            patternType,
          });

          if (!validation.valid) {
            const expectedPattern = validation.isDeprecated
              ? `Deprecated pattern detected. ${validation.error}`
              : validation.error;

            logger.warn(
              { title, folder, patternType, error: validation.error },
              "Naming pattern validation failed",
            );

            return {
              content: [
                {
                  type: "text" as const,
                  text: `Invalid filename format for ${patternType} in folder '${folder}':\n\n${expectedPattern}\n\nPlease use the correct naming convention for this artifact type.`,
                },
              ],
              isError: true,
            };
          }

          logger.debug({ title, folder, patternType }, "Naming pattern validation passed");
        }
      }
    }

    // Search guard: check for duplicates before write_note
    if (name === "write_note" && config.searchGuardEnabled) {
      const guardResult = await checkForDuplicates(client, resolvedArgs);

      if (!guardResult.allowed) {
        // Enforce mode: block the write
        return {
          content: [
            {
              type: "text" as const,
              text: formatGuardError(guardResult),
            },
          ],
          isError: true,
        };
      }

      // Warn mode: include warning in response (will be added after success)
      if (guardResult.warning) {
        logger.info({ warning: guardResult.warning }, "Search guard warning");
      }
    }

    logger.debug({ tool: name, args: resolvedArgs }, "Calling proxied tool");

    const result = await client.callTool({
      name,
      arguments: resolvedArgs,
    });

    // Invalidate bootstrap_context cache on write operations
    if (name === "write_note" || name === "edit_note") {
      const project = resolvedArgs.project as string | undefined;
      invalidateBootstrapCache(project);
      logger.debug(
        { tool: name, project },
        "Invalidated bootstrap_context cache after write operation",
      );

      // Trigger embedding generation (fire-and-forget)
      // For write_note: use title + folder as permalink, content from args
      // For edit_note: use identifier as permalink, need to fetch content
      if (name === "write_note") {
        const title = resolvedArgs.title as string | undefined;
        const folder = resolvedArgs.folder as string | undefined;
        const content = resolvedArgs.content as string | undefined;
        if (title && content) {
          const permalink = folder ? `${folder}/${title}` : title;
          triggerEmbedding(permalink, content);
          logger.debug({ permalink }, "Triggered embedding for new note");
        }
      } else if (name === "edit_note") {
        // Fetch updated content and trigger embedding (fire-and-forget)
        const identifier = resolvedArgs.identifier as string | undefined;
        if (identifier) {
          // Async fetch and trigger - does not block edit response
          client
            .callTool({
              name: "read_note",
              arguments: { identifier, project: resolvedArgs.project },
            })
            .then((readResult) => {
              // Extract content from read_note response
              // Cast to expected structure (MCP SDK returns union type)
              const result = readResult as {
                content?: Array<{ type: string; text?: string }>;
              };
              const firstContent = result.content?.[0];
              if (firstContent?.type === "text" && firstContent.text) {
                triggerEmbedding(identifier, firstContent.text);
                logger.debug({ identifier }, "Triggered embedding for edited note");
              }
            })
            .catch((error: Error) => {
              logger.warn({ identifier, error }, "Failed to fetch content for embedding");
            });
        }
      }
    }

    // Ensure result has content array
    if (!result.content) {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result),
          },
        ],
      };
    }

    return result as CallToolResult;
  } catch (error) {
    logger.error({ tool: name, error }, "Proxied tool call failed");
    return {
      content: [
        {
          type: "text" as const,
          text: `🧠 Error calling ${name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Map folder paths to pattern types for validation.
 * Based on ADR-023/ADR-024 naming patterns - ONLY canonical paths.
 *
 * Canonical mappings (single path per entity):
 *   decision → decisions
 *   session → sessions
 *   requirement → specs/{name}/requirements
 *   design → specs/{name}/design
 *   task → specs/{name}/tasks
 *   analysis → analysis
 *   feature → planning
 *   epic → roadmap
 *   critique → critique
 *   test-report → qa
 *   security → security
 *   retrospective → retrospectives
 *   skill → skills
 *
 * @param folder - Folder path from write_note args
 * @returns Pattern type for validation, or undefined if no validation applies
 */
function folderToPatternType(folder: string | undefined): PatternType | undefined {
  if (!folder) {
    return undefined;
  }

  // Normalize folder path (remove trailing slashes, lowercase for comparison)
  const normalized = folder.replace(/\/+$/, "").toLowerCase();

  // Simple exact-match canonical paths
  const exactMapping: Record<string, PatternType> = {
    decisions: "decision",
    sessions: "session",
    analysis: "analysis",
    planning: "feature",
    roadmap: "epic",
    critique: "critique",
    qa: "test-report",
    security: "security",
    retrospectives: "retrospective",
    skills: "skill",
  };

  if (exactMapping[normalized]) {
    return exactMapping[normalized];
  }

  // Parameterized specs/{name}/* paths
  // Match: specs/anything/requirements, specs/anything/design, specs/anything/tasks
  if (normalized.startsWith("specs/") && normalized.split("/").length === 3) {
    const suffix = normalized.split("/")[2];
    const specsMapping: Record<string, PatternType> = {
      requirements: "requirement",
      design: "design",
      tasks: "task",
    };
    return specsMapping[suffix];
  }

  return undefined;
}

/**
 * Inject resolved project into tool arguments if not already specified
 */
async function injectProject(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (args.project) {
    return args;
  }

  const resolved = resolveProject(undefined);

  if (!resolved) {
    logger.debug("No project resolved, passing through to basic-memory");
    return args;
  }

  // Auto-promote resolved project to active for session
  setActiveProject(resolved);

  logger.debug({ project: resolved }, "Injected and set active project");
  return { ...args, project: resolved };
}
