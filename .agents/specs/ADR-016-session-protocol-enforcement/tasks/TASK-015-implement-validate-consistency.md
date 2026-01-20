---
type: task
id: TASK-015
title: Implement Validate-Consistency in Go
status: complete
priority: P0
complexity: L
estimate: 8h
related:
  - REQ-006
blocked_by: []
blocks:
  - TASK-016
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - consistency
---

# TASK-015: Implement Validate-Consistency in Go

## Design Context

- REQ-006: Cross-Document Consistency Validation

## Objective

Port Validate-Consistency.ps1 to Go with 1-to-1 functional parity, including:

- Feature artifact discovery (.agents/planning/ directory)
- Scope alignment validation (Epic → PRD)
- Requirement coverage validation (PRD → Tasks)
- Naming convention validation (EPIC-NNN-*, prd-*, tasks-* patterns)
- Cross-reference validation (broken links detection)
- Task completion status validation (Checkpoint 2 P0 tasks)
- Three output formats: console (colored), markdown, JSON
- CI mode with exit code 1 on failures

## Scope

**In Scope**:

- Go implementation at `packages/validation/validate-consistency.go`
- Feature discovery from .agents/planning/, .agents/roadmap/
- All validation functions from PowerShell script
- Output formatting (console with ANSI colors, markdown, JSON)
- CLI flag parsing (-Feature, -All, -Checkpoint, -Format, -CI, -Path)
- Comprehensive Go tests at `packages/validation/tests/validate-consistency_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-016)
- Changes to .agents/ directory structure
- Modification of naming convention rules

## Acceptance Criteria

- [ ] Go implementation complete with all validation functions
- [ ] CLI supports all PowerShell parameters (-Feature, -All, -Checkpoint 1/2, -Format, -CI, -Path)
- [ ] Feature discovery from .agents/planning/ and .agents/roadmap/ directories
- [ ] Scope alignment validation (Epic outcomes → PRD requirements)
- [ ] Requirement coverage validation (PRD requirements → Tasks)
- [ ] Naming convention validation with regex patterns
- [ ] Cross-reference validation (relative links, absolute links, anchors)
- [ ] Task completion status validation for Checkpoint 2
- [ ] Console output with ANSI colors ([PASS], [FAIL], [WARNING])
- [ ] Markdown output format matches PowerShell version
- [ ] JSON output format with validations array and summary statistics
- [ ] Exit code 0 on success, 1 on failure (in CI mode)
- [ ] Comprehensive test coverage (>= 80%) with table-driven tests
- [ ] WASM compilation succeeds without errors
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/validate-consistency.go` | Create | Main implementation |
| `packages/validation/tests/validate-consistency_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add consistency validation types |
| `packages/validation/wasm/main.go` | Modify | Register consistency validator |

## Implementation Notes

**Key Algorithms**:

1. **Feature Discovery**: Scan .agents/planning/ for prd-*.md and tasks-*.md files, extract feature names
2. **Scope Alignment**: Parse Epic success criteria, compare count with PRD requirements count
3. **Requirement Coverage**: Count PRD requirements (checkbox/numbered), compare with Tasks count
4. **Naming Convention**: Apply regex patterns from .agents/governance/naming-conventions.md
5. **Cross-References**: Parse markdown links `[text](path)`, resolve relative paths, check file existence

**ANSI Color Codes**:

- Reset: `\x1b[0m`
- Red: `\x1b[31m`
- Yellow: `\x1b[33m`
- Green: `\x1b[32m`
- Cyan: `\x1b[36m`
- Magenta: `\x1b[35m`

**Error Handling**:

- Gracefully handle missing directories (return empty feature list)
- Gracefully handle missing Epic (warning, not error)
- Fail on missing PRD or Tasks when feature specified
- Detect and report all issues before exiting (don't fail on first error)

## Testing Requirements

- [ ] Test feature discovery with multiple features
- [ ] Test scope alignment with matching/mismatched criteria counts
- [ ] Test requirement coverage with complete/incomplete task lists
- [ ] Test naming conventions with valid/invalid file names
- [ ] Test cross-reference validation with valid/broken links
- [ ] Test task completion status at Checkpoint 1 and 2
- [ ] Test all output formats (console, markdown, JSON)
- [ ] Test CI mode exit codes
- [ ] Test -All flag with multiple features
- [ ] Test -Feature flag with single feature
- [ ] Test edge cases (empty directories, missing files, malformed content)
