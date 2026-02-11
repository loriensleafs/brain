---
title: TASK-007 Cross-Language Parity Tests
type: task
status: complete
feature-ref: FEAT-003
effort: M
permalink: features/feat-003-worktree-aware-project-resolution/tasks/task-007-cross-language-parity-tests
---

# TASK-007 Cross-Language Parity Tests

## Description

Create a cross-language parity test suite that verifies all three implementations (TypeScript, Go, Bun hooks) produce identical results for worktree detection scenarios. Tests use shared JSON test fixtures defining input/expected-output pairs and run in each language's test runner to confirm behavioral equivalence.

## Definition of Done

- [x] [requirement] Shared test fixture definitions (JSON) describing input/expected-output pairs #acceptance
- [x] [requirement] Test scenario for linked worktree detection returns main path #acceptance
- [x] [requirement] Test scenario for main worktree returns null (not linked) #acceptance
- [x] [requirement] Test scenario for non-git directory returns null #acceptance
- [x] [requirement] Test scenario for bare repository returns null #acceptance
- [x] [requirement] Test scenario for git not available returns null #acceptance
- [x] [requirement] Test scenario for opt-out via env var disables detection #acceptance
- [x] [requirement] Test scenario for opt-out via config disables detection #acceptance
- [x] [requirement] Test scenario for timeout handling returns null #acceptance
- [x] [requirement] TypeScript, Go, and Bun test runners executing fixture-based tests #acceptance
- [x] [requirement] All three produce identical results for all fixtures #acceptance
- [x] [requirement] Tests integrated into existing CI pipeline #acceptance

## Observations

- [fact] Status: COMPLETE #status
- [fact] Effort: M #effort
- [task] Parity tests prevent implementation drift across languages #quality
- [technique] Shared JSON fixtures ensure identical scenarios across test runners #consistency
- [fact] Existing parity test infrastructure exists at packages/validation/src/__tests__/parity/ #location
- [constraint] Tests need real git repos (not mocks) for worktree creation #test-infrastructure

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | Shared fixture design and 3 parallel test runners; AI generates boilerplate test code efficiently but fixture design and CI integration need human oversight |

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[REQ-004 Cross-Language Parity]]
- depends_on [[TASK-002 Implement detectWorktreeMainPath TypeScript]]
- depends_on [[TASK-003 Implement detectWorktreeMainPath Go]]
- depends_on [[TASK-004 Implement detectWorktreeMainPath Bun Hooks]]
- depends_on [[TASK-005 Add Worktree Fallback to matchCwdToProject]]
