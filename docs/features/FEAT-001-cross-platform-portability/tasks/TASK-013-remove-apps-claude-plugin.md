---
title: TASK-013-remove-apps-claude-plugin
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 3h
effort-estimate-ai: 1h
milestone: phase-1
tags:
- task
- phase-1
- removal
- cleanup
permalink: features/feat-001-cross-platform-portability/tasks/task-013-remove-apps-claude-plugin
---

# TASK-013 Remove apps/claude-plugin and Old Commands

## Description

- [fact] Verify all content moved to root and adapters functional #verification
- [fact] Remove `apps/claude-plugin/` directory entirely #removal
- [fact] Remove old `brain plugin install/uninstall` commands from `apps/tui/cmd/plugin.go` #removal
- [fact] Remove Go module files (go.mod, go.sum) from apps/claude-plugin/ #cleanup
- [fact] Update any remaining references to apps/claude-plugin/ in codebase #cleanup
- [fact] Grep codebase for old paths and fix all references #cleanup

## Definition of Done

- [ ] [requirement] apps/claude-plugin/ deleted #removed
- [ ] [requirement] brain plugin install/uninstall commands removed from Go CLI #removed
- [ ] [requirement] No broken references to apps/claude-plugin/ in codebase #clean
- [ ] [requirement] brain install and brain claude work via adapters + root content #functional
- [ ] [requirement] CI passes #ci

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 3h |
| AI-Assisted Estimate | 1h |
| Rationale | Directory removal plus codebase-wide reference cleanup; mechanical grep-and-fix |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-008-port-brain-hooks-to-js-ts]]
- blocked_by [[TASK-009-consolidate-brain-skills-binary]]
- blocked_by [[TASK-011-implement-brain-install-uninstall]]
- blocked_by [[TASK-012-refactor-brain-claude-launcher]]
- satisfies [[REQ-001-canonical-content-extraction]]
