/**
 * Cursor adapter for Brain cross-platform plugin system.
 *
 * Transforms canonical content (agents, skills, commands, protocols, hooks, MCP)
 * into Cursor plugin format with .mdc rules, JSON merge payloads, and
 * description-only agent frontmatter.
 *
 * Cursor install strategy: file copy (symlinks broken in Cursor as of Feb 2026).
 * Rules delivered via .cursor/rules/ in .mdc format.
 * JSON configs (hooks.json, mcp.json) use additive merge with manifest tracking.
 * NEVER modifies user's existing Cursor config outside Brain-managed keys.
 */

import { join } from "path";
import type {
  AgentPlatformConfig,
  BrainConfig,
  CanonicalAgent,
  GeneratedFile,
} from "./shared.ts";
import {
  brainPrefix,
  readCanonicalAgents,
  withFrontmatter,
} from "./shared.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CursorOutput {
  agents: GeneratedFile[];
  rules: GeneratedFile[];
  hooks: GeneratedFile[];
  mcp: GeneratedFile[];
}

/**
 * JSON merge payload for additive config merging.
 * The Go CLI reads these and merges them into the user's existing config
 * without overwriting non-Brain keys.
 */
export interface JsonMergePayload {
  /** Keys managed by Brain (for manifest tracking and uninstall) */
  managedKeys: string[];
  /** The JSON content to merge additively */
  content: Record<string, unknown>;
}

// ─── Agent Transform ─────────────────────────────────────────────────────────

/**
 * Transform a canonical agent into Cursor format.
 * Cursor agents use description-only frontmatter (no model, memory, color, tools).
 * Returns null if the agent has no Cursor config (e.g., claude-only agents).
 */
export function transformAgent(
  agent: CanonicalAgent,
  config: AgentPlatformConfig | null | undefined,
): GeneratedFile | null {
  // null config means this agent is not for Cursor
  if (config === null || config === undefined) return null;

  const frontmatter: Record<string, unknown> = {};

  // Cursor only supports the description field
  if (config.description) frontmatter.description = config.description;

  const content = withFrontmatter(frontmatter, agent.body);
  return {
    relativePath: `rules/${brainPrefix(agent.name)}.mdc`,
    content,
  };
}

/**
 * Transform all canonical agents for Cursor.
 */
export async function transformAgents(
  agentsDir: string,
  brainConfig: BrainConfig,
): Promise<GeneratedFile[]> {
  const agents = await readCanonicalAgents(agentsDir);
  const results: GeneratedFile[] = [];

  for (const agent of agents) {
    const agentConfig = brainConfig.agents[agent.name];
    const platformConfig = agentConfig?.["cursor"] ?? undefined;
    const generated = transformAgent(agent, platformConfig);
    if (generated) results.push(generated);
  }

  return results;
}

// ─── Rules Transform ─────────────────────────────────────────────────────────

/**
 * Transform protocols into Cursor composable rules (.cursor/rules/).
 * Each protocol file becomes a .mdc rule file with emoji prefix.
 * Uses Bun.Glob to scan for .md files.
 */
export async function transformProtocols(
  protocolsDir: string,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];
  const glob = new Bun.Glob("*.md");

  try {
    for await (const entry of glob.scan({ cwd: protocolsDir })) {
      if (entry === ".gitkeep") continue;

      const content = await Bun.file(join(protocolsDir, entry)).text();
      const prefixed = `${brainPrefix(entry.replace(/\.md$/, ""))}.mdc`;

      results.push({
        relativePath: `rules/${prefixed}`,
        content,
      });
    }
  } catch {
    return results;
  }

  return results;
}

// ─── Hooks Transform ─────────────────────────────────────────────────────────

/**
 * Generate Cursor hooks JSON merge payload from brain.config.json.
 * Produces a merge payload that the Go CLI applies additively to .cursor/hooks.json.
 * Uses Bun.Glob for script discovery.
 */
export async function transformHooks(
  hooksDir: string,
  brainConfig: BrainConfig,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];
  const hookEntries = brainConfig.hooks ?? {};

  // Build hooks merge payload
  const hooksContent: Record<string, unknown[]> = {};
  const managedKeys: string[] = [];

  for (const [hookName, toolConfig] of Object.entries(hookEntries)) {
    const cursorConfig = toolConfig["cursor"];
    if (!cursorConfig) continue;

    const entry = {
      matcher: cursorConfig.matcher ?? "",
      hooks: [
        {
          type: "command",
          command: `hooks/scripts/${brainPrefix(hookName)}.js`,
          timeout: cursorConfig.timeout ?? 10,
        },
      ],
    };

    const eventKey = cursorConfig.event;
    if (!hooksContent[eventKey]) {
      hooksContent[eventKey] = [];
    }
    hooksContent[eventKey].push(entry);
    if (!managedKeys.includes(`hooks.${eventKey}`)) {
      managedKeys.push(`hooks.${eventKey}`);
    }
  }

  if (Object.keys(hooksContent).length > 0) {
    const payload: JsonMergePayload = {
      managedKeys,
      content: { hooks: hooksContent },
    };
    results.push({
      relativePath: "hooks/hooks.merge.json",
      content: JSON.stringify(payload, null, 2) + "\n",
    });
  }

  // Copy hook scripts with emoji prefix
  const scriptsDir = join(hooksDir, "scripts");
  const scriptGlob = new Bun.Glob("*");

  try {
    for await (const entry of scriptGlob.scan({ cwd: scriptsDir })) {
      if (entry === ".gitkeep" || entry === ".DS_Store") continue;

      const content = await Bun.file(join(scriptsDir, entry)).text();
      results.push({
        relativePath: `hooks/scripts/${entry}`,
        content,
      });
    }
  } catch {
    // No scripts directory
  }

  return results;
}

// ─── MCP Transform ───────────────────────────────────────────────────────────

/**
 * Transform canonical mcp.json into Cursor MCP merge payload.
 * Produces a merge payload that the Go CLI applies additively to .cursor/mcp.json.
 * Resolves relative paths to absolute paths for the MCP server binary.
 * Uses Bun.file() for reading and existence checks.
 */
export async function transformMcp(
  projectRoot: string,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];
  const mcpFile = Bun.file(join(projectRoot, "mcp.json"));

  if (!(await mcpFile.exists())) return results;

  try {
    const mcpConfig = await mcpFile.json();

    // Resolve relative paths in args to absolute paths from project root
    const managedKeys: string[] = [];
    if (mcpConfig.mcpServers) {
      for (const [serverName, server] of Object.entries(
        mcpConfig.mcpServers,
      ) as Array<[string, { args?: string[] }]>) {
        managedKeys.push(`mcpServers.${serverName}`);
        if (server.args) {
          server.args = server.args.map((arg: string) =>
            arg.startsWith("./") ? join(projectRoot, arg) : arg,
          );
        }
      }
    }

    const payload: JsonMergePayload = {
      managedKeys,
      content: mcpConfig,
    };

    results.push({
      relativePath: "mcp/mcp.merge.json",
      content: JSON.stringify(payload, null, 2) + "\n",
    });
  } catch {
    // Invalid mcp.json
  }

  return results;
}

// ─── Main Transform ──────────────────────────────────────────────────────────

/**
 * Run all Cursor transforms and return generated files.
 * This is the main entry point called by sync.ts.
 *
 * Cursor differences from Claude Code:
 * - Agents become .mdc rules (description-only frontmatter)
 * - Protocols become .mdc rules (not .md)
 * - No separate skills, commands, or plugin manifest
 * - Hooks and MCP use JSON merge payloads (not direct files)
 */
export async function transform(
  projectRoot: string,
  brainConfig: BrainConfig,
): Promise<CursorOutput> {
  const agentsDir = join(projectRoot, "agents");
  const protocolsDir = join(projectRoot, "protocols");
  const hooksDir = join(projectRoot, "hooks");

  const [agents, rules, hooks, mcp] = await Promise.all([
    transformAgents(agentsDir, brainConfig),
    transformProtocols(protocolsDir),
    transformHooks(hooksDir, brainConfig),
    transformMcp(projectRoot),
  ]);

  return {
    agents,
    rules,
    hooks,
    mcp,
  };
}
