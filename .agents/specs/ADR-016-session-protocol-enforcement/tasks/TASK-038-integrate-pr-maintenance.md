---
type: task
id: TASK-038
title: Integrate PR Maintenance into Enforcement
status: complete
priority: P2
complexity: M
estimate: 4h
related:
  - REQ-017
  - TASK-037
blocked_by:
  - TASK-037
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

# TASK-038: Integrate PR Maintenance into Enforcement

## Design Context

- REQ-017: PR Discovery and Classification
- TASK-037: Implement PR Discovery and Classification in Go

## Objective

Integrate Go-based PR maintenance tool into GitHub Actions workflow via WASM.

## Scope

**In Scope**:

- WASM build for PR maintenance tool
- GitHub Actions workflow integration
- Matrix strategy configuration
- Integration tests

**Out of Scope**:

- Tool implementation (covered by TASK-037)

## Acceptance Criteria

- [ ] WASM build succeeds for pr-maintenance.go
- [ ] GitHub Actions workflow calls tool
- [ ] Matrix strategy consumes JSON output
- [ ] Parallel job spawning verified
- [ ] Integration tests verify WASM invocation
- [ ] Error handling for tool failures
- [ ] Documentation for workflow usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register PR maintenance tool |
| `.github/workflows/pr-maintenance.yml` | Create | PR maintenance workflow |
| `packages/validation/tests/integration/pr-maintenance.test.ts` | Create | Integration tests |

## Testing Requirements

- [ ] Test WASM invocation
- [ ] Test workflow integration
- [ ] Test matrix strategy
- [ ] Test parallel job spawning
- [ ] Test error handling
