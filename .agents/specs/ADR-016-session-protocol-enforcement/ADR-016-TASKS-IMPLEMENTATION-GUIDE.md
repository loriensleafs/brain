# ADR-016 Tasks Implementation Guide

> **Scope**: All 26 tasks (implementation patterns)

**Total Tasks**: 26 (TASK-015 through TASK-040)
**Pattern**: 2 tasks per requirement (implementation + integration)

## Task Mapping

| REQ | Script | Implementation Task | Integration Task | Priority | Estimate |
|-----|--------|---------------------|------------------|----------|----------|
| REQ-006 | Validate-Consistency.ps1 | TASK-015 | TASK-016 | P0 | 8h + 2h |
| REQ-007 | Validate-PrePR.ps1 | TASK-017 | TASK-018 | P0 | 6h + 2h |
| REQ-008 | Detect-SkillViolation.ps1 | TASK-019 | TASK-020 | P1 | 4h + 1h |
| REQ-009 | Detect-TestCoverageGaps.ps1 | TASK-021 | TASK-022 | P1 | 4h + 1h |
| REQ-010 | Check-SkillExists.ps1 | TASK-023 | TASK-024 | P1 | 3h + 1h |
| REQ-011 | Validate-MemoryIndex.ps1 | TASK-025 | TASK-026 | P2 | 10h + 2h |
| REQ-012 | Validate-PRDescription.ps1 | TASK-027 | TASK-028 | P2 | 5h + 2h |
| REQ-013 | Validate-SkillFormat.ps1 | TASK-029 | TASK-030 | P2 | 4h + 1h |
| REQ-014 | Validate-Traceability.ps1 | TASK-031 | TASK-032 | P2 | 8h + 2h |
| REQ-015 | Validate-Session.ps1 | TASK-033 | TASK-034 | P2 | 12h + 3h |
| REQ-016 | Invoke-BatchPRReview.ps1 | TASK-035 | TASK-036 | P2 | 6h + 2h |
| REQ-017 | Invoke-PRMaintenance.ps1 | TASK-037 | TASK-038 | P2 | 8h + 2h |
| REQ-018 | SlashCommandValidator.psm1 | TASK-039 | TASK-040 | P2 | 3h + 1h |

**Total Effort**: 104 hours

---

## Implementation Tasks (Odd Numbers: TASK-015, TASK-017, ...)

### Standard Implementation Pattern

Each implementation task follows this structure:

**Objective**: Port PowerShell script to Go with 1-to-1 functional parity

**In Scope**:

- Go implementation at `packages/validation/{script-name}.go`
- All validation functions from PowerShell script
- CLI flag parsing (match PowerShell parameters)
- Output formatting (console with ANSI colors, markdown, JSON where applicable)
- Comprehensive Go tests at `packages/validation/tests/{script-name}_test.go`
- WASM compilation support

**Out of Scope**:

- CI/pre-commit integration (covered by integration tasks)
- Changes to validation rules or file structures

**Acceptance Criteria**:

- [ ] Go implementation complete with all functions
- [ ] CLI supports all PowerShell parameters
- [ ] Output format matches PowerShell version
- [ ] Exit codes match PowerShell behavior
- [ ] Comprehensive test coverage (>= 80%)
- [ ] WASM compilation succeeds
- [ ] Documentation with usage examples

**Files Created**:

- `packages/validation/{script-name}.go`
- `packages/validation/tests/{script-name}_test.go`

**Files Modified**:

- `packages/validation/types.go` (add validation types)
- `packages/validation/wasm/main.go` (register validator)

---

## Integration Tasks (Even Numbers: TASK-016, TASK-018, ...)

### Standard Integration Pattern

Each integration task follows this structure:

**Objective**: Wire Go implementation into appropriate workflow (pre-commit, CI, or Inngest)

**Integration Targets**:

| Task | Target | Trigger |
|------|--------|---------|
| TASK-016 | Inngest | Session end workflow - consistency validation step |
| TASK-018 | CLI wrapper | Local dev invocation - validate before PR |
| TASK-020 | Pre-commit | .husky/pre-commit - non-blocking warning |
| TASK-022 | Pre-commit | .husky/pre-commit - *.ps1 changes |
| TASK-024 | Inngest | Phase 1.5 gates - skill existence checks |
| TASK-026 | Pre-commit | .husky/pre-commit - .serena/memories/** changes |
| TASK-028 | CI | PR creation/update - GitHub Actions workflow |
| TASK-030 | Pre-commit | .husky/pre-commit - .serena/memories/** changes |
| TASK-032 | CI | .agents/specs/** changes - GitHub Actions workflow |
| TASK-034 | Inngest + Pre-commit | Session end workflow + pre-commit mode |
| TASK-036 | Claude command | /pr-review command - worktree management |
| TASK-038 | CI | Scheduled/manual - GitHub Actions workflow |
| TASK-040 | CI | .claude/commands/** changes - GitHub Actions workflow |

**In Scope**:

- GitHub Actions workflow YAML (for CI tasks)
- Pre-commit hook configuration (for pre-commit tasks)
- Inngest function registration (for Inngest tasks)
- WASM deployment configuration
- Documentation updates

**Out of Scope**:

- Go implementation changes (covered by implementation tasks)
- Workflow logic (should be minimal per ADR-006)

**Acceptance Criteria**:

- [ ] Workflow/hook configuration complete
- [ ] Validator triggered on appropriate events
- [ ] Exit codes handled correctly (block on failure)
- [ ] Error messages visible in CI/pre-commit output
- [ ] WASM binary deployed (for Inngest tasks)
- [ ] Documentation updated with integration examples
- [ ] Validation runs successfully in target environment

**Files Created/Modified**:

For CI tasks:

- `.github/workflows/{validator-name}.yml`

For Pre-commit tasks:

- `.githooks/pre-commit` (modify to add validator call)

For Inngest tasks:

- `inngest/functions/{validator-name}.ts`
- `inngest/wasm/{validator-name}.wasm` (deploy compiled binary)

---

## Specific Task Details

### TASK-015/016: Validate-Consistency (P0, 8h + 2h)

**Implementation (TASK-015)**:

- Complexity: L (large, multiple validation algorithms)
- Key functions: feature discovery, scope alignment, requirement coverage, naming conventions, cross-references, task completion
- Output formats: console (ANSI colors), markdown, JSON

**Integration (TASK-016)**:

- Target: GitHub Actions CI
- Trigger: Changes to `.agents/planning/**`, `.agents/roadmap/**`
- Blocking: Yes (fail PR on validation errors)

### TASK-017/018: Validate-PrePR (P0, 6h + 2h)

**Implementation (TASK-017)**:

- Complexity: M (orchestrator calling other validators)
- Key functions: session end validation, Pester tests, markdown lint, path normalization, planning artifacts, agent drift
- CLI flags: -Quick (skip slow checks), -SkipTests

**Integration (TASK-018)**:

- Target: Pre-commit hook
- Trigger: All commits
- Blocking: Yes (prevent commit on validation errors)
- Note: Calls other validators (session, consistency, etc.)

### TASK-019/020: Detect-SkillViolation (P1, 4h + 1h)

**Implementation (TASK-019)**:

- Complexity: S (pattern matching)
- Key functions: detect raw `gh` command usage, suggest skill alternatives
- Non-blocking: Warning only (exit code 0)

**Integration (TASK-020)**:

- Target: GitHub Actions CI
- Trigger: Changes to `*.md`, `*.ps1`, `*.psm1`
- Blocking: No (warning only)

### TASK-021/022: Detect-TestCoverageGaps (P1, 4h + 1h)

**Implementation (TASK-021)**:

- Complexity: S (file system scan + pattern matching)
- Key functions: find .ps1 files without .Tests.ps1, apply ignore patterns
- Non-blocking: Warning only

**Integration (TASK-022)**:

- Target: Pre-commit hook
- Trigger: Changes to `*.ps1`
- Blocking: No (warning only)

### TASK-023/024: Check-SkillExists (P1, 3h + 1h)

**Implementation (TASK-023)**:

- Complexity: XS (file system scan)
- Key functions: discover skills by operation, substring matching, list available skills
- Return type: Boolean (for skill existence check)

**Integration (TASK-024)**:

- Target: Pre-commit hook (helper for other validators)
- Trigger: Called by Detect-SkillViolation and other validators
- Usage: Library function, not standalone validation

### TASK-025/026: Validate-MemoryIndex (P2, 10h + 2h)

**Implementation (TASK-025)**:

- Complexity: L (complex multi-tier validation)
- Key functions: domain index validation (P0), memory-index validation (P1), orphan detection (P1), format validation (P0)
- Output formats: console (ANSI colors), markdown, JSON

**Integration (TASK-026)**:

- Target: GitHub Actions CI
- Trigger: Changes to `.serena/memories/**`
- Blocking: Yes for P0 failures, warnings for P1/P2

### TASK-027/028: Validate-PRDescription (P2, 5h + 2h)

**Implementation (TASK-027)**:

- Complexity: M (GitHub API interaction, pattern extraction)
- Key functions: fetch PR data via gh CLI, extract file references from description, match against diff
- Severity levels: CRITICAL (blocking), WARNING (non-blocking)

**Integration (TASK-028)**:

- Target: GitHub Actions CI
- Trigger: PR creation, PR update (synchronize event)
- Blocking: Yes for CRITICAL issues, no for WARNINGS

### TASK-029/030: Validate-SkillFormat (P2, 4h + 1h)

**Implementation (TASK-029)**:

- Complexity: S (regex pattern matching)
- Key functions: detect bundled format (multiple ## Skill- headers), detect invalid skill- prefix
- CI vs local mode: CI blocking, local warning

**Integration (TASK-030)**:

- Target: Pre-commit hook
- Trigger: Changes to `.serena/memories/**` (excluding index files)
- Blocking: Yes in CI, warning in local

### TASK-031/032: Validate-Traceability (P2, 8h + 2h)

**Implementation (TASK-031)**:

- Complexity: M (YAML parsing, graph traversal)
- Key functions: load specs (REQ, DESIGN, TASK), validate 5 traceability rules, detect orphans
- Output formats: console (ANSI colors), markdown, JSON
- Exit codes: 0 (pass), 1 (errors), 2 (warnings with -Strict)

**Integration (TASK-032)**:

- Target: GitHub Actions CI
- Trigger: Changes to `.agents/specs/**`
- Blocking: Yes for errors (broken references, untraced tasks)
- Optional: Use -Strict flag to block on warnings (orphaned specs)

### TASK-033/034: Validate-Session (P2, 12h + 3h)

**Implementation (TASK-033)**:

- Complexity: XL (most complex validator)
- Key functions: Session Start validation, Session End validation, memory evidence validation (ADR-007 E2), QA skip rules (docs-only, investigation-only), markdown lint, git validation
- Fail-closed design: Cannot verify = FAIL
- Pre-commit mode: Skip commit SHA and git clean checks

**Integration (TASK-034)**:

- Target: Inngest function
- Trigger: Session end events (manual or automated)
- Blocking: Yes (session cannot close without validation pass)
- WASM deployment required

### TASK-035/036: Invoke-BatchPRReview (P2, 6h + 2h)

**Implementation (TASK-035)**:

- Complexity: M (git worktree management)
- Key functions: create worktrees, check status, cleanup, gh CLI integration
- Operations: Setup, Status, Cleanup
- CLI flags: -Force (cleanup with uncommitted changes)

**Integration (TASK-036)**:

- Target: Inngest function
- Trigger: Batch PR review requests
- Usage: Async worktree management for parallel PR processing
- WASM deployment required

### TASK-037/038: Invoke-PRMaintenance (P2, 8h + 2h)

**Implementation (TASK-037)**:

- Complexity: M (PR discovery, classification, conflict detection)
- Key functions: discover open PRs, classify by bot category, detect activation triggers, detect derivative PRs
- Output: JSON for GitHub Actions matrix
- Bot categories: agent-controlled, mention-triggered, review-bot

**Integration (TASK-038)**:

- Target: Inngest function
- Trigger: Scheduled (cron) or manual
- Usage: PR maintenance automation
- Output: GitHub Actions matrix JSON
- WASM deployment required

### TASK-039/040: SlashCommandValidator (P2, 3h + 1h)

**Implementation (TASK-039)**:

- Complexity: XS (orchestrator module)
- Key functions: discover slash commands, invoke Validate-SlashCommand.ps1, aggregate results
- Export: Public API function for CI/pre-commit

**Integration (TASK-040)**:

- Target: GitHub Actions CI
- Trigger: Changes to `.claude/commands/**`
- Blocking: Yes (fail on validation errors)
- Note: Calls Validate-SlashCommand.ps1 (separate validator)

---

## Common Testing Requirements

All implementation tasks must include:

- **Unit Tests**: Test core validation logic with table-driven tests
- **Integration Tests**: Test CLI flag parsing and output formatting
- **Edge Case Tests**: Test empty inputs, missing files, malformed content
- **Error Handling Tests**: Test graceful degradation and error messages
- **WASM Compatibility Tests**: Ensure WASM compilation succeeds

Test coverage target: >= 80% for all validators

---

## Common Implementation Notes

### ANSI Color Codes (for Console Output)

```go
const (
    ColorReset   = "\x1b[0m"
    ColorRed     = "\x1b[31m"
    ColorYellow  = "\x1b[33m"
    ColorGreen   = "\x1b[32m"
    ColorCyan    = "\x1b[36m"
    ColorMagenta = "\x1b[35m"
)
```

### Exit Code Standards

- `0`: Validation passed (or non-blocking warning)
- `1`: Validation failed (blocking error)
- `2`: Usage error or environment issue

### CLI Flag Patterns

Use `flag` package for CLI parsing:

```go
var (
    feature    = flag.String("Feature", "", "Feature name to validate")
    all        = flag.Bool("All", false, "Validate all features")
    ciMode     = flag.Bool("CI", false, "CI mode (exit non-zero on failures)")
    format     = flag.String("Format", "console", "Output format: console, markdown, json")
)
```

### WASM Registration Pattern

```go
// In wasm/main.go
//go:build js && wasm
package main

import (
    "syscall/js"
    "yourpackage/validation"
)

func main() {
    js.Global().Set("validateConsistency", js.FuncOf(validation.ValidateConsistencyWASM))
    // ... register other validators
    select {} // Keep WASM running
}
```

---

## Sequencing Recommendation

**Week 1 (P0)**:

- TASK-015/016: Validate-Consistency
- TASK-017/018: Validate-PrePR

**Week 2 (P1)**:

- TASK-019/020: Detect-SkillViolation
- TASK-021/022: Detect-TestCoverageGaps
- TASK-023/024: Check-SkillExists

**Week 3-5 (P2 - Batch 1)**:

- TASK-025/026: Validate-MemoryIndex
- TASK-027/028: Validate-PRDescription
- TASK-029/030: Validate-SkillFormat

**Week 6-8 (P2 - Batch 2)**:

- TASK-031/032: Validate-Traceability
- TASK-033/034: Validate-Session (most complex, save for last)

**Week 9-10 (P2 - Batch 3)**:

- TASK-035/036: Invoke-BatchPRReview
- TASK-037/038: Invoke-PRMaintenance
- TASK-039/040: SlashCommandValidator

---

## Success Criteria

All tasks complete when:

- [ ] All 13 PowerShell scripts ported to Go
- [ ] All Go implementations compile to WASM
- [ ] All validators integrated into appropriate workflows
- [ ] Test coverage >= 80% for all validators
- [ ] Documentation complete with usage examples
- [ ] Original PowerShell validations deprecated/removed
- [ ] All CI checks passing with Go validators

## Complete Task List (ADR-016)

All 39 active tasks for ADR-016 Session Protocol Enforcement:

| ID | Title | Status | Complexity | Effort |
|----|-------|--------|------------|--------|
| TASK-001 | Implement session state TypeScript interfaces | complete | S | 3h |
| TASK-002 | Implement HMAC-SHA256 session state signing | complete | S | 3h |
| TASK-003 | Implement Brain note persistence for session state | complete | M | 5h |
| TASK-004 | Implement optimistic locking for concurrent updates | complete | M | 4h |
| TASK-005 | Implement SessionService with workflow tracking | complete | L | 8h |
| TASK-006 | Implement Brain CLI bridge for hook integration | complete | M | 6h |
| TASK-007 | Implement session history compaction logic | complete | M | 5h |
| TASK-008 | Remove file cache code and migrate to Brain notes | complete | S | 2h |
| TASK-009 | Write comprehensive unit tests for all components | complete | L | 8h |
| TASK-010 | Implement Inngest workflow setup | complete | S | 3h |
| TASK-011 | Implement session-protocol-start workflow | complete | M | 6h |
| TASK-012 | Implement session-protocol-end workflow | complete | M | 4h |
| TASK-013 | Implement orchestrator-agent-routing workflow | complete | L | 7h |
| TASK-014 | REMOVED - HANDOFF migration covered by Milestone 3.1 | removed | - | - |
| TASK-015 | Implement Validate-Consistency in Go | complete | L | 8h |
| TASK-016 | Integrate Validate-Consistency into Enforcement | complete | M | 4h |
| TASK-017 | Implement Pre-PR Validation Runner in Go | complete | M | 6h |
| TASK-018 | Integrate Pre-PR Validation into Enforcement | complete | S | 2h |
| TASK-019 | Implement Skill Violation Detection in Go | complete | M | 5h |
| TASK-020 | Integrate Skill Violation Detection into Enforcement | complete | S | 2h |
| TASK-021 | Implement Test Coverage Gap Detection in Go | complete | M | 5h |
| TASK-022 | Integrate Test Coverage Gap Detection into Enforcement | complete | S | 2h |
| TASK-023 | Implement Skill Existence Verification in Go | complete | S | 4h |
| TASK-024 | Integrate Skill Existence Verification into Enforcement | complete | S | 2h |
| TASK-025 | Implement Memory Index Validation in Go | complete | L | 8h |
| TASK-026 | Integrate Memory Index Validation into Enforcement | complete | S | 2h |
| TASK-027 | Implement PR Description Validation in Go | complete | M | 6h |
| TASK-028 | Integrate PR Description Validation into Enforcement | complete | S | 2h |
| TASK-029 | Implement Skill Format Validation in Go | complete | M | 5h |
| TASK-030 | Integrate Skill Format Validation into Enforcement | complete | S | 2h |
| TASK-031 | Implement Traceability Validation in Go | complete | L | 8h |
| TASK-032 | Integrate Traceability Validation into Enforcement | complete | S | 2h |
| TASK-033 | Implement Session Protocol Validation in Go | complete | L | 10h |
| TASK-034 | Integrate Session Protocol Validation into Enforcement | complete | M | 4h |
| TASK-035 | Implement Batch PR Review Worktree Management in Go | complete | M | 6h |
| TASK-036 | Integrate Batch PR Review into Enforcement | complete | S | 2h |
| TASK-037 | Implement PR Discovery and Classification in Go | complete | L | 8h |
| TASK-038 | Integrate PR Maintenance into Enforcement | complete | M | 4h |
| TASK-039 | Implement Slash Command Format Validation in Go | complete | M | 5h |
| TASK-040 | Integrate Slash Command Validation into Enforcement | complete | S | 2h |

**Phase Summary**:

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1-3: Session Protocol (TASK-001 to TASK-013) | 13 active | complete |
| Phase 4-6: Validation Scripts (TASK-015 to TASK-040) | 26 active | complete |
| **Total** | **39 active** (TASK-014 removed) | **complete** |

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- README.md: Specification expansion overview
- REQ-006 through REQ-018: Requirement specifications
