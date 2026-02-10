---
title: ANALYSIS-011-reference-install-comparison
type: note
permalink: analysis/analysis-011-reference-install-comparison
tags:
- analysis
- reference-comparison
- multi-tool
- install
- rjmurillo
- basic-memory
- architecture
---

# ANALYSIS-011 Reference Install Comparison

## Context

Comparison of two reference implementations against Brain's ADR-002 multi-tool architecture: rjmurillo/ai-agents (a multi-tool agent framework with 21 agents) and basicmachines-co/basic-memory (the memory system Brain depends on).

## Reference 1: rjmurillo/ai-agents

### Directory Structure

```text
ai-agents/
  src/
    vs-code-agents/       # Generated VS Code/Copilot agents
    copilot-cli/          # Generated Copilot CLI agents
    claude/               # Generated Claude Code agents
  templates/
    agents/*.shared.md    # Canonical source-of-truth agent definitions
    platforms/            # Platform-specific config (vscode.yaml, copilot-cli.yaml)
    toolsets.yaml         # Named tool collections with per-platform variants
  scripts/               # Validation and utilities
  build/
    Generate-Agents.ps1  # Template-to-platform generation script
  .claude-plugin/        # skill-installer marketplace manifest
  AGENTS.md              # Tool-agnostic instructions (9KB, serves Claude/Copilot/Cortex/Factory)
  CLAUDE.md              # Claude-specific additions (references @AGENTS.md)
```

### Installation Mechanism

Uses skill-installer (rjmurillo/skill-installer), a Python-based universal installer:

- Interactive TUI with Discover/Installed/Marketplaces tabs
- CLI for scriptable automation
- Source registry (sources.json) tracks Git repos containing skills
- Installed registry (installed.json) tracks deployed items
- Dual scope: user-level (home directories) or project-level (repo directories)
- Supports: Claude Code, VS Code, VS Code Insiders, Copilot CLI, Codex, Factory Droid

### Multi-Tool Content Strategy

**Template-based code generation**, NOT runtime adapters:

- Shared templates in `templates/agents/*.shared.md` are the single source of truth
- Platform-specific YAML config in `templates/platforms/` defines per-tool transformations
- `toolsets.yaml` defines named tool groups with per-platform variants (tools_vscode, tools_copilot)
- PowerShell build script (`Generate-Agents.ps1`) transforms templates into platform-specific output in `src/`
- Generated files are committed to git (not .gitignored)

**Key pattern**: `$toolset:editor` expands differently per platform. VS Code gets `vscode` tool, Copilot CLI gets different tools. The toolset system is the adapter layer.

### Tool-Specific vs Tool-Agnostic Content

- AGENTS.md (9KB) is tool-agnostic, serves all platforms
- CLAUDE.md starts with `@AGENTS.md` reference, adds Claude-specific instructions (Task subagent patterns, memory interface hierarchy, skill-first checkpoint)
- Agent body content varies per platform via template generation (handoff syntax: `#runSubagent` for VS Code vs `/agent` for Copilot CLI)

### Strengths

1. Template-based generation with toolset expansion is elegant for multi-platform agent definitions
2. Generated output is committed to git, so users see exactly what each platform gets
3. AGENTS.md as tool-agnostic layer with CLAUDE.md as tool-specific overlay matches the convention
4. skill-installer provides TUI + CLI installation with cross-platform deployment
5. Clear "never edit generated files" rule prevents drift

### Weaknesses

1. Only covers agent definitions and instructions, not hooks, MCP config, or skills
2. PowerShell build script is a single-language dependency (though PowerShell is their project language)
3. No staging/symlink strategy -- skill-installer handles placement directly
4. No hook or MCP config generation
5. Three target platforms (VS Code, Copilot CLI, Claude) -- no Cursor or Gemini

## Reference 2: basicmachines-co/basic-memory

### Directory Structure

```text
basic-memory/
  src/basic_memory/       # Core Python package
  tests/                  # Unit and integration tests
  .claude/                # Claude-specific configuration
  docs/                   # Documentation
  docker-compose files    # Container orchestration
```

### Installation Mechanism

Single command: `uv tool install basic-memory` (or `uvx basic-memory mcp` for direct execution)

- No multi-tool auto-configuration
- Each tool requires manual MCP config editing
- Claude Desktop: edit `claude_desktop_config.json`
- VS Code: edit User Settings JSON or `.vscode/mcp.json`
- No installer TUI or interactive setup

### Multi-Tool Support

Supports Claude Desktop, VS Code, Claude.ai, ChatGPT, Google Gemini, Claude Code, Codex -- all through the same MCP protocol. The MCP server is tool-agnostic; tool-specific differences are only in how the MCP config is placed.

**Key insight**: basic-memory achieves multi-tool support by standardizing on MCP as the protocol layer. There are zero content transforms. The same `basic-memory mcp` command works identically across all tools. The only per-tool variation is the JSON config snippet that tells each tool how to start the MCP server.

### Tool-Specific vs Tool-Agnostic Content

Almost entirely tool-agnostic. The MCP server exposes the same tools (write_note, read_note, search, etc.) to every client. There is no adapter layer because there is nothing to adapt -- the MCP protocol is the universal interface.

### Strengths

1. MCP as universal protocol eliminates per-tool content transforms entirely
2. Single `uv tool install` command for installation
3. Tool-agnostic by design -- same server, same tools, same behavior everywhere
4. Cloud sync extends the model across devices without changing the tool integration pattern
5. Knowledge graph format (Markdown + frontmatter + observations + relations) is human-readable and tool-independent

### Weaknesses

1. No auto-configuration for tools -- manual JSON editing required per tool
2. No installer TUI or interactive setup
3. No hook integration or skill system
4. No agent definitions -- it is purely a memory/knowledge tool, not an agent framework
5. Configuration documentation is scattered across README sections per tool

## Comparison Against Brain ADR-002

### What rjmurillo/ai-agents Does Better

| Area | ai-agents | Brain ADR-002 | Verdict |
|:--|:--|:--|:--|
| Template generation | Shared templates with toolset expansion, PowerShell build script, committed output | Dual TS+Go adapter implementation | ai-agents is simpler. Single build script vs dual implementation. Brain should consider whether committed generated output is better than install-time generation. |
| Tool-agnostic AGENTS.md | 9KB tool-agnostic AGENTS.md + CLAUDE.md overlay | 174KB instructions requiring decomposition | ai-agents kept AGENTS.md small and tool-agnostic from the start. Brain's 174KB decomposition task is a consequence of building Claude-first. |
| Toolset abstraction | `$toolset:name` syntax with per-platform expansion | Tool capability mapping table in adapter | Toolsets are more declarative and composable than Brain's table-based mapping. |
| Installation TUI | skill-installer with TUI (Discover/Installed/Marketplaces) | `huh` v2 multi-select + bubbletea progress | Both have TUI. skill-installer has richer features (source management, marketplace). Brain's is more focused. |

### What Brain ADR-002 Does Better

| Area | Brain ADR-002 | ai-agents | Verdict |
|:--|:--|:--|:--|
| Scope coverage | Agents, skills, commands, hooks, MCP config, instructions, plugin metadata | Agents and instructions only | Brain covers the full extension surface. ai-agents only handles agent definitions. |
| Hook architecture | JS/TS scripts with per-tool event mapping, replacing Go binaries | No hooks | ai-agents has no hook system. Brain's hook architecture is novel. |
| MCP config generation | Template-based MCP config resolved per-tool by adapters | No MCP config handling | Brain auto-generates MCP configs; ai-agents leaves this to users. |
| Staging and uninstall | XDG-compliant staging + manifest tracking + clean uninstall | No staging, no uninstall tracking | Brain's install/uninstall is more robust. |
| Symlink handling | Hybrid strategy (symlink for Claude, copy for Cursor/Gemini) with explicit tool compatibility matrix | Not addressed | Brain explicitly handles the symlink compatibility landscape. |
| Skills portability | Open Agent Skills SKILL.md standard, 28 scripts across 3 languages | Skills distributed via skill-installer but no portability analysis | Brain has analyzed script portability across tools. |

### What Brain Should Adopt from rjmurillo/ai-agents

1. **Committed generated output**: ai-agents commits generated files to git. This means users (and CI) can diff what each platform gets. Brain's install-time-only generation means the output is invisible until install. Consider generating and committing golden output for at least Claude Code.

2. **Toolset abstraction**: The `$toolset:name` syntax is more declarative than Brain's adapter table. Brain's canonical schema has `tools: [mcp, file_read, file_edit, terminal]` which is close, but the toolset expansion pattern is more composable.

3. **Small, tool-agnostic AGENTS.md**: ai-agents kept AGENTS.md at 9KB and tool-agnostic. Brain should aim for a similar separation: small universal AGENTS.md + tool-specific extensions. The 174KB decomposition reinforces this.

4. **`@AGENTS.md` reference pattern**: CLAUDE.md starts with `@AGENTS.md` to pull in the shared instructions. Simple and effective.

### What Brain Should Adopt from basic-memory

1. **MCP as universal protocol**: basic-memory proves that MCP eliminates per-tool content transforms for server-side tools. Brain's MCP server (apps/mcp/) already works this way. The insight is: maximize what goes through MCP (no per-tool adaptation needed) and minimize what requires per-tool file placement (agents, instructions, hooks -- which DO need adaptation).

2. **`uvx` pattern for zero-install MCP**: `uvx basic-memory mcp` runs the MCP server without installation. Brain could offer a similar pattern for its MCP server if the TS MCP server were published to npm (`npx brain-mcp`).

### Gaps in Brain's Plan That These Repos Solve

1. **No gap from basic-memory**: basic-memory's approach (manual per-tool config editing) is actually less sophisticated than Brain's auto-configuration via `brain install`. Brain is ahead here.

2. **Template generation pattern (from ai-agents)**: Brain's dual TS+Go adapter approach is more complex than ai-agents' single PowerShell build script. The open question (DECISION-2 in ADR-002) about dual vs single adapter implementation is relevant -- ai-agents demonstrates that a single-language build script works well.

3. **Source registry (from skill-installer)**: skill-installer's source registry (tracking Git repos as skill sources) is a pattern Brain doesn't have. If Brain wants to support third-party skills or community agents, a source registry would be needed.

## Key Architectural Insights

### Spectrum of Multi-Tool Approaches

The three projects represent a spectrum:

| Project | Approach | Complexity | Coverage |
|:--|:--|:--|:--|
| basic-memory | Protocol-level universality (MCP) | Lowest | MCP tools only |
| ai-agents | Build-time generation from templates | Medium | Agent definitions + instructions |
| Brain ADR-002 | Install-time adaptation via dual adapters | Highest | Full extension surface (agents, skills, hooks, MCP, instructions) |

Brain's higher complexity is justified by its broader scope (hooks, MCP config, skills, full instruction system) that the other projects don't address. But the complexity risk flagged in ANALYSIS-008 remains: simpler approaches succeed more often.

### Template Generation vs Runtime Adaptation

ai-agents generates platform-specific files at build time (PowerShell script) and commits them. Brain generates at install time (Go adapter on user's machine). Trade-offs:

| Factor | Build-time (ai-agents) | Install-time (Brain) |
|:--|:--|:--|
| Visibility | Users see generated output in git | Output only exists after `brain install` |
| Dependencies | Build script runs in dev environment | Go adapter runs on user's machine (no Node.js needed) |
| Freshness | Must rebuild when templates change | Always generates from latest canonical content |
| Testing | Easy -- diff committed output | Must run adapter to see output |
| User trust | Can inspect before installing | Must trust adapter logic |

Brain's install-time approach is justified for user-specific content (MCP paths, staging paths) but ai-agents' build-time approach is better for reviewable content (agent definitions, instructions).

### MCP as Escape Hatch

basic-memory demonstrates that anything exposed via MCP needs zero per-tool adaptation. Brain should maximize its MCP surface to reduce adapter complexity. Content that can be served via MCP (memory, search, knowledge graph) does not need per-tool file placement.

## Observations

- [fact] rjmurillo/ai-agents uses template-based generation (PowerShell) with committed output for 3 platforms #pattern
- [fact] ai-agents toolsets.yaml provides declarative per-platform tool expansion via $toolset:name syntax #pattern
- [fact] ai-agents AGENTS.md is 9KB and tool-agnostic; CLAUDE.md adds Claude-specific overlay via @AGENTS.md reference #pattern
- [fact] ai-agents uses skill-installer (Python) with TUI for cross-platform deployment of agent definitions #install
- [fact] basic-memory uses MCP protocol as universal interface requiring zero content transforms across 7+ tools #pattern
- [fact] basic-memory has no auto-configuration; each tool requires manual MCP JSON config editing #gap
- [fact] basic-memory uses uv/uvx for zero-friction installation and MCP server execution #install
- [insight] Build-time generation with committed output provides visibility that install-time adaptation lacks #tradeoff
- [insight] MCP protocol eliminates per-tool adaptation for server-side tools; Brain should maximize MCP surface #architecture
- [insight] Brain's broader scope (hooks, MCP config, skills, instructions) justifies higher complexity than either reference #scope
- [decision] Brain should consider committed golden output for reviewable content (agent definitions, instructions) alongside install-time generation for user-specific content (paths, staging) #recommendation

## Relations

- relates_to [[ANALYSIS-008-community-validation-research]]
- relates_to [[ANALYSIS-006-multi-tool-compatibility-research]]
- relates_to [[ANALYSIS-007-install-staging-strategy-research]]
- implements [[ADR-002-multi-tool-compatibility-architecture]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
