---
title: TASK-025-verify-build-and-tests
type: task
status: complete
feature-ref: FEAT-001
effort-estimate-human: 2h
effort-estimate-ai: 1h
milestone: phase-4
tags:
- task
- phase-4
- verification
- testing
- ci
permalink: features/feat-001-cross-platform-portability/tasks/task-025-verify-build-and-tests
---

# TASK-025 Verify Build and Tests Pass

## Description

- [fact] Run full Go build to verify adapter migration compiles cleanly #build
- [fact] Run Go unit tests for both Claude and Cursor adapters #unit-tests
- [fact] Run integration tests for brain install, brain claude, and brain cursor commands #integration
- [fact] Verify golden file snapshots match Go adapter output #golden-files
- [fact] Run CI validation pipeline end-to-end #ci
- [fact] Verify no bun/node subprocess calls remain in any adapter or install path #no-bun

## Definition of Done

- [x] [requirement] `go build ./...` passes with zero errors #build
- [x] [requirement] `go test ./...` passes with zero failures #unit-tests
- [x] [requirement] Integration tests for install and launcher commands pass #integration
- [x] [requirement] Golden file validation passes #golden-files
- [x] [requirement] CI pipeline runs green #ci
- [x] [requirement] No runtime dependency on bun/node for adapter operations #no-bun

## Effort Summary

| Estimate Type | Value |
|:--|:--|
| Tier Classification | Tier 1 (AI-Dominant) |
| Human Estimate | 2h |
| AI-Assisted Estimate | 1h |
| Rationale | Verification and validation of previously implemented work; mostly running existing test suites |

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- blocked_by [[TASK-024-remove-ts-adapter-files]]
- validates [[TASK-021-write-go-claude-code-adapter]]
- validates [[TASK-022-write-go-cursor-adapter]]
- validates [[TASK-023-wire-go-adapters-into-cli]]
- relates_to [[TASK-020-add-ci-validation-and-golden-files]]
