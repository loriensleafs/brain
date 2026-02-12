---
title: TASK-010 Per-Tool Code Deletion
type: task
status: proposed
feature-ref: FEAT-005
effort: S
permalink: features/feat-005-unified-tool-engine/tasks/task-010-per-tool-code-deletion
---

# TASK-010 Per-Tool Code Deletion

## Description

Delete the per-tool adapter files and per-tool installer target files after all golden-file and integration tests pass through the engine path. Remove associated per-tool test files. Update any remaining import references. Verify all tests pass after deletion.

### Files to Delete

| File | Lines | Purpose (replaced by engine) |
|---|---|---|
| `internal/adapters/claude.go` | 877 | Claude Code adapter transforms |
| `internal/adapters/cursor.go` | 694 | Cursor adapter transforms |
| `internal/adapters/claude_test.go` | ~500 | Claude Code adapter tests |
| `internal/adapters/cursor_test.go` | ~500 | Cursor adapter tests |
| `internal/installer/targets/claudecode.go` | 225 | Claude Code installer target |
| `internal/installer/targets/cursor.go` | 566 | Cursor installer target |
| `internal/installer/targets/claudecode_test.go` | ~300 | Claude Code target tests |
| `internal/installer/targets/cursor_test.go` | ~200 | Cursor target tests |

### Files to Retain

| File | Location After Migration |
|---|---|
| `shared.go` | `internal/engine/shared.go` (relocated in TASK-003) |
| `compose.go` | `internal/engine/compose.go` (relocated in TASK-003) |
| `source.go` | `internal/engine/source.go` (relocated in TASK-003) |
| `compose_test.go` | `internal/engine/compose_test.go` (relocated in TASK-003) |

## Definition of Done

- [ ] [requirement] All golden-file parity tests pass through engine path (TASK-007 complete) #acceptance
- [ ] [requirement] All integration tests pass through engine path (TASK-009 complete) #acceptance
- [ ] [requirement] Per-tool adapter files deleted (`claude.go`, `cursor.go`) #acceptance
- [ ] [requirement] Per-tool installer target files deleted (`claudecode.go`, `cursor.go`) #acceptance
- [ ] [requirement] Per-tool test files deleted or migrated #acceptance
- [ ] [requirement] `internal/adapters/` directory removed (only contained per-tool files + shared code, shared code already relocated) #acceptance
- [ ] [requirement] All remaining imports updated (no dangling references to deleted files) #acceptance
- [ ] [requirement] Full test suite passes after deletion (`go test ./...`) #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: S #effort
- [task] Final cleanup task; only executes after parity and integration gates pass #sequencing
- [fact] Net deletion: ~3,860 lines of per-tool Go code (source + tests) #impact
- [constraint] Must not delete until TASK-007 and TASK-009 are complete and passing #gate
- [risk] Lingering import references may cause build failures; verify with `go build ./...` #build

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 1 hour |
| AI-Dominant Effort | 0.25 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 3x |
| AI Effort | 0.33 hours |
| Rationale | Mechanical deletion; AI handles file removal and import cleanup reliably |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[DESIGN-001 Engine Architecture]]
- depends_on [[TASK-007 Golden-File Parity Tests]]
- depends_on [[TASK-009 Integration Tests]]
