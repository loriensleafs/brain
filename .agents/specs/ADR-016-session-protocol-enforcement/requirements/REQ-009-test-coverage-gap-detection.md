---
type: requirement
id: REQ-009
title: Test Coverage Gap Detection
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
  - testing
  - coverage
  - quality
---

# REQ-009: Test Coverage Gap Detection

## Requirement Statement

WHEN PowerShell (.ps1) files exist without corresponding test files (.Tests.ps1)
THE SYSTEM SHALL detect and report these gaps with expected test file paths
SO THAT developers maintain test coverage and catch regressions early

## Requirement Statement

The Detect-TestCoverageGaps.ps1 script implements FR-4 from Local Guardrails consolidation (Issue #230). It detects PowerShell files without corresponding .Tests.ps1 files.

Default ignore patterns:

- Test files themselves (\.Tests\.ps1$)
- Test directories (tests?[\\/])
- Build scripts (build[\\/])
- GitHub workflows (.github[\\/])
- Installation scripts (install.*\.ps1$)
- Common modules (Common\.psm1$, AIReviewCommon\.psm1$)

Custom ignore patterns can be provided via -IgnoreFile parameter.

## Acceptance Criteria

- [ ] System scans for .ps1 files (excluding .Tests.ps1)
- [ ] System checks for corresponding test files in same directory
- [ ] System checks for test files in tests/ subdirectory
- [ ] System applies default ignore patterns (build scripts, installation, common modules)
- [ ] System supports custom ignore patterns via -IgnoreFile parameter
- [ ] System supports -StagedOnly flag to check only git-staged files
- [ ] System reports missing test files with expected test file paths
- [ ] System provides NON-BLOCKING warning (exit code 0)
- [ ] System excludes .git and node_modules directories from scan

## Rationale

Test coverage gaps lead to:

- Undetected regressions when code changes
- Reduced confidence in refactoring
- Missing behavior documentation (tests as specs)

Non-blocking warnings allow incremental test coverage improvement while avoiding workflow disruption.

## Dependencies

- git (for staged file detection)
- PowerShell file structure (.ps1, .Tests.ps1 naming convention)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
