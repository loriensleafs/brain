---
type: requirement
id: REQ-017
title: PR Discovery and Classification
status: accepted
priority: P2
category: functional
epic: ADR-016
related:
  - REQ-016
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - pr
  - maintenance
  - classification
  - automation
---

# REQ-017: PR Discovery and Classification

## Requirement Statement

WHEN open PRs require attention
THE SYSTEM SHALL discover, classify, and output JSON for GitHub Actions matrix strategy
SO THAT pr-comment-responder jobs can be spawned in parallel for each actionable PR

## Context

The Invoke-PRMaintenance.ps1 script is a THIN ORCHESTRATION LAYER that identifies PRs needing attention. It ONLY does:

- Discover open PRs
- Classify each PR by activation trigger
- Detect conflicts and derivative PRs
- Output ActionRequired JSON for workflow matrix

Processing is delegated to:

- /pr-comment-responder: Comment acknowledgment, replies, thread resolution
- /merge-resolver: Conflict resolution

**PR Classification**:

- **agent-controlled**: PRs by rjmurillo-bot, rjmurillo[bot]
- **mention-triggered**: PRs by copilot-swe-agent, copilot, app/copilot-swe-agent
- **review-bot**: PRs by coderabbitai, cursor[bot], gemini-code-assist

**Activation Triggers**:

- CHANGES_REQUESTED (agent-controlled PRs with change requests)
- MENTION (mention-triggered PRs with @mentions)
- CONFLICT (PRs with merge conflicts)

Exit codes:

- 0 = Success
- 2 = Error (script failure, API errors, fatal exceptions)

## Acceptance Criteria

- [ ] System discovers all open PRs in repository
- [ ] System classifies PRs by bot category (agent-controlled, mention-triggered, review-bot)
- [ ] System detects activation triggers (CHANGES_REQUESTED, MENTION, CONFLICT)
- [ ] System detects merge conflicts via gh CLI
- [ ] System identifies derivative PRs (copilot/sub-pr-{number} pattern)
- [ ] System supports -OutputJson flag for matrix consumption
- [ ] System outputs JSON with prs array and summary statistics
- [ ] System supports -MaxPRs parameter (default: 20)
- [ ] System supports -WhatIf flag for dry-run mode
- [ ] System uses GitHubCore module for rate limit checking (DRY)
- [ ] System respects protected branches (main, master, develop)

## Rationale

PR discovery and classification enables:

- Parallel processing of multiple PRs via GitHub Actions matrix
- Selective activation based on PR category and triggers
- Conflict detection before merge attempts
- Derivative PR detection for follow-up handling

## Dependencies

- gh CLI (PR discovery, conflict detection)
- GitHubCore.psm1 module (rate limit checking)
- GitHub Actions matrix strategy (for parallel job spawning)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- REQ-016: Batch PR Review Worktree Management
- .agents/architecture/bot-author-feedback-protocol.md
