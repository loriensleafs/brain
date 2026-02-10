---
title: DESIGN-003-install-tui-flow
type: design
status: implemented
feature-ref: FEAT-001
req-refs:
- REQ-004
tags:
- design
- install
- tui
- huh
- bubbletea
permalink: features/feat-001-cross-platform-portability/design/design-003-install-tui-flow
---

# DESIGN-003 Install TUI Flow

## Summary

Interactive install/uninstall using charmbracelet/huh v2 for forms and bubbletea inline for progress.

## Technical Approach

- [decision] huh v2 replaces external gum binary for all interactive prompts #no-external-dep
- [decision] bubbletea inline mode (non-fullscreen) for progress bars #progress

### Install Flow

```text
brain install
  1. Tool detection (config dirs: ~/.claude/, ~/.cursor/)
  2. huh.NewMultiSelect() -> select tools
  3. huh.NewConfirm() -> confirm selection
  4. bubbletea inline -> per-tool progress
     For each tool:
       a. Shell out to bun: run adapters/sync.ts
       b. Claude Code: symlink to ~/.claude/
       c. Cursor: copy to .cursor/
  5. Summary: installed/skipped/failed
```

### Uninstall Flow

```text
brain uninstall
  1. Detect what is installed
  2. huh.NewMultiSelect() -> select tools
  3. huh.NewConfirm() -> confirm
  4. Remove installed files (symlinks or copies)
  5. Summary
```

## Trade-offs Considered

- [decision] huh v2 over gum: same UI, no external binary, same charmbracelet ecosystem #tradeoff
- [decision] Inline bubbletea over fullscreen: user sees output above/below #ux

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- satisfies [[REQ-004-unified-install]]
- traces_to [[ADR-002 Cross-Platform Plugin Architecture]]

## Install Flow

### Install Flow

```text
brain install
  1. Tool detection (config dirs: ~/.claude/, ~/.cursor/)
  2. huh.NewMultiSelect() -> select tools
  3. huh.NewConfirm() -> confirm selection
  4. bubbletea inline -> per-tool progress
     For each tool:
       a. Shell out to bun: run adapters/sync.ts
       b. Claude Code: symlink 🧠-prefixed content to ~/.claude/ (plugin isolation)
          - Instructions delivered via .claude/rules/🧠-*.md (composable, auto-loaded)
          - NEVER modify user's CLAUDE.md, AGENTS.md, hooks, or MCP config
       c. Cursor: copy 🧠-prefixed files to .cursor/
          - Agents: .cursor/agents/🧠-*.md
          - Skills: .cursor/skills/🧠-*/SKILL.md
          - Commands: .cursor/commands/🧠-*.md
          - Rules: .cursor/rules/🧠-*.mdc
          - Hooks: JSON merge into .cursor/hooks.json (manifest tracked)
          - MCP: JSON merge into .cursor/mcp.json (manifest tracked)
          - NEVER overwrite user's existing files
       d. Write install manifest for deterministic uninstall
  5. Summary: installed/skipped/failed
```

Non-destructive guarantee: Brain install NEVER touches user-created files. All Brain content is identifiable by the `🧠` prefix. Cursor JSON configs (hooks.json, mcp.json) use additive JSON merge with manifest tracking so Brain entries can be cleanly removed on uninstall.
