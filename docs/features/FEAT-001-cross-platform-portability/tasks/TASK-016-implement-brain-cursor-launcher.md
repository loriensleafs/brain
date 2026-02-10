---
title: TASK-016-implement-brain-cursor-launcher
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 3h
effort-estimate-ai: 1h
milestone: phase-2
tags:
- task
- phase-2
- cursor
- launcher
permalink: features/feat-001-cross-platform-portability/tasks/task-016-implement-brain-cursor-launcher
---

# TASK-016 Implement brain cursor Launcher

## Description

- [fact] New `brain cursor` command in `apps/tui/cmd/cursor.go` #cli
- [fact] Run TS Cursor adapter via bun for fresh staging #staging
- [fact] File copy output to .cursor/ #copy
- [fact] Launch Cursor with Brain plugin configured #launch
- [fact] Detect cursor binary in PATH #detection

## Definition of Done

- [x] [requirement] brain cursor stages via TS adapter and launches Cursor #launch
- [x] [requirement] Fresh staging on every launch #fresh
- [x] [requirement] Error when Cursor not found #detection

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 3h |
| AI-Assisted Estimate | 1h |
| Rationale | Pattern established by brain claude launcher; straightforward adaptation |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-015-extend-brain-install-for-cursor]]
- enables [[TASK-017-cursor-integration-testing]]
