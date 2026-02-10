---
title: TASK-019-refactor-hook-scripts-for-normalization
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 3h
milestone: phase-3
tags:
- task
- phase-3
- hooks
- refactor
permalink: features/feat-001-cross-platform-portability/tasks/task-019-refactor-hook-scripts-for-normalization-1
---

# TASK-019 Refactor Hook Scripts for Normalization

## Description

- [fact] Refactor all hook scripts to import normalize.ts and work with NormalizedHookEvent #refactor
- [fact] Generate hooks/cursor.json mapping Cursor events to shared scripts #cursor-config
- [fact] Update hooks/claude-code.json if needed #claude-config
- [fact] Test: stop-validator works in both tools #testing
- [fact] Test: user-prompt processing works in both tools #testing
- [fact] Test: pre-tool-use gating works in both tools #testing

## Definition of Done

- [ ] [requirement] All hook scripts use NormalizedHookEvent interface #normalized
- [ ] [requirement] hooks/cursor.json maps Cursor events to shared scripts #cursor
- [ ] [requirement] hooks/claude-code.json maps Claude Code events to shared scripts #claude
- [ ] [requirement] Stop validation works on both platforms #stop
- [ ] [requirement] Tool gating works on both platforms #gating

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | Refactoring existing scripts to use normalization layer; testing across both platforms |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-018-build-hook-normalization-shim]]
- enables [[TASK-020-add-ci-validation-and-golden-files]]
- satisfies [[REQ-003-hook-normalization]]
