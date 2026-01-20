---
type: task
id: TASK-020
title: Integrate Skill Violation Detection into Enforcement
status: complete
priority: P1
complexity: S
estimate: 2h
related:
  - REQ-008
  - TASK-019
blocked_by:
  - TASK-019
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

# TASK-020: Integrate Skill Violation Detection into Enforcement

## Design Context

- REQ-008: Skill Violation Detection
- TASK-019: Implement Skill Violation Detection in Go

## Objective

Integrate Go-based skill violation detector into pre-commit workflow via WASM.

## Scope

**In Scope**:

- WASM build for skill violation detector
- Pre-commit hook integration
- Integration tests

**Out of Scope**:

- Detector implementation (covered by TASK-019)

## Acceptance Criteria

- [ ] WASM build succeeds for skill-violation.go
- [ ] Pre-commit hook calls detector
- [ ] Integration tests verify WASM invocation
- [ ] Non-blocking behavior verified
- [ ] Documentation for pre-commit usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register skill violation detector |
| `.husky/pre-commit` | Modify | Add skill violation check |
| `packages/validation/tests/integration/skill-violation.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test non-blocking behavior
- [ ] Test error handling
