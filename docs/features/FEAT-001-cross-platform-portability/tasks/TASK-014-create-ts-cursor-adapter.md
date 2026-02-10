---
title: TASK-014-create-ts-cursor-adapter
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 3h
milestone: phase-2
tags:
- task
- phase-2
- adapter
- cursor
- typescript
permalink: features/feat-001-cross-platform-portability/tasks/task-014-create-ts-cursor-adapter-1
---

# TASK-014 Create TS Cursor Adapter

## Description

- [fact] Create `adapters/cursor.ts` with frontmatter transform: brain.config.json values to Cursor format #adapter
- [fact] Map brain.config.json values to Cursor frontmatter (description field) #transform
- [fact] Generate `.cursor/rules/🧠-*.mdc` from protocols/ content + Cursor-specific sections #rules
- [fact] Generate `.cursor/agents/🧠-*.md` with Cursor frontmatter #agents
- [fact] Generate `.cursor/skills/🧠-*/SKILL.md` (copy with 🧠 prefix) #skills
- [fact] Generate `.cursor/commands/🧠-*.md` (copy with 🧠 prefix) #commands
- [fact] Generate JSON merge payloads for `.cursor/mcp.json` and `.cursor/hooks.json` (additive, not overwrite) #json-merge
- [fact] Skip agents with null cursor entry in brain.config.json (e.g., orchestrator-claude) #filtering
- [fact] File copy write strategy (Cursor symlinks broken as of Feb 2026) #staging
- [fact] All output filenames use 🧠 emoji prefix for immediate identification in Cursor listings #naming

## Definition of Done

- [x] [requirement] Cursor adapter generates valid .cursor/ directory structure with 🧠-prefixed filenames #output
- [x] [requirement] All agents have correct Cursor frontmatter with description field #frontmatter
- [x] [requirement] .cursor/rules/🧠-*.mdc generated from protocols #rules
- [x] [requirement] Agents with null cursor config skipped (e.g., orchestrator-claude) #filtering
- [x] [requirement] JSON merge payloads for hooks.json and mcp.json support manifest tracking #json-merge

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | Pattern established by Claude Code adapter; Cursor frontmatter mapping well-documented |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-013-remove-apps-claude-plugin]]
- enables [[TASK-015-extend-brain-install-for-cursor]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
- traces_to [[DESIGN-001-adapter-architecture]]
