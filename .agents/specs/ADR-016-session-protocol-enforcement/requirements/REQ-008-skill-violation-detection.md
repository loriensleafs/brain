---
type: requirement
id: REQ-008
title: Skill Violation Detection
status: accepted
priority: P1
category: functional
epic: ADR-016
related: []
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - skills
  - github
  - guardrails
---

# REQ-008: Skill Violation Detection

## Requirement Statement

WHEN code or documentation contains raw `gh` command usage
THE SYSTEM SHALL detect these patterns and warn when equivalent GitHub skill scripts exist in .claude/skills/github/
SO THAT developers use skill abstractions for better error handling, consistency, and auditability

## Context

The Detect-SkillViolation.ps1 script implements Phase 1 guardrail from Issue #230. It detects raw `gh` command patterns in markdown and PowerShell files and warns when these capabilities should use GitHub skill scripts instead.

Detected patterns:

- `gh pr (create|merge|close|view|list|diff)`
- `gh issue (create|close|view|list)`
- `gh api`
- `gh repo`

This is a NON-BLOCKING WARNING that helps identify missing skill capabilities.

## Acceptance Criteria

- [ ] System scans markdown (.md) and PowerShell (.ps1, .psm1) files
- [ ] System detects raw `gh` command usage patterns
- [ ] System verifies if .claude/skills/github/ directory exists
- [ ] System supports -StagedOnly flag to check only git-staged files
- [ ] System reports file path and line number for each violation
- [ ] System tracks missing skill capabilities (e.g., "gh pr", "gh issue")
- [ ] System provides NON-BLOCKING warning (exit code 0)
- [ ] System suggests checking .claude/skills/github/scripts before using raw commands
- [ ] System references skill-usage-mandatory.md documentation

## Rationale

Skill violations indicate:

- Missing abstractions that should be created
- Inconsistent GitHub operation patterns
- Loss of error handling and retry logic
- Reduced auditability of GitHub operations

Non-blocking warnings allow incremental adoption while tracking capability gaps.

## Dependencies

- .claude/skills/github/ directory structure
- git (for staged file detection)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
