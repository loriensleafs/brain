---
type: task
id: TASK-036
title: Integrate Batch PR Review into Enforcement
status: complete
priority: P2
complexity: S
estimate: 2h
related:
  - REQ-016
  - TASK-035
blocked_by:
  - TASK-035
blocks: []
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - integration
  - wasm
  - inngest
---

# TASK-036: Integrate Batch PR Review into Enforcement

## Design Context

- REQ-016: Batch PR Review Worktree Management
- TASK-035: Implement Batch PR Review Worktree Management in Go

## Objective

Integrate Go-based batch PR review tool into /pr-review Claude command via WASM.

## Scope

**In Scope**:

- WASM build for batch PR review tool
- Claude command integration
- Integration tests

**Out of Scope**:

- Tool implementation (covered by TASK-035)

## Acceptance Criteria

- [ ] WASM build succeeds for batch-pr-review.go
- [ ] /pr-review command calls tool
- [ ] Integration tests verify WASM invocation
- [ ] Error handling for tool failures
- [ ] Documentation for command usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register batch PR tool |
| `.claude/commands/pr-review.md` | Modify | Add worktree management |
| `packages/validation/tests/integration/batch-pr-review.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test command integration
- [ ] Test error handling
