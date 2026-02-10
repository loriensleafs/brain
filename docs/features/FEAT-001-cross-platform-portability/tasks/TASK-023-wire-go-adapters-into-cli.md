---
title: TASK-023-wire-go-adapters-into-cli
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 4h
effort-estimate-ai: 2h
milestone: phase-4
tags:
- task
- phase-4
- cli
- go
- wiring
permalink: features/feat-001-cross-platform-portability/tasks/task-023-wire-go-adapters-into-cli
---

# TASK-023 Wire Go Adapters into CLI Commands

## Description

- [fact] Update apps/tui/cmd/install.go to call Go adapters directly instead of shelling out to bun #wiring
- [fact] Update apps/tui/cmd/claude.go to use Go Claude adapter for install/sync operations #claude
- [fact] Update apps/tui/cmd/cursor.go to use Go Cursor adapter for install/sync operations #cursor
- [fact] Remove bun subprocess invocation from install and launcher commands #removal
- [fact] Adapter functions called as native Go library calls, no process spawning #native
- [fact] Maintain existing CLI UX (huh v2 multiselect, bubbletea inline progress) #ux

## Definition of Done

- [x] [requirement] `brain install` uses Go adapters directly without bun subprocess #install
- [x] [requirement] `brain claude` launcher uses Go Claude adapter #claude
- [x] [requirement] `brain cursor` launcher uses Go Cursor adapter #cursor
- [x] [requirement] All CLI commands pass existing integration tests #tests
- [x] [requirement] No bun/node subprocess calls remain in install or launcher paths #no-bun

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 4h |
| AI-Assisted Estimate | 2h |
| Rationale | Wiring existing Go packages into existing CLI commands; well-defined interfaces on both sides |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-021-write-go-claude-code-adapter]]
- blocked_by [[TASK-022-write-go-cursor-adapter]]
- relates_to [[TASK-011-implement-brain-install-uninstall]]
- relates_to [[TASK-012-refactor-brain-claude-launcher]]
- relates_to [[TASK-016-implement-brain-cursor-launcher]]
