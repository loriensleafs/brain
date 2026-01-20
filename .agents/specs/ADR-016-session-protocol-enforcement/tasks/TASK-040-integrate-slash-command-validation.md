---
type: task
id: TASK-040
title: Integrate Slash Command Validation into Enforcement
status: complete
priority: P2
complexity: S
estimate: 2h
related:
  - REQ-018
  - TASK-039
blocked_by:
  - TASK-039
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

# TASK-040: Integrate Slash Command Validation into Enforcement

## Design Context

- REQ-018: Slash Command Format Validation
- TASK-039: Implement Slash Command Format Validation in Go

## Objective

Integrate Go-based slash command validator into CI workflow via WASM.

## Scope

**In Scope**:

- WASM build for slash command validator
- GitHub Actions workflow integration
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-039)

## Acceptance Criteria

- [ ] WASM build succeeds for slash-command.go
- [ ] GitHub Actions workflow calls validator
- [ ] Integration tests verify WASM invocation
- [ ] Format violations block CI
- [ ] Documentation for CI usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register slash command validator |
| `.github/workflows/slash-command-validation.yml` | Create | Slash command validation workflow |
| `packages/validation/tests/integration/slash-command.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test workflow integration
- [ ] Test blocking behavior
- [ ] Test error handling
