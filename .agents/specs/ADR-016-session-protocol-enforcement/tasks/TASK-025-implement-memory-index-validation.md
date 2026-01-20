---
type: task
id: TASK-025
title: Implement Memory Index Validation in Go
status: complete
priority: P2
complexity: L
estimate: 8h
related:
  - REQ-011
blocked_by: []
blocks:
  - TASK-026
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - memory
  - ADR-017
---

# TASK-025: Implement Memory Index Validation in Go

## Design Context

- REQ-011: Memory Index Validation

## Objective

Port Validate-MemoryIndex.ps1 to Go with multi-tier validation for ADR-017 tiered memory architecture.

## Scope

**In Scope**:

- Go implementation at `packages/validation/memory-index.go`
- Domain index discovery (skills-*-index.md pattern)
- P0 validation (blocking): file references, keyword density, format, deprecated prefixes, duplicates
- P1 validation (warning): memory-index.md completeness, orphaned files, unindexed files
- P2 validation (warning): minimum keywords, domain prefix naming
- Three output formats: console (colored), markdown, JSON
- Comprehensive Go tests at `packages/validation/tests/memory-index_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-026)
- Memory system implementation

## Acceptance Criteria

- [ ] Go implementation complete with multi-tier validation
- [ ] CLI supports -CI, -Format flags
- [ ] Discovers domain indices (skills-*-index.md)
- [ ] P0: Validates file references point to existing files
- [ ] P0: Validates keyword density >= 40% unique
- [ ] P0: Validates pure lookup table format (no titles/metadata)
- [ ] P0: Detects deprecated skill- prefix in entries
- [ ] P0: Detects duplicate entries within domain index
- [ ] P1: Validates memory-index.md completeness
- [ ] P1: Detects orphaned atomic files not in any index
- [ ] P2: Validates minimum keyword count >= 5
- [ ] P2: Validates domain prefix naming {domain}-{description}
- [ ] Console output with colored indicators
- [ ] Markdown output format
- [ ] JSON output format with validations array
- [ ] Exit code 1 in CI mode on P0 failures
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/memory-index.go` | Create | Main implementation |
| `packages/validation/tests/memory-index_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add memory index types |
| `packages/validation/wasm/main.go` | Modify | Register memory validator |

## Implementation Notes

**P0 Checks (Blocking)**:

- File reference validation: Parse index entries, check file existence
- Keyword density: Count unique keywords / total skills >= 0.40
- Format validation: No h1/h2 headings except domain header, no metadata lines
- Deprecated prefix: No entries containing "skill-" prefix
- Duplicate detection: Track entries by path within each domain index

**P1 Checks (Warning)**:

- memory-index.md completeness: References all domain indices
- Orphan detection: Find atomic files not referenced by any index
- Unindexed files: Find skill- prefixed files not in indices

**P2 Checks (Warning)**:

- Minimum keywords: >= 5 keywords per skill
- Domain prefix: File name matches {domain}-{description} pattern

## Testing Requirements

- [ ] Test P0 validations (blocking failures)
- [ ] Test P1 validations (warnings)
- [ ] Test P2 validations (warnings)
- [ ] Test domain index discovery
- [ ] Test keyword density calculation
- [ ] Test format validation
- [ ] Test orphan detection
- [ ] Test output formats (console, markdown, JSON)
- [ ] Test CI mode exit codes
