---
type: requirement
id: REQ-012
title: PR Description Validation
status: accepted
priority: P2
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
  - pr
  - description
  - mismatch-detection
---

# REQ-012: PR Description Validation

## Requirement Statement

WHEN a pull request description claims files were changed
THE SYSTEM SHALL validate these claims against the actual PR diff and detect mismatches
SO THAT PR descriptions accurately reflect code changes and prevent Analyst CRITICAL_FAIL verdicts

## Context

The Validate-PRDescription.ps1 script implements FR-2 from Local Guardrails consolidation (Issue #230). It prevents PR description vs diff mismatches as seen in PR #199.

The script performs two checks:

**CRITICAL (Blocking)**:

- Files mentioned in description but not in diff

**WARNING (Non-blocking)**:

- Major files (.ps1, .cs, .ts, .js, .py, .yml) changed but not mentioned

The script extracts file references from description using multiple patterns:

- Inline code: \`file.ps1\`
- Bold: \*\*file.ps1\*\*
- List items: - file.ps1
- Markdown links: [text](file.ps1)

## Acceptance Criteria

- [ ] System fetches PR data (title, body, changed files) via gh CLI
- [ ] System extracts file references from PR description (multiple patterns)
- [ ] System validates mentioned files exist in PR diff (CRITICAL check)
- [ ] System detects significant changed files not mentioned (WARNING check)
- [ ] System supports suffix matching (e.g., "file.ps1" matches "path/to/file.ps1")
- [ ] System normalizes path separators (backslash to forward slash)
- [ ] System reports CRITICAL issues with severity Red
- [ ] System reports WARNING issues with severity Yellow
- [ ] System returns exit code 1 in CI mode (-CI flag) on CRITICAL issues
- [ ] System returns exit code 0 on WARNINGS (non-blocking)
- [ ] System accepts -Owner and -Repo parameters (defaults to git remote)

## Rationale

PR description validation prevents:

- Misleading descriptions claiming changes that don't exist
- Missing documentation of significant file changes
- Analyst CRITICAL_FAIL verdicts from description/diff mismatches
- Wasted reviewer time investigating phantom changes

## Dependencies

- gh CLI (GitHub command-line tool)
- git (for remote URL parsing)
- PR number and repository context

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
