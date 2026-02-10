---
title: TASK-001-create-root-level-directory-scaffold
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 2h
effort-estimate-ai: 0.5h
milestone: phase-1
tags:
- task
- phase-1
- scaffold
permalink: features/feat-001-cross-platform-portability/tasks/task-001-create-root-level-directory-scaffold-1
---

# TASK-001 Create Root-Level Directory Scaffold

## Description

- [fact] Create top-level directories: `agents/`, `skills/`, `commands/`, `protocols/`, `hooks/`, `hooks/scripts/`, `adapters/` #structure
- [fact] Create `mcp.json` at repo root with canonical MCP server config (extracted from `apps/claude-plugin/.mcp.json`) #mcp
- [fact] Create `brain.config.json` skeleton at repo root #config

## Definition of Done

- [ ] [requirement] All directories exist at repo root #structure
- [ ] [requirement] `mcp.json` contains MCP server config with relative paths (not hardcoded user paths) #mcp
- [ ] [requirement] `brain.config.json` skeleton exists #config
- [ ] [requirement] No turbo workspace entries needed for static content directories #turbo

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 2h |
| AI-Assisted Estimate | 0.5h |
| Rationale | Directory creation and config file extraction is mechanical and low-risk |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- enables [[TASK-002-move-canonical-skills]]
- enables [[TASK-003-move-canonical-commands]]
- enables [[TASK-004-extract-protocols-to-root]]
- enables [[TASK-005-canonicalize-agent-definitions]]
