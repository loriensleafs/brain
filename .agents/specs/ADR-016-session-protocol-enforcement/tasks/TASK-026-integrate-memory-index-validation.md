---
type: task
id: TASK-026
title: Integrate Memory Index Validation into Enforcement
status: complete
priority: P2
complexity: S
estimate: 2h
related:
  - REQ-011
  - TASK-025
blocked_by:
  - TASK-025
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

# TASK-026: Integrate Memory Index Validation into Enforcement

## Design Context

- REQ-011: Memory Index Validation
- TASK-025: Implement Memory Index Validation in Go

## Objective

Integrate Go-based memory index validator into pre-commit workflow via WASM.

## Scope

**In Scope**:

- WASM build for memory index validator
- Pre-commit hook integration for .serena/memories/ changes
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-025)

## Acceptance Criteria

- [ ] WASM build succeeds for memory-index.go
- [ ] Pre-commit hook calls validator for memory changes
- [ ] Integration tests verify WASM invocation
- [ ] P0 failures block commit
- [ ] P1/P2 warnings logged but non-blocking
- [ ] Documentation for pre-commit usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register memory validator |
| `.husky/pre-commit` | Modify | Add memory index check |
| `packages/validation/tests/integration/memory-index.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test P0 blocking behavior
- [ ] Test P1/P2 warning behavior
- [ ] Test error handling
