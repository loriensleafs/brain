---
type: requirement
id: REQ-013
title: Skill Format Validation
status: accepted
priority: P2
category: functional
epic: ADR-016
related:
  - REQ-011
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - skills
  - format
  - ADR-017
---

# REQ-013: Skill Format Validation

## Requirement Statement

WHEN skill files are staged for commit
THE SYSTEM SHALL validate atomic format (one skill per file) and naming convention (no skill- prefix)
SO THAT skills comply with ADR-017 requirements

## Context

The Validate-SkillFormat.ps1 script enforces ADR-017 skill format requirements:

- One skill per file (no bundled skills with multiple ## Skill- headers)
- Files must NOT use 'skill-' prefix (use {domain}-{description} format)

This validation runs on staged .serena/memories/ files during pre-commit.

Bundled format detection pattern: `(?m)^## Skill-[A-Za-z]+-[0-9]+:`

## Acceptance Criteria

- [ ] System scans .serena/memories/ directory for skill files
- [ ] System excludes index files (skills-*-index.md, memory-index.md)
- [ ] System detects bundled format (multiple ## Skill- headers in one file)
- [ ] System detects invalid skill- prefix in file names
- [ ] System supports -StagedOnly flag for pre-commit hook integration
- [ ] System supports -ChangedFiles parameter for CI workflow integration
- [ ] System reports bundled files with skill count
- [ ] System reports prefix violations
- [ ] System provides BLOCKING failure in CI mode (-CI flag)
- [ ] System provides NON-BLOCKING warning for local development

## Rationale

Atomic skill format ensures:

- One skill per file improves discoverability
- Consistent naming convention ({domain}-{description})
- No deprecated skill- prefix patterns
- Easier skill maintenance and updates

## Dependencies

- .serena/memories/ directory structure
- ADR-017 tiered memory architecture
- git (for staged file detection)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- ADR-017: Tiered Memory Architecture
- REQ-011: Memory Index Validation
