---
type: task
id: TASK-037
title: Implement PR Discovery and Classification in Go
status: complete
priority: P2
complexity: L
estimate: 8h
related:
  - REQ-017
blocked_by: []
blocks:
  - TASK-038
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - pr
  - maintenance
---

# TASK-037: Implement PR Discovery and Classification in Go

## Design Context

- REQ-017: PR Discovery and Classification

## Objective

Port Invoke-PRMaintenance.ps1 to Go with PR discovery, classification, and JSON output for GitHub Actions matrix.

## Scope

**In Scope**:

- Go implementation at `packages/validation/pr-maintenance.go`
- Open PR discovery
- PR classification (agent-controlled, mention-triggered, review-bot)
- Activation trigger detection (CHANGES_REQUESTED, MENTION, CONFLICT)
- Merge conflict detection
- Derivative PR detection (copilot/sub-pr-{number})
- JSON output for workflow matrix
- Comprehensive Go tests at `packages/validation/tests/pr-maintenance_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-038)
- PR processing (delegates to /pr-comment-responder, /merge-resolver)

## Acceptance Criteria

- [ ] Go implementation complete with PR discovery
- [ ] CLI supports -OutputJson, -MaxPRs, -WhatIf flags
- [ ] Discovers all open PRs in repository
- [ ] Classifies PRs by bot category (agent-controlled, mention-triggered, review-bot)
- [ ] Detects activation triggers (CHANGES_REQUESTED, MENTION, CONFLICT)
- [ ] Detects merge conflicts via gh CLI
- [ ] Identifies derivative PRs (copilot/sub-pr-{number})
- [ ] Outputs JSON with prs array and summary statistics
- [ ] Supports -MaxPRs parameter (default: 20)
- [ ] Supports -WhatIf flag for dry-run
- [ ] Respects protected branches (main, master, develop)
- [ ] Exit code 0 success, 2 error
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/pr-maintenance.go` | Create | Main implementation |
| `packages/validation/tests/pr-maintenance_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add PR maintenance types |
| `packages/validation/wasm/main.go` | Modify | Register PR maintenance tool |

## Implementation Notes

**PR Classification**:

- agent-controlled: rjmurillo-bot, rjmurillo[bot]
- mention-triggered: copilot-swe-agent, copilot, app/copilot-swe-agent
- review-bot: coderabbitai, cursor[bot], gemini-code-assist

**Activation Triggers**:

- CHANGES_REQUESTED: agent-controlled PRs with change request reviews
- MENTION: mention-triggered PRs with @mentions in comments
- CONFLICT: PRs with merge conflicts

**Derivative PR Pattern**:

Branch name matches `copilot/sub-pr-{number}`

## Testing Requirements

- [ ] Test PR discovery
- [ ] Test PR classification (all categories)
- [ ] Test activation trigger detection
- [ ] Test merge conflict detection
- [ ] Test derivative PR detection
- [ ] Test JSON output format
- [ ] Test -MaxPRs limit
- [ ] Test -WhatIf mode
- [ ] Test protected branch handling
