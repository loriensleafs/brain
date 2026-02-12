---
title: TASK-002 Step Pipeline with Rollback
type: task
status: pending
feature-ref: FEAT-004
effort: S
permalink: features/feat-004-registry-based-installer/tasks/task-002-step-pipeline-with-rollback
---

# TASK-002 Step Pipeline with Rollback

## Description

Implement the `Step` struct and `Pipeline` type with `Execute()` method at `internal/installer/pipeline.go`. The pipeline executes steps sequentially with Condition-based skipping and reverse-order Undo on failure. Implementation is ~50 lines. Undo failures are logged but do not interrupt the rollback chain.

## Definition of Done

- [ ] [requirement] File `internal/installer/pipeline.go` created #acceptance
- [ ] [requirement] `Step` struct with Name, Condition, Action, Undo fields #acceptance
- [ ] [requirement] `Pipeline` struct with Steps slice #acceptance
- [ ] [requirement] `Execute()` runs steps sequentially #acceptance
- [ ] [requirement] Steps with Condition() == false are skipped #acceptance
- [ ] [requirement] On failure, Undo called in reverse order on completed steps #acceptance
- [ ] [requirement] Nil Undo skipped during rollback #acceptance
- [ ] [requirement] Undo failures logged but do not halt rollback #acceptance
- [ ] [requirement] Error message wraps step name and original error #acceptance
- [ ] [requirement] Unit tests: success, failure+rollback, condition skip, nil undo, undo failure #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: S #effort
- [task] ~50 lines of code; simplicity is a feature #size
- [decision] Custom implementation over libraries (goyek, dagu, go-steps) because they add more code than they save #simplicity
- [constraint] Undo failures must not interrupt rollback to ensure best-effort cleanup #resilience
- [fact] File location: `apps/tui/internal/installer/pipeline.go` #location

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 2 hours |
| AI-Dominant Effort | 0.5 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 4x |
| AI Effort | 0.5 hours |
| Rationale | Well-defined ~50 line implementation with clear semantics; AI generates with high confidence |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-002 Step Pipeline with Rollback]]
- implements [[DESIGN-001 Registry and Pipeline Architecture]]
- enables [[TASK-006 Claude Code Target]]
- enables [[TASK-007 Cursor Target]]
