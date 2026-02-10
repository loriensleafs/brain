---
title: ANALYSIS-017-existing-file-conflict-research
type: note
permalink: analysis/analysis-017-existing-file-conflict-research
tags:
- analysis
- install
- conflict-resolution
- cross-platform
- claude-code
---

# ANALYSIS-017 Existing File Conflict Research

## Problem

When Brain installs its plugin into a user's project, it must install instruction files (AGENTS.md, CLAUDE.md, bootstrap command, orchestrator agent), hooks, and MCP server configuration. The user may already have these files with their own content. Brain must not destroy user content. This includes:

1. **Instruction files**: CLAUDE.md, AGENTS.md, rules
2. **Hooks**: `.claude/settings.json` hooks section, plugin hooks
3. **MCP config**: `.claude/mcp.json` or equivalent MCP server definitions

## Research Findings

### Claude Code File Discovery Mechanisms

Claude Code provides multiple non-conflicting mechanisms for loading instructions:

1. **CLAUDE.md files**: Loaded from cwd up the directory tree. Multiple CLAUDE.md files merge (more specific wins). Supports `@path/to/import.md` syntax for importing other files.

2. **`.claude/rules/*.md`**: All markdown files in `.claude/rules/` are automatically loaded with the same priority as CLAUDE.md. No imports needed. Supports subdirectories and glob-based path scoping.

3. **Skills directory**: `.claude/skills/<name>/SKILL.md` provides self-contained instruction sets. Skills are auto-discovered and can be invoked automatically or via `/skill-name`. Plugin skills use `plugin-name:skill-name` namespace, so they cannot conflict.

4. **Agents directory**: `.claude/agents/<name>.md` provides agent definitions. Plugin agents are also namespaced.

5. **Nested CLAUDE.md**: Files in subdirectories load on demand when Claude reads files in that directory.

### How Vercel Skills CLI Handles Installation

Vercel's `npx skills` installs to `.claude/skills/` directory. It does NOT modify CLAUDE.md. Skills are placed in dedicated directories containing SKILL.md files. The CLI uses symlinks (preferred) or copies. No conflict with existing user files because skills use their own namespace.

### AGENTS.md Standard

The AGENTS.md standard uses location-based precedence: nearest AGENTS.md wins, user prompts override everything. No merge mechanism exists. If the user has an AGENTS.md, installing Brain's AGENTS.md would overwrite it.

### Cursor Rules

Cursor uses `.cursor/rules/*.mdc` directory with composable individual files. Multiple rules are merged into context. Priority hierarchy: Team Rules > Project Rules > User Rules > Legacy Rules. This is a composable non-destructive model.

### Gemini Code Assist

Uses GEMINI.md or AGENT.md at project root. Supports hierarchy (global `~/.gemini/GEMINI.md` plus project level). More specific overrides less specific. Also supports `.gemini/styleguide.md` for code review rules.

## Options Analysis

### Option 1: `.claude/rules/` Directory (RECOMMENDED)

**Strategy**: Install Brain instructions as individual rule files in `.claude/rules/brain/`.

```text
.claude/
  rules/
    brain/
      orchestrator-rules.md     # Brain orchestrator instructions
      memory-architecture.md    # Memory protocol
      session-protocol.md       # Session lifecycle
      agent-catalog.md          # Agent/teammate catalog
      boundaries.md             # Constraints and anti-patterns
```

**Pros**:

- Zero conflict with existing CLAUDE.md (rules are additive)
- Composable with user's own rules
- Auto-loaded by Claude Code without imports
- Supports path-scoped activation via frontmatter
- Organized in subdirectory, easy to identify Brain's rules
- User can delete the brain/ subdirectory to uninstall

**Cons**:

- Claude Code specific (no Cursor equivalent for this exact path)
- Rules are always loaded (no lazy loading like nested CLAUDE.md)
- Each rule file adds to context budget

### Option 2: Import Directive in CLAUDE.md

**Strategy**: Add a single `@.claude/brain/AGENTS.md` import line to existing CLAUDE.md.

```markdown
# Existing user CLAUDE.md content...

@.claude/brain/AGENTS.md
```

**Pros**:

- Minimal modification (one line added)
- User sees exactly what was added
- Brain content lives in separate file

**Cons**:

- Requires modifying user's CLAUDE.md (risky)
- If user doesn't have CLAUDE.md, must create it
- Import must be approved on first load (one-time dialog)
- More fragile (user might remove the import line)

### Option 3: Separate Namespace File (`.claude/CLAUDE.md`)

**Strategy**: Install as `.claude/CLAUDE.md` which is loaded alongside root CLAUDE.md.

**Pros**:

- Does not touch root CLAUDE.md
- Auto-loaded by Claude Code

**Cons**:

- `.claude/CLAUDE.md` and `./CLAUDE.md` have the same priority
- If user already has `.claude/CLAUDE.md`, this conflicts
- Only one CLAUDE.md per directory level

### Option 4: Hybrid (Rules + Agents + Skills)

**Strategy**: Distribute Brain content across multiple Claude Code mechanisms:

- Agent definitions: `.claude/agents/orchestrator.md` (already supported)
- Skills: `.claude/skills/brain-*/SKILL.md` (already supported)
- Rules: `.claude/rules/brain/*.md` for instruction content
- No CLAUDE.md modification needed

**Pros**:

- Each file type uses its native mechanism
- Zero conflict
- Most idiomatic to Claude Code

**Cons**:

- Content split across multiple locations
- Harder to understand the full Brain instruction set at a glance

### Option 5: Interactive Prompt During Install

**Strategy**: `brain install` checks for existing files and prompts user:

- "CLAUDE.md already exists. [M]erge Brain instructions / [S]kip / [B]ackup and replace?"

**Pros**:

- User has full control
- Handles all edge cases

**Cons**:

- Requires interactive CLI (blocks CI/CD)
- Merge logic is complex and error-prone
- User must understand the implications

### Cross-Tool Comparison

| Tool | Conflict-Free Mechanism | Notes |
|:--|:--|:--|
| Claude Code | `.claude/rules/`, `.claude/skills/`, `.claude/agents/` | All composable and namespaced |
| Cursor | `.cursor/rules/*.mdc` | Composable individual rule files |
| Gemini | `~/.gemini/GEMINI.md` (global) + project-level | Hierarchy-based override |
| VS Code/Copilot | `.github/copilot-instructions.md` | Single file, no composition |

## Recommendation

**Option 4 (Hybrid)** with **Option 1 (rules/)** as the primary instruction delivery mechanism.

Brain should install:

1. **Agents**: `.claude/agents/orchestrator.md` (and others) -- already works, uses plugin namespace
2. **Skills**: `.claude/skills/brain-*/SKILL.md` -- already works, uses plugin namespace
3. **Rules**: `.claude/rules/brain/*.md` -- Brain-specific instructions split into composable rule files
4. **Commands**: `.claude/commands/*.md` -- already works

This avoids touching CLAUDE.md entirely. All Brain content lives in namespaced subdirectories. The user's own CLAUDE.md, AGENTS.md, and rules remain untouched.

For Cursor: install Brain rules as `.cursor/rules/brain-*.mdc` files (same composable pattern, different directory).

For Gemini: install as `.gemini/brain-rules.md` alongside user's own GEMINI.md.

## Observations

- [decision] Use `.claude/rules/brain/*.md` as primary instruction delivery for Claude Code #non-destructive
- [decision] Never modify user's existing CLAUDE.md or AGENTS.md during install #safety
- [fact] Claude Code `.claude/rules/` files are auto-loaded with same priority as CLAUDE.md #mechanism
- [fact] Vercel skills CLI installs to `.claude/skills/` without touching CLAUDE.md #precedent
- [fact] Cursor uses composable `.cursor/rules/*.mdc` files with merge semantics #cross-tool
- [insight] Each tool has a composable, non-destructive instruction mechanism; Brain should use them all #portability
- [constraint] AGENTS.md standard has no merge mechanism; must avoid overwriting user's AGENTS.md #limitation
- [fact] Claude Code supports `@path/to/import.md` in CLAUDE.md but this requires modifying the file #import

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- relates_to [[DESIGN-005 Composable Orchestrator Rules]]
- relates_to [[ADR-002 Cross-Platform Plugin Architecture]]
- relates_to [[REQ-005 Orchestrator Portability]]

## Hooks Merge Strategy

### How Claude Code Plugin Hooks Work

Claude Code has a built-in plugin hook system that solves the merge problem automatically.

**Plugin hooks file**: `<plugin>/hooks/hooks.json` with an optional `description` field. When a plugin is enabled, **its hooks merge with user and project hooks automatically**. Plugin hooks are labeled `[Plugin]` in the `/hooks` menu and are read-only (the user cannot accidentally modify them).

**Brain's current hooks** (from `apps/claude-plugin/hooks/hooks.json`):

- `UserPromptSubmit`: Runs `brain-hooks user-prompt` on every prompt submission
- `SessionStart`: Runs `brain-hooks session-start` on startup/resume/clear/compact
- `Stop`: Runs `brain-hooks stop` when Claude finishes responding

**Merge behavior**: All matching hooks from all sources (user, project, plugin) run in parallel. They do NOT replace each other. This means Brain's hooks and user's hooks coexist automatically.

### Hook Merge: No Conflict Possible

| Scenario | What Happens |
|:--|:--|
| User has no hooks | Brain's plugin hooks install and run |
| User has hooks on different events | Both run independently (different events, no overlap) |
| User has hooks on same event (e.g., `Stop`) | Both hooks run in parallel. All matching hooks execute. No collision. |
| User has hook on same event with same matcher | Both run in parallel. Identical handlers are deduplicated automatically. |

**Key finding**: Claude Code's hook system is inherently additive. Multiple hooks on the same event ALL execute. There is no last-write-wins or override behavior. Brain's hooks cannot conflict with user hooks.

### Hook Scopes

| Location | Scope | Brain Uses? |
|:--|:--|:--|
| `~/.claude/settings.json` | All user projects | No (user's space) |
| `.claude/settings.json` | Single project | No (user's space) |
| `.claude/settings.local.json` | Single project, gitignored | No (user's space) |
| Plugin `hooks/hooks.json` | When plugin is enabled | YES -- Brain's hooks live here |
| Skill/agent frontmatter | While component is active | Could use for agent-scoped hooks |

**Decision**: Brain hooks live exclusively in `<plugin>/hooks/hooks.json`. Brain never touches `.claude/settings.json`. The plugin hook system handles merge automatically.

### Uninstall

Disabling the Brain plugin removes its hooks. No cleanup script needed. The `/hooks` menu labels plugin hooks as `[Plugin]`, making them easy to identify.

## MCP Config Merge Strategy

### How Claude Code MCP Config Works

MCP servers are configured in `.claude/mcp.json` at the project level or `~/.claude/mcp.json` at the user level.

**Plugin MCP servers**: Plugins define their MCP servers in `<plugin>/.mcp.json`. Brain's current config:

```json
{
  "mcpServers": {
    "brain": {
      "command": "bun",
      "args": ["run", "/Users/peter.kloss/Dev/brain/apps/mcp/src/index.ts"],
      "env": { "BRAIN_TRANSPORT": "stdio" }
    }
  }
}
```

### MCP Config: Plugin Namespace Prevents Conflicts

Like hooks, plugin MCP servers are loaded alongside user MCP servers. The `mcpServers` object is a key-value map where each key is a unique server name. Brain uses the key `"brain"`, which is unlikely to collide with user-defined server names.

| Scenario | What Happens |
|:--|:--|
| User has no MCP servers | Brain's MCP server installs normally |
| User has MCP servers with different names | Both coexist in the merged config (different keys) |
| User has an MCP server named "brain" | Name collision. User's server would conflict. |

### Name Collision Mitigation

The risk of a user having an MCP server named `"brain"` is low but possible. Options:

1. **Use a namespaced key**: `"brain-mcp"` or `"plugin-brain"` instead of `"brain"`. Reduces collision chance.
2. **Check during install**: If the user already has a `"brain"` key in their `.claude/mcp.json`, warn and skip or rename.
3. **Plugin MCP isolation**: Plugin MCP servers are already isolated by the plugin system. The plugin's `.mcp.json` is loaded separately from the user's `.claude/mcp.json`.

**Decision**: Use the plugin's `.mcp.json` (already in place). The plugin system loads it independently. If the user has their own `.claude/mcp.json`, it is not modified.

### Uninstall

Disabling the Brain plugin removes its MCP server. No cleanup script needed.

## Cross-Tool Hook/Config Strategy

| Tool | Hook Mechanism | MCP Config | Conflict Resolution |
|:--|:--|:--|:--|
| Claude Code | Plugin `hooks/hooks.json` (auto-merge) | Plugin `.mcp.json` (auto-isolated) | No conflicts possible via plugin system |
| Cursor | `.cursor/hooks.json` (if supported) | `.cursor/mcp.json` | Needs JSON merge on install |
| Gemini | Not yet supported | MCP supported since Oct 2025 | TBD |
| VS Code/Copilot | No hook system | MCP via settings.json | Needs JSON merge on install |

### For Non-Plugin Tools (Cursor, VS Code)

Where the plugin system does not exist, Brain install must perform JSON merge:

1. **Read** existing config file (e.g., `.cursor/mcp.json`)
2. **Parse** as JSON
3. **Add** Brain's entries under a namespaced key (e.g., `"brain"` in `mcpServers`)
4. **Write** merged JSON back
5. **Record** what was added (e.g., in `.brain/install-manifest.json`) for clean uninstall

**Uninstall**: Read the install manifest, remove only Brain's entries from the config, write back.

### Install Manifest

```json
{
  "version": 1,
  "installed_at": "2026-02-10T01:00:00Z",
  "entries": {
    ".cursor/mcp.json": {
      "mcpServers": ["brain"]
    },
    ".cursor/rules/": {
      "files": ["brain-orchestrator.mdc", "brain-memory.mdc"]
    }
  }
}
```

The manifest tracks exactly what Brain added, enabling clean removal without affecting user content.

## Updated Observations

- [decision] Plugin hooks auto-merge with user hooks; Brain never touches .claude/settings.json #hooks
- [fact] Claude Code hook system is inherently additive; multiple hooks on same event all execute in parallel #no-conflict
- [decision] Plugin .mcp.json is loaded independently from user's .claude/mcp.json; no merge needed #mcp
- [fact] For non-plugin tools (Cursor, VS Code), JSON merge with install manifest enables clean install/uninstall #cross-tool
- [insight] The Claude Code plugin system solves hooks and MCP conflicts by design; no merge logic needed for plugin-based install #architecture
