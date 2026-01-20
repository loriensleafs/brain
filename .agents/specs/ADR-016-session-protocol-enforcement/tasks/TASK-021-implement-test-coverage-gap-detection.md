---
type: task
id: TASK-021
title: Implement Test Coverage Gap Detection in Go
status: complete
priority: P1
complexity: M
estimate: 5h
related:
  - REQ-009
blocked_by: []
blocks:
  - TASK-022
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - testing
---

# TASK-021: Implement Test Coverage Gap Detection in Go

## Design Context

- REQ-009: Test Coverage Gap Detection

## Objective

Port Detect-TestCoverageGaps.ps1 to Go with gap detection for PowerShell files without corresponding test files.

## Scope

**In Scope**:

- Go implementation at `packages/validation/test-coverage-gaps.go`
- .ps1 file scanning
- Test file existence checking (.Tests.ps1)
- Default ignore patterns (build/, tests/, .github/, install scripts, common modules)
- Custom ignore patterns via file
- Comprehensive Go tests at `packages/validation/tests/test-coverage-gaps_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-022)
- Test file generation

## Acceptance Criteria

- [ ] Go implementation complete with gap detection
- [ ] CLI supports -StagedOnly, -IgnoreFile, -Path flags
- [ ] Scans for .ps1 files (excluding .Tests.ps1)
- [ ] Checks for test files in same directory
- [ ] Checks for test files in tests/ subdirectory
- [ ] Applies default ignore patterns
- [ ] Supports custom ignore patterns via file
- [ ] Reports missing test files with expected paths
- [ ] Exit code 0 (non-blocking warning)
- [ ] Excludes .git and node_modules directories
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/test-coverage-gaps.go` | Create | Main implementation |
| `packages/validation/tests/test-coverage-gaps_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add test coverage types |
| `packages/validation/wasm/main.go` | Modify | Register gap detector |

## Implementation Notes

**Default Ignore Patterns**:

```go
var defaultIgnorePatterns = []string{
    `\.Tests\.ps1$`,
    `tests?[\\/]`,
    `build[\\/]`,
    `.github[\\/]`,
    `install.*\.ps1$`,
    `Common\.psm1$`,
    `AIReviewCommon\.psm1$`,
}
```

## Testing Requirements

- [ ] Test gap detection for files without tests
- [ ] Test same directory test file detection
- [ ] Test tests/ subdirectory detection
- [ ] Test default ignore patterns
- [ ] Test custom ignore patterns
- [ ] Test staged-only mode
- [ ] Test directory exclusions
