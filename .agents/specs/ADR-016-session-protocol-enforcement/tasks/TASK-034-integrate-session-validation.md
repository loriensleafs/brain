---
type: task
id: TASK-034
title: Integrate Session Protocol Validation into Enforcement
status: complete
priority: P2
complexity: M
estimate: 4h
related:
  - REQ-015
  - TASK-033
blocked_by:
  - TASK-033
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

# TASK-034: Integrate Session Protocol Validation into Enforcement

## Design Context

- REQ-015: Session Protocol Validation
- TASK-033: Implement Session Protocol Validation in Go

## Objective

Integrate Go-based session validator into session end workflow and pre-commit hook via WASM.

## Scope

**In Scope**:

- WASM build for session validator
- Inngest function registration
- Session end workflow integration
- Pre-commit hook integration
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-033)

## Acceptance Criteria

- [ ] WASM build succeeds for session.go
- [ ] Inngest function registered for session validation
- [ ] Session end workflow calls validator
- [ ] Pre-commit hook calls validator (pre-commit mode)
- [ ] Integration tests verify WASM invocation
- [ ] Validator failures block session completion
- [ ] Error handling for validator failures
- [ ] Performance metrics logged
- [ ] Documentation for workflow usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register session validator |
| `apps/session-protocol/inngest/functions/validate-session.ts` | Create | Inngest function wrapper |
| `apps/session-protocol/inngest/workflows/session-end.ts` | Modify | Add session validation step |
| `.husky/pre-commit` | Modify | Add session validation check |
| `packages/validation/tests/integration/session.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test Inngest function
- [ ] Test session end workflow integration
- [ ] Test pre-commit hook integration
- [ ] Test error handling
- [ ] Test performance metrics
