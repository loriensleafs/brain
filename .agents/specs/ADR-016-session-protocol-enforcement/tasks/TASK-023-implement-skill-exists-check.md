---
type: task
id: TASK-023
title: Implement Skill Existence Verification in Go
status: complete
priority: P1
complexity: S
estimate: 4h
related:
  - REQ-010
blocked_by: []
blocks:
  - TASK-024
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - skills
---

# TASK-023: Implement Skill Existence Verification in Go

## Design Context

- REQ-010: Skill Existence Verification

## Objective

Port Check-SkillExists.ps1 to Go with dynamic skill discovery and substring matching.

## Scope

**In Scope**:

- Go implementation at `packages/validation/skill-exists.go`
- .claude/skills/github/scripts/ directory scanning
- Operation-based filtering (pr, issue, reactions, label, milestone)
- Substring matching on action names
- List available skills functionality
- Comprehensive Go tests at `packages/validation/tests/skill-exists_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-024)

## Acceptance Criteria

- [ ] Go implementation complete with skill discovery
- [ ] CLI supports -Operation, -Action, -ListAvailable flags
- [ ] Scans .claude/skills/github/scripts/ directory
- [ ] Filters by operation type (pr, issue, reactions, label, milestone)
- [ ] Performs substring matching on action names
- [ ] Returns boolean result for existence checks
- [ ] Lists all available skills by operation
- [ ] Returns false if operation directory doesn't exist
- [ ] Returns false if no matching scripts found
- [ ] Self-documenting output for -ListAvailable
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/skill-exists.go` | Create | Main implementation |
| `packages/validation/tests/skill-exists_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add skill existence types |
| `packages/validation/wasm/main.go` | Modify | Register skill checker |

## Implementation Notes

**Operations**:

- pr
- issue
- reactions
- label
- milestone

**Substring Matching**:

Case-insensitive substring match on script file names.

## Testing Requirements

- [ ] Test operation-based filtering
- [ ] Test substring matching
- [ ] Test -ListAvailable flag
- [ ] Test missing operation directory
- [ ] Test no matching scripts
- [ ] Test all supported operations
