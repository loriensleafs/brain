---
title: TASK-003 Implement detectWorktreeMainPath Go
type: task
status: complete
feature-ref: FEAT-003
effort: M
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-003-implement-detect-worktree-main-path-go
---

# TASK-003 Implement detectWorktreeMainPath Go

## Description

Create the Go implementation of `DetectWorktreeMainPath` in a new file `packages/utils/internal/worktree_detector.go`. Must produce identical behavior to the TypeScript implementation (TASK-002). Uses `context.WithTimeout` for 3-second subprocess timeout and Go idiomatic error handling while maintaining semantic parity with TypeScript.

## Definition of Done

- [x] [requirement] New file `packages/utils/internal/worktree_detector.go` created #acceptance
- [x] [requirement] `DetectWorktreeMainPath(cwd string) (*WorktreeDetectionResult, error)` exported #acceptance
- [x] [requirement] `WorktreeDetectionResult` struct with `MainWorktreePath` and `IsLinkedWorktree` #acceptance
- [x] [requirement] Fast pre-check for `.git` file/directory #acceptance
- [x] [requirement] Single `git rev-parse` subprocess with 3-second timeout via `context.WithTimeout` #acceptance
- [x] [requirement] Bare repository handling #acceptance
- [x] [requirement] Main worktree detection (commonDir == gitDir) #acceptance
- [x] [requirement] DEBUG and WARN level logging per REQ-006 #acceptance
- [x] [requirement] Unit tests covering all 8 edge cases from DESIGN-002 #acceptance
- [x] [requirement] Tests pass with `go test ./...` #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: M #effort
- [task] Must mirror TypeScript behavior exactly for cross-language parity #parity
- [technique] Use context.WithTimeout for 3-second subprocess timeout #go-patterns
- [technique] Use exec.CommandContext (not exec.Command) for timeout support #go-patterns
- [constraint] Go error handling differs from TS; must still match behavior semantically #cross-language

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | Go port of TypeScript reference implementation; algorithm is defined but Go idioms (error handling, context.WithTimeout) require careful adaptation for behavioral parity |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-001 Worktree Detection via Git Common Dir]]
- implements [[REQ-004 Cross-Language Parity]]
- implements [[DESIGN-002 Detection Algorithm Detail]]
- depends_on [[TASK-001 Config Schema Update]]
- mirrors [[TASK-002 Implement detectWorktreeMainPath TypeScript]]
- enables [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
