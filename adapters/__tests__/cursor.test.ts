/** Create a unique temp directory using Bun shell. */
async function makeTempDir(prefix: string): Promise<string> {
  const dir = `${prefix}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await Bun.$`mkdir -p ${dir}`.quiet();
  return dir;
}
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { transform, transformAgent } from "../cursor.js";
import type { BrainConfig, CanonicalAgent } from "../shared.js";

describe("transformAgent (Cursor)", () => {
  it("returns null for null config (skipped agent)", () => {
    const agent: CanonicalAgent = {
      name: "orchestrator-claude",
      body: "# Claude Orchestrator",
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

  it("generates .mdc rule with description-only frontmatter", () => {
    const agent: CanonicalAgent = {
      name: "architect",
      body: "# Architect Agent\n\nYou are a software architect.",
      frontmatter: {},
    };

    const result = transformAgent(agent, {
      description: "System design governance and ADR documentation",
    });

    expect(result).not.toBeNull();
    expect(result!.relativePath).toBe("rules/\u{1F9E0}-architect.mdc");
    expect(result!.content).toContain(
      "description: System design governance and ADR documentation",
    );
    expect(result!.content).toContain("# Architect Agent");
    expect(result!.content).toContain("You are a software architect.");
    // Should NOT contain Claude Code-specific fields
    expect(result!.content).not.toContain("model:");
    expect(result!.content).not.toContain("memory:");
    expect(result!.content).not.toContain("color:");
    expect(result!.content).not.toContain("tools:");
  });

  it("handles config with no description", () => {
    const agent: CanonicalAgent = {
      name: "analyst",
      body: "# Analyst",
      frontmatter: {},
    };

    const result = transformAgent(agent, {});

    expect(result).not.toBeNull();
    expect(result!.relativePath).toBe("rules/\u{1F9E0}-analyst.mdc");
    // No frontmatter block when empty
    expect(result!.content).toBe("# Analyst");
  });

  it("ignores Claude Code-specific fields in config", () => {
    const agent: CanonicalAgent = {
      name: "implementer",
      body: "# Implementer",
      frontmatter: {},
    };

    const result = transformAgent(agent, {
      model: "opus",
      description: "Production code implementation",
      memory: "persistent",
      color: "#FF0000",
      allowed_tools: ["Read", "Write"],
      skills: ["memory"],
    });

    expect(result).not.toBeNull();
    expect(result!.content).toContain(
      "description: Production code implementation",
    );
    expect(result!.content).not.toContain("model:");
    expect(result!.content).not.toContain("memory:");
    expect(result!.content).not.toContain("color:");
    expect(result!.content).not.toContain("tools:");
    expect(result!.content).not.toContain("skills:");
  });
});

describe("transform (Cursor integration)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await makeTempDir(join(tmpdir(), "brain-cursor-test-"));
    await Bun.$`mkdir -p ${join(tempDir, "agents")}`.quiet();
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

    // Create protocol
    await Bun.write(
      join(tempDir, "protocols", "memory-architecture.md"),
      "# Memory Architecture\n\nRules for memory.",
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

    const config: BrainConfig = {
      targets: { "cursor": {} },
      agents: {
        architect: {
          cursor: {
            description: "System design governance",
          },
        },
      },
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);

    // Agents as .mdc rules
    expect(output.agents).toHaveLength(1);
    expect(output.agents[0].relativePath).toBe(
      "rules/\u{1F9E0}-architect.mdc",
    );
    expect(output.agents[0].content).toContain(
      "description: System design governance",
    );
    expect(output.agents[0].content).not.toContain("model:");

    // Protocol rules as .mdc
    expect(output.rules).toHaveLength(1);
    expect(output.rules[0].relativePath).toBe(
      "rules/\u{1F9E0}-memory-architecture.mdc",
    );

    // MCP merge payload
    expect(output.mcp).toHaveLength(1);
    expect(output.mcp[0].relativePath).toBe("mcp/mcp.merge.json");
    const mcpPayload = JSON.parse(output.mcp[0].content);
    expect(mcpPayload.managedKeys).toContain("mcpServers.brain");
    expect(mcpPayload.content.mcpServers.brain.args[1]).toBe(
      join(tempDir, "apps/mcp/src/index.ts"),
    );
  });

  it("skips agents with null cursor config", async () => {
    await Bun.write(
      join(tempDir, "agents", "orchestrator-claude.md"),
      "# Claude Orchestrator",
    );

    const config: BrainConfig = {
      targets: { "claude-code": {}, "cursor": {} },
      agents: {
        "orchestrator-claude": {
          "claude-code": {
            model: "opus",
            description: "Claude orchestrator",
          },
          cursor: null,
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

  it("handles agents not in config", async () => {
    await Bun.write(
      join(tempDir, "agents", "unlisted.md"),
      "# Unlisted Agent",
    );

    const config: BrainConfig = {
      targets: { "cursor": {} },
      agents: {},
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);
    expect(output.agents).toHaveLength(0);
  });

  it("produces hooks merge payload with managed keys", async () => {
    const config: BrainConfig = {
      targets: { "cursor": {} },
      agents: {},
      hooks: {
        "stop-validator": {
          cursor: { event: "Stop", timeout: 10 },
        },
      },
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);

    const hooksMerge = output.hooks.find(
      (f) => f.relativePath === "hooks/hooks.merge.json",
    );
    expect(hooksMerge).toBeDefined();

    const payload = JSON.parse(hooksMerge!.content);
    expect(payload.managedKeys).toContain("hooks.Stop");
    expect(payload.content.hooks.Stop).toBeDefined();
    expect(payload.content.hooks.Stop[0].hooks[0].command).toContain(
      "\u{1F9E0}-stop-validator",
    );
  });

  it("does not produce skills, commands, or plugin manifest", async () => {
    const config: BrainConfig = {
      targets: { "cursor": {} },
      agents: {},
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);

    // CursorOutput has no skills, commands, or plugin fields
    expect(output).not.toHaveProperty("skills");
    expect(output).not.toHaveProperty("commands");
    expect(output).not.toHaveProperty("plugin");
  });

  it("handles empty project gracefully", async () => {
    const config: BrainConfig = {
      targets: { "cursor": {} },
      agents: {},
    };
    await Bun.write(
      join(tempDir, "brain.config.json"),
      JSON.stringify(config),
    );

    const output = await transform(tempDir, config);
    expect(output.agents).toHaveLength(0);
    expect(output.rules).toHaveLength(0);
    expect(output.hooks).toHaveLength(0);
    expect(output.mcp).toHaveLength(0);
  });
});
