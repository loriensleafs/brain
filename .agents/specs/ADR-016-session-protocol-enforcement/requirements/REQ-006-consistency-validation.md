---
type: requirement
id: REQ-006
title: Cross-Document Consistency Validation
status: accepted
priority: P0
category: functional
epic: ADR-016
related:
  - REQ-001
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - consistency
  - planning
  - artifacts
---

# REQ-006: Cross-Document Consistency Validation

## Requirement Statement

WHEN a feature has multiple planning artifacts (Epic, PRD, Tasks)
THE SYSTEM SHALL validate scope alignment, requirement coverage, naming conventions, cross-references, and task completion status
SO THAT planning artifacts maintain traceability and consistency throughout the development lifecycle

## Context

The Validate-Consistency.ps1 script implements the validation procedure defined in .agents/governance/consistency-protocol.md. It checks:

- Scope alignment between Epic and PRD
- Requirement coverage from PRD to Tasks
- Naming convention compliance (EPIC-NNN-*, prd-*, tasks-*)
- Cross-reference validity (links point to existing files)
- Task completion status (P0 tasks complete at Checkpoint 2)

This validation runs at two checkpoints:

- Checkpoint 1 (Pre-Critic): Before implementation begins
- Checkpoint 2 (Post-Implementation): After code is written

## Acceptance Criteria

- [ ] System discovers all features from .agents/planning/ directory
- [ ] System validates Epic/PRD scope alignment (Epic outcomes match PRD requirements)
- [ ] System validates requirement coverage (all PRD requirements have corresponding tasks)
- [ ] System validates naming conventions per governance/naming-conventions.md
- [ ] System detects broken cross-references (links to non-existent files)
- [ ] System validates task completion status for Checkpoint 2 (P0 tasks must be complete)
- [ ] System supports three output formats: console (colored), markdown, JSON
- [ ] System returns exit code 1 when run with -CI flag and validations fail
- [ ] System validates single feature with -Feature parameter
- [ ] System validates all features with -All parameter

## Rationale

Cross-document consistency prevents:

- Scope drift between Epic goals and PRD implementation
- Missing task coverage for requirements
- Broken links in documentation
- Incomplete implementation (P0 tasks skipped)

Automating these checks reduces manual review burden and catches errors before they reach production.

## Dependencies

- .agents/governance/consistency-protocol.md (validation rules)
- .agents/governance/naming-conventions.md (file naming patterns)
- .agents/planning/ directory structure (Epic, PRD, Tasks files)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- REQ-001: Session Protocol Validation (related validation)
