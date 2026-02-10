---
title: TASK-024-remove-ts-adapter-files
type: task
status: pending
feature-ref: FEAT-001
effort-estimate-human: 2h
effort-estimate-ai: 1h
milestone: phase-4
tags:
- task
- phase-4
- removal
- cleanup
- typescript
permalink: features/feat-001-cross-platform-portability/tasks/task-024-remove-ts-adapter-files
---

# TASK-024 Remove TS Adapter Files and Update Tests

## Description

- [fact] Remove TypeScript adapter files (adapters/claude-code.ts, adapters/cursor.ts, adapters/shared.ts, adapters/sync.ts) #removal
- [fact] Remove bun/node adapter dependencies from package.json if no longer needed #cleanup
- [fact] Update or remove TS adapter tests that are now covered by Go adapter tests #tests
- [fact] Update golden file tests to validate Go adapter output instead of TS adapter output #golden-files
- [fact] Grep codebase for remaining references to TS adapter paths and fix #references
- [fact] Update CI pipeline to remove bun adapter invocation steps #ci

## Definition of Done

- [ ] [requirement] All TS adapter files removed from adapters/ directory #removed
- [ ] [requirement] No broken references to TS adapter files in codebase #clean
- [ ] [requirement] Golden file tests updated to validate Go adapter output #golden-files
- [ ] [requirement] CI pipeline updated to remove bun adapter steps #ci
- [ ] [requirement] Build and all tests pass #tests

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 2h |
| AI-Assisted Estimate | 1h |
| Rationale | Mechanical deletion and reference cleanup; similar scope to TASK-013 |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-023-wire-go-adapters-into-cli]]
- supersedes [[TASK-010-create-ts-claude-code-adapter]]
- supersedes [[TASK-014-create-ts-cursor-adapter]]
- relates_to [[TASK-020-add-ci-validation-and-golden-files]]
