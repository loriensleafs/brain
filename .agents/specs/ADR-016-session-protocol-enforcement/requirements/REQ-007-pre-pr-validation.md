---
type: requirement
id: REQ-007
title: Pre-PR Unified Validation Runner
status: accepted
priority: P0
category: functional
epic: ADR-016
related:
  - REQ-001
  - REQ-006
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - shift-left
  - pre-commit
---

# REQ-007: Pre-PR Unified Validation Runner

## Requirement Statement

WHEN a developer prepares to create a pull request
THE SYSTEM SHALL execute all local validations in optimized order (fast checks first) and report consolidated results
SO THAT quality issues are detected before PR creation, reducing CI failure cycles

## Context

The Validate-PrePR.ps1 script provides a unified shift-left validation runner that executes:

1. Session End validation (latest session log)
2. Pester unit tests
3. Markdown linting (auto-fix and validate)
4. Path normalization (check for absolute paths) - skippable with -Quick
5. Planning artifacts validation - skippable with -Quick
6. Agent drift detection - skippable with -Quick

The script supports -Quick mode for rapid iteration (runs only fast validations) and -SkipTests for special cases.

## Acceptance Criteria

- [ ] System executes validations in optimized order (fast checks first)
- [ ] System validates session end requirements for latest session log
- [ ] System runs Pester unit tests (unless -SkipTests specified)
- [ ] System runs markdown linting with auto-fix
- [ ] System validates path normalization (absolute path detection)
- [ ] System validates planning artifacts consistency
- [ ] System detects agent drift
- [ ] System supports -Quick flag to skip slow validations (path norm, planning, drift)
- [ ] System provides colored console output with [PASS]/[FAIL]/[SKIP] indicators
- [ ] System reports total validation time and summary statistics
- [ ] System returns exit code 0 on success, 1 on failure, 2 on environment errors

## Rationale

Unified pre-PR validation:

- Reduces CI failure cycles by catching issues locally
- Provides immediate feedback during development
- Optimizes developer workflow with fast/slow validation modes
- Consolidates multiple validation scripts into single entry point

## Dependencies

- scripts/Validate-Session.ps1 (session validation)
- build/scripts/Invoke-PesterTests.ps1 (unit tests)
- npx markdownlint-cli2 (markdown linting)
- build/scripts/Validate-PathNormalization.ps1 (path checks)
- build/scripts/Validate-PlanningArtifacts.ps1 (planning consistency)
- build/scripts/Detect-AgentDrift.ps1 (drift detection)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- REQ-001: Session Protocol Validation
- REQ-006: Cross-Document Consistency Validation
