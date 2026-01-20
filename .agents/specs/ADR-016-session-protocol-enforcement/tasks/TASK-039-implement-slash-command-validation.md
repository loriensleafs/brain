---
type: task
id: TASK-039
title: Implement Slash Command Format Validation in Go
status: complete
priority: P2
complexity: M
estimate: 5h
related:
  - REQ-018
blocked_by: []
blocks:
  - TASK-040
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - slash-commands
  - ADR-006
---

# TASK-039: Implement Slash Command Format Validation in Go

## Design Context

- REQ-018: Slash Command Format Validation

## Objective

Port SlashCommandValidator.psm1 to Go with format validation orchestration for slash commands.

## Scope

**In Scope**:

- Go implementation at `packages/validation/slash-command.go`
- .claude/commands/ directory scanning (recursive)
- Format validation delegation (calls Validate-SlashCommand.ps1 logic)
- Result aggregation
- Exit code behavior
- Comprehensive Go tests at `packages/validation/tests/slash-command_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-040)
- Slash command format rules (uses existing validation logic)

## Acceptance Criteria

- [ ] Go implementation complete with validation orchestration
- [ ] CLI supports -Path, -CI flags
- [ ] Discovers all .md files in .claude/commands/ (recursive)
- [ ] Validates format for each discovered file
- [ ] Tracks validation results per file
- [ ] Reports failed files with count
- [ ] Exit code 0 if all validations pass
- [ ] Exit code 1 if any validation fails
- [ ] Handles missing .claude/commands/ gracefully (skip)
- [ ] Handles missing validation logic gracefully (report error)
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/slash-command.go` | Create | Main implementation |
| `packages/validation/tests/slash-command_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add slash command types |
| `packages/validation/wasm/main.go` | Modify | Register slash command validator |

## Implementation Notes

**Validation Logic**:

Call existing Validate-SlashCommand.ps1 logic for each file. Focus on orchestration, not reimplementing validation rules.

**Directory Scanning**:

Recursive scan of .claude/commands/ for .md files.

## Testing Requirements

- [ ] Test directory scanning
- [ ] Test validation orchestration
- [ ] Test result aggregation
- [ ] Test exit code behavior
- [ ] Test missing directory handling
- [ ] Test error handling
