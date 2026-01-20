---
type: task
id: TASK-031
title: Implement Traceability Validation in Go
status: complete
priority: P2
complexity: L
estimate: 8h
related:
  - REQ-014
blocked_by: []
blocks:
  - TASK-032
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - go
  - validation
  - traceability
---

# TASK-031: Implement Traceability Validation in Go

## Design Context

- REQ-014: Traceability Cross-Reference Validation

## Objective

Port Validate-Traceability.ps1 to Go with cross-reference validation and orphan detection.

## Scope

**In Scope**:

- Go implementation at `packages/validation/traceability.go`
- Specification file loading (REQ-*.md, DESIGN-*.md, TASK-*.md)
- YAML front matter parsing (type, id, status, related fields)
- Rule 1: Forward traceability (REQ → DESIGN) - warning
- Rule 2: Backward traceability (TASK → DESIGN) - error
- Rule 3: Complete chain (DESIGN has REQ and TASK) - warning
- Rule 4: Reference validity (all IDs exist) - error
- Rule 5: Status consistency (completed propagation) - info
- Three output formats: console (colored), markdown, JSON
- Comprehensive Go tests at `packages/validation/tests/traceability_test.go`
- WASM compilation support

**Out of Scope**:

- CI integration (covered by TASK-032)

## Acceptance Criteria

- [ ] Go implementation complete with all validation rules
- [ ] CLI supports -Strict, -Format, -CI flags
- [ ] Loads specification files (REQ-*, DESIGN-*, TASK-*)
- [ ] Parses YAML front matter correctly
- [ ] Rule 1: Validates REQ traces to DESIGN (warning)
- [ ] Rule 2: Validates TASK traces to DESIGN (error)
- [ ] Rule 3: Validates DESIGN has REQ and TASK (warning)
- [ ] Rule 4: Validates all referenced IDs exist (error)
- [ ] Rule 5: Validates status consistency (info)
- [ ] Console output with colored indicators
- [ ] Markdown output format
- [ ] JSON output format with validations array
- [ ] Exit code 1 on errors (broken references, untraced tasks)
- [ ] Exit code 2 on warnings with -Strict flag
- [ ] Reports statistics (REQs, DESIGNs, TASKs, valid chains)
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/traceability.go` | Create | Main implementation |
| `packages/validation/tests/traceability_test.go` | Create | Comprehensive tests |
| `packages/validation/types.go` | Modify | Add traceability types |
| `packages/validation/wasm/main.go` | Modify | Register traceability validator |

## Implementation Notes

**YAML Front Matter Parsing**:

```go
type SpecFrontMatter struct {
    Type    string   `yaml:"type"`
    ID      string   `yaml:"id"`
    Status  string   `yaml:"status"`
    Related []string `yaml:"related"`
}
```

**Validation Rules**:

1. Forward: REQ has at least one DESIGN in related[] (warning)
2. Backward: TASK has at least one DESIGN in related[] (error)
3. Complete: DESIGN has both REQ and TASK in related[] (warning)
4. Validity: All IDs in related[] exist as files (error)
5. Status: If all TASKs completed, DESIGN should be completed (info)

## Testing Requirements

- [ ] Test Rule 1 (forward traceability)
- [ ] Test Rule 2 (backward traceability)
- [ ] Test Rule 3 (complete chain)
- [ ] Test Rule 4 (reference validity)
- [ ] Test Rule 5 (status consistency)
- [ ] Test YAML parsing
- [ ] Test output formats
- [ ] Test exit codes
- [ ] Test -Strict flag behavior
