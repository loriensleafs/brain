---
title: TASK-006 Claude Code Target
type: task
status: pending
feature-ref: FEAT-004
effort: L
permalink: features/feat-004-registry-based-installer/tasks/task-006-claude-code-target
---

# TASK-006 Claude Code Target

## Description

Implement the Claude Code target at `internal/installer/targets/claudecode.go`. The target struct implements `ToolInstaller` and `Provisioner` (for marketplace registration). Self-registers via `init()`. The `Install()` method builds a 4-step pipeline: clean previous install, run adapter transforms, register marketplace in `known_marketplaces.json`, and write install manifest. Uses otiai10/copy for file operations, gjson/sjson for marketplace JSON manipulation, and xdg for config directory resolution.

## Definition of Done

- [ ] [requirement] File `internal/installer/targets/claudecode.go` created #acceptance
- [ ] [requirement] `ClaudeCode` struct implements `ToolInstaller` #acceptance
- [ ] [requirement] `ClaudeCode` struct implements `Provisioner` for marketplace setup #acceptance
- [ ] [requirement] `init()` calls `installer.Register(&ClaudeCode{})` #acceptance
- [ ] [requirement] `Name()` returns `"claude-code"` #acceptance
- [ ] [requirement] `DisplayName()` returns `"Claude Code"` #acceptance
- [ ] [requirement] `ConfigDir()` resolves `~/.claude` via xdg or direct path #acceptance
- [ ] [requirement] `IsToolInstalled()` checks Claude Code config directory existence #acceptance
- [ ] [requirement] `IsBrainInstalled()` uses gjson to check for Brain keys in config #acceptance
- [ ] [requirement] `Install()` builds 4-step pipeline with Condition and Undo on each step #acceptance
- [ ] [requirement] `Uninstall()` reverses install: remove files, deregister marketplace, remove manifest #acceptance
- [ ] [requirement] Golden-file tests verify install output #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: L #effort
- [task] Most complex target due to marketplace registration #complexity
- [technique] Marketplace registration uses sjson.SetBytes for adding and sjson.DeleteBytes for removing #json-ops
- [fact] Claude Code config: `~/.claude/` with `known_marketplaces.json` #paths
- [constraint] Must preserve existing user config; Brain content is additive #safety
- [risk] Marketplace JSON structure may change across Claude Code versions #fragility

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | L |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Complex target with marketplace registration, 4-step pipeline, and multiple library integrations; algorithm is defined but edge cases in marketplace JSON require careful handling |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-004 Claude Code Target]]
- implements [[DESIGN-002 Target Implementation Guide]]
- depends_on [[TASK-001 Registry and ToolInstaller Interface]]
- depends_on [[TASK-002 Step Pipeline with Rollback]]
- depends_on [[TASK-003 Library Integration otiai10-copy]]
- depends_on [[TASK-004 Library Integration tidwall-gjson-sjson]]
- depends_on [[TASK-005 Library Integration json-patch-xdg]]
- enables [[TASK-008 Parallel Multi-Tool Execution]]
- validated_by [[TASK-010 Golden-File and Integration Tests]]
