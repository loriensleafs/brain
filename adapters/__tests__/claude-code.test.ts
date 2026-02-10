/** Create a unique temp directory using Bun shell. */
async function makeTempDir(prefix: string): Promise<string> {
  const dir = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await Bun.$`mkdir -p ${dir}`.quiet();
  return dir;
}
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { transform, transformAgent } from "../claude-code.js";
import type { BrainConfig, CanonicalAgent } from "../shared.js";

describe("transformAgent", () => {
  it("returns null for null config (skipped agent)", () => {
    const agent: CanonicalAgent = {
      name: "orchestrator-cursor",
      body: "# Cursor Orchestrator",
      frontmatter: {},
    };
    expect(transformAgent(agent, null)).toBeNull();
  });

  it("returns null for undefined config", () => {
    const agent: CanonicalAgent = {
      name: "unknown",
      body: "# Unknown",
      frontmatter: {},
    };
    expect(transformAgent(agent, undefined)).toBeNull();
  });

  it("generates Claude Code frontmatter from config", () => {
    const agent: CanonicalAgent = {
      name: "architect",
      body: "# Architect Agent\n\nYou are a software architect.",
      frontmatter: {},
    };

    const result = transformAgent(agent, {
      model: "opus",
      allowed_tools: ["Read", "Grep", "Glob"],
      color: "#7B68EE",
      skills: ["memory", "adr-creation"],
    });

    expect(result).not.toBeNull();
    expect(result!.relativePath).toBe("agents/\u{1F9E0}-architect.md");
    expect(result!.content).toContain("name: \u{1F9E0}-architect");
    expect(result!.content).toContain("model: opus");
    expect(result!.content).toContain("color: \"#7B68EE\"");
    expect(result!.content).toContain("  - Read");
    expect(result!.content).toContain("  - Grep");
    expect(result!.content).toContain("  - memory");
    expect(result!.content).toContain("# Architect Agent");
    expect(result!.content).toContain("You are a software architect.");
  });

  it("includes description and argument_hint when present", () => {
    const agent: CanonicalAgent = {
      name: "analyst",
      body: "# Analyst",
      frontmatter: {},
    };

    const result = transformAgent(agent, {
      model: "sonnet",
      description: "Technical investigator",
      argument_hint: "Describe what to investigate",
    });

    expect(result).not.toBeNull();
    expect(result!.content).toContain("description: Technical investigator");
    expect(result!.content).toContain(
      "argument-hint: Describe what to investigate",
    );
  });
});

describe("transform (integration)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir(join(tmpdir(), "brain-adapter-test-"));
    // Create minimal project structure
    await Bun.$`mkdir -p ${join(tempDir, "agents")}`.quiet();
    await Bun.$`mkdir -p ${join(tempDir, "skills", "memory")}`.quiet();
    await Bun.$`mkdir -p ${join(tempDir, "commands")}`.quiet();
    await Bun.$`mkdir -p ${join(tempDir, "protocols")}`.quiet();
    await Bun.$`mkdir -p ${join(tempDir, "hooks", "scripts")}`.quiet();
  });

  afterEach(async () => {
    await Bun.$`rm -rf ${tempDir}`.quiet();
  });

  it("transforms a minimal project", async () => {
    // Create canonical agent
    await Bun.write(
      join(tempDir, "agents", "architect.md"),
      "# Architect Agent\n\nYou design systems.",
    );

    // Create command
    await Bun.write(
      join(tempDir, "commands", "start-session.md"),
      "Start a new session.",
    );

    // Create protocol
    await Bun.write(
      join(tempDir, "protocols", "memory-architecture.md"),
      "# Memory Architecture\n\nRules for memory.",
    );

    // Create skill file
    await Bun.write(
      join(tempDir, "skills", "memory", "SKILL.md"),
      "# Memory Skill\n\nInstructions.",
    );

    // Create mcp.json
    await Bun.write(
      join(tempDir, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          brain: {
            command: "bun",
            args: ["run", "./apps/mcp/src/index.ts"],
            env: { BRAIN_TRANSPORT: "stdio" },
          },
        },
      }),
    );

    // Create brain.config.json
    const config: BrainConfig = {
      targets: ["claude-code"],
      agents: {
        architect: {
          "claude-code": {
            model: "opus",
            allowed_tools: ["Read", "Grep"],
            color: "#7B68EE",
          },
        },
      },
      hooks: {
        "stop-validator": {
          "claude-code": { event: "Stop", timeout: 10 },
        },
      },
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);

    // Agents
    expect(output.agents).toHaveLength(1);
    expect(output.agents[0].relativePath).toBe(
      "agents/\u{1F9E0}-architect.md",
    );
    expect(output.agents[0].content).toContain("model: opus");

    // Skills
    expect(output.skills).toHaveLength(1);
    expect(output.skills[0].relativePath).toBe(
      "skills/\u{1F9E0}-memory/SKILL.md",
    );

    // Commands
    expect(output.commands).toHaveLength(1);
    expect(output.commands[0].relativePath).toBe(
      "commands/\u{1F9E0}-start-session.md",
    );

    // Rules (from protocols)
    expect(output.rules).toHaveLength(1);
    expect(output.rules[0].relativePath).toBe(
      "rules/\u{1F9E0}-memory-architecture.md",
    );

    // Hooks
    const hooksJson = output.hooks.find(
      (f) => f.relativePath === "hooks/hooks.json",
    );
    expect(hooksJson).toBeDefined();
    const parsed = JSON.parse(hooksJson!.content);
    expect(parsed.hooks.Stop).toBeDefined();
    expect(parsed.hooks.Stop[0].hooks[0].command).toContain(
      "\u{1F9E0}-stop-validator",
    );

    // MCP
    expect(output.mcp).toHaveLength(1);
    expect(output.mcp[0].relativePath).toBe(".mcp.json");
    const mcpParsed = JSON.parse(output.mcp[0].content);
    expect(mcpParsed.mcpServers.brain.args[1]).toBe(
      join(tempDir, "apps/mcp/src/index.ts"),
    );

    // Plugin manifest
    expect(output.plugin).toHaveLength(1);
    expect(output.plugin[0].relativePath).toBe(
      ".claude-plugin/plugin.json",
    );
  });

  it("skips agents with null claude-code config", async () => {
    await Bun.write(
      join(tempDir, "agents", "orchestrator-cursor.md"),
      "# Cursor Orchestrator",
    );

    const config: BrainConfig = {
      targets: ["claude-code", "cursor"],
      agents: {
        "orchestrator-cursor": {
          "claude-code": null,
          cursor: { description: "Cursor orchestrator" },
        },
      },
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);
    expect(output.agents).toHaveLength(0);
  });

  it("handles agents not in config (no config entry)", async () => {
    await Bun.write(
      join(tempDir, "agents", "unlisted.md"),
      "# Unlisted Agent",
    );

    const config: BrainConfig = {
      targets: ["claude-code"],
      agents: {},
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);
    // Agent not in config -> no platform config -> skipped
    expect(output.agents).toHaveLength(0);
  });
});
