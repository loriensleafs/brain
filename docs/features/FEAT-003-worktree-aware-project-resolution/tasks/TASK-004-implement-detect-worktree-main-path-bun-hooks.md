---
title: TASK-004 Implement detectWorktreeMainPath Bun Hooks
type: task
status: complete
feature-ref: FEAT-003
effort: M
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-004-implement-detect-worktree-main-path-bun-hooks
---

# TASK-004 Implement detectWorktreeMainPath Bun Hooks

## Description

Add worktree detection to the Bun hooks implementation at `templates/hooks/scripts/project-resolve.ts`. Must produce identical behavior to the TypeScript implementation (TASK-002) while using Bun-specific APIs (`Bun.spawn`) for subprocess execution. The worktree detection logic itself must be identical, but integration into the hooks resolution flow may require adaptation due to known divergences in the resolution hierarchy.

## Definition of Done

- [x] [requirement] `detectWorktreeMainPath` function added to `templates/hooks/scripts/project-resolve.ts` #acceptance
- [x] [requirement] Same algorithm as TypeScript implementation #acceptance
- [x] [requirement] Uses `Bun.spawn` or equivalent for subprocess execution #acceptance
- [x] [requirement] 3-second timeout on git subprocess #acceptance
- [x] [requirement] Fast pre-check for `.git` file/directory #acceptance
- [x] [requirement] Bare repository and main worktree handling #acceptance
- [x] [requirement] DEBUG and WARN level logging per REQ-006 #acceptance
- [x] [requirement] Unit tests covering all 8 edge cases from DESIGN-002 #acceptance
- [x] [requirement] Tests pass in Bun runtime #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: M #effort
- [task] Bun hooks use different subprocess APIs than Node.js #platform-difference
- [risk] Bun hooks resolution hierarchy already diverges slightly; must verify integration point #parity
- [constraint] Must test in Bun runtime, not Node.js #testing
- [fact] Bun.spawn API differs from Node child_process; timeout handling may differ #api

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | Bun port of TypeScript reference implementation; Bun.spawn API differences and runtime-specific testing add complexity beyond a direct copy |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-001 Worktree Detection via Git Common Dir]]
- implements [[REQ-004 Cross-Language Parity]]
- implements [[DESIGN-002 Detection Algorithm Detail]]
- depends_on [[TASK-001 Config Schema Update]]
- mirrors [[TASK-002 Implement detectWorktreeMainPath TypeScript]]
- enables [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
