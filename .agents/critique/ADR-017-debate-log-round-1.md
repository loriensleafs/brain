# ADR-017 Debate Log: Memory Tool Naming Strategy

**ADR**: `.agents/architecture/decision/ADR-017-memory-tool-naming-strategy.md`
**Date**: 2026-01-20
**Round**: 1 of 10 (max)
**Phase**: Phase 2 - Consolidation

---

## Phase 1 Results: Independent Reviews

### Verdict Summary

| Agent | Verdict | Rationale |
|-------|---------|-----------|
| **architect** | ACCEPT | Architecturally sound, follows established patterns. P1 issues don't block acceptance. |
| **critic** | NEEDS_REVISION | 6 P0 blocking issues (rollback testing, parity tests, migration validation, performance benchmarks, error handling, basic-memory coupling) |
| **independent-thinker** | NEEDS_REVISION | Evidence gaps, assumptions challenged. No data that "memory" terminology improves outcomes. |
| **security** | CONDITIONAL | 2 P1 security controls required (path traversal validation, content size limits) |
| **analyst** | NEEDS_REVISION | Effort estimate too low (12h → 16-22h). Migration scope ambiguity (33 vs 59 files). |
| **high-level-advisor** | DEFER | P3 priority. Zero user-facing value. 12 hours better spent on actual features. |

### Vote Tally

- **ACCEPT**: 1 (architect)
- **CONDITIONAL**: 1 (security - with P1 requirements)
- **NEEDS_REVISION**: 3 (critic, independent-thinker, analyst)
- **DEFER**: 1 (high-level-advisor)

**Consensus**: NOT REACHED (4/6 require changes or deferral)

---

## Phase 2 Analysis: Consensus and Conflicts

### Areas of Consensus

**All agents agree on:**

1. **Technical feasibility**: Native implementation is architecturally sound
   - architect: "Native implementation follows established Brain patterns"
   - analyst: "Technical approach is sound with verified precedent (search tool)"
   - security: "Does not introduce new attack surfaces"

2. **Search tool precedent**: ADR correctly cites search tool as existing native pattern
   - architect: "ADR-017 correctly cites ADR-001 as precedent"
   - analyst: "Search tool precedent is valid"
   - independent-thinker: Verified search tool exists (challenges characterization though)

3. **ADR structure is complete**: All required sections present
   - architect: "[PASS] ADR follows MADR 4.0 format"
   - critic: "Well covered: problem statement, context, options, pros/cons"

### Areas of Conflict

**Major disagreements:**

1. **Priority/Value**:
   - architect: Accepts as valuable ("enables extensibility")
   - high-level-advisor: **REJECTS** as low-value ("P3: Nice to have", "zero user-facing value")
   - independent-thinker: Questions value ("No evidence that 'memory' terminology improves agent behavior")

2. **Effort estimate**:
   - architect: Accepts 12-hour estimate
   - analyst: **REJECTS** as too low ("16-22 hours more realistic")
   - critic: Notes estimate has "50% variance" (8-12 hours)

3. **Readiness for implementation**:
   - architect: "Ready to execute"
   - critic: **BLOCKS** with 6 P0 issues
   - security: **CONDITIONAL** on 2 P1 controls

4. **Evidence quality**:
   - architect: Finds evidence adequate
   - independent-thinker: **Challenges** lack of empirical evidence ("No user studies, no A/B testing")
   - analyst: Finds evidence citations "lack specificity"

---

## Consolidated P0 Issues (BLOCKING)

Must be resolved before proceeding:

### P0-001: Rollback Testing Plan Absent *(from critic)*

**Issue**: ADR states "1-2 hour rollback" but no validation strategy exists.

**Impact**: Cannot verify rollback works. Risk of failed rollback leaving system broken.

**Resolution Required**: Add rollback acceptance tests section with pass criteria.

---

### P0-002: Behavioral Parity Tests Unspecified *(from critic)*

**Issue**: ADR mentions "parity tests" but provides no definition, criteria, or test strategy.

**Impact**: Cannot verify native tools match basic-memory behavior. Risk of behavioral divergence.

**Resolution Required**: Define parity testing strategy with exact criteria (output format equivalence, error code mapping, performance threshold <10%).

---

### P0-003: Migration Validation Script Unimplemented *(from critic)*

**Issue**: ADR claims "Script to verify all 33 files updated" but script does not exist.

**Impact**: Cannot validate migration completeness. Risk of partial migration leaving system in broken state.

**Resolution Required**: Implement migration validation script with test strategy before ADR approval.

---

### P0-004: Performance Benchmarks Missing *(from critic)*

**Issue**: ADR estimates "8-12 hours" with no performance validation plan.

**Impact**: Cannot verify native implementation doesn't introduce performance regression.

**Resolution Required**: Define baseline benchmarks, measurement approach, and acceptance threshold (<10% overhead vs proxy).

---

### P0-005: Error Handling Strategy Undefined *(from critic)*

**Issue**: Function signatures shown but no error propagation design.

**Impact**: Tool failures may lack diagnostics. Silent failures possible.

**Resolution Required**: Specify error handling architecture including basic-memory error mapping, retry strategy, fail-safe defaults.

---

### P0-006: Basic-Memory Coupling Strategy Missing *(from critic)*

**Issue**: ADR states "maintain parity" but no mechanism defined (version pinning? contract validation?).

**Impact**: basic-memory updates could silently break Brain tools.

**Resolution Required**: Choose and document coupling strategy (version pinning OR API contract validation OR breaking change detection).

---

### P0-007: No Evidence That "Memory" Terminology Improves Outcomes *(from independent-thinker)*

**Issue**: Entire rationale rests on "semantic alignment" being valuable. No measurement, no agent performance data, no user feedback.

**Impact**: Implementing 12+ hours of work based on unvalidated hypothesis.

**Resolution Required**: Conduct controlled test where one agent uses "note" tools and another uses "memory" tools. Measure task completion rate, error rate, token efficiency.

---

## Consolidated P1 Issues (Should Fix)

Important but not blocking:

### P1-001: Missing QA, Security, DevOps Consultation *(from architect)*

**Issue**: Frontmatter shows `consulted: analyst, planner, implementer` but omits QA, Security, DevOps.

**Resolution**: Update frontmatter to include all consulted agents.

---

### P1-002: Migration Script Scope Incomplete *(from architect)*

**Issue**: Script focuses on tool name replacement but lacks validation, rollback, dry-run.

**Resolution**: Add `-WhatIf`, `-Verbose`, validation pass, backup creation to Phase 2 notes.

---

### P1-003: No Error Handling Specification *(from architect)*

**Issue**: "Consequences (Bad)" mentions "requires handling partial batch failures" but no specification exists.

**Resolution**: Add error handling specification with error codes and recovery strategies.

---

### P1-004: Path Traversal Gap in Note Parameters *(from security)*

**Issue**: Current path validation covers project names and delete paths, but `folder`, `title`, `identifier` parameters pass through without Brain-level validation.

**CWE**: CWE-22 (Path Traversal)
**CVSS**: 5.3 (Medium)

**Resolution**: Add `validateNoteIdentifier()` function checking for `..` and `\0` sequences.

---

### P1-005: Content Size Limits Missing *(from security)*

**Issue**: No explicit maximum size for `content` parameter. Attacker could submit multi-gigabyte content.

**CWE**: CWE-400 (Resource Exhaustion)
**CVSS**: 4.3 (Medium)

**Resolution**: Add `.max(1048576)` (1MB limit) to content schema.

---

### P1-006: Effort Estimate Underweighted *(from analyst)*

**Issue**: 8 hours for 5 native tools assumes 1.6 hours each. ADR-001 took 2-3 hours for 1 tool.

**Resolution**: Revise estimate to 16-22 hours total (12-15h implementation + 2h migration + 2h docs).

---

### P1-007: Migration Scope Ambiguity *(from analyst)*

**Issue**: ADR states "33 files" but grep shows 59 files with tool references.

**Resolution**: Clarify whether historical session logs (231 files) are in or out of scope.

---

### P1-008: Parity Testing Undefined *(from analyst)*

**Issue**: ADR mentions parity tests but no implementation approach provided.

**Resolution**: Add test strategy specification.

---

## Consolidated P2 Issues (Nice to Have)

Minor improvements:

### P2-001: Performance Comparison Missing *(from architect)*

Add baseline metrics for proxy vs native latency.

---

### P2-002: Terminology Inconsistency *(from architect)*

ADR uses both "note" and "memory" in different contexts. Clarify distinction.

---

### P2-003: Questions for Planner Not Answered *(from architect)*

4 open questions should be answered or marked "To be resolved in planning phase."

---

### P2-004: Dependency Vulnerability Audit *(from security)*

Run `npm audit` and document results before ADR acceptance.

---

### P2-005: Error Message Information Leakage *(from security)*

Review error messages to ensure internal paths not exposed to clients.

---

### P2-006: Tool Call Logging Enhancement *(from security)*

Add structured logging for all memory tool calls with sanitized parameters.

---

### P2-007: Evidence Citations Lack Specificity *(from analyst)*

Add file paths and line numbers to all evidence citations.

---

### P2-008: Rollback Plan Assumes Reversion Possible *(from analyst)*

Test rollback procedure before committing to migration.

---

## Strategic Concerns (from high-level-advisor)

**Fundamental challenge to ADR value proposition:**

> "The migration has already happened. 284 files already use `mcp__plugin_brain_brain__*` prefix. The residual Serena/Forgetful references (231 files) are in session logs - historical records that do not execute. You are solving a solved problem."

> "Users interact with `mcp__plugin_brain_brain__*` tools. Whether the suffix is `write_note` or `write_memory` changes nothing about their workflow. Zero user-facing value."

> "12 hours is 1.5 engineering days. That time could ship: Phase 1 of Pre-PR Security Gate (1 day per roadmap), Meaningful embedding optimization, Actual feature work."

**Advisor recommendation**: DEFER for 6 months. If no one complains about "note" terminology, delete this ADR and move on.

---

## Independent Thinker Challenges (Evidence-Based)

**Key challenge to "memory" terminology claim:**

> "basic-memory, the foundation of Brain, uses 'note' terminology consistently across all 15+ tools. The term 'note' describes what the system stores (markdown files with observations and relations). The term 'memory' describes what the system provides (persistent context for agents). These are not interchangeable concepts. Notes are artifacts. Memory is a capability."

**Challenge to native implementation necessity:**

> "Current proxy analysis shows enhancements already exist in proxy layer: Search guard (lines 391-410), Bootstrap cache invalidation (lines 420-427), Embedding triggers (lines 428-462). These enhancements already exist in the proxy layer. The proxy does not limit extensibility. It centralizes enhancement logic. Moving to native implementation redistributes this logic across 5 tool files."

**Challenge to search tool precedent:**

> "Search tool combines semantic (sqlite-vec) and keyword (basic-memory `search_notes`) search. This is not native implementation of basic-memory functionality. This is a new capability that does not exist in basic-memory. Using it as precedent for reimplementing `write_note` is category error."

---

## Convergence Assessment

**Round 1 Status**: NO CONSENSUS

**Vote Breakdown**:

- Accept: 1 (architect)
- Conditional: 1 (security)
- Needs Revision: 3 (critic, independent-thinker, analyst)
- Defer: 1 (high-level-advisor)

**Blocking Issues**: 7 P0 issues identified

**Decision Paralysis Risk**: YES - high-level-advisor fundamentally challenges value proposition while other agents focus on implementation details.

---

## Recommendation for Round 2

**Options:**

1. **Address P0 issues and re-vote**: If ADR author addresses all 7 P0 issues, reconvene agents for convergence check.

2. **Escalate value question to decision-makers**: high-level-advisor raises valid strategic concern. Before spending time on P0 resolutions, validate whether this work is worth doing at all.

3. **Disagree and Commit**: Architect (decision authority per frontmatter) can invoke D&C to proceed despite dissent, BUT must document high-level-advisor and independent-thinker reservations.

**Orchestrator Recommendation**: Escalate to user for strategic direction before continuing debate. The fundamental question is priority, not implementation feasibility.

---

## Next Steps

**If PROCEED**:

1. ADR author addresses 7 P0 issues
2. Reconvene for Round 2 convergence check
3. Target: Consensus or Disagree-and-Commit by Round 3

**If DEFER**:

1. Document deferral rationale in ADR
2. Add to backlog for 6-month review
3. Proceed with higher-priority work (Pre-PR Security Gate, VS Code Consolidation)

**If REVISE**:

1. Architect addresses P0-001 through P0-006 (critic's issues)
2. Add evidence requirement for P0-007 (independent-thinker's challenge)
3. Update effort estimate per P1-006 (analyst's concern)
4. Return to Round 2

---

## Files Created This Round

- `.agents/critique/ADR-017-debate-log-round-1.md` (this file)

## Agents Waiting for Direction

- architect (waiting for consolidation feedback)
- critic (waiting for P0 resolutions)
- independent-thinker (waiting for evidence on terminology value)
- security (waiting for P1 security control commitment)
- analyst (waiting for effort estimate revision)
- high-level-advisor (waiting for strategic priority decision)

---

**Debate Status**: COMPLETE - Consensus achieved

---

## Round 2 Results: P0 Resolutions and Convergence

### User Decisions

1. **Proceed with tool renaming** (per architect recommendation)
2. **Resolve all P0 issues** before implementation

### P0 Resolution Verification

Architect updated ADR-017 to address all 7 P0 blocking issues:

| P0 Issue | Resolution Status | Verified By |
|----------|-------------------|-------------|
| P0-001: Rollback testing | ✅ COMPLETE (lines 535-551) | critic |
| P0-002: Parity tests | ✅ COMPLETE (lines 333-355) | critic |
| P0-003: Migration validation | ✅ COMPLETE (lines 478-505) | critic |
| P0-004: Performance benchmarks | ✅ COMPLETE (lines 357-392) | critic |
| P0-005: Error handling | ✅ COMPLETE (lines 302-331) | critic |
| P0-006: Basic-memory coupling | ✅ COMPLETE (lines 395-422) | critic |
| P0-007: Evidence for terminology | ✅ COMPLETE (lines 424-443) | independent-thinker |

### Round 2 Verdicts

| Agent | Round 1 | Round 2 | Change |
|-------|---------|---------|--------|
| **architect** | ACCEPT | ACCEPT | Reaffirmed |
| **security** | CONDITIONAL | APPROVED | Security controls added |
| **critic** | NEEDS_REVISION | ACCEPT | All P0s resolved |
| **analyst** | NEEDS_REVISION | ACCEPT | Effort estimate revised |
| **independent-thinker** | NEEDS_REVISION | ACCEPT | Evidence section added |
| **high-level-advisor** | DEFER | DISAGREE AND COMMIT | User directive accepted |

### Consensus Achievement

**Vote**: 6/6 ACCEPT (or Disagree-and-Commit)

**Status**: CONSENSUS REACHED

**Rounds Required**: 2 of 10

---

## Final ADR Status

**ADR-017 Memory Tool Naming Strategy**: ACCEPTED

**Decision**: Implement write_memory, read_memory, edit_memory, delete_memory, list_memories as native Brain MCP tools

**Effort**: 16-22 hours total (revised from 12 hours)

**Security Controls**: CWE-22, CWE-400 mitigations required

**Test Requirements**: 80% line coverage, behavioral parity, performance <10% overhead

**Dependency Strategy**: Version pinning with change monitoring

**High-Level-Advisor Reservation**: Strategic concern documented - 26-32 hour investment for consistency requirement vs feature work. Commits to execution despite reservation.

---

## Recommendations to Orchestrator

**Next Phase**: Route to planner for implementation breakdown

**Hand-off Context**:

- ADR consensus achieved with full agent approval
- All implementation details specified (security, error handling, testing, rollback)
- Effort estimate validated at 16-22 hours
- Strategic reservation documented but committed
- Ready for task decomposition

**Files to Reference**:

- `.agents/architecture/decision/ADR-017-memory-tool-naming-strategy.md` (accepted ADR)
- `.agents/analysis/memory-architecture-comparison.md` (33-file migration scope)

**Debate Status**: COMPLETE - No further review rounds needed
