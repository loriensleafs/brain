---
title: TASK-017-cursor-integration-testing
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 3h
milestone: phase-2
tags:
- task
- phase-2
- testing
- cursor
permalink: features/feat-001-cross-platform-portability/tasks/task-017-cursor-integration-testing
---

# TASK-017 Cursor Integration Testing

## Description

- [fact] Test in Cursor: agents load and are discoverable #agents
- [fact] Test in Cursor: skills auto-discovered from .cursor/skills/ #skills
- [fact] Test in Cursor: MCP tools available via .cursor/mcp.json #mcp
- [fact] Test in Cursor: commands work from .cursor/commands/ #commands
- [fact] Test in Cursor: orchestrator-cursor delegates to specialist subagents #orchestrator
- [fact] Document any Cursor-specific issues or workarounds #documentation

## Definition of Done

- [x] [requirement] Agents load in Cursor and are invocable #agents
- [x] [requirement] Skills discovered and functional #skills
- [x] [requirement] MCP server connects and tools available #mcp
- [x] [requirement] Orchestrator-cursor successfully delegates to subagents #orchestrator
- [x] [requirement] Issues documented with workarounds #documentation

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | Manual testing in Cursor required; may surface unexpected incompatibilities |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-016-implement-brain-cursor-launcher]]
- enables [[TASK-018-build-hook-normalization-shim]]
