---
title: CRIT-002-revised-adr-plan-review
type: note
permalink: critique/crit-002-revised-adr-plan-review
tags:
- critique
- multi-tool
- architecture
- planning
- review
- alignment
---

# CRIT-002: Revised ADR-002 and PLAN-001 Alignment Review

## Documents Reviewed

- **ADR-002** (revised 2026-02-10): Multi-Tool Compatibility Architecture
- **PLAN-001** (unchanged): Multi-Tool Compatibility Implementation Plan
- **CRIT-001**: Original critique findings for comparison

## Verdict: REVISE (conditional on PLAN-001 update)

ADR-002 revision is strong. It addresses most CRIT-001 findings and introduces significant architectural improvements. However, PLAN-001 has NOT been updated to reflect the revised architecture, creating a critical misalignment.

---

## Check 1: Root-Level Structure

**Verdict**: [PASS] (ADR) / [FAIL] (PLAN)

ADR-002 revision makes a significant and well-justified architectural change: canonical content at repo root instead of `packages/plugin-content/`. The rationale is sound -- static content does not benefit from turbo workspace orchestration, and root-level placement aligns with community patterns.

The new structure is clearly documented:

- `agents/`, `skills/`, `commands/`, `hooks/` at repo root
- `adapters/` directory with TS transforms + tests
- `apps/tui/pkg/adapters/` for Go adapter logic
- `apps/claude-plugin/` is REMOVED (all tools equal)
- AGENTS.md at repo root as universal instruction file

**Critical misalignment**: PLAN-001 still references the OLD architecture throughout:

- Task 1.1: "Create `packages/plugin-content/` workspace package" -- this package no longer exists
- Tasks 1.2-1.6: "Move to `packages/plugin-content/agents/`" -- should be repo root `agents/`
- Task 1.7: "Refactor `apps/claude-plugin/`" -- this directory is being removed, not refactored
- Task 2.1: "Create `apps/cursor-plugin/` adapter" -- replaced by `adapters/cursor.ts`
- Task 3.1: "Create `apps/gemini-plugin/` adapter" -- replaced by `adapters/gemini.ts`
- All Phase 1 task acceptance criteria reference the old paths

**This is the single blocking issue.** PLAN-001 must be rewritten to match the revised ADR-002 architecture. Every task, path reference, acceptance criterion, and dependency needs updating.

---

## Check 2: CRIT-001 Findings Incorporation

### Finding: Gemini parallel gap (BLOCKING)

**Status**: [PASS] -- Addressed. ADR-002 section 6 now says "PENDING: User decision on whether this is acceptable or Gemini should be descoped from orchestration support." The requirement is reframed as "for tools that support it" with explicit acknowledgment that user sign-off is needed.

### Finding: Emoji validation spike

**Status**: [PASS] -- Addressed. ADR-002 section 5 now includes: "An emoji validation spike in Phase 1 tests rendering across all 3 tools before committing to the approach. If any tool mangles the emoji, fallback options include a text prefix (`[brain]`) or Unicode escape sequences."

### Finding: Adapter build vs runtime clarification

**Status**: [PASS] -- Addressed. ADR-002 section 4 now clearly states dual implementation: TS adapters for CI/test (build-time), Go adapters in CLI for install-time. Golden file parity tests verify both produce identical output.

### Finding: Missing risks (implicit Claude Code deps, emoji encoding, gum+bubbletea)

**Status**: [WARNING] -- Partially addressed. ADR-002 adds `extraction-risk` observation about implicit Claude Code dependencies. Emoji encoding risk addressed via golden file tests. gum+bubbletea integration risk not explicitly addressed in ADR but this is low severity.

### Finding: Agent-teams variant interaction with install flow

**Status**: [PASS] -- Addressed. ADR-002 section 6 documents variant files in `agents/variants/claude-code/` and the staging-time swap mechanism. Section 7 states install staging strategy is pending research (task #15).

### Finding: Missing task for CLAUDE.md update

**Status**: [WARNING] -- Not addressed in PLAN-001 (since plan was not updated). Must be included in the revised plan.

### Finding: Missing task for canonical schema documentation

**Status**: [PASS] -- ADR-002 section 2 now defines the canonical frontmatter schema directly, reducing the need for a separate documentation task.

### Finding: Missing task for round-trip validation

**Status**: [WARNING] -- ADR-002 mentions golden file snapshot tests but PLAN-001 lacks a specific task for this. Must be in revised plan.

### Finding: Testing harness spike

**Status**: [WARNING] -- ADR-002 mentions `adapters/__tests__/` but PLAN-001 lacks a specific task. Must be in revised plan.

---

## Check 3: Canonical Frontmatter Schema

**Verdict**: [PASS]

ADR-002 section 2 now defines the canonical schema with clear field definitions:

- `name` (machine identifier, kebab-case)
- `display_name` (human-visible with emoji prefix)
- `description` (tool-agnostic)
- `model` (adapter maps to tool-specific ID)
- `tools` (capability declarations)
- `parallel` (boolean for background/subagent support)
- `tags` (discovery metadata)

The tool-specific mapping table is clear and complete. This was a missing element in the original ADR that CRIT-001 flagged.

---

## Check 4: Security Section

**Verdict**: [PASS]

The security section is substantially expanded from the original. It now covers:

- TOCTOU risk with atomic operations and restrictive permissions
- Supply chain risk with deterministic pure functions and golden file snapshots
- Hook trust model (tool-level permissions, no elevation, linted code)
- MCP trust model (subprocess, stdio, no network exposure)
- Tool detection via filesystem check (no untrusted binary execution)
- Credential separation

This addresses the security review gap identified by the 6-agent debate.

---

## Check 5: Gemini Parallel Gap Marked PENDING

**Verdict**: [PASS]

ADR-002 section 6 explicitly states: "PENDING: User decision on whether this is acceptable or Gemini should be descoped from orchestration support." The requirement is reframed to "for tools that support it" with a clear call-out that user sign-off is needed. This satisfies the CRIT-001 blocking finding.

---

## Check 6: Plan Alignment with Revised ADR

**Verdict**: [FAIL]

PLAN-001 is completely misaligned with the revised ADR-002. Specific misalignments:

| PLAN-001 Reference | ADR-002 Revised Reality |
|:--|:--|
| `packages/plugin-content/` workspace package | Content at repo root, no workspace package |
| `apps/claude-plugin/` refactored | `apps/claude-plugin/` removed entirely |
| `apps/cursor-plugin/` adapter app | `adapters/cursor.ts` + Go adapter |
| `apps/gemini-plugin/` adapter app | `adapters/gemini.ts` + Go adapter |
| Go binary `brain-hooks` kept in Claude adapter | JS/TS hook scripts replace Go binary |
| Turbo workspace dependency tracking | Root-level content, no turbo involvement |
| Phase 1 task 1.1: create workspace package | Should be: create root-level directory scaffold |
| Phase 1 task 1.7: refactor Claude adapter app | Should be: create Claude adapter in `adapters/`, create Go adapter in `apps/tui/pkg/adapters/`, remove `apps/claude-plugin/` |

**New tasks needed in revised plan**:

1. Port brain-hooks Go binary to JS/TS hook scripts (significant new scope)
2. Create `adapters/` directory with TS adapters + tests + golden files
3. Create `apps/tui/pkg/adapters/` with Go adapter logic
4. Remove `apps/claude-plugin/` after content extraction
5. Create AGENTS.md at repo root
6. Golden file parity tests (TS adapter output == Go adapter output)
7. Version compatibility validation (SUPPORTED_VERSIONS map)

**Removed tasks from plan**:

- Task 1.1 (workspace package) -- no longer needed
- Task 1.7 as written (refactor Claude adapter app) -- completely different scope now
- Tasks 2.1, 3.1 as written (per-tool adapter apps) -- replaced by lightweight adapters

---

## Check 7: Filename Kebab-Case

**Verdict**: [PASS]

Both documents in Brain memory use kebab-case filenames:

- `decisions/ADR-002-multi-tool-compatibility-architecture.md`
- `planning/PLAN-001-multi-tool-compatibility-implementation-plan.md`

This note also follows kebab-case: `CRIT-002-revised-adr-plan-review.md`

---

## Additional Findings

### New Architecture Element: JS/TS Hook Port

ADR-002 introduces a significant new decision: replacing the Go `brain-hooks` binary with JS/TS hook scripts. This was not in the original ADR and is a substantial scope change:

- The Go binary contains scenario detection, skill loading, and analysis logic
- Porting to TS is nontrivial (ADR acknowledges "Phase 1 is largest due to brain-hooks binary port")
- The Go source is archived, not deleted, until TS port is validated

This is the right architectural direction (hooks must be portable across tools) but PLAN-001 has no tasks for this port. The revised plan must account for this scope.

### New Architecture Element: Dual Adapter Implementation

ADR-002 introduces TS + Go adapters with golden file parity testing. This is well-justified (end users should not need bun) but doubles the adapter implementation work. PLAN-001 does not account for Go adapter development in `apps/tui/pkg/adapters/`.

### New Architecture Element: PowerShell Script Portability

ADR-002 section 9 raises an important new concern about PowerShell scripts across tools. This was not in the original ADR. The decision to defer to Phase 3 is reasonable but should be tracked as a risk in the plan.

---

## Final Verdict: REVISE

### Blocking Issue

**PLAN-001 must be rewritten to match revised ADR-002.** The plan references the old architecture throughout (workspace package, per-tool adapter apps, retained Claude adapter). Every task path, acceptance criterion, and dependency needs updating. This is not a minor edit -- it requires a full plan revision given the scope of architectural changes.

### ADR-002 Assessment: [PASS]

The revised ADR-002 is substantially improved:

- Root-level structure is well-justified
- Canonical frontmatter schema is defined
- Security section is comprehensive
- Gemini parallel gap marked PENDING
- Dual adapter pattern (TS + Go) clearly explained
- Hook script port documented
- Tool detection strategy updated (config dirs primary)
- All filenames kebab-case

### Recommendation

1. Planner teammate should rewrite PLAN-001 to match revised ADR-002
2. New tasks needed for: hook binary port, dual adapter implementation, Go adapter golden file parity, AGENTS.md creation, `apps/claude-plugin/` removal
3. Phase 1 scope has increased (hook port + dual adapters) -- effort estimate should be revisited

## Observations

- [decision] ADR-002 revision passes review; PLAN-001 requires full rewrite to match #verdict
- [fact] ADR-002 addresses 7 of 8 CRIT-001 findings; remaining 1 (gum+bubbletea integration) is low severity #review-coverage
- [risk] PLAN-001 references old architecture throughout, making it unusable for implementation #blocking
- [risk] Phase 1 scope increased by hook binary port and dual adapter implementation #scope-creep
- [insight] Root-level canonical content is a better architectural choice than turbo workspace package #architecture
- [insight] Dual adapter pattern (TS for CI, Go for CLI) avoids forcing bun dependency on end users #pragmatic
- [fact] ADR-002 now defines canonical frontmatter schema with 7 fields #schema
- [fact] Security section expanded from 3 bullet points to 6 detailed threat mitigations #security

## Relations

- reviews [[ADR-002-multi-tool-compatibility-architecture]]
- reviews [[PLAN-001-multi-tool-compatibility-implementation-plan]]
- follows_up [[CRIT-001-multi-tool-architecture-critique]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
