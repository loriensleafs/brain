---
title: REQ-005-kebab-case-filename-convention
type: requirement
status: approved
permalink: features/feat-002-feature-workflow/requirements/req-005-kebab-case-filename-convention
feature-ref: FEAT-002
priority: must
created-by: planner
tags:
- requirement
- feature-workflow
- naming
- kebab-case
---

# REQ-005: Kebab-Case Filename Convention

## Requirement Statement

All artifact filenames within the unified feature structure MUST use kebab-case format with no spaces. The filename pattern MUST be `{PREFIX}-{NNN}-{kebab-case-description}.md` where:
- PREFIX is uppercase (FEAT, REQ, DESIGN, TASK)
- NNN is zero-padded three-digit number
- description is lowercase words separated by hyphens

## Acceptance Criteria

1. **No spaces in filenames**: All artifact files use hyphens as word separators
2. **Lowercase descriptive portion**: The description after the ID is entirely lowercase
3. **Uppercase prefix retained**: Entity type prefix (FEAT, REQ, DESIGN, TASK) remains uppercase
4. **Consistent pattern**: All files follow `{PREFIX}-{NNN}-{description}.md` exactly

## Valid Examples
- `FEAT-001-unified-artifact-structure.md`
- `REQ-005-kebab-case-filename-convention.md`
- `DESIGN-003-structure-patterns.md`
- `TASK-002-update-memory-skill.md`

## Invalid Examples
- `TASK-001 Create Example Files.md` (contains spaces)
- `REQ-001-Agent-Prompts.md` (mixed case in description)
- `design-001-patterns.md` (lowercase prefix)

## Rationale

Consistent kebab-case ensures:
- Cross-platform compatibility (spaces cause CLI/script issues)
- Predictable glob patterns for automation
- URL-safe permalinks without encoding
- Easier tab-completion in terminals

## Observations

- [requirement] All filenames must use kebab-case, no spaces #naming
- [requirement] Prefix remains uppercase, description is lowercase #convention
- [rationale] Enables reliable automation and cross-platform compatibility #justification
- [constraint] Existing files with spaces must be renamed #migration

## Relations

- implements [[FEAT-002-feature-workflow]]
- derives_from [[ADR-001-feature-workflow]]
- enforced_by [[TASK-007-rename-files-to-kebab-case]]
