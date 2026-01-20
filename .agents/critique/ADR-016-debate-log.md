# ADR-016 Review Debate Log

## Metadata

| Field | Value |
|-------|-------|
| **ADR** | ADR-016: Automatic Session Protocol Enforcement via Inngest Workflows |
| **Review Date** | 2026-01-18 |
| **Rounds** | 1 |
| **Final Verdict** | CONDITIONAL ACCEPT |
| **Status** | Revised with P0 Resolutions |

---

## Phase 0: Related Work Research

**Existing Context**:

- Gap analysis at `.agents/analysis/001-session-protocol-automation-gaps.md`
- 17 gaps identified (5 Critical, 5 High, 4 Medium, 3 Low)
- User requirements: Use Brain MCP workflows and session state, eliminate HANDOFF.md, track orchestrator workflows

**Existing Inngest Workflows** (apps/mcp/src/inngest/):

- `session-state-update` - Session state changes
- `session-state-query` - Session state queries
- `feature-completion` - Feature completion validation
- `hitl-approval` - Human-in-the-loop approval gates

---

## Phase 1: Independent Agent Reviews

### Architect Review

**Verdict**: ACCEPT with P1 fixes

**Key Points**:

- Architecture is coherent and eliminates HANDOFF.md as requested
- Brain-first persistence is appropriate
- Inngest workflows provide good observability

**P1 Issues Identified**:

1. Compaction strategy needs specification
2. Migration script needed
3. Failure modes need documentation
4. Monitoring approach undefined

---

### Critic Review

**Verdict**: NEEDS_WORK

**P0 Blockers Identified**:

1. Memory-index missing (cross-reference for sessions)
2. QA gate missing (validation before session close)
3. No parallel operation period for migration
4. No failure recovery defined
5. Concurrent session handling missing

---

### Independent-Thinker Review

**Verdict**: NEEDS_WORK

**Key Concerns**:

1. Solution is over-engineered for the problem
2. Graceful degradation undefined
3. Simpler alternatives not evaluated (improved tooling, better docs)
4. Evidence of 30% efficiency loss lacks methodology

---

### Security Review

**Verdict**: NEEDS_WORK | **Confidence**: 85%

**P0 Security Issues**:

1. **SEC-001**: Session state tampering via filesystem (Brain notes are plaintext)
2. **SEC-002**: Race condition in concurrent session updates
3. **SEC-003**: Fail-open behavior when state unavailable

**P1 Security Issues**:

1. **SEC-004**: MCP restart window exploitation
2. **SEC-005**: Event injection via Inngest
3. **SEC-006**: Secret exposure in agent context
4. **SEC-007**: Brain CLI trust boundary violation

**Recommendations**:

- Add HMAC-SHA256 signing to session state
- Change fail-open to fail-closed
- Add optimistic locking for concurrent updates
- Add secret redaction filter

---

### Analyst Review

**Verdict**: BLOCK | **Confidence**: 85%

**P0 Gaps Identified**:

1. Compaction strategy undefined
2. Concurrent session handling missing
3. Migration risk unmitigated
4. Schema validation missing
5. Memory-index missing

**Key Analysis Points**:

- Root cause of protocol violations not investigated
- Evidence quality insufficient (30% claim lacks methodology)
- Timeline optimistic (3 weeks should be 4-6 weeks)
- Brain notes as database inappropriate without atomic operations
- Alternatives not properly evaluated

---

### High-Level Advisor Review

**Verdict**: NEEDS_WORK | **Confidence**: 85%

**Strategic Assessment**:

- ADR conflates two problems: protocol enforcement + workflow tracking
- Scope is too large (scope creep score: 8/10)
- No incremental value delivery possible
- 3-week estimate is optimistic

**Recommendation**: Split into ADR-016a (OrchestratorWorkflow tracking) and ADR-016b (Brain persistence)

**Alternative Proposed**: Extend existing sessionState.ts with OrchestratorWorkflow fields, keep file cache, add 1 event. Done in 3-4 days.

---

## Phase 2: Consolidation

### Consensus Issues (All Agree)

| ID | Issue | Agents |
|----|-------|--------|
| C-01 | Compaction strategy undefined | Architect, Critic, Analyst |
| C-02 | Concurrent session handling missing | Critic, Security, Analyst |
| C-03 | Migration risk unmitigated | Critic, Analyst, High-level-advisor |
| C-04 | Schema validation missing | Analyst |
| C-05 | Fail-open security behavior | Security, Critic |

### Conflict Points

| Conflict | Position A | Position B |
|----------|-----------|-----------|
| Scope | Architect: Full implementation | High-level-advisor: Split ADR |
| Approach | Architect: Inngest workflows | Independent-thinker: Simpler alternatives |
| Evidence | Architect: Sufficient | Analyst: Needs root cause analysis |

---

## Phase 3: Resolution

### P0 Resolutions Added to ADR

1. **Resolution 1: Compaction Strategy Specification**
   - Trigger: >10 completed agent invocations
   - Logic: Keep last 3, store rest in history note
   - Validation: Schema check required
   - Rollback: 30-day retention

2. **Resolution 2: Concurrent Session Handling**
   - Add `version` field for optimistic locking
   - Retry up to 3 times on conflict
   - Fail if all retries exhausted

3. **Resolution 3: Session State Signing**
   - HMAC-SHA256 with server-side secret
   - Verify signature in hooks before trusting state
   - Environment variable: `BRAIN_SESSION_SECRET`

4. **Resolution 4: Fail-Closed Behavior**
   - Block destructive tools when state unavailable
   - Allow read-only tools in unknown mode
   - Require explicit "disabled" mode to bypass all gates

5. **Resolution 5: Clean Migration (No Backwards Compatibility)**
   - Direct cutover to Brain notes
   - No parallel operation needed
   - Existing sessions start fresh
   - File cache code removed entirely

---

## Phase 4: Convergence Check

### Remaining Concerns (Post-Resolution)

| Agent | Concern | Addressed? |
|-------|---------|-----------|
| Architect | Compaction strategy | YES |
| Critic | Memory-index | NO (deferred to P1) |
| Critic | QA gate | NO (deferred to P1) |
| Security | Session tampering | YES (HMAC) |
| Security | Race conditions | YES (optimistic locking) |
| Security | Fail-open | YES (fail-closed) |
| Analyst | Schema validation | PARTIAL (signature validates) |
| High-level-advisor | Scope | ACCEPTED (user wants full solution) |

### P1 Items Deferred to Implementation

1. Memory-index for session cross-references
2. QA validation gate before session close
3. Secret redaction filter for agent context
4. Brain CLI integrity verification

### Dissent Record

**High-level-advisor**: Maintains that splitting into ADR-016a/b would be more pragmatic, but commits to full implementation given user's explicit requirements for workflow-based enforcement with orchestrator tracking.

**Analyst**: Maintains that root cause investigation should precede implementation, but commits to proceeding with added resolutions and metrics collection during parallel operation phase.

---

## Final Verdict

### Status: CONDITIONAL ACCEPT

**Conditions**:

1. All 5 P0 resolutions implemented as specified in ADR
2. P1 items tracked as follow-up issues
3. 2-week parallel operation period before cutover
4. Acceptance criteria met before Phase 3b

### Vote Summary

| Agent | Initial | Final |
|-------|---------|-------|
| Architect | ACCEPT | ACCEPT |
| Critic | NEEDS_WORK | DISAGREE-AND-COMMIT |
| Independent-thinker | NEEDS_WORK | DISAGREE-AND-COMMIT |
| Security | NEEDS_WORK | ACCEPT (with resolutions) |
| Analyst | BLOCK | DISAGREE-AND-COMMIT |
| High-level-advisor | NEEDS_WORK | DISAGREE-AND-COMMIT |

**Result**: 2 ACCEPT + 4 DISAGREE-AND-COMMIT = CONDITIONAL ACCEPT

### Disagree-and-Commit Statements

**Critic**: "I disagree that all P0 issues are resolved (memory-index and QA gate deferred), but I commit to implementation with the understanding these are P1 follow-ups."

**Independent-thinker**: "I disagree that simpler alternatives were properly evaluated, but I commit to this architecture given user requirements and added safeguards."

**Analyst**: "I disagree that evidence quality is sufficient, but I commit to implementation with metrics collection during parallel operation to validate effectiveness."

**High-level-advisor**: "I disagree that full scope is optimal (prefer split ADR), but I commit to this approach given explicit user requirements."

---

## Recommendations to Orchestrator

1. **Proceed with ADR-016 implementation** with P0 resolutions included
2. **Create issues** for P1 items (memory-index, QA gate, secret redaction, CLI integrity)
3. **Update timeline** to 4 weeks (accounting for resolutions)
4. **Add monitoring** during parallel operation phase
5. **Review at 30 days** post-implementation per ADR review schedule

---

## Post-Review Addendum (2026-01-19)

### Resolution 3 Removal: HMAC-SHA256 Session State Signing

**Decision**: Removed BRAIN_SESSION_SECRET and HMAC-SHA256 signing from implementation (Resolution 3 from original conditional acceptance)

**Decision Maker**: User directive after implementation review

**Date**: 2026-01-19

**Rationale**:

1. **Threat Model Mismatch**:
   - HMAC protects against external tampering of session state
   - In single-user, local-first environment: user = potential attacker
   - User has full filesystem access to Brain notes
   - User controls MCP process and any secret storage
   - Signing provides no meaningful security boundary

2. **Filesystem Trust Model Consistency**:
   - Brain knowledge graph already trusts filesystem integrity
   - All Brain notes are plaintext markdown without signing
   - Session state should follow same trust model
   - Inconsistent to sign session state but not other Brain notes

3. **Operational Burden**:
   - Requires BRAIN_SESSION_SECRET generation and management
   - Adds startup validation complexity
   - Increases error surface (secret rotation, expiration, etc.)
   - No operational benefit in single-user context

4. **YAGNI Principle**:
   - Building for hypothetical multi-user scenario
   - Current deployment: single-user localhost only
   - If multi-user needed later: add signing then, not speculatively now

**Security Posture After Removal**:

- **Enforcement Mechanism**: Fail-closed hook behavior (blocks tools when state unavailable)
- **Trust Boundary**: Filesystem permissions (consistent with Brain knowledge graph)
- **Attack Surface**: Same as Brain notes (filesystem access = full control)
- **Appropriate For**: Single-user, local-first, trusted environment

**Implementation Impact**:

- **Code Removed**: 227 lines (signing.ts), 23 tests (signing.test.ts), signature verification in persistence layer
- **Interfaces Simplified**: SessionState no longer has `_signature` field
- **Dependencies Removed**: No BRAIN_SESSION_SECRET environment variable required
- **Effort Saved**: ~6 hours of implementation and testing

**Retrospective Analysis**:

The Security Agent's original concern (SEC-001: Session state tampering via filesystem) is valid for multi-user or server-side deployments where:

- Session state stored on shared filesystem
- Multiple users with different privilege levels
- Secret stored server-side (users cannot access)
- MCP runs as service (users cannot restart)

For Brain's deployment model (local-first, single-user):

- All conditions above are false
- User controls entire stack (filesystem, MCP, secret, code)
- Signing becomes security theater (appearance of security without actual protection)

**Final Architecture**: Filesystem trust with fail-closed enforcement. Simple, appropriate, maintainable.

**Consensus**: Removal aligns with pragmatic security (protect against real threats, not theoretical ones).
