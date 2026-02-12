---
title: TASK-007 Cursor Target
type: task
status: pending
feature-ref: FEAT-004
effort: M
permalink: features/feat-004-registry-based-installer/tasks/task-007-cursor-target
---

# TASK-007 Cursor Target

## Description

Implement the Cursor target at `internal/installer/targets/cursor.go`. The target struct implements `ToolInstaller` (no optional interfaces needed). Self-registers via `init()`. The `Install()` method builds a 4-step pipeline: clean previous install, run adapter transforms, merge MCP config using json-patch (RFC 7396), and write install manifest. Cursor follows the same dotfile conventions as Claude Code but without marketplace registration.

## Definition of Done

- [ ] [requirement] File `internal/installer/targets/cursor.go` created #acceptance
- [ ] [requirement] `Cursor` struct implements `ToolInstaller` #acceptance
- [ ] [requirement] `init()` calls `installer.Register(&Cursor{})` #acceptance
- [ ] [requirement] `Name()` returns `"cursor"` #acceptance
- [ ] [requirement] `DisplayName()` returns `"Cursor"` #acceptance
- [ ] [requirement] `ConfigDir()` resolves `~/.cursor` #acceptance
- [ ] [requirement] `IsToolInstalled()` checks Cursor config directory existence #acceptance
- [ ] [requirement] `IsBrainInstalled()` uses gjson to check for Brain keys in mcp.json #acceptance
- [ ] [requirement] `Install()` builds 4-step pipeline with Condition and Undo on each step #acceptance
- [ ] [requirement] MCP config merge uses `jsonpatch.MergePatch` (RFC 7396, arbitrary depth) #acceptance
- [ ] [requirement] `Uninstall()` reverses install: remove files, remove Brain MCP keys, remove manifest #acceptance
- [ ] [requirement] Golden-file tests verify install output #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: M #effort
- [task] Simpler than Claude Code; no marketplace registration #simplicity
- [fact] Cursor dotfile layout mirrors Claude Code: .cursor/commands/, .cursor/rules/, .cursor/mcp.json #convergence
- [technique] MCP config merge is the differentiating step; uses json-patch for arbitrary depth #json-ops
- [insight] Cursor target validates the extensibility claim: one file, ~80-100 lines #proof-point
- [constraint] Must not modify non-Brain keys in existing .cursor/mcp.json #safety

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | Follows Claude Code target pattern closely; simpler (no marketplace) but still requires careful MCP config merge handling |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-005 Cursor Target]]
- implements [[DESIGN-002 Target Implementation Guide]]
- depends_on [[TASK-001 Registry and ToolInstaller Interface]]
- depends_on [[TASK-002 Step Pipeline with Rollback]]
- depends_on [[TASK-003 Library Integration otiai10-copy]]
- depends_on [[TASK-004 Library Integration tidwall-gjson-sjson]]
- depends_on [[TASK-005 Library Integration json-patch-xdg]]
- enables [[TASK-008 Parallel Multi-Tool Execution]]
- validated_by [[TASK-010 Golden-File and Integration Tests]]
