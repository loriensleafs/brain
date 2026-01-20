---
type: requirement
id: REQ-011
title: Memory Index Validation
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
  - memory
  - tiered-architecture
  - ADR-017
---

# REQ-011: Memory Index Validation

## Requirement Statement

WHEN tiered memory architecture (ADR-017) is used
THE SYSTEM SHALL validate domain index consistency, keyword density, file references, and detect orphaned atomic files
SO THAT memory indices remain valid and discoverable

## Context

The Validate-MemoryIndex.ps1 script implements multi-tier validation for ADR-017 tiered memory architecture:

**P0 (Always Blocking)**:

- All domain index entries point to existing files
- Keyword density >= 40% unique keywords per skill in domain
- Index format is pure lookup table (no titles/metadata)
- No deprecated skill- prefix in index entries
- No duplicate entries in same index

**P1 (Warning)**:

- memory-index.md exists and references all domain indices
- All references in memory-index point to existing files
- Orphaned atomic files reported (not referenced by any index)
- Unindexed skill- prefixed files detected

**P2 (Warning)**:

- Minimum keyword count (>= 5 per skill)
- Domain prefix naming convention ({domain}-{description})

## Acceptance Criteria

- [ ] System discovers all domain indices (skills-*-index.md pattern)
- [ ] System validates file references point to existing files (P0 blocking)
- [ ] System validates keyword density >= 40% unique (P0 blocking)
- [ ] System validates pure lookup table format (no titles, metadata, navigation) (P0 blocking)
- [ ] System detects deprecated skill- prefix in index entries (P0 blocking)
- [ ] System detects duplicate entries within domain index (P0 blocking)
- [ ] System validates memory-index.md completeness (P1 warning)
- [ ] System detects orphaned atomic files not in any index (P1 warning)
- [ ] System validates minimum keyword count >= 5 (P2 warning)
- [ ] System validates domain prefix naming {domain}-{description} (P2 warning)
- [ ] System supports three output formats: console (colored), markdown, JSON
- [ ] System returns exit code 1 in CI mode (-CI flag) on P0 failures

## Rationale

Memory index validation ensures:

- All indexed skills can be located (no broken references)
- Skills have sufficient keywords for lexical matching
- Index format maximizes token efficiency (ADR-017)
- No silent failures from deprecated naming patterns
- Orphaned skills are discovered and indexed

## Dependencies

- .serena/memories/ directory structure
- ADR-017 tiered memory architecture
- Domain index files (skills-*-index.md)
- memory-index.md (master index)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- ADR-017: Tiered Memory Architecture
