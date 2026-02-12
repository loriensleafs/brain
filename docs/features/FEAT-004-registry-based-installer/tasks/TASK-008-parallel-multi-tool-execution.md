---
title: TASK-008 Parallel Multi-Tool Execution
type: task
status: pending
feature-ref: FEAT-004
effort: M
permalink: features/feat-004-registry-based-installer/tasks/task-008-parallel-multi-tool-execution
---

# TASK-008 Parallel Multi-Tool Execution

## Description

Implement parallel multi-tool execution using `errgroup.WithContext` and `SetLimit`. Each tool's `Install()` is called in a separate goroutine. Output is buffered per tool to prevent interleaving. First failure cancels remaining installs via context. Pipeline steps should check `ctx.Done()` between steps for early abort. This is the orchestration layer between the install command UI and the per-tool pipelines.

## Definition of Done

- [ ] [requirement] `errgroup.WithContext` used for parallel goroutine management #acceptance
- [ ] [requirement] `SetLimit` matches number of confirmed tools #acceptance
- [ ] [requirement] Each tool's Install() runs in its own goroutine #acceptance
- [ ] [requirement] Per-tool output buffered to `bytes.Buffer` #acceptance
- [ ] [requirement] Buffers flushed to stdout after each tool completes #acceptance
- [ ] [requirement] First failure cancels remaining tools via context cancellation #acceptance
- [ ] [requirement] Pipeline Execute() accepts context and checks Done() between steps #acceptance
- [ ] [requirement] Per-tool success/failure reported individually #acceptance
- [ ] [requirement] Single tool install works correctly (N=1 parallel) #acceptance
- [ ] [requirement] Tests verify parallel execution, cancellation, and buffered output #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: M #effort
- [task] Requires updating Pipeline.Execute() signature to accept context.Context #api-change
- [technique] errgroup is stdlib-adjacent; maintained by Go team with same release cadence #dependency
- [constraint] Each tool has independent config dirs; no shared state means no locking needed #independence
- [risk] Context cancellation between pipeline steps means a tool may be partially installed on cancel; rollback handles this #rollback
- [insight] Buffered output is simple: bytes.Buffer per goroutine, flush after completion #implementation

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 4 hours |
| AI-Dominant Effort | 1 hour |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 2 hours |
| Rationale | errgroup pattern is well-documented but context propagation into pipeline and buffered output require careful integration |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-006 Parallel Multi-Tool Execution]]
- implements [[DESIGN-001 Registry and Pipeline Architecture]]
- depends_on [[TASK-001 Registry and ToolInstaller Interface]]
- depends_on [[TASK-002 Step Pipeline with Rollback]]
- depends_on [[TASK-006 Claude Code Target]]
- depends_on [[TASK-007 Cursor Target]]
- enables [[TASK-009 Install Command Rewrite]]
