---
title: TASK-011-implement-brain-install-uninstall
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 10h
effort-estimate-ai: 5h
milestone: phase-1
tags:
- task
- phase-1
- install
- cli
- huh
permalink: features/feat-001-cross-platform-portability/tasks/task-011-implement-brain-install-uninstall
---

# TASK-011 Implement brain install and brain uninstall

## Description

- [fact] New `brain install` command in `apps/tui/cmd/install.go` using huh v2 + bubbletea inline #cli
- [fact] Tool detection: check config directory existence (~/.claude/, ~/.cursor/) #detection
- [fact] huh.NewMultiSelect() for tool selection, huh.NewConfirm() for confirmation #ui
- [fact] Go CLI shells out to `bun adapters/sync.ts` for TS transforms #bun
- [fact] Claude Code: symlink 🧠-prefixed output to ~/.claude/ (plugin isolation handles namespacing) #claude
- [fact] Claude Code instructions delivered via `.claude/rules/🧠-*.md` (composable, auto-loaded) #claude-rules
- [fact] Cursor: copy 🧠-prefixed files to .cursor/ directories #cursor
- [fact] Cursor hooks.json and mcp.json use JSON merge with manifest tracking (not overwrite) #cursor-merge
- [fact] Install NEVER modifies user's existing CLAUDE.md, AGENTS.md, hooks, or MCP config #non-destructive
- [fact] Write install manifest per tool for deterministic uninstall #manifest
- [fact] New `brain uninstall` command: remove installed files and manifest-tracked JSON entries #uninstall
- [fact] Idempotent: safe to re-run #reliability

## Definition of Done

- [x] [requirement] brain install uses huh v2 (no gum binary dependency) #huh
- [x] [requirement] Claude Code installed via symlinks with 🧠 prefix #claude
- [x] [requirement] Cursor installed via file copy with 🧠-prefixed filenames #cursor
- [x] [requirement] Cursor hooks.json/mcp.json use JSON merge with manifest, not overwrite #json-merge
- [x] [requirement] Install NEVER modifies user's existing files (CLAUDE.md, hooks, MCP config) #non-destructive
- [x] [requirement] Install manifest tracks all Brain content per tool #manifest
- [x] [requirement] brain uninstall removes all artifacts including manifest-tracked JSON entries #uninstall
- [x] [requirement] Idempotent re-runs #reliability

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 3 (Human-Led) |
| Human Estimate | 10h |
| AI-Assisted Estimate | 5h |
| Rationale | Complex TUI integration (huh + bubbletea), multi-tool staging, bun subprocess management |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-010-create-ts-claude-code-adapter]]
- enables [[TASK-012-refactor-brain-claude-launcher]]
- enables [[TASK-013-remove-apps-claude-plugin]]
- satisfies [[REQ-004-unified-install]]
- traces_to [[DESIGN-003-install-tui-flow]]
