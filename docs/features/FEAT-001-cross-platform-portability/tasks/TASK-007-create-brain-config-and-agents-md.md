---
title: TASK-007-create-brain-config-and-agents-md
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 4h
effort-estimate-ai: 2h
milestone: phase-1
tags:
- task
- phase-1
- config
- instructions
permalink: features/feat-001-cross-platform-portability/tasks/task-007-create-brain-config-and-agents-md-1
---

# TASK-007 Create brain.config.json and AGENTS.md

## Description

- [fact] Populate `brain.config.json` with per-agent per-tool mappings for all 25 agents #config
- [fact] Create `AGENTS.md` at repo root from protocols/ content + tool-neutral instruction sections #instructions
- [fact] AGENTS.md replaces apps/claude-plugin/instructions/AGENTS.md as universal instruction file #replacement
- [fact] Claude Code reads AGENTS.md natively; symlink to CLAUDE.md if needed #claude

## Definition of Done

- [x] [requirement] brain.config.json contains targets, agents, and hooks mappings #config
- [x] [requirement] AGENTS.md at repo root is readable by both Claude Code and Cursor #universal
- [x] [requirement] No Claude-specific content in AGENTS.md universal sections #portability

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 4h |
| AI-Assisted Estimate | 2h |
| Rationale | brain.config.json population is mechanical (25 agents x 2 tools); AGENTS.md composition from protocols |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-004-extract-protocols-to-root]]
- blocked_by [[TASK-005-canonicalize-agent-definitions]]
- blocked_by [[TASK-006-create-two-orchestrator-agents]]
- enables [[TASK-010-create-ts-claude-code-adapter]]
- satisfies [[REQ-001-canonical-content-extraction]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
