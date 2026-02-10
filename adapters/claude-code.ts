/**
 * Claude Code adapter for Brain cross-platform plugin system.
 *
 * Transforms canonical content (agents, skills, commands, protocols, hooks, MCP)
 * into Claude Code plugin format with proper frontmatter, emoji prefixes, and
 * plugin directory structure.
 *
 * Claude Code install strategy: symlinks from canonical content to ~/.claude/plugins/
 * Instructions delivered via .claude/rules/ (composable, auto-loaded).
 * NEVER modifies user's existing CLAUDE.md, hooks, or MCP config.
 */

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  AgentPlatformConfig,
  BrainConfig,
  CanonicalAgent,
  GeneratedFile,
} from "./shared.js";
import {
  brainPrefix,
  collectFiles,
  readCanonicalAgents,
  readTextFile,
  withFrontmatter,
} from "./shared.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClaudeCodeOutput {
  agents: GeneratedFile[];
  skills: GeneratedFile[];
  commands: GeneratedFile[];
  rules: GeneratedFile[];
  hooks: GeneratedFile[];
  mcp: GeneratedFile[];
  plugin: GeneratedFile[];
}

// ─── Agent Transform ─────────────────────────────────────────────────────────

/**
 * Transform a canonical agent into Claude Code format.
 * Adds Claude Code-specific frontmatter from brain.config.json.
 * Returns null if the agent has no Claude Code config (e.g., cursor-only agents).
 */
export function transformAgent(
  agent: CanonicalAgent,
  config: AgentPlatformConfig | null | undefined,
): GeneratedFile | null {
  // null config means this agent is not for Claude Code
  if (config === null || config === undefined) return null;

  const frontmatter: Record<string, unknown> = {
    name: brainPrefix(agent.name),
  };

  // Add Claude Code-specific fields from config
  if (config.model) frontmatter.model = config.model;
  if (config.description) frontmatter.description = config.description;
  if (config.memory) frontmatter.memory = config.memory;
  if (config.color) frontmatter.color = config.color;
  if (config.argument_hint) frontmatter["argument-hint"] = config.argument_hint;
  if (config.allowed_tools && config.allowed_tools.length > 0) {
    frontmatter.tools = config.allowed_tools;
  }
  if (config.skills && config.skills.length > 0) {
    frontmatter.skills = config.skills;
  }

  const content = withFrontmatter(frontmatter, agent.body);
  return {
    relativePath: `agents/${brainPrefix(agent.name)}.md`,
    content,
  };
}

/**
 * Transform all canonical agents for Claude Code.
 */
export async function transformAgents(
  agentsDir: string,
  brainConfig: BrainConfig,
): Promise<GeneratedFile[]> {
  const agents = await readCanonicalAgents(agentsDir);
  const results: GeneratedFile[] = [];

  for (const agent of agents) {
    const agentConfig = brainConfig.agents[agent.name];
    const platformConfig = agentConfig?.["claude-code"] ?? undefined;
    const generated = transformAgent(agent, platformConfig);
    if (generated) results.push(generated);
  }

  return results;
}

// ─── Skills Transform ────────────────────────────────────────────────────────

/**
 * Collect skills for Claude Code. Skills are copied as-is with emoji prefix on directory name.
 */
export async function transformSkills(
  skillsDir: string,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];

  let entries: string[];
  try {
    entries = await readdir(skillsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry === ".gitkeep" || entry === ".DS_Store") continue;
    const skillPath = join(skillsDir, entry);
    const fileStat = await stat(skillPath);
    if (!fileStat.isDirectory()) continue;

    const files = await collectFiles(skillPath);
    for (const file of files) {
      const fullPath = join(skillPath, file);
      const content = await readTextFile(fullPath);
      results.push({
        relativePath: `skills/${brainPrefix(entry)}/${file}`,
        content,
      });
    }
  }

  return results;
}

// ─── Commands Transform ──────────────────────────────────────────────────────

/**
 * Collect commands for Claude Code. Commands are copied as-is with emoji prefix.
 */
export async function transformCommands(
  commandsDir: string,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];

  let entries: string[];
  try {
    entries = await readdir(commandsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md") || entry === ".gitkeep") continue;
    const fullPath = join(commandsDir, entry);
    const content = await readTextFile(fullPath);
    const prefixed = entry.startsWith("\u{1F9E0}-")
      ? entry
      : `${brainPrefix(entry.replace(/\.md$/, ""))}.md`;
    results.push({
      relativePath: `commands/${prefixed}`,
      content,
    });
  }

  return results;
}

// ─── Rules Transform ─────────────────────────────────────────────────────────

/**
 * Transform protocols into Claude Code composable rules (.claude/rules/).
 * Each protocol file becomes a rule file with emoji prefix.
 */
export async function transformProtocols(
  protocolsDir: string,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];

  let entries: string[];
  try {
    entries = await readdir(protocolsDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md") || entry === ".gitkeep") continue;
    const fullPath = join(protocolsDir, entry);
    const content = await readTextFile(fullPath);
    const prefixed = `${brainPrefix(entry.replace(/\.md$/, ""))}.md`;
    results.push({
      relativePath: `rules/${prefixed}`,
      content,
    });
  }

  return results;
}

// ─── Hooks Transform ─────────────────────────────────────────────────────────

/**
 * Generate Claude Code hooks.json from brain.config.json hook mappings
 * and hook script files.
 */
export async function transformHooks(
  hooksDir: string,
  brainConfig: BrainConfig,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];
  const hookEntries = brainConfig.hooks ?? {};

  // Build hooks.json structure
  const hooksJson: Record<string, unknown[]> = {};

  for (const [hookName, toolConfig] of Object.entries(hookEntries)) {
    const ccConfig = toolConfig["claude-code"];
    if (!ccConfig) continue;

    const entry = {
      matcher: ccConfig.matcher ?? "",
      hooks: [
        {
          type: "command",
          command: `\${CLAUDE_PLUGIN_ROOT}/hooks/scripts/${brainPrefix(hookName)}.js`,
          timeout: ccConfig.timeout ?? 10,
        },
      ],
    };

    if (!hooksJson[ccConfig.event]) {
      hooksJson[ccConfig.event] = [];
    }
    hooksJson[ccConfig.event].push(entry);
  }

  if (Object.keys(hooksJson).length > 0) {
    results.push({
      relativePath: "hooks/hooks.json",
      content: JSON.stringify({ hooks: hooksJson }, null, 2) + "\n",
    });
  }

  // Copy hook scripts with emoji prefix
  const scriptsDir = join(hooksDir, "scripts");
  try {
    const scriptEntries = await readdir(scriptsDir);
    for (const entry of scriptEntries) {
      if (entry === ".gitkeep" || entry === ".DS_Store") continue;
      const fullPath = join(scriptsDir, entry);
      const fileStat = await stat(fullPath);
      if (fileStat.isDirectory()) continue;

      const content = await readTextFile(fullPath);
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
 * Transform canonical mcp.json into Claude Code .mcp.json format.
 * Resolves relative paths to absolute paths for the MCP server binary.
 */
export async function transformMcp(
  projectRoot: string,
): Promise<GeneratedFile[]> {
  const results: GeneratedFile[] = [];
  const mcpPath = join(projectRoot, "mcp.json");

  try {
    const raw = await readTextFile(mcpPath);
    const mcpConfig = JSON.parse(raw);

    // Resolve relative paths in args to absolute paths from project root
    if (mcpConfig.mcpServers) {
      for (const server of Object.values(mcpConfig.mcpServers) as Array<{
        args?: string[];
      }>) {
        if (server.args) {
          server.args = server.args.map((arg: string) =>
            arg.startsWith("./") ? join(projectRoot, arg) : arg,
          );
        }
      }
    }

    results.push({
      relativePath: ".mcp.json",
      content: JSON.stringify(mcpConfig, null, 2) + "\n",
    });
  } catch {
    // No mcp.json
  }

  return results;
}

// ─── Plugin Manifest ─────────────────────────────────────────────────────────

/**
 * Generate Claude Code plugin manifest files.
 */
export function generatePluginManifest(): GeneratedFile[] {
  const pluginJson = {
    name: "\u{1F9E0}",
    description: "Brain knowledge graph + workflow mode management",
    author: {
      name: "Peter Kloss",
    },
  };

  return [
    {
      relativePath: ".claude-plugin/plugin.json",
      content: JSON.stringify(pluginJson, null, 2) + "\n",
    },
  ];
}

// ─── Main Transform ──────────────────────────────────────────────────────────

/**
 * Run all Claude Code transforms and return generated files.
 * This is the main entry point called by sync.ts.
 */
export async function transform(
  projectRoot: string,
  brainConfig: BrainConfig,
): Promise<ClaudeCodeOutput> {
  const agentsDir = join(projectRoot, "agents");
  const skillsDir = join(projectRoot, "skills");
  const commandsDir = join(projectRoot, "commands");
  const protocolsDir = join(projectRoot, "protocols");
  const hooksDir = join(projectRoot, "hooks");

  const [agents, skills, commands, rules, hooks, mcp] = await Promise.all([
    transformAgents(agentsDir, brainConfig),
    transformSkills(skillsDir),
    transformCommands(commandsDir),
    transformProtocols(protocolsDir),
    transformHooks(hooksDir, brainConfig),
    transformMcp(projectRoot),
  ]);

  return {
    agents,
    skills,
    commands,
    rules,
    hooks,
    mcp,
    plugin: generatePluginManifest(),
  };
}
