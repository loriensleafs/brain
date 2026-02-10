---
title: TASK-006-create-two-orchestrator-agents
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 8h
effort-estimate-ai: 4h
milestone: phase-1
tags:
- task
- phase-1
- orchestrator
- agent-teams
permalink: features/feat-001-cross-platform-portability/tasks/task-006-create-two-orchestrator-agents
---

# TASK-006 Create Two Orchestrator Agents

## Description

- [fact] Create `agents/orchestrator-claude.md` using Agent Teams APIs (Teammate, SendMessage, TaskCreate, delegation mode) #claude
- [fact] Create `agents/orchestrator-cursor.md` using Task tool hub-and-spoke pattern (is_background subagents) #cursor
- [fact] Extract orchestrator content from current orchestrator.md (2,312 lines, 85 Claude-specific refs) #extraction
- [fact] Claude orchestrator keeps Agent Teams-specific content; Cursor orchestrator uses Cursor-native patterns #separation
- [fact] Update brain.config.json: orchestrator-claude -> claude-code only, orchestrator-cursor -> cursor only #config

## Definition of Done

- [ ] [requirement] orchestrator-claude.md uses Agent Teams APIs and works on Claude Code #claude
- [ ] [requirement] orchestrator-cursor.md uses Task tool hub-and-spoke and works on Cursor #cursor
- [ ] [requirement] brain.config.json routes each orchestrator to correct tool only #config
- [ ] [requirement] Both orchestrators can delegate to the same specialist agents #compatibility

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 3 (Human-Led) |
| Human Estimate | 8h |
| AI-Assisted Estimate | 4h |
| Rationale | Requires deep understanding of both Agent Teams and Cursor subagent patterns; orchestrator is most complex agent |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-005-canonicalize-agent-definitions]]
- enables [[TASK-010-create-ts-claude-code-adapter]]
- satisfies [[REQ-005-orchestrator-portability]]
- traces_to [[DESIGN-004-orchestrator-strategy]]
