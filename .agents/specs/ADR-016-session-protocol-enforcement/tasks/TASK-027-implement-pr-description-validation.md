---
type: task
id: TASK-027
title: Implement PR Description Validation in Go
status: complete
priority: P2
complexity: M
estimate: 6h
related:
  - REQ-012
blocked_by: []
blocks:
  - TASK-028
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - pr
---

# TASK-027: Implement PR Description Validation in Go

## Design Context

- REQ-012: PR Description Validation

## Objective

Port Validate-PRDescription.ps1 to Go with description/diff mismatch detection.

## Scope

**In Scope**:

- Go implementation at `packages/validation/pr-description.go`
- PR data fetching via gh CLI
- File reference extraction (multiple patterns)
- CRITICAL check: mentioned files exist in diff
- WARNING check: major files changed but not mentioned
- Suffix matching and path normalization
- Comprehensive Go tests at `packages/validation/tests/pr-description_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-028)

## Acceptance Criteria

- [ ] Go implementation complete with mismatch detection
- [ ] CLI supports -PR, -Owner, -Repo, -CI flags
- [ ] Fetches PR data (title, body, changed files) via gh
- [ ] Extracts file references from description (inline code, bold, list, links)
- [ ] CRITICAL: Validates mentioned files exist in diff
- [ ] WARNING: Detects significant files not mentioned (.ps1, .cs, .ts, .js, .py, .yml)
- [ ] Supports suffix matching (file.ps1 matches path/to/file.ps1)
- [ ] Normalizes path separators (backslash to forward slash)
- [ ] Reports CRITICAL issues with severity Red
- [ ] Reports WARNING issues with severity Yellow
- [ ] Exit code 1 in CI mode on CRITICAL issues
- [ ] Exit code 0 on WARNINGS (non-blocking)
- [ ] Defaults to git remote for Owner/Repo
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/pr-description.go` | Create | Main implementation |
| `packages/validation/tests/pr-description_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add PR validation types |
| `packages/validation/wasm/main.go` | Modify | Register PR validator |

## Implementation Notes

**File Reference Patterns**:

```go
var fileRefPatterns = []string{
    "`([^`]+\\.(ps1|cs|ts|js|py|yml|yaml|md|go))`",         // inline code
    "\\*\\*([^*]+\\.(ps1|cs|ts|js|py|yml|yaml|md|go))\\*\\*", // bold
    "^[\\s-]+([^\\s]+\\.(ps1|cs|ts|js|py|yml|yaml|md|go))",  // list items
    "\\[([^]]+)\\]\\(([^)]+\\.(ps1|cs|ts|js|py|yml|yaml|md|go))\\)", // markdown links
}
```

**Major File Extensions**:

.ps1, .cs, .ts, .js, .py, .yml, .yaml

## Testing Requirements

- [ ] Test file reference extraction (all patterns)
- [ ] Test CRITICAL check (mentioned but not in diff)
- [ ] Test WARNING check (major files not mentioned)
- [ ] Test suffix matching
- [ ] Test path normalization
- [ ] Test gh CLI integration
- [ ] Test exit code behavior
- [ ] Test default Owner/Repo from git remote
