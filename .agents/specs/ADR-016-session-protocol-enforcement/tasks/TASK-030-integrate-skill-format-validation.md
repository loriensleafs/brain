---
type: task
id: TASK-030
title: Integrate Skill Format Validation into Enforcement
status: complete
priority: P2
complexity: S
estimate: 2h
related:
  - REQ-013
  - TASK-029
blocked_by:
  - TASK-029
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

# TASK-030: Integrate Skill Format Validation into Enforcement

## Design Context

- REQ-013: Skill Format Validation
- TASK-029: Implement Skill Format Validation in Go

## Objective

Integrate Go-based skill format validator into pre-commit workflow via WASM.

## Scope

**In Scope**:

- WASM build for skill format validator
- Pre-commit hook integration for .serena/memories/ changes
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-029)

## Acceptance Criteria

- [ ] WASM build succeeds for skill-format.go
- [ ] Pre-commit hook calls validator for memory changes
- [ ] Integration tests verify WASM invocation
- [ ] Format violations block commit
- [ ] Documentation for pre-commit usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register format validator |
| `.husky/pre-commit` | Modify | Add format validation check |
| `packages/validation/tests/integration/skill-format.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test blocking behavior
- [ ] Test error handling
