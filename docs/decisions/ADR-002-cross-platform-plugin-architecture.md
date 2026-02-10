---
title: ADR-002-cross-platform-plugin-architecture
type: decision
permalink: decisions/adr-002-cross-platform-plugin-architecture
tags:
- architecture
- multi-tool
- cross-platform
- cursor
- plugin
- adapters
---

# ADR-002: Cross-Platform Plugin Architecture

## Status

**PROPOSED** (2026-02-10)

Replaces ADR-002 revisions 1-5. Clean rewrite based on cross-platform proposal + consolidated research (ANALYSIS-008 through ANALYSIS-014) + codebase audit (ANALYSIS-009, ANALYSIS-010) + user decisions from session 2026-02-09/10.

## Context

Brain is a Claude Code plugin with tight coupling between content (agents, skills, commands, instructions) and the Claude Code installation mechanism in `apps/claude-plugin/`. The AI coding tool landscape has converged: Claude Code and Cursor now support nearly identical extensibility primitives. 85% of Brain's content is already portable or trivially portable.

### Feature Matrix (Verified Feb 2026)

| Feature | Claude Code | Cursor | Format Compatible? |
|:--|:--|:--|:--|
| Commands | `.claude/commands/*.md` | `.cursor/commands/*.md` | Identical format |
| Skills | `.claude/skills/*/SKILL.md` | `.cursor/skills/*/SKILL.md` | Identical format (Open Agent Skills) |
| Agents | `.claude/agents/*.md` | `.cursor/agents/*.md` | Similar but frontmatter differs |
| MCP Config | `.claude/mcp.json` | `.cursor/mcp.json` | Identical `mcpServers` schema |
| Hooks | `settings.json` hooks section | `.cursor/hooks.json` | Different event names + file location |
| Project Rules | `CLAUDE.md` (auto-loaded) | `.cursor/rules/*.mdc` | Different format and mechanism |
| Global Config | `~/.claude/` | `~/.cursor/` | Same pattern, different dir |

### Scope

**In scope**: Claude Code, Cursor IDE/CLI.

**Descoped**: Gemini CLI. Gemini has the most divergence (TOML commands, no symlinks, no parallel agents, no SessionStart hook equivalent). Descoped to contain risk. Re-evaluate when Gemini's extension model stabilizes.

**Deferred**: Codex CLI. Minimal extensibility surface (1 hook event, no native parallel, no agent definitions beyond AGENTS.md).

### Current State (from ANALYSIS-009 Codebase Audit)

| Category | Count | Size | Claude-Specific Refs |
|:--|:--|:--|:--|
| Agents | 25 `.md` files | 560KB (14,911 lines) | 298 API refs across 22 agents |
| Skills | 27 SKILL.md + 28 scripts (14 PS1, 10 PY, 4 TS) | 14MB | Minimal (SKILL.md is tool-neutral) |
| Commands | 9 `.md` files | 60KB | Session/mode refs |
| Instructions | AGENTS.md + _AGENTS.md + 3 protocols | 174KB | Deeply Claude-specific |
| Go binaries | brain-hooks (8 cmds, 3,673 LOC) + brain-skills (3 cmds, 627 LOC) | 8.6MB | Hook entry points |
| Metadata | plugin.json, .mcp.json, hooks.json | <2KB | Claude Code format |

## Decision

### 1. Root-Level Canonical Content

All tool-agnostic content lives at the repository root. This follows the community pattern (AGENTS.md standard: 60,000+ projects, Vercel Skills CLI: 40+ tools).

```text
brain/
  agents/                    # Canonical agent definitions
    orchestrator-claude.md   # Claude Code orchestrator (Agent Teams)
    orchestrator-cursor.md   # Cursor orchestrator (Task tool hub-and-spoke)
    architect.md             # Shared specialist (portable)
    implementer.md           # Shared specialist (portable)
    ...
  skills/                    # Canonical skills (Open Agent Skills standard)
  commands/                  # Canonical slash commands (Markdown)
  protocols/                 # Instruction/protocol content
  hooks/
    scripts/                 # Shared JS/TS hook logic
      normalize.ts           # Platform detection + event normalization shim
      session-lifecycle.ts   # Session start/end, validation
      user-prompt.ts         # Prompt processing, scenario detection
      pre-tool-use.ts        # Tool gating, mode enforcement
      stop-validator.ts      # Session validation before stop
      skill-loader.ts        # Skill discovery and loading
      analyze.ts             # Step-by-step analysis workflow
    claude-code.json         # Generated: CC hooks config
    cursor.json              # Generated: Cursor hooks.json
  apps/mcp/                  # Unchanged (MCP server)
  apps/tui/                  # Go CLI with built-in adapter transforms
    internal/adapters/       # Go adapters (install-time transforms)
      claude_code.go         # CC-specific transforms
      cursor.go              # Cursor-specific transforms
      shared.go              # Shared transform utilities
      adapters_test.go       # Golden file snapshot tests
  mcp.json                   # Canonical MCP server config
  AGENTS.md                  # Canonical project rules (cross-platform)
  brain.config.json          # Declarative per-agent, per-tool mapping
```

### 2. Install Architecture

A unified `brain install` command using charmbracelet/huh v2 multiselect + bubbletea inline progress. Per-tool strategy is internal to the install command:

- **Claude Code**: Installed as a PLUGIN. Symlinks from canonical content to `~/.claude/` (proven pattern, current approach).
- **Cursor**: Installed as FILE SYNC. Copies transformed files to `.cursor/` (symlinks broken as of Feb 2026, Cursor team fix "in the pipe" with no ETA).

```text
brain install
  -> huh multi-select: [Claude Code, Cursor]
  -> huh confirm: "Install Brain for: Claude Code, Cursor?"
  -> bubbletea inline: progress per tool
     -> Go adapters: transform canonical content to tool-specific format
     -> Claude Code: symlink to ~/.claude/
     -> Cursor: copy to .cursor/
  -> Summary: installed/skipped/failed

brain uninstall
  -> huh multi-select: select tools to uninstall
  -> Remove installed files (symlinks or copies)
  -> Summary
```

Transforms are **Go adapters** in `apps/tui/internal/adapters/`. Adapters are CLI concerns (install-time transforms like frontmatter injection, file placement, JSON merge) and belong in Go where the entire CLI lives. No bun subprocess needed at install time. Having 4 TS files that Go shells out to is inconsistent when the CLI is Go and the transform logic is straightforward.

### 3. Orchestrator Strategy: Two Versions

Two orchestrator agents, same specialist agents underneath.

**Claude Code orchestrator** (`agents/orchestrator-claude.md`): Uses Agent Teams. Spawns teammates, manages shared task list, uses SendMessage for inter-agent messaging, supports debate/challenge patterns. Agent Teams is Brain's unique differentiator -- no other tool provides any-to-any inter-agent messaging.

**Cursor orchestrator** (`agents/orchestrator-cursor.md`): Uses standard hub-and-spoke pattern via Task tool. Parent spawns background subagents (`is_background: true`), reads results when complete. No inter-subagent messaging (Cursor limitation). No shared task list (Cursor limitation). Simpler but effective for parallel execution.

**Specialist agents** (architect, implementer, analyst, qa, etc.): Identical across both tools. The body content is tool-neutral. Only frontmatter differs (Claude Code adds `model`, `allowed_tools`, `memory`, `color`; Cursor adds `description`).

### 4. Agent Transformation

Canonical agents have minimal frontmatter. Tool-specific values live in `brain.config.json`.

**Canonical** (`agents/architect.md`):

```markdown
# Architect Agent

You are a software architect focused on system design and technical decisions.
[...tool-neutral instructions...]

## Skills
- coding-workflow
```

**Generated for Claude Code** (`.claude/agents/architect.md`):

```yaml
---
name: architect
model: opus
allowed_tools: Read, Grep, Glob, WebSearch, WebFetch
skills:
  - coding-workflow
---
# Architect Agent
[...identical body content...]
```

**Generated for Cursor** (`.cursor/agents/architect.md`):

```yaml
---
description: "Software architect for system design, technical decisions, ADRs, and design reviews."
---
# Architect Agent
[...identical body content...]
```

### 5. brain.config.json

Declarative per-agent, per-tool mapping. No abstract "model tiers" -- just explicit values.

```json
{
  "targets": ["claude-code", "cursor"],
  "agents": {
    "architect": {
      "claude-code": { "model": "opus", "allowed_tools": ["Read", "Grep", "Glob", "WebSearch"] },
      "cursor": { "description": "Software architect for design decisions and ADRs" }
    },
    "implementer": {
      "claude-code": { "model": "sonnet", "allowed_tools": ["Read", "Write", "Edit", "Bash"] },
      "cursor": { "description": "Implementation agent for writing and modifying code" }
    },
    "orchestrator-claude": {
      "claude-code": { "model": "opus", "allowed_tools": ["Read", "Grep", "Glob", "Bash", "TaskCreate", "SendMessage"] },
      "cursor": null
    },
    "orchestrator-cursor": {
      "claude-code": null,
      "cursor": { "description": "Central coordinator for multi-agent workflows" }
    }
  },
  "hooks": {
    "stop-validator": {
      "claude-code": { "event": "Stop" },
      "cursor": { "event": "stop" }
    },
    "session-lifecycle": {
      "claude-code": { "event": "SessionStart" },
      "cursor": null
    },
    "user-prompt": {
      "claude-code": { "event": "UserPromptSubmit" },
      "cursor": { "event": "beforeSubmitPrompt" }
    }
  }
}
```

Agents with `null` for a tool are skipped during that tool's install. This is how tool-specific orchestrators are handled cleanly.

### 6. Hook Architecture

JS/TS scripts with a normalization layer replace the Go brain-hooks binary (3,673 LOC) and brain-skills binary (627 LOC).

**Hook Event Mapping**:

| Claude Code | Cursor | Normalized Event | Can Block? |
|:--|:--|:--|:--|
| `UserPromptSubmit` | `beforeSubmitPrompt` | `prompt-submit` | CC: Yes, Cursor: No |
| `PreToolUse` (Bash) | `beforeShellExecution` | `before-shell` | Both: Yes |
| `PreToolUse` (MCP) | `beforeMCPExecution` | `before-mcp` | Both: Yes |
| `PostToolUse` (Write/Edit) | `afterFileEdit` | `after-edit` | Neither |
| `Stop` | `stop` | `stop` | CC: Yes, Cursor: No |
| `SessionStart` | -- | `session-start` | N/A |
| `Notification` | -- | `notification` | N/A |
| `SubagentStop` | -- | `subagent-stop` | N/A |
| -- | `beforeReadFile` | `before-read` | Cursor only |

**Normalization shim** (`hooks/scripts/normalize.ts`):

```typescript
interface NormalizedHookEvent {
  platform: 'claude-code' | 'cursor';
  event: string;
  sessionId: string;
  workspaceRoot: string;
  payload: Record<string, unknown>;
}
```

Each hook script imports the normalizer, then runs platform-agnostic logic. Per-tool JSON configs (`claude-code.json`, `cursor.json`) map tool-specific event names to the shared scripts. Hooks with no Cursor equivalent (SessionStart, Notification, SubagentStop) are Claude Code-only; the Cursor adapter skips them.

**Go binary porting scope**: brain-hooks has 8 subcommands (session-start, user-prompt, pre-tool-use, stop, detect-scenario, load-skills, analyze, validate-session) with 3,673 LOC source + 2,669 LOC tests. brain-skills has 3 subcommands (incoherence, decision-critic, fix-fences) with 627 LOC, each with Python equivalents already in skills/. brain-hooks also imports `packages/utils` and `packages/validation` which need TS equivalents.

### 7. Protocols Migration

The current 174KB of instructions/protocols is deeply Claude Code-specific. Strategy:

- **`protocols/` at root**: Contains tool-neutral content (agent personas, workflow patterns, quality standards, memory architecture). This is the canonical source.
- **`AGENTS.md` at root**: Generated from `protocols/` + Claude Code-specific sections. Claude Code reads this natively. Symlinked to `CLAUDE.md` if needed.
- **Cursor**: Adapter generates `.cursor/rules/*.mdc` from `protocols/` content + Cursor-specific sections.
- **Tool-specific content** (Agent Teams APIs, tool paths, MCP tool names) handled by adapter injection at install time.

### 8. What Stays Platform-Specific

Not worth abstracting:

- **Claude Code Agent Teams**: Cursor uses git worktrees for file-isolated parallelism -- fundamentally different model. Two orchestrators, not one unified abstraction.
- **Cursor Custom Modes**: UI-configured, no file equivalent in Claude Code. Cursor-specific bonus.
- **Claude Code plugin manifest**: `.claude-plugin/plugin.json` is CC-only distribution. Cursor has no equivalent packaging.
- **Cursor `beforeReadFile` hook**: No CC equivalent. Cursor-specific security bonus.
- **Cursor git worktrees**: Up to 20 parallel file-isolated agents. Brain Agent Teams shares workspace. No unification needed.

## Migration Strategy

### Phase 1: Extract and Canonicalize (Foundation)

- Move agent markdown from `apps/claude-plugin/agents/` to root `agents/`
- Audit and split agent content: tool-neutral body stays canonical, Claude-specific content (298 API refs across 22 agents) goes into Claude Code orchestrator or adapter injection
- Create two orchestrator agents (Claude Code Agent Teams + Cursor hub-and-spoke)
- Move skills to root `skills/` (zero transforms needed)
- Move commands to root `commands/` (zero transforms needed)
- Extract protocols to root `protocols/`, separate tool-neutral from tool-specific content
- Port brain-hooks Go binary to JS/TS hook scripts (8 subcommands, 3,673 LOC + 2,669 LOC tests)
- Port or consolidate brain-skills Go binary (3 subcommands with Python equivalents)
- Port Go shared packages (packages/utils, packages/validation) to TS equivalents
- Create `brain.config.json` with per-agent, per-tool mapping
- Create Go adapters in `apps/tui/internal/adapters/` (claude_code.go, shared.go)
- Implement `brain install` and `brain uninstall` commands (Go CLI with built-in adapter transforms)
- Validate: everything still works identically in Claude Code
- Remove `apps/claude-plugin/` entirely

### Phase 2: Add Cursor Target

- Create Cursor Go adapter (`apps/tui/internal/adapters/cursor.go`)
- Write agent frontmatter transformer for Cursor format
- Generate `.cursor/rules/*.mdc` from protocols
- Generate `.cursor/hooks.json` from hook config
- Extend `brain install` for Cursor target
- Implement `brain cursor` launch wrapper
- Test in Cursor: agents load, skills discovered, MCP tools available, hooks fire

### Phase 3: Hook Normalization

- Build the normalize.ts stdin JSON shim
- Refactor hook scripts to use normalized events
- Generate both Claude Code hooks config and `.cursor/hooks.json`
- Test: stop-validator works in both, user-prompt processing works in both
- Add CI validation (golden file snapshots for adapter output)
- Hooks with no Cursor equivalent (SessionStart, Notification, SubagentStop) are Claude Code-only; Cursor adapter skips them

## Alternatives Considered

### A. Three-Tool Simultaneous Support (ADR-002 r1-r4)

Support Claude Code + Cursor + Gemini CLI from Phase 1. **Rejected**: Gemini has the most divergence (TOML commands, blocked symlinks, no parallel, missing hook events). Adding Gemini triples the adapter surface for a tool with the smallest user base. Descoped to contain risk.

### B. TypeScript-Only Adapters (ADR-002 r6 initial decision)

TS adapters at root `adapters/` directory with Go CLI shelling out to bun at install time. **Reversed**: adapters are CLI concerns (install-time transforms), not runtime concerns. Having 4 TS files that Go shells out to is inconsistent when the entire CLI is Go. The transform logic (frontmatter injection, file placement, JSON merge) is straightforward Go. Users needing bun for MCP server does not justify adding a bun subprocess dependency to the install path. Go adapters in `apps/tui/internal/adapters/` are simpler and self-contained.

### C. XDG Staging Directory (ADR-002 r3)

Staging at `~/.local/share/brain/plugins/{tool}/` with manifest tracking. **Replaced**: The install command writes directly to each tool's config directory. Claude Code via symlinks, Cursor via file copy. Simpler than intermediate staging.

### D. Canonical Frontmatter Schema with Model Tiers (ADR-002 r5)

Abstract model tiers (default/large/fast) mapped by adapters to tool-specific model IDs. **Replaced**: `brain.config.json` stores explicit per-agent, per-tool values. No abstraction layer -- direct, readable, maintainable.

### E. Agent Overlay Mechanism (ADR-002 r5)

`agents/overlays/{tool}/` directory with per-tool body content appended by adapters. **Replaced**: Most agents (14 of 25) need no tool-specific content. The 11 that do are handled by: (a) two orchestrator files (tool-specific by nature), (b) adapter injection of tool-specific frontmatter from brain.config.json, (c) moving Claude-specific API references to protocols where they belong.

## Consequences

### Good

- 85% of content needs zero transformation (skills, commands, MCP config)
- Single install command with per-tool strategy hidden behind `brain install`
- Two orchestrators match each tool's native parallel execution model
- Hook normalization makes logic portable while respecting tool differences
- Go adapters in CLI eliminate bun subprocess dependency for install; adapters are self-contained CLI concerns
- Community-aligned (root-level content, Open Agent Skills, AGENTS.md standard)
- Dramatically simpler than ADR-002 r5 (which estimated 120-176h; this approach is closer to 60-90h)

### Bad

- Go binary porting (brain-hooks + brain-skills) remains nontrivial (4,300 LOC + 2,669 LOC tests + shared packages)
- Instructions decomposition (174KB) requires content analysis
- Clean break: old commands and paths stop working immediately
- Two orchestrator files to maintain instead of one with adapter transforms

### Neutral

- MCP server (`apps/mcp/`) unchanged
- Go CLI (`apps/tui/`) gains install commands (shells out to bun for transforms)
- Gemini support deferred, not abandoned

## Observations

- [decision] Scope limited to Claude Code + Cursor; Gemini descoped to contain risk #scope
- [decision] Unified brain install with per-tool strategy: Claude Code as plugin (symlinks), Cursor as file sync (copies) #install
- [decision] Two orchestrator agents: Agent Teams for Claude Code, Task tool hub-and-spoke for Cursor #orchestrator
- [decision] Specialist agents are portable; only frontmatter differs across tools #agents
- [decision] brain.config.json with explicit per-agent per-tool values replaces abstract canonical schema #config
- [decision] Hook normalization shim (normalize.ts) for platform-agnostic hook logic #hooks
- [decision] Hooks stay as hooks with normalization layer; no MCP migration for hook logic #hooks
- [decision] Clean break from apps/claude-plugin/ -- no backward compatibility #clean-break
- [decision] Go adapters in apps/tui/internal/adapters/; no bun subprocess for install. Adapters are CLI concerns (install-time transforms) and belong in Go where the CLI lives #adapters
- [decision] protocols/ at root for tool-neutral content; AGENTS.md generated from protocols + tool-specific injection #protocols
- [fact] 85% of Brain content needs zero transformation (skills, commands, MCP config are format-identical) #portability
- [fact] AGENTS.md standard has 60,000+ project adoption; Vercel Skills CLI supports 40+ tools #ecosystem
- [fact] 22 of 25 agents contain Claude Code-specific refs (298 total); orchestrator has 85 refs across 2,312 lines #audit
- [fact] brain-hooks: 8 subcommands, 3,673 LOC + 2,669 LOC tests; brain-skills: 3 subcommands, 627 LOC #audit
- [fact] Instructions/protocols: 174KB across 5 files, deeply Claude-specific #audit
- [fact] Cursor subagents support true parallel via background mode; worktrees support file-isolated parallel (max 20) #cursor
- [fact] Brain Agent Teams has inter-agent messaging that no other tool provides -- unique differentiator #differentiation
- [fact] Cursor symlinks broken as of Feb 2026; file copy required #blocker
- [risk] Go binary porting scope includes shared package dependencies (packages/utils, packages/validation) #porting
- [decision] Reversed TS-only adapter decision: adapters are CLI concerns (install-time transforms) not runtime concerns; Go is the right language for CLI internals #adapters #reversal
- [risk] Hook normalization must handle different blocking semantics (CC Stop blocks, Cursor stop is info-only) #hooks
- [insight] Ecosystem consensus is "simplicity wins" -- Brain's adapter complexity must justify itself against convergence #convergence
- [insight] Hooks with no Cursor equivalent (SessionStart, Notification, SubagentStop) remain Claude Code-only; Cursor adapter skips them #hooks

## Relations

- supersedes [[ADR-002-multi-tool-compatibility-architecture]] (all revisions)
- implements [[ANALYSIS-006-multi-tool-compatibility-research]]
- incorporates [[ANALYSIS-008-community-validation-research]]
- incorporates [[ANALYSIS-009-codebase-gap-audit]]
- incorporates [[ANALYSIS-010 Consolidated Validation Brief]]
- incorporates [[ANALYSIS-011-install-pattern-research]]
- incorporates [[ANALYSIS-012-cursor-orchestrator-research]]
- incorporates [[ANALYSIS-013-mcp-orchestration-research]]
- incorporates [[ANALYSIS-014-orchestrator-comparison]]
- extends [[ADR-001-feature-workflow]]
- relates_to [[Brain CLI Architecture]]
- relates_to [[FEAT-001 Multi-Tool Compatibility]]

## Security Considerations

- [security] Hook scripts execute in the tool's runtime with the tool's permissions. No elevation. Scripts are linted and reviewed like application code #hook-trust
- [security] MCP server runs as stdio subprocess. No network exposure. Tool-specific MCP configs point to same local server binary #mcp-trust
- [security] No credentials in canonical content or generated output; auth handled by each tool's native credential management #separation
- [security] Cursor file copy (not symlink) avoids TOCTOU race conditions inherent in symlink-based installs #cursor-security

## Reversibility

- [reversibility] LOW RISK -- content extraction is additive (root dirs created, old dir removed but recoverable from git) #assessment
- [reversibility] apps/claude-plugin/ removal is reversible from git history #isolation
- [reversibility] Two-orchestrator approach is independently reversible -- either can be removed without affecting the other #orchestrator
- [reversibility] Hook normalization layer is removable -- scripts can be made tool-specific again if normalization proves too complex #hooks

## Addendum: Naming Convention and Install Conflict Strategy (Session Decision)

### Brain Emoji Prefix Convention

ALL Brain content uses the `🧠` prefix universally:

| Content Type | Pattern | Example |
|:--|:--|:--|
| Skills | `🧠-{name}/SKILL.md` | `🧠-memory/SKILL.md` |
| Agents | `🧠-{name}.md` | `🧠-orchestrator.md` |
| Commands | `🧠-{name}.md` | `🧠-start-session.md` |
| Rules | `🧠-{name}.md` | `🧠-memory-architecture.md` |
| Hook scripts | `🧠-{name}.js` | `🧠-stop-validator.js` |

This makes Brain content immediately identifiable in any tool's `/` listing. Tools that don't support emoji in filenames will be handled per-tool as they arise.

### Non-Destructive Install via Composable Rules

Brain NEVER modifies user's existing CLAUDE.md, AGENTS.md, hooks config, or MCP config.

**Claude Code**: Plugin system handles isolation. Plugin agents, skills, commands, hooks, and MCP are namespaced automatically. Instructions delivered via `.claude/rules/🧠-*.md` (auto-loaded, composable).

**Cursor**: No plugin system. Brain installs via direct file placement:

- Rules: `.cursor/rules/🧠-*.mdc`
- Agents: `.cursor/agents/🧠-*.md`
- Skills: `.cursor/skills/🧠-*/SKILL.md`
- Commands: `.cursor/commands/🧠-*.md`
- Hooks: JSON merge into `.cursor/hooks.json` with manifest tracking for clean uninstall
- MCP: JSON merge into `.cursor/mcp.json` with manifest tracking

### Composable Rules Architecture

Instructions are decomposed into individual rule files (not monolithic AGENTS.md). Shared rules + tool-specific overrides composed at install/sync time. Template variables handle terminology differences ({worker}, {delegate_cmd}, {sequence_model}).

See DESIGN-005-composable-orchestrator-rules for full design.

### Observations

- [decision] All Brain content uses 🧠 prefix universally #naming #nonnegotiable
- [decision] Never modify user's existing instruction, hook, or MCP files #non-destructive
- [decision] Claude Code uses plugin isolation; Cursor uses 🧠-prefixed file placement + JSON merge with manifest #per-tool
- [decision] Instructions delivered as composable rules, not monolithic AGENTS.md #composable
