---
title: TASK-005 Add Worktree Fallback to matchCwdToProject
type: task
status: complete
feature-ref: FEAT-003
effort: L
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-005-add-worktree-fallback-to-match-cwd-to-project
---

# TASK-005 Add Worktree Fallback to matchCwdToProject

## Description

Integrate worktree detection as a fallback in `matchCwdToProject` across all three language implementations (TypeScript, Go, Bun hooks). When direct CWD matching fails, the function checks opt-out settings, runs worktree detection, validates the result, and attempts to match the main worktree path against configured code_paths. Also updates the internal return type from `string | null` to `CwdMatchResult` in all three implementations and adds the new `resolveProjectWithContext` public API.

## Definition of Done

- [x] [requirement] `matchCwdToProject` updated in TypeScript (`packages/utils/src/project-resolver.ts`) #acceptance
- [x] [requirement] `matchCwdToProject` updated in Go (`packages/utils/internal/project_resolver.go`) #acceptance
- [x] [requirement] `matchCwdToProject` updated in Bun hooks (`templates/hooks/scripts/project-resolve.ts`) #acceptance
- [x] [requirement] Internal return type changed to `CwdMatchResult` in all 3 implementations #acceptance
- [x] [requirement] `resolveProject` public API preserved (returns `string | null`) #acceptance
- [x] [requirement] New `resolveProjectWithContext` API exposed in all 3 implementations #acceptance
- [x] [requirement] Opt-out check (env var, then config) runs before detection #acceptance
- [x] [requirement] Security validation of effectiveCwd via path-validator #acceptance
- [x] [requirement] Existing direct match behavior unchanged (worktree fallback only when direct fails) #acceptance
- [x] [requirement] Unit tests for the integration path in all 3 implementations #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: L #effort
- [task] Highest integration complexity; touches all 3 implementations #complexity
- [constraint] Must not change behavior for existing direct-match cases #backward-compatible
- [technique] Opt-out check before detection avoids unnecessary subprocess spawn #optimization
- [risk] Making matchCwdToProject async in TypeScript may require upstream changes #async

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | L |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 3 (Human-Primary) |
| AI Multiplier | 1.5x |
| AI Effort | 2.67 hours |
| Rationale | Highest integration complexity touching 3 language implementations; async conversion in TS, CwdMatchResult type propagation, and cross-language opt-out logic require careful human coordination |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-001 Worktree Detection via Git Common Dir]]
- implements [[REQ-003 Two-Level Opt-Out Mechanism]]
- implements [[REQ-004 Cross-Language Parity]]
- implements [[REQ-005 Security Validation of Effective CWD]]
- depends_on [[TASK-002 Implement detectWorktreeMainPath TypeScript]]
- depends_on [[TASK-003 Implement detectWorktreeMainPath Go]]
- depends_on [[TASK-004 Implement detectWorktreeMainPath Bun Hooks]]
- enables [[TASK-006 MCP Server Runtime Override]]
- enables [[TASK-007 Cross-Language Parity Tests]]
