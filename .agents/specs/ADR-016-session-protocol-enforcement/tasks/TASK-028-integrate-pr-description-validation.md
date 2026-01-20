---
type: task
id: TASK-028
title: Integrate PR Description Validation into Enforcement
status: complete
priority: P2
complexity: S
estimate: 2h
related:
  - REQ-012
  - TASK-027
blocked_by:
  - TASK-027
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

# TASK-028: Integrate PR Description Validation into Enforcement

## Design Context

- REQ-012: PR Description Validation
- TASK-027: Implement PR Description Validation in Go

## Objective

Integrate Go-based PR description validator into CI workflow via WASM.

## Scope

**In Scope**:

- WASM build for PR description validator
- GitHub Actions workflow integration
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-027)

## Acceptance Criteria

- [ ] WASM build succeeds for pr-description.go
- [ ] GitHub Actions workflow calls validator
- [ ] Integration tests verify WASM invocation
- [ ] CRITICAL issues block PR merge
- [ ] WARNING issues logged but non-blocking
- [ ] Documentation for CI usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register PR validator |
| `.github/workflows/pr-validation.yml` | Create | PR validation workflow |
| `packages/validation/tests/integration/pr-description.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test CRITICAL blocking behavior
- [ ] Test WARNING non-blocking behavior
- [ ] Test error handling
