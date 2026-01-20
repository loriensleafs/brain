# ADR-016 Session Protocol Enforcement - Specification Expansion

**Status**: Draft
**Created**: 2026-01-19
**Objective**: Achieve 1-to-1 functionality parity with ai-agents-main validation scripts

## Overview

This specification expands ADR-016 Session Protocol Enforcement to include 13 PowerShell validation script migrations to Go + WASM. The goal is complete functional parity with the ai-agents-main codebase.

## Artifacts Created

### Requirements (REQ-006 through REQ-018)

| ID | Title | Priority | Script Reference |
|----|-------|----------|-----------------|
| REQ-006 | Cross-Document Consistency Validation | P0 | Validate-Consistency.ps1 |
| REQ-007 | Pre-PR Unified Validation Runner | P0 | Validate-PrePR.ps1 |
| REQ-008 | Skill Violation Detection | P1 | Detect-SkillViolation.ps1 |
| REQ-009 | Test Coverage Gap Detection | P1 | Detect-TestCoverageGaps.ps1 |
| REQ-010 | Skill Existence Verification | P1 | Check-SkillExists.ps1 |
| REQ-011 | Memory Index Validation | P2 | Validate-MemoryIndex.ps1 |
| REQ-012 | PR Description Validation | P2 | Validate-PRDescription.ps1 |
| REQ-013 | Skill Format Validation | P2 | Validate-SkillFormat.ps1 |
| REQ-014 | Traceability Cross-Reference Validation | P2 | Validate-Traceability.ps1 |
| REQ-015 | Session Protocol Validation | P2 | Validate-Session.ps1 |
| REQ-016 | Batch PR Review Worktree Management | P2 | Invoke-BatchPRReview.ps1 |
| REQ-017 | PR Discovery and Classification | P2 | Invoke-PRMaintenance.ps1 |
| REQ-018 | Slash Command Format Validation | P2 | SlashCommandValidator.psm1 |

### Tasks (TASK-015 through TASK-039)

Tasks follow the pattern from ADR-016: 2 tasks per requirement (implementation + integration).

**Implementation Tasks** (Go port + WASM build):

- TASK-015: Implement Validate-Consistency in Go
- TASK-017: Implement Validate-PrePR in Go
- TASK-019: Implement Detect-SkillViolation in Go
- TASK-021: Implement Detect-TestCoverageGaps in Go
- TASK-023: Implement Check-SkillExists in Go
- TASK-025: Implement Validate-MemoryIndex in Go
- TASK-027: Implement Validate-PRDescription in Go
- TASK-029: Implement Validate-SkillFormat in Go
- TASK-031: Implement Validate-Traceability in Go
- TASK-033: Implement Validate-Session in Go
- TASK-035: Implement Invoke-BatchPRReview in Go
- TASK-037: Implement Invoke-PRMaintenance in Go
- TASK-039: Implement SlashCommandValidator in Go

**Integration Tasks** (CI/pre-commit/Inngest):

- TASK-016: Integrate Validate-Consistency into CI
- TASK-018: Integrate Validate-PrePR into pre-commit
- TASK-020: Integrate Detect-SkillViolation into CI
- TASK-022: Integrate Detect-TestCoverageGaps into pre-commit
- TASK-024: Integrate Check-SkillExists into pre-commit
- TASK-026: Integrate Validate-MemoryIndex into CI
- TASK-028: Integrate Validate-PRDescription into CI
- TASK-030: Integrate Validate-SkillFormat into pre-commit
- TASK-032: Integrate Validate-Traceability into CI
- TASK-034: Integrate Validate-Session into Inngest
- TASK-036: Integrate Invoke-BatchPRReview into Inngest
- TASK-038: Integrate Invoke-PRMaintenance into Inngest
- TASK-040: Integrate SlashCommandValidator into CI

## Migration Pattern

Each script follows the ADR-016 migration pattern:

1. **Analyze**: Study PowerShell implementation
2. **Port**: Rewrite in Go (packages/validation/{script-name}.go)
3. **Test**: Create Go tests (packages/validation/tests/{script-name}_test.go)
4. **WASM**: Compile to WASM for Inngest integration
5. **Integrate**: Wire into pre-commit, CI, or Inngest workflows

## Target Structure

```text
packages/validation/
├── validate-consistency.go
├── validate-pre-pr.go
├── detect-skill-violation.go
├── detect-test-coverage-gaps.go
├── check-skill-exists.go
├── validate-memory-index.go
├── validate-pr-description.go
├── validate-skill-format.go
├── validate-traceability.go
├── validate-session.go (already exists)
├── invoke-batch-pr-review.go
├── invoke-pr-maintenance.go
├── slash-command-validator.go
├── tests/
│   ├── validate-consistency_test.go
│   ├── validate-pre-pr_test.go
│   └── ... (13 test files)
└── wasm/
    └── main.go (WASM build entry point)
```

## Effort Estimate

Based on ADR-016 pattern (4-8 hours per script for implementation + integration):

| Priority | Scripts | Estimated Hours |
|----------|---------|----------------|
| P0 | 2 | 16 hours |
| P1 | 3 | 24 hours |
| P2 | 8 | 64 hours |
| **Total** | **13** | **104 hours** |

## Sequencing Strategy

**Phase 1 (P0 - Ship First)**:

- REQ-006/007: Consistency + Pre-PR validation (critical for shift-left)

**Phase 2 (P1 - High Value)**:

- REQ-008/009/010: Skill violations, test gaps, skill discovery

**Phase 3 (P2 - Complete Parity)**:

- REQ-011-018: Memory index, PR validation, traceability, etc.

## Integration Points

### Pre-Commit Hooks

- validate-pre-pr (orchestrator)
- detect-test-coverage-gaps
- check-skill-exists
- validate-skill-format

### CI Workflows

- validate-consistency
- detect-skill-violation
- validate-memory-index
- validate-pr-description
- validate-traceability
- slash-command-validator

### Inngest Functions

- validate-session
- invoke-batch-pr-review
- invoke-pr-maintenance

## Success Criteria

- [ ] All 13 scripts ported to Go with 1-to-1 functional parity
- [ ] All scripts compile to WASM
- [ ] All scripts have comprehensive Go tests
- [ ] All scripts integrated into appropriate workflows (pre-commit, CI, Inngest)
- [ ] All original PowerShell validations replaced with Go equivalents
- [ ] Documentation updated with Go usage examples

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent)
- REQ-001 through REQ-005: Original ADR-016 requirements
- TASK-001 through TASK-014: Original ADR-016 tasks
