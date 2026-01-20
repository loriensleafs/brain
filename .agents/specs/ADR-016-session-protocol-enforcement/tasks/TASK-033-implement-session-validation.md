---
type: task
id: TASK-033
title: Implement Session Protocol Validation in Go
status: complete
priority: P2
complexity: L
estimate: 10h
related:
  - REQ-015
blocked_by: []
blocks:
  - TASK-034
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - session
---

# TASK-033: Implement Session Protocol Validation in Go

## Design Context

- REQ-015: Session Protocol Validation

## Objective

Port Validate-Session.ps1 to Go with fail-closed verification-based enforcement.

## Scope

**In Scope**:

- Go implementation at `packages/validation/session.go`
- Canonical protocol reading (SESSION-PROTOCOL.md)
- Session Start checklist validation
- Memory evidence validation (ADR-007 E2)
- Session End checklist validation
- QA skip rules (docs-only, investigation-only)
- Git worktree and commit validation
- Markdown linting validation
- Pre-commit mode support
- Comprehensive Go tests at `packages/validation/tests/session_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-034)

## Acceptance Criteria

- [ ] Go implementation complete with session validation
- [ ] CLI supports -SessionLog, -FixMarkdown, -PreCommit, -CI flags
- [ ] Reads canonical protocol from SESSION-PROTOCOL.md
- [ ] Parses Session Start checklist table
- [ ] Validates Session Start MUST rows checked
- [ ] Validates memory-index Evidence contains actual memory names
- [ ] Verifies referenced memories exist in .serena/memories/
- [ ] Parses Session End checklist table
- [ ] Enforces template match (Req, Step order)
- [ ] Validates Session End MUST rows checked
- [ ] Validates QA row (CRITICAL or SKIPPED with valid reason)
- [ ] Supports docs-only QA skip (only .md changed)
- [ ] Supports investigation-only QA skip (only .agents/, .serena/ changed)
- [ ] Validates git worktree clean (skip in pre-commit)
- [ ] Validates at least one commit since starting (skip in pre-commit)
- [ ] Validates Commit SHA evidence (skip in pre-commit)
- [ ] Runs markdownlint validation
- [ ] Supports -FixMarkdown flag
- [ ] Provides pedagogical error messages
- [ ] Exit code 0 PASS, 1 FAIL, 2 error
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/session.go` | Create | Main implementation |
| `packages/validation/tests/session_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add session validation types |
| `packages/validation/wasm/main.go` | Modify | Register session validator |

## Implementation Notes

**Checklist Table Parsing**:

Parse markdown tables with columns: Req Level, Step, Verification, Evidence

**Memory Evidence Validation (ADR-007 E2)**:

1. Extract memory names from Evidence column (memory-index row)
2. Verify each memory file exists in .serena/memories/
3. Fail-closed: If cannot parse or verify, validation FAILS

**QA Skip Rules**:

- Docs-only: git diff shows only .md files changed
- Investigation-only: git diff shows only .agents/sessions/, .agents/analysis/, .serena/memories/ changed

## Testing Requirements

- [ ] Test Session Start validation
- [ ] Test memory evidence validation (E2)
- [ ] Test Session End validation
- [ ] Test QA skip rules
- [ ] Test git worktree validation
- [ ] Test commit SHA validation
- [ ] Test markdownlint integration
- [ ] Test pre-commit mode
- [ ] Test pedagogical error messages
- [ ] Test exit codes
