---
title: TASK-012-refactor-brain-claude-launcher
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 3h
effort-estimate-ai: 1h
milestone: phase-1
tags:
- task
- phase-1
- claude
- launcher
permalink: features/feat-001-cross-platform-portability/tasks/task-012-refactor-brain-claude-launcher
---

# TASK-012 Refactor brain claude Launcher

## Description

- [fact] Rewrite `apps/tui/cmd/claude.go` to use root-level content instead of apps/claude-plugin/ #refactor
- [fact] Remove `findPluginSource()` which walks up from cwd looking for apps/claude-plugin/ #removal
- [fact] Use adapters/sync.ts via bun for fresh staging on each launch #staging
- [fact] Update --agent-teams variant swap to use agents/variants/claude-code/ directory pattern #variants
- [fact] Remove `symlinkPluginContent()` and `symlinkDir()` functions (replaced by adapter) #cleanup

## Definition of Done

- [ ] [requirement] brain claude stages via TS adapter and launches Claude Code #launch
- [ ] [requirement] brain claude --agent-teams swaps orchestrator variant correctly #variants
- [ ] [requirement] No references to apps/claude-plugin/ in claude.go #cleanup

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 3h |
| AI-Assisted Estimate | 1h |
| Rationale | Rewrite of existing launcher with well-defined new staging pattern |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-011-implement-brain-install-uninstall]]
- enables [[TASK-013-remove-apps-claude-plugin]]
