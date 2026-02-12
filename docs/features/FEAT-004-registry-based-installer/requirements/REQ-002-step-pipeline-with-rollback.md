---
title: REQ-002 Step Pipeline with Rollback
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-002-step-pipeline-with-rollback
---

# REQ-002 Step Pipeline with Rollback

## Requirement Statement

The system MUST implement a step pipeline that executes sequential steps with reverse-order compensation (rollback) on failure. Each step has an optional `Condition` function for idempotent skipping and an optional `Undo` function for rollback. This is a saga-lite pattern implemented in ~50 lines of custom code.

### Pipeline Structure

```go
type Step struct {
    Name      string
    Condition func() bool  // skip if returns false (idempotent guard)
    Action    func() error
    Undo      func() error // nil = no rollback needed
}

type Pipeline struct {
    Steps []Step
}

func (p *Pipeline) Execute() error
```

### Execution Semantics

```text
FOR each step in pipeline:
  1. If Condition != nil && Condition() == false: SKIP (already done)
  2. Execute Action()
  3. If Action fails:
     - Rollback all completed steps in REVERSE order
     - Each completed step's Undo() is called (if non-nil)
     - Return error wrapping step name and original error
  4. If Action succeeds: add to completed list
```

### Rollback Guarantees

- Undo functions are called in reverse order of completion
- Undo failures are logged but do not interrupt the rollback chain
- After rollback completes, the system is in pre-pipeline state
- Condition guards enable re-running a pipeline after partial failure

## Acceptance Criteria

- [ ] [requirement] `Step` struct with `Name`, `Condition`, `Action`, `Undo` fields #acceptance
- [ ] [requirement] `Pipeline` struct with `Steps` slice and `Execute()` method #acceptance
- [ ] [requirement] Steps execute sequentially in order #acceptance
- [ ] [requirement] Steps with `Condition() == false` are skipped #acceptance
- [ ] [requirement] Steps with `nil` Condition always execute #acceptance
- [ ] [requirement] On failure, completed steps' Undo functions called in reverse order #acceptance
- [ ] [requirement] Steps with `nil` Undo are skipped during rollback #acceptance
- [ ] [requirement] Undo failures are logged but do not halt the rollback chain #acceptance
- [ ] [requirement] Error message includes failing step name and wrapped error #acceptance
- [ ] [requirement] Unit tests cover: success path, failure with rollback, condition skip, nil undo #acceptance

## Observations

- [requirement] Saga-lite pattern provides atomic install guarantees without a full workflow engine #design
- [decision] ~50 lines of custom code; rejected goyek, dagu, go-steps as overkill #simplicity
- [technique] Condition guards enable idempotent re-runs after partial failure #idempotency
- [constraint] Undo failures must not interrupt rollback chain to ensure best-effort cleanup #resilience
- [insight] Each tool's Install() method builds its own pipeline, keeping tool-specific logic encapsulated #encapsulation
- [fact] Steps are wrappable in huh/spinner for progress display #ux

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- relates_to [[REQ-004 Claude Code Target]]
- relates_to [[REQ-005 Cursor Target]]
- relates_to [[TASK-002 Step Pipeline with Rollback]]
