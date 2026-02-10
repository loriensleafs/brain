---
title: TASK-010-create-ts-claude-code-adapter
type: task
status: todo
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 3h
milestone: phase-1
tags:
- task
- phase-1
- adapter
- claude-code
- typescript
permalink: features/feat-001-cross-platform-portability/tasks/task-010-create-ts-claude-code-adapter-1
---

# TASK-010 Create TS Claude Code Adapter

## Description

- [fact] Create `adapters/claude-code.ts` with frontmatter transform: brain.config.json values to Claude Code format #adapter
- [fact] Create `adapters/shared.ts` with common transform utilities (frontmatter parsing, file generation) #shared
- [fact] Create `adapters/sync.ts` as main orchestrator that reads brain.config.json and invokes per-tool adapters #sync
- [fact] Adapter generates Claude Code-specific agent frontmatter (model, allowed_tools, memory, color, skills) #transform
- [fact] Adapter generates .mcp.json from canonical mcp.json #mcp
- [fact] Adapter generates `.claude/rules/🧠-*.md` from protocols/ (composable instructions, not monolithic AGENTS.md) #rules
- [fact] All output filenames use 🧠 emoji prefix (e.g., `.claude/agents/🧠-architect.md`) #naming
- [fact] Adapter skips agents with null claude-code entry in brain.config.json #filtering

## Definition of Done

- [ ] [requirement] adapters/sync.ts produces valid Claude Code plugin output when invoked via bun #output
- [ ] [requirement] Generated agents match current apps/claude-plugin/agents/ structure #parity
- [ ] [requirement] mcp.json correctly transformed #mcp
- [ ] [requirement] Agents with null claude-code config skipped (e.g., orchestrator-cursor) #filtering

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | Well-defined transforms from brain.config.json to Claude Code format; reference implementation for other adapters |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-005-canonicalize-agent-definitions]]
- blocked_by [[TASK-006-create-two-orchestrator-agents]]
- blocked_by [[TASK-007-create-brain-config-and-agents-md]]
- enables [[TASK-011-implement-brain-install-uninstall]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
- traces_to [[DESIGN-001-adapter-architecture]]
