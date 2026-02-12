---
title: TASK-003 Relocate Shared Code to Engine Package
type: task
status: proposed
feature-ref: FEAT-005
effort: S
permalink: features/feat-005-unified-tool-engine/tasks/task-003-relocate-shared-code-to-engine-package
---

# TASK-003 Relocate Shared Code to Engine Package

## Description

Move `shared.go`, `compose.go`, and `source.go` from `internal/adapters/` to `internal/engine/`. Update package declarations, import paths across the codebase, and verify all existing tests pass after relocation. The file contents remain unchanged; only package membership changes.

## Definition of Done

- [ ] [requirement] `shared.go` moved to `internal/engine/shared.go` with package declaration updated #acceptance
- [ ] [requirement] `compose.go` moved to `internal/engine/compose.go` with package declaration updated #acceptance
- [ ] [requirement] `source.go` moved to `internal/engine/source.go` with package declaration updated #acceptance
- [ ] [requirement] All import paths referencing `adapters.GeneratedFile`, `adapters.BrainConfig`, `adapters.TemplateSource` updated to `engine.` #acceptance
- [ ] [requirement] Existing per-tool adapter files (`claude.go`, `cursor.go`) updated to import from `engine` package #acceptance
- [ ] [requirement] Existing installer targets updated to import from `engine` package #acceptance
- [ ] [requirement] `compose_test.go` relocated and passes #acceptance
- [ ] [requirement] All existing tests pass with no behavior changes #acceptance

## Observations

- [fact] Status: PROPOSED #status
- [fact] Effort: S #effort
- [task] Mechanical refactor; no logic changes, only package moves and import updates #nature
- [constraint] Must not change any function signatures or behavior #backward-compatible
- [risk] Import cycles if engine/ imports adapters/ or vice versa; verify with `go vet` #build
- [technique] `goimports` can automatically fix import paths after move #tooling

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | S |
| Human Effort | 2 hours |
| AI-Dominant Effort | 0.5 hours |
| AI Tier | Tier 1 (AI-Dominant) |
| AI Multiplier | 3x |
| AI Effort | 0.67 hours |
| Rationale | Pure mechanical move; AI handles package renaming and import path updates reliably |

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[DESIGN-001 Engine Architecture]]
- enables [[TASK-004 Generic Transform Engine]]
- enables [[TASK-005 Placement Strategy Abstraction]]
