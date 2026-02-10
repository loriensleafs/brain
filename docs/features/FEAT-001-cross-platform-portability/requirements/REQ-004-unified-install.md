---
title: REQ-004-unified-install
type: requirement
status: approved
feature-ref: FEAT-001
tags:
- requirement
- install
- cli
- huh
permalink: features/feat-001-cross-platform-portability/requirements/req-004-unified-install
---

# REQ-004 Unified Install/Uninstall

## Requirement Statement

- [requirement] `brain install` SHALL detect available tools and present huh v2 multiselect for tool selection #detection
- [requirement] `brain uninstall` SHALL cleanly remove all installed files for selected tools #uninstall
- [requirement] Per-tool install strategy SHALL be internal (Claude Code: symlinks, Cursor: file copy) #strategy
- [requirement] Go CLI SHALL shell out to bun for TS adapter transforms at install time #bun
- [requirement] Install SHALL be non-destructive: NEVER modify user's existing CLAUDE.md, AGENTS.md, hooks config, or MCP config #non-destructive
- [requirement] Claude Code: plugin isolation handles namespacing; instructions delivered via `.claude/rules/🧠-*.md` (auto-loaded, composable) #claude-install
- [requirement] Cursor: 🧠-prefixed files placed in `.cursor/` directories; hooks and MCP config merged via JSON merge with manifest tracking for clean uninstall #cursor-install
- [requirement] Manifest SHALL track all installed Brain files per tool for deterministic uninstall #manifest

## Acceptance Criteria

- [x] [requirement] AC-01: brain install uses huh v2 multiselect (no gum binary dependency) #huh
- [x] [requirement] AC-02: Claude Code installed via symlinks to ~/.claude/ #claude
- [ ] [requirement] AC-03: Cursor installed via file copy to .cursor/ with 🧠-prefixed filenames #cursor
- [x] [requirement] AC-04: brain uninstall removes all artifacts for selected tool #uninstall
- [x] [requirement] AC-05: Install is idempotent (safe to re-run) #idempotent
- [x] [requirement] AC-06: Install NEVER modifies user's existing CLAUDE.md, AGENTS.md, hooks config, or MCP config #non-destructive
- [ ] [requirement] AC-07: Cursor hooks and MCP config use JSON merge (not overwrite) with manifest tracking #json-merge
- [x] [requirement] AC-08: Manifest file tracks all installed Brain content per tool for deterministic uninstall #manifest

## Observations

- [fact] huh v2 is the Go library behind gum; same UI primitives, no external dependency #ecosystem
- [fact] Cursor symlinks broken as of Feb 2026; file copy required #blocker
- [fact] Users already need bun for MCP server; no additional dependency for TS adapters #bun
- [decision] Non-destructive install: Brain content never overwrites user files #non-destructive
- [decision] Cursor uses JSON merge with manifest tracking for hooks.json and mcp.json #json-merge
- [decision] Claude Code instructions delivered via composable rules (`.claude/rules/🧠-*.md`), not monolithic AGENTS.md #composable

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- derives_from [[ADR-002 Cross-Platform Plugin Architecture]]
