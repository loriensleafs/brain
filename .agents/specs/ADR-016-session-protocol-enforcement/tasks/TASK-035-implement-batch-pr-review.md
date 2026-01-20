---
type: task
id: TASK-035
title: Implement Batch PR Review Worktree Management in Go
status: complete
priority: P2
complexity: M
estimate: 6h
related:
  - REQ-016
blocked_by: []
blocks:
  - TASK-036
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - pr
  - worktree
---

# TASK-035: Implement Batch PR Review Worktree Management in Go

## Design Context

- REQ-016: Batch PR Review Worktree Management

## Objective

Port Invoke-BatchPRReview.ps1 to Go with git worktree management for parallel PR review.

## Scope

**In Scope**:

- Go implementation at `packages/validation/batch-pr-review.go`
- Three operations: Setup, Status, Cleanup
- PR branch fetching via gh CLI
- Git worktree creation in parallel
- Worktree status checking (clean, uncommitted, conflicts)
- Worktree removal with -Force flag
- Comprehensive Go tests at `packages/validation/tests/batch-pr-review_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-036)

## Acceptance Criteria

- [ ] Go implementation complete with worktree management
- [ ] CLI supports -Operation (Setup|Status|Cleanup), -PRs, -Force, -WorktreeRoot flags
- [ ] Fetches PR branch names via gh CLI
- [ ] Creates git worktrees for each PR in parallel
- [ ] Fetches branches from origin before creating worktrees
- [ ] Reports worktree creation status (success, exists, failed)
- [ ] Checks worktree status (clean, uncommitted, conflicts)
- [ ] Removes worktrees with Cleanup operation
- [ ] Supports -Force flag to cleanup with uncommitted changes
- [ ] Uses WorktreeRoot parameter (defaults to parent of current repo)
- [ ] Handles gh CLI authentication errors gracefully
- [ ] Handles branch not found errors gracefully
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/batch-pr-review.go` | Create | Main implementation |
| `packages/validation/tests/batch-pr-review_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add batch PR types |
| `packages/validation/wasm/main.go` | Modify | Register batch PR tool |

## Implementation Notes

**Worktree Naming**:

`worktree-pr-{number}` (e.g., worktree-pr-53)

**Operations**:

1. Setup: Create worktrees for specified PRs
2. Status: Report worktree status
3. Cleanup: Remove worktrees (with -Force for uncommitted)

**gh CLI Integration**:

```bash
gh pr view <number> --json headRefName -q .headRefName
```

## Testing Requirements

- [ ] Test Setup operation
- [ ] Test Status operation
- [ ] Test Cleanup operation
- [ ] Test -Force flag
- [ ] Test parallel worktree creation
- [ ] Test gh CLI integration
- [ ] Test error handling (auth, branch not found)
