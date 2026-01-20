---
type: requirement
id: REQ-010
title: Skill Existence Verification
status: accepted
priority: P1
category: functional
epic: ADR-016
related:
  - REQ-008
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - skills
  - github
  - discovery
---

# REQ-010: Skill Existence Verification

## Requirement Statement

WHEN agents or scripts need to verify GitHub skill availability before operations
THE SYSTEM SHALL provide self-documenting discovery via file system scan with substring matching
SO THAT Phase 1.5 BLOCKING gates can verify skill capabilities dynamically

## Context

The Check-SkillExists.ps1 script provides skill discovery for .claude/skills/github/scripts/ directory. It supports:

- Checking if a specific skill exists (operation + action)
- Listing all available skills by operation type
- Substring matching for flexible skill discovery

Operations: pr, issue, reactions, label, milestone

## Acceptance Criteria

- [ ] System scans .claude/skills/github/scripts/ directory structure
- [ ] System supports operation-based filtering (pr, issue, reactions, label, milestone)
- [ ] System performs substring matching on action names
- [ ] System returns boolean result for existence checks
- [ ] System supports -ListAvailable flag to enumerate all skills by operation
- [ ] System returns false if operation directory doesn't exist
- [ ] System returns false if no matching scripts found
- [ ] System provides self-documenting output (operation categories with skill names)

## Rationale

Dynamic skill discovery:

- Eliminates hardcoded skill lists in scripts
- Enables Phase 1.5 BLOCKING gates to verify capabilities before operations
- Provides self-documentation via -ListAvailable flag
- Supports flexible matching for skill name variations

## Dependencies

- .claude/skills/github/scripts/ directory structure
- PowerShell file system operations

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- REQ-008: Skill Violation Detection (related skill validation)
