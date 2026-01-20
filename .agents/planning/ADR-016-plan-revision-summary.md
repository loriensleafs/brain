# ADR-016 Implementation Plan: Revision Summary

**Date**: 2026-01-18
**Revised By**: Planner Agent
**Trigger**: Critic verdict NEEDS REVISION

---

## Critic Verdict

**Status**: NEEDS REVISION
**Critical Issues Identified**: 4

---

## Changes Made

### 1. Added Missing Pre-PR Validation Milestone (CRITICAL)

**Issue**: Plan lacked mandatory pre-PR validation work package per planner protocol.

**Resolution**:

- Added Milestone 3.5: Pre-PR Validation (BLOCKING for PR)
- Effort: 8 hours
- Owner: QA Agent
- Deliverables:
  1. Cross-cutting concerns audit (hardcoded values → env vars)
  2. Fail-closed design verification (exit codes, error handling)
  3. Test-implementation alignment (coverage, drift detection)
  4. CI environment simulation (GITHUB_ACTIONS=true)
  5. Environment variable completeness (all vars documented)
  6. Session protocol validation (Validate-SessionProtocol.ps1 PASS)

**Impact**:

- Prevents follow-up PR pattern (PR #32→#33)
- Catches issues before PR review
- Mandatory quality gate before orchestrator APPROVED verdict

---

### 2. Resequenced Phase 2 (CRITICAL)

**Issue**: Integration testing (Milestone 3.4) needed to run BEFORE Hook Integration (Milestone 2.6).

**Resolution**:

- Moved Integration Testing from Phase 3 to Phase 2
- New sequence:
  - Milestone 2.1: Inngest Workflow Setup (20h workflows)
  - Milestone 2.2: Brain CLI Implementation (4h)
  - Milestone 2.3: Integration Testing (16h) ← MOVED HERE
  - Milestone 2.4: Hook Integration (8h) ← DEPENDS ON TESTS PASSING

**Rationale**: Hooks depend on validated workflows. Integration tests must pass before hook integration to avoid cascading failures.

**Impact**:

- Phase 2 duration: 5 days → 6 days
- Risk mitigation: Hook integration only proceeds if workflows proven stable

---

### 3. Updated Timeline and Effort Estimates (CRITICAL)

**Issue**: Missing effort for workflows (20h), migration (3h), validation (8h), docs (2h).

**Resolution**:

| Phase | Old Estimate | New Estimate | Delta | Reason |
|-------|-------------|--------------|-------|--------|
| Phase 1 | 5 days | 5 days | 0 | No change |
| Phase 2 | 5 days | 6 days | +1 day | Added integration testing |
| Phase 3 | 5 days | 5 days | 0 | Validation added, but HANDOFF deletion reduced |
| **Total** | **15 days** | **16 days** | **+1 day** | Still fits 3-week allocation |

**Detailed Effort Breakdown**:

**Phase 1** (5 days):

- 1.1: Schema Extension (2 days)
- 1.2: Optimistic Locking (1 day)
- 1.3: HMAC Signing (1 day)
- 1.4: Brain Persistence (1 day)

**Phase 2** (6 days):

- 2.1: Inngest Workflows (2.5 days / 20h)
- 2.2: Brain CLI (0.5 days / 4h)
- 2.3: Integration Testing (2 days / 16h)
- 2.4: Hook Integration (1 day / 8h)

**Phase 3** (5 days):

- 3.1: HANDOFF.md Migration (0.4 days / 3h)
- 3.2: Documentation Updates (1 day / 8h)
- 3.3: HANDOFF.md Deletion (0.5 days / 4h)
- 3.4: Final Docs + ADR Update (0.3 days / 2h)
- 3.5: Pre-PR Validation (1 day / 8h)

**Total Effort**: 77 hours (fits within 3-week sprint)

**Impact**:

- Target completion: 2026-02-08 → 2026-02-10 (+2 days buffer)
- Still achievable within 3-week allocation
- More realistic estimate prevents schedule slip

---

### 4. Clarified Inngest Workflow Scope (CRITICAL)

**Issue**: Milestones 2.1-2.4 described Inngest workflows but tasks were duplicated/missing.

**Resolution**:

- Consolidated workflow implementation into Milestone 2.1
- Milestone 2.1 now includes:
  - Inngest project setup
  - All 4 workflow files:
    - `session-protocol-start.ts` (8 steps)
    - `session-protocol-end.ts` (6 steps)
    - `orchestrator-agent-routing.ts` (agent invocation tracking)
    - `agent-completion-handler.ts` (agent completion tracking)
  - Event schemas in `apps/mcp/src/events/session.ts`
- Removed duplicate Milestones 2.2, 2.3, 2.4 (workflow descriptions)
- Renumbered:
  - Old 2.5 (Brain CLI) → New 2.2
  - Old 2.6 (Hook Integration) → New 2.4

**Rationale**: Workflows are implemented together (not separately) for architectural coherence. Separate milestones created artificial sequencing.

**Impact**:

- Clarity: No duplicate deliverables
- Effort transparency: 20 hours allocated to complete workflow implementation
- Testability: Integration tests (2.3) validate all workflows before hook integration

---

## Summary of Revisions

| Change | Type | Impact |
|--------|------|--------|
| Added Pre-PR Validation (3.5) | New milestone | +8h, BLOCKING gate for PR |
| Moved Integration Testing (2.3) | Resequencing | +1 day Phase 2, risk reduction |
| Updated total effort | Estimate refinement | 77h total (+33h from baseline) |
| Consolidated workflows (2.1) | Scope clarification | 20h transparent, no duplication |

---

## Revised Milestone Sequence

**Phase 1** (Week 1):

1. 1.1: Session State Schema Extension (2 days)
2. 1.2: Optimistic Locking (1 day)
3. 1.3: HMAC Signing (1 day)
4. 1.4: Brain Persistence (1 day)

**Phase 2** (Week 2):

1. 2.1: Inngest Workflow Setup + Implementation (2.5 days, 20h)
2. 2.2: Brain CLI (0.5 days, 4h)
3. 2.3: Integration Testing (2 days, 16h) ← MOVED FROM PHASE 3
4. 2.4: Hook Integration (1 day, 8h) ← DEPENDS ON 2.3 PASS

**Phase 3** (Week 3):

1. 3.1: HANDOFF.md Migration (3h)
2. 3.2: Documentation Updates (8h)
3. 3.3: HANDOFF.md Deletion (4h)
4. 3.4: Final Docs + ADR Update (2h)
5. 3.5: Pre-PR Validation (8h) ← NEW, BLOCKING PR CREATION

---

## Validation Checklist

All critical issues addressed:

- [x] Added Milestone 3.5: Pre-PR Validation (8h, BLOCKING for PR)
  - Task 3.5.1: Extract hardcoded values
  - Task 3.5.2: Document environment variables
  - Task 3.5.3: Validate fail-closed behavior
  - Task 3.5.4: CI simulation testing
  - Task 3.5.5: Cleanup TODOs/FIXMEs
  - Task 3.5.6: Run Validate-SessionProtocol.ps1

- [x] Resequenced Phase 2:
  - Milestone 2.3 (Integration Testing) BEFORE Milestone 2.4 (Hook Integration)
  - Dependencies explicit: Hook Integration depends on Integration Testing PASS

- [x] Updated Timeline:
  - Added +33 hours to total estimate (workflows 20h + migration 3h + validation 8h + docs 2h)
  - New total: 77 hours (fits 3-week allocation)
  - Target completion: 2026-02-10 (was 2026-02-08, +2 days buffer)

- [x] Clarified Inngest Workflow Scope:
  - Consolidated all workflow implementation into Milestone 2.1 (20h)
  - Removed duplicate workflow milestones (old 2.2, 2.3, 2.4)
  - All 4 workflow files explicitly listed in deliverables

---

## Next Steps

1. Route updated plan to **critic** for re-validation
2. If critic approves: Route to **implementer** for Phase 1 execution
3. If critic rejects: Address remaining issues

---

## Related Documents

- **Original Plan**: `.agents/planning/ADR-016-implementation-plan.md`
- **Critic Review**: (User-provided feedback in task description)
- **ADR-016**: `.agents/architecture/ADR-016-automatic-session-protocol-enforcement.md`
