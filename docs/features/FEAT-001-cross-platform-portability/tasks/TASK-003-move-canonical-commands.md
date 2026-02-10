---
title: TASK-003-move-canonical-commands
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 1h
effort-estimate-ai: 0.5h
milestone: phase-1
tags:
- task
- phase-1
- commands
- extraction
permalink: features/feat-001-cross-platform-portability/tasks/task-003-move-canonical-commands-1
---

# TASK-003 Move Canonical Commands

## Description

- [fact] Move 9 command `.md` files from `apps/claude-plugin/commands/` to `commands/` at repo root #extraction
- [fact] Commands are Markdown format; identical for Claude Code and Cursor #portability

## Definition of Done

- [ ] [requirement] All 9 commands at `commands/` in Markdown format #commands
- [ ] [requirement] No Claude-specific formatting remains in command content #portability

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 1h |
| AI-Assisted Estimate | 0.5h |
| Rationale | Simple file move; command format is already canonical Markdown |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-001-create-root-level-directory-scaffold]]
- enables [[TASK-010-create-ts-claude-code-adapter]]
- satisfies [[REQ-001-canonical-content-extraction]]
