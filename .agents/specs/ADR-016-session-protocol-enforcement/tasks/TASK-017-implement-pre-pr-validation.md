---
type: task
id: TASK-017
title: Implement Pre-PR Validation Runner in Go
status: complete
priority: P0
complexity: M
estimate: 6h
related:
  - REQ-007
blocked_by: []
blocks:
  - TASK-018
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - pre-pr
---

# TASK-017: Implement Pre-PR Validation Runner in Go

## Design Context

- REQ-007: Pre-PR Unified Validation Runner

## Objective

Port Validate-PrePR.ps1 to Go with unified validation orchestration, including:

- Session end validation (latest session log)
- Test execution orchestration
- Markdown linting execution
- Path normalization checks
- Planning artifacts validation
- Agent drift detection
- Quick mode for rapid iteration
- Colored console output with timing

## Scope

**In Scope**:

- Go implementation at `packages/validation/pre-pr.go`
- Validation orchestration in optimized order (fast first)
- CLI flag parsing (-Quick, -SkipTests, -SessionLog, -CI)
- Integration with other validators via function calls
- Comprehensive Go tests at `packages/validation/tests/pre-pr_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-018)
- Test framework implementation (delegates to existing)

## Acceptance Criteria

- [ ] Go implementation complete with all validation steps
- [ ] CLI supports -Quick, -SkipTests, -SessionLog, -CI flags
- [ ] Execution order optimized (fast checks first)
- [ ] Session end validation integrated
- [ ] Test execution orchestration (skip with -SkipTests)
- [ ] Markdown linting execution (via npx)
- [ ] Path normalization validation integrated
- [ ] Planning artifacts validation integrated
- [ ] Agent drift detection integrated
- [ ] Console output with colored [PASS]/[FAIL]/[SKIP] indicators
- [ ] Timing statistics for each validation step
- [ ] Summary report with pass/fail/skip counts
- [ ] Exit code 0 on success, 1 on failure, 2 on error
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/pre-pr.go` | Create | Main orchestration |
| `packages/validation/tests/pre-pr_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add pre-PR validation types |
| `packages/validation/wasm/main.go` | Modify | Register pre-PR validator |

## Implementation Notes

**Execution Order**:

1. Session end validation (fast)
2. Pester tests (slow, skippable with -Quick or -SkipTests)
3. Markdown linting (medium, auto-fix)
4. Path normalization (slow, skippable with -Quick)
5. Planning artifacts (slow, skippable with -Quick)
6. Agent drift detection (slow, skippable with -Quick)

**Integration Points**:

- Call validate-session.go for session validation
- Call validate-consistency.go for planning validation
- Shell out to npx markdownlint-cli2 for linting
- Call validate-path-normalization.go for path checks
- Call detect-agent-drift.go for drift detection

## Testing Requirements

- [ ] Test full validation run (all steps)
- [ ] Test -Quick mode (skips slow validations)
- [ ] Test -SkipTests mode (skips test execution)
- [ ] Test individual validation step failures
- [ ] Test timing statistics collection
- [ ] Test summary report generation
- [ ] Test exit code behavior
- [ ] Test error handling (missing dependencies)
