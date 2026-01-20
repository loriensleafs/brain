---
type: task
id: TASK-019
title: Implement Skill Violation Detection in Go
status: complete
priority: P1
complexity: M
estimate: 5h
related:
  - REQ-008
blocked_by: []
blocks:
  - TASK-020
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

# TASK-019: Implement Skill Violation Detection in Go

## Design Context

- REQ-008: Skill Violation Detection

## Objective

Port Detect-SkillViolation.ps1 to Go with pattern detection for raw `gh` command usage, including:

- File scanning (markdown and PowerShell files)
- Pattern detection (gh pr, gh issue, gh api, gh repo)
- Skill capability checking
- Staged-only mode
- Non-blocking warning output

## Scope

**In Scope**:

- Go implementation at `packages/validation/skill-violation.go`
- Pattern regex matching for gh commands
- Skill directory verification (.claude/skills/github/)
- CLI flag parsing (-StagedOnly, -Path)
- Comprehensive Go tests at `packages/validation/tests/skill-violation_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-020)
- Skill creation (detection only)

## Acceptance Criteria

- [ ] Go implementation complete with pattern detection
- [ ] CLI supports -StagedOnly, -Path flags
- [ ] Scans .md, .ps1, .psm1 files
- [ ] Detects gh pr (create|merge|close|view|list|diff) patterns
- [ ] Detects gh issue (create|close|view|list) patterns
- [ ] Detects gh api patterns
- [ ] Detects gh repo patterns
- [ ] Verifies .claude/skills/github/ directory exists
- [ ] Reports file path and line number for violations
- [ ] Tracks missing skill capabilities
- [ ] Exit code 0 (non-blocking warning)
- [ ] Suggests checking skill directory
- [ ] References skill-usage-mandatory.md
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/skill-violation.go` | Create | Main implementation |
| `packages/validation/tests/skill-violation_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add skill violation types |
| `packages/validation/wasm/main.go` | Modify | Register skill violation detector |

## Implementation Notes

**Patterns**:

```go
var ghPatterns = []string{
    `gh\s+pr\s+(create|merge|close|view|list|diff)`,
    `gh\s+issue\s+(create|close|view|list)`,
    `gh\s+api\s+`,
    `gh\s+repo\s+`,
}
```

**Skill Capability Tracking**:

Track unique operation types (pr, issue, api, repo) found in violations.

## Testing Requirements

- [ ] Test pattern detection for gh pr commands
- [ ] Test pattern detection for gh issue commands
- [ ] Test pattern detection for gh api commands
- [ ] Test pattern detection for gh repo commands
- [ ] Test file type filtering (.md, .ps1, .psm1)
- [ ] Test staged-only mode
- [ ] Test skill directory verification
- [ ] Test line number reporting
- [ ] Test capability tracking
