---
title: TASK-021-write-go-claude-code-adapter
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 6h
effort-estimate-ai: 3h
milestone: phase-4
tags:
- task
- phase-4
- adapter
- claude-code
- go
permalink: features/feat-001-cross-platform-portability/tasks/task-021-write-go-claude-code-adapter
---

# TASK-021 Write Go Claude Code Adapter

## Description

- [fact] Rewrite Claude Code adapter from TypeScript (adapters/claude-code.ts) to Go at apps/tui/internal/adapters/claude.go #migration
- [fact] Adapter reads brain.config.json and transforms agent definitions to Claude Code format (model, allowed_tools, memory, color, skills) #transform
- [fact] Adapter generates .mcp.json from canonical mcp.json #mcp
- [fact] Adapter generates `.claude/rules/` composable instruction files from protocols/ #rules
- [fact] All output filenames use emoji prefix (e.g., `.claude/agents/orchestrator.md`) #naming
- [fact] Adapter skips agents with null claude-code entry in brain.config.json #filtering
- [fact] Eliminates bun subprocess dependency for Claude Code install path #no-bun

## Definition of Done

- [x] [requirement] apps/tui/internal/adapters/claude.go compiles and passes unit tests #build
- [x] [requirement] Generated output matches existing TS adapter output (parity with adapters/claude-code.ts) #parity
- [x] [requirement] mcp.json correctly transformed to .mcp.json #mcp
- [x] [requirement] Agents with null claude-code config skipped #filtering
- [x] [requirement] No bun/node dependency required for Claude Code adapter #no-bun

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | Direct port of existing TS logic to Go; well-defined input/output contract from TASK-010 |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- supersedes [[TASK-010-create-ts-claude-code-adapter]]
- relates_to [[ADR-002 Cross-Platform Plugin Architecture]]
- traces_to [[DESIGN-001-adapter-architecture]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
