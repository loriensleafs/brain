---
type: task
id: TASK-032
title: Integrate Traceability Validation into Enforcement
status: complete
priority: P2
complexity: S
estimate: 2h
related:
  - REQ-014
  - TASK-031
blocked_by:
  - TASK-031
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

# TASK-032: Integrate Traceability Validation into Enforcement

## Design Context

- REQ-014: Traceability Cross-Reference Validation
- TASK-031: Implement Traceability Validation in Go

## Objective

Integrate Go-based traceability validator into CI workflow via WASM.

## Scope

**In Scope**:

- WASM build for traceability validator
- GitHub Actions workflow integration
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-031)

## Acceptance Criteria

- [ ] WASM build succeeds for traceability.go
- [ ] GitHub Actions workflow calls validator
- [ ] Integration tests verify WASM invocation
- [ ] Errors block PR merge
- [ ] Warnings logged but non-blocking (unless -Strict)
- [ ] Documentation for CI usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register traceability validator |
| `.github/workflows/spec-validation.yml` | Create | Spec validation workflow |
| `packages/validation/tests/integration/traceability.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test error blocking behavior
- [ ] Test warning non-blocking behavior
- [ ] Test -Strict mode
- [ ] Test error handling
