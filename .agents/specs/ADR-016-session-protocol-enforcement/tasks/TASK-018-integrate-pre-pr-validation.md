---
type: task
id: TASK-018
title: Integrate Pre-PR Validation into Enforcement
status: complete
priority: P0
complexity: S
estimate: 2h
related:
  - REQ-007
  - TASK-017
blocked_by:
  - TASK-017
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

# TASK-018: Integrate Pre-PR Validation into Enforcement

## Design Context

- REQ-007: Pre-PR Unified Validation Runner
- TASK-017: Implement Pre-PR Validation Runner in Go

## Objective

Integrate Go-based pre-PR validator into local development workflow via WASM build.

## Scope

**In Scope**:

- WASM build for pre-PR validator
- CLI wrapper script for local invocation
- Integration tests

**Out of Scope**:

- Validator implementation (covered by TASK-017)
- CI workflow integration (local dev tool only)

## Acceptance Criteria

- [ ] WASM build succeeds for pre-pr.go
- [ ] CLI wrapper script created for easy invocation
- [ ] Integration tests verify WASM invocation
- [ ] Error handling for validator failures
- [ ] Documentation for local usage

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register pre-PR validator |
| `scripts/validate-pre-pr.sh` | Create | CLI wrapper script |
| `packages/validation/tests/integration/pre-pr.test.ts` | Create | Integration tests |

## Implementation Notes

**CLI Wrapper**:

```bash
#!/bin/bash
# Wrapper for WASM-based pre-PR validation
node packages/validation/wasm/runner.js pre-pr "$@"
```

## Testing Requirements

- [ ] Test WASM compilation and loading
- [ ] Test CLI wrapper invocation
- [ ] Test error handling (WASM panic, invalid input)
