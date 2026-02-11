---
title: TASK-006 MCP Server Runtime Override
type: task
status: complete
feature-ref: FEAT-003
effort: M
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-006-mcp-server-runtime-override
---

# TASK-006 MCP Server Runtime Override

## Description

Implement the MCP server runtime override that applies worktree-local memories paths for CODE mode sessions. When `matchCwdToProject` returns `isWorktreeResolved: true` and the project uses CODE memories mode, the MCP server overrides the memories path to point to the actual worktree's `docs/` directory. For DEFAULT and CUSTOM mode projects, no override is applied. Key distinction: use `actualCwd` (the real worktree path), not `effectiveCwd` (the main repo path used for project identification).

## Definition of Done

- [x] [requirement] MCP server detects worktree-resolved sessions from `resolveProjectWithContext` #acceptance
- [x] [requirement] For CODE mode projects: memories path overridden to `actualCwd + "/docs"` #acceptance
- [x] [requirement] For DEFAULT mode projects: no override (shared memory location used) #acceptance
- [x] [requirement] For CUSTOM mode projects: no override (explicit path used) #acceptance
- [x] [requirement] Override applied before basic-memory API calls #acceptance
- [x] [requirement] Static basic-memory config file NOT modified #acceptance
- [x] [requirement] DEBUG log emitted when CODE mode override is applied #acceptance
- [x] [requirement] Multiple concurrent worktree sessions operate independently #acceptance
- [x] [requirement] Integration tests verify CODE mode reads/writes to worktree-local docs/ #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: M #effort
- [task] Uses actualCwd for CODE mode, not effectiveCwd; subtle but critical distinction #design
- [decision] Override at MCP server layer because translation layer runs at config time, not request time #architecture
- [risk] docs/ directory may not exist in worktree; consider creating on first write #edge-case
- [constraint] Must not modify static basic-memory config #backward-compatible

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | MCP server integration with runtime path override; requires understanding of the config/runtime boundary and actualCwd vs effectiveCwd distinction |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-002 MCP Runtime Memories Path Override]]
- depends_on [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
- validated_by [[TASK-008 Integration Tests with Real Worktree]]
