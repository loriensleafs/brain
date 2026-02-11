---
title: TASK-002 Implement detectWorktreeMainPath TypeScript
type: task
status: complete
feature-ref: FEAT-003
effort: M
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-002-implement-detect-worktree-main-path-typescript
---

# TASK-002 Implement detectWorktreeMainPath TypeScript

## Description

Create the TypeScript implementation of `detectWorktreeMainPath` as a new module `packages/utils/src/worktree-detector.ts`. This is the primary reference implementation that Go and Bun will mirror. Exports `detectWorktreeMainPath(cwd: string): Promise<WorktreeDetectionResult | null>` with fast pre-check, single `git rev-parse` subprocess with 3-second timeout, bare repository handling, and DEBUG/WARN logging at all decision points.

## Definition of Done

- [x] [requirement] New file `packages/utils/src/worktree-detector.ts` created #acceptance
- [x] [requirement] `detectWorktreeMainPath(cwd: string): Promise<WorktreeDetectionResult | null>` exported #acceptance
- [x] [requirement] `WorktreeDetectionResult` interface exported with `mainWorktreePath` and `isLinkedWorktree` #acceptance
- [x] [requirement] Fast pre-check for `.git` file/directory implemented #acceptance
- [x] [requirement] Single `git rev-parse` subprocess with 3-second timeout #acceptance
- [x] [requirement] Bare repository handling (returns null) #acceptance
- [x] [requirement] Main worktree detection (commonDir == gitDir returns null) #acceptance
- [x] [requirement] DEBUG level logging at all decision points per REQ-006 #acceptance
- [x] [requirement] WARN level logging for timeouts and security failures #acceptance
- [x] [requirement] Unit tests covering all 8 edge cases from DESIGN-002 #acceptance
- [x] [requirement] Tests pass with `npm test` or equivalent #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: M #effort
- [task] Primary implementation; Go and Bun mirror this #reference-implementation
- [technique] Use execFile (not exec) to avoid shell injection risk #security
- [constraint] 3-second timeout on subprocess; async/Promise-based API #performance
- [fact] Must handle git not installed (ENOENT from execFile) gracefully #error-handling

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Reference implementation requiring careful subprocess management, timeout handling, and security considerations; AI accelerates boilerplate but edge cases need human review |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-001 Worktree Detection via Git Common Dir]]
- implements [[REQ-006 Observability Logging]]
- implements [[DESIGN-002 Detection Algorithm Detail]]
- depends_on [[TASK-001 Config Schema Update]]
- enables [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
- mirrors [[TASK-003 Implement detectWorktreeMainPath Go]]
- mirrors [[TASK-004 Implement detectWorktreeMainPath Bun Hooks]]
