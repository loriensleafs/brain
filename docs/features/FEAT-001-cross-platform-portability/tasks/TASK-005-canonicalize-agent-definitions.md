---
title: TASK-005-canonicalize-agent-definitions
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 8h
effort-estimate-ai: 3h
milestone: phase-1
tags:
- task
- phase-1
- agents
- canonicalization
permalink: features/feat-001-cross-platform-portability/tasks/task-005-canonicalize-agent-definitions-2
---

# TASK-005 Canonicalize Agent Definitions

## Description

- [fact] Move 23 specialist agent `.md` files from `apps/claude-plugin/agents/` to `agents/` at repo root #extraction
- [fact] Canonical agent filenames use kebab-case without emoji prefix (e.g., `agents/architect.md`); 🧠 prefix applied at install time by adapters #naming
- [fact] Strip Claude-specific frontmatter (name, model, memory, color, argument-hint, tools, skills) from agent files #frontmatter
- [fact] Agent bodies become tool-neutral: remove or generalize 298 Claude-specific API references across 22 agents #canonicalization
- [fact] Claude-specific content (MCP tool names, Teammate(), TaskCreate, SendMessage) moved to protocols or adapter injection #separation
- [fact] Identify which refs are truly tool-specific vs which are canonical (e.g., Brain MCP tools work on both) #analysis
- [fact] Per-agent tool-specific values go into brain.config.json #config

## Definition of Done

- [x] [requirement] 23 specialist agents at `agents/` with tool-neutral body content #agents
- [x] [requirement] No Claude-specific frontmatter in canonical agent files #frontmatter
- [x] [requirement] Agent bodies readable and useful on both Claude Code and Cursor #portability
- [x] [requirement] brain.config.json updated with per-agent per-tool values for all 23 specialists #config

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 8h |
| AI-Assisted Estimate | 3h |
| Rationale | 298 Claude-specific refs across 22 agents; each needs categorization and handling |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-001-create-root-level-directory-scaffold]]
- enables [[TASK-006-create-two-orchestrator-agents]]
- enables [[TASK-010-create-ts-claude-code-adapter]]
- satisfies [[REQ-001-canonical-content-extraction]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
