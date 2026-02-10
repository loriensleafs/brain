---
title: TASK-022-write-go-cursor-adapter
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
- cursor
- go
permalink: features/feat-001-cross-platform-portability/tasks/task-022-write-go-cursor-adapter
---

# TASK-022 Write Go Cursor Adapter

## Description

- [fact] Rewrite Cursor adapter from TypeScript (adapters/cursor.ts) to Go at apps/tui/internal/adapters/cursor.go #migration
- [fact] Adapter reads brain.config.json and transforms agent definitions to Cursor format #transform
- [fact] Adapter generates .cursor/ directory structure with rules, agents, and MCP config #output
- [fact] Cursor install uses file sync (copies) rather than symlinks #install-mode
- [fact] Adapter generates emoji-prefixed file placement + JSON merge with manifest for hooks and MCP config #cursor-install
- [fact] Eliminates bun subprocess dependency for Cursor install path #no-bun

## Definition of Done

- [x] [requirement] apps/tui/internal/adapters/cursor.go compiles and passes unit tests #build
- [x] [requirement] Generated output matches existing TS adapter output (parity with adapters/cursor.ts) #parity
- [x] [requirement] Cursor directory structure correctly generated #structure
- [x] [requirement] JSON merge with manifest works for hooks and MCP config #merge
- [x] [requirement] No bun/node dependency required for Cursor adapter #no-bun

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 2 (AI-Assisted) |
| Human Estimate | 6h |
| AI-Assisted Estimate | 3h |
| Rationale | Direct port of existing TS logic to Go; parallel with TASK-021 using same patterns |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- supersedes [[TASK-014-create-ts-cursor-adapter]]
- relates_to [[ADR-002 Cross-Platform Plugin Architecture]]
- traces_to [[DESIGN-001-adapter-architecture]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
