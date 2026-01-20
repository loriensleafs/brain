---
type: task
id: TASK-029
title: Implement Skill Format Validation in Go
status: complete
priority: P2
complexity: M
estimate: 5h
related:
  - REQ-013
blocked_by: []
blocks:
  - TASK-030
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - skills
  - ADR-017
---

# TASK-029: Implement Skill Format Validation in Go

## Design Context

- REQ-013: Skill Format Validation

## Objective

Port Validate-SkillFormat.ps1 to Go with atomic format and naming validation for ADR-017.

## Scope

**In Scope**:

- Go implementation at `packages/validation/skill-format.go`
- .serena/memories/ directory scanning
- Bundled format detection (multiple ## Skill- headers)
- skill- prefix detection in file names
- Staged-only mode
- Changed files parameter for CI
- Comprehensive Go tests at `packages/validation/tests/skill-format_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-030)

## Acceptance Criteria

- [ ] Go implementation complete with format validation
- [ ] CLI supports -StagedOnly, -ChangedFiles, -CI flags
- [ ] Scans .serena/memories/ directory
- [ ] Excludes index files (skills-*-index.md, memory-index.md)
- [ ] Detects bundled format (multiple ## Skill- headers)
- [ ] Detects invalid skill- prefix in file names
- [ ] Reports bundled files with skill count
- [ ] Reports prefix violations
- [ ] BLOCKING failure in CI mode
- [ ] Non-blocking warning for local development
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/skill-format.go` | Create | Main implementation |
| `packages/validation/tests/skill-format_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add skill format types |
| `packages/validation/wasm/main.go` | Modify | Register format validator |

## Implementation Notes

**Bundled Format Detection**:

```go
bundledPattern := regexp.MustCompile(`(?m)^## Skill-[A-Za-z]+-[0-9]+:`)
```

**skill- Prefix Detection**:

Check if file name starts with "skill-" (case-insensitive).

## Testing Requirements

- [ ] Test bundled format detection
- [ ] Test skill- prefix detection
- [ ] Test index file exclusion
- [ ] Test staged-only mode
- [ ] Test changed files parameter
- [ ] Test CI blocking behavior
- [ ] Test local warning behavior
