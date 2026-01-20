# ADR-016 Implementation Plan: Automatic Session Protocol Enforcement

**Project**: Inngest Workflow-Based Session Protocol with Brain Persistence
**ADR**: [ADR-016](../architecture/ADR-016-automatic-session-protocol-enforcement.md)
**Start Date**: 2026-01-18
**Target Completion**: 2026-04-08 (11.5 weeks / 81 calendar days over 6 phases)
**Scope**: Phase 1 (Schema + Locking + Signing) → Phase 2 (Workflows + CLI) → Phase 3 (Migration + Validation) → Phase 4 (P0 Validation Scripts) → Phase 5 (P1 Detection Scripts) → Phase 6 (P2 Maintenance Scripts)
**Total Effort**: 197 hours (77h original + 120h validation scripts)

---

## Scope Evolution

**2026-01-18 (Original)**: Phases 1-3, session protocol enforcement, 77h
**2026-01-19 (Expanded)**: Phases 4-6 added, validation migration, +120h
**Final**: 6 phases, 197 hours, 11.5 weeks

---

## Executive Summary

Implement workflow-based session protocol enforcement using Inngest for orchestration and Brain MCP notes as the single source of truth for session state. This architecture replaces the hook-based coordinator approach with event-driven workflows, adds orchestrator workflow tracking, and eliminates HANDOFF.md.

**Success Criteria** (from ADR-016):

- Session state schema with orchestrator workflow tracking operational
- Optimistic locking with 3-retry strategy prevents concurrent corruption
- HMAC-SHA256 signing detects tampering attempts
- Fail-closed hooks block work when state unavailable
- HANDOFF.md eliminated (Brain notes + session state provide all context)
- Zero file cache (Brain notes only)

**Critical Architectural Decision**: Brain notes are the durable source of truth. File caches create synchronization complexity and violate single-source-of-truth principle.

---

## Prerequisites

**Before starting Phase 1, verify these dependencies:**

| Prerequisite | Verification Command | Fallback Strategy |
|--------------|---------------------|-------------------|
| Brain MCP operational | `mcp__plugin_brain_brain__list_directory` | Cannot proceed (Brain notes are source of truth) |
| Inngest running | `curl http://localhost:8288/health` | Local dev with inngest CLI |
| Node.js 20+ | `node --version` | Install from nodejs.org |
| PowerShell 7.4+ | `pwsh --version` | Install from GitHub releases |
| Git repository | `git rev-parse --git-dir` | Cannot proceed (fundamental requirement) |

**Risk Mitigation**: Brain MCP is non-negotiable (architecture decision). If unavailable, implementation blocked. Inngest can run locally via dev server during implementation.

---

## Phase 1: Session State Schema + Security (Week 1)

**Status**: COMPLETE (2026-01-19)
**Duration**: 5 days (4 days optimistic, 6 days pessimistic)
**Goal**: Extend session state schema with orchestrator workflow tracking, implement optimistic locking and HMAC signing

### Milestone 1.1: Session State Schema Extension

**Effort**: 2 days
**Owner**: Implementer
**Dependencies**: None

**Deliverables**:

1. **Extended SessionState Interface** (`apps/mcp/src/services/session/types.ts`):
   - Add `orchestratorWorkflow?: OrchestratorWorkflow` field
   - Add `version: number` for optimistic locking
   - Add `_signature: string` for HMAC verification

2. **New Workflow Interfaces** (`apps/mcp/src/services/session/types.ts`):
   - `OrchestratorWorkflow` with agent history, decisions, verdicts, handoffs
   - `AgentInvocation` with full input/output context
   - `Decision`, `Verdict`, `Handoff` supporting interfaces
   - `AgentType` union with all 16 agent types

3. **Schema Validation** (`apps/mcp/src/services/session/validation.ts`):
   - Zod schemas for all new interfaces
   - Validation function `validateSessionState(state: unknown): SessionState`
   - Runtime type checking before persistence

**Acceptance Criteria**:

- [PASS] SessionState interface compiles without TypeScript errors
- [PASS] All new interfaces have Zod schemas
- [PASS] Validation function rejects malformed state
- [PASS] Version field defaults to 0 for new sessions
- [PASS] Signature field optional (added on write, not on read)

**Testing Strategy**:

- Unit tests for schema validation (10 test cases covering valid/invalid states)
- Property-based testing with fast-check for schema edge cases
- Integration test: Create session → serialize → validate → deserialize

**Evidence Location**: `.agents/qa/ADR-016-phase1-schema-tests.md`

---

### Milestone 1.2: Optimistic Locking Implementation

**Effort**: 1 day
**Owner**: Implementer
**Dependencies**: Milestone 1.1 (version field exists)

**Deliverables**:

1. **Locking Logic** (`apps/mcp/src/services/session/locking.ts`):
   - `updateSessionWithLocking(sessionId, updates, maxRetries=3)` function
   - Version increment on every update
   - Read-verify-write cycle with retry
   - Exponential backoff between retries (100ms, 200ms, 400ms)

2. **Error Handling**:
   - `VersionConflictError` custom exception
   - Retry exhaustion throws clear error with session ID
   - Logging for conflict detection and resolution

3. **Integration with Session Service**:
   - Replace direct Brain note writes with `updateSessionWithLocking`
   - All update methods (addAgentInvocation, addDecision, etc.) use locking

**Acceptance Criteria**:

- [PASS] Concurrent updates (2 simultaneous) resolve via retry
- [PASS] Version increments correctly on each update
- [PASS] Retry logic backs off exponentially
- [PASS] After 3 retries, throws VersionConflictError
- [PASS] Zero state corruption under concurrent load

**Testing Strategy**:

- Concurrency test: 5 parallel updates to same session (should succeed)
- Stress test: 20 parallel updates (some fail after retries, documented)
- Unit test: Mocked Brain writes with version conflicts

**Evidence Location**: `.agents/qa/ADR-016-phase1-locking-tests.md`

**Risk**: Brain MCP write latency may require retry tuning (monitor P95 write times)

---

### Milestone 1.3: HMAC-SHA256 Signing Implementation

**Effort**: 1 day
**Owner**: Implementer
**Dependencies**: Milestone 1.1 (signature field exists)

**Deliverables**:

1. **Signing Functions** (`apps/mcp/src/services/session/signing.ts`):
   - `signSessionState(state: SessionState): SignedSessionState` - adds _signature
   - `verifySessionState(state: SignedSessionState): boolean` - validates signature
   - Uses HMAC-SHA256 with `BRAIN_SESSION_SECRET` environment variable
   - Canonical JSON serialization (sorted keys) for deterministic hashing

2. **Environment Setup**:
   - `.env.example` entry for `BRAIN_SESSION_SECRET`
   - Documentation on generating secret: `openssl rand -hex 32`
   - Startup validation: fail if secret missing in production

3. **Integration with Persistence**:
   - All writes sign state before persisting to Brain notes
   - All reads verify signature after loading from Brain notes
   - Unsigned state (legacy) handled gracefully (warning logged, not rejected)

**Acceptance Criteria**:

- [PASS] Valid signature passes verification
- [PASS] Tampered state fails verification
- [PASS] Missing secret fails at startup (not at runtime)
- [PASS] Signature verification runs on every state load
- [PASS] Canonical JSON prevents false negatives from key ordering

**Testing Strategy**:

- Unit test: Sign → verify passes
- Unit test: Sign → modify content → verify fails
- Unit test: Different secrets produce different signatures
- Security test: Attempt to bypass gate with unsigned state (should fail)

**Evidence Location**: `.agents/qa/ADR-016-phase1-signing-tests.md`

**Security Note**: Secret rotation requires re-signing all active sessions. Document rotation procedure.

---

### Milestone 1.4: Brain Persistence Layer (No File Cache)

**Effort**: 1 day
**Owner**: Implementer
**Dependencies**: Milestones 1.1, 1.2, 1.3 (schema, locking, signing ready)

**Deliverables**:

1. **Brain Persistence Class** (`apps/mcp/src/services/session/brain-persistence.ts`):
   - `BrainSessionPersistence` class with Brain MCP client dependency
   - `saveSession(session: SessionState)` - writes to Brain note (signed + locked)
   - `loadSession(sessionId: string)` - reads from Brain note (verified)
   - `getCurrentSession()` - reads from `sessions/current-session` pointer
   - In-memory cache (Map<sessionId, SessionState>) for performance

2. **Session Note Structure**:
   - Session state: `sessions/session-{sessionId}` (category: "sessions")
   - Current pointer: `sessions/current-session` (contains active session ID)
   - Category allows Brain to index all sessions

3. **MCP Startup Logic**:
   - Load current session from Brain notes into cache on MCP initialization
   - Graceful handling if no current session exists (first run)

4. **File Cache Removal**:
   - DELETE `~/.local/state/brain/session.json` (no file cache code)
   - DELETE file cache read/write logic from session service
   - All persistence goes through Brain notes only

**Acceptance Criteria**:

- [PASS] Session saves to Brain note at `sessions/session-{id}`
- [PASS] Current session pointer updates on session creation
- [PASS] MCP startup loads current session into cache
- [PASS] No file cache code remains in codebase
- [PASS] Cache invalidation works on note write

**Testing Strategy**:

- Integration test: Save → MCP restart → load (state preserved)
- Unit test: Cache hit/miss scenarios
- Cleanup test: Verify no `.json` files created

**Evidence Location**: `.agents/qa/ADR-016-phase1-persistence-tests.md`

**Performance**: In-memory cache keeps hot path fast. Brain note writes asynchronous.

---

## Phase 2: Inngest Workflows + Brain CLI Bridge + Integration Testing (Week 2)

**Status**: COMPLETE (2026-01-19)
**Duration**: 6 days (5 days optimistic, 8 days pessimistic)
**Goal**: Implement Inngest workflows, Brain CLI, run integration tests, integrate hooks
**Total Effort**: 24 hours (20h workflows + 0.5 days CLI + 2 days testing + 1 day hooks)

### Milestone 2.1: Inngest Workflow Setup

**Effort**: 2 days (20 hours including workflow implementation)
**Owner**: Implementer
**Dependencies**: Phase 1 complete (session state schema ready)

**Deliverables**:

1. **Inngest Project Setup** (`apps/mcp/src/workflows/`):
   - Initialize Inngest client with local dev server
   - Create workflow directory structure
   - Configure event types (`session/protocol.start`, `session/state.update`, etc.)

2. **Development Environment**:
   - Add Inngest dev server to local development setup
   - Update `package.json` scripts for workflow testing
   - Configure environment variables (`INNGEST_EVENT_KEY`)

3. **Core Workflow Files** (`apps/mcp/src/workflows/`):
   - `session-protocol-start.ts` - Full implementation (8 steps)
   - `session-protocol-end.ts` - Full implementation (6 steps)
   - `orchestrator-agent-routing.ts` - Agent invocation tracking
   - `agent-completion-handler.ts` - Agent completion tracking
   - Event schemas in `apps/mcp/src/events/session.ts`

**Acceptance Criteria**:

- [PASS] Inngest client initialized without errors
- [PASS] Event emission works (test event sent successfully)
- [PASS] Workflow directory structure follows conventions
- [PASS] Dev server accessible at <http://localhost:8288>
- [PASS] All 4 workflow files implement required steps
- [PASS] Event schemas defined for all workflow triggers

**Testing Strategy**:

- Manual: Send test event, verify receipt in Inngest UI
- Integration: Emit event from MCP, verify workflow triggers
- Unit test: Event schema validation

**Evidence Location**: `.agents/qa/ADR-016-phase2-workflow-setup-tests.md`

**Note**: This milestone includes full workflow implementation to avoid duplication. Next milestone is 2.2 (Brain CLI).

---

### Milestone 2.2: Brain CLI Implementation

**Effort**: 0.5 days
**Owner**: Implementer
**Dependencies**: Phase 1 complete (session state persisted in Brain notes)
**Must Complete Before**: Milestone 2.3 (Hook Integration)

**Deliverables**:

1. **Brain CLI Commands** (`apps/cli/src/commands/session/`):
   - `brain session get-state` - queries MCP, reads from `sessions/current-session`
   - `brain session set-state` - updates MCP, writes to `sessions/session-{id}`
   - JSON output for hook consumption

2. **Error Handling**:
   - Graceful handling if MCP unavailable
   - Clear error messages for hooks
   - Exit codes: 0 (success), 1 (error)

**Acceptance Criteria**:

- [PASS] `brain session get-state` returns current session state as JSON
- [PASS] `brain session set-state` updates session state
- [PASS] CLI fails gracefully if MCP unavailable (exit code 1)
- [PASS] JSON output parseable by Go hooks

**Testing Strategy**:

- Unit test: Mock MCP responses
- Integration test: CLI → MCP → Brain notes roundtrip
- Error test: MCP offline (should return error exit code)

**Evidence Location**: `.agents/qa/ADR-016-phase2-cli-tests.md`

---

### Milestone 2.3: Integration Testing

**Effort**: 2 days
**Owner**: QA
**Dependencies**: Milestones 2.1 (workflows), 2.2 (Brain CLI)

**Deliverables**:

1. **Test Scenarios** (documented in `.agents/qa/ADR-016-phase2-integration-tests.md`):
   - Session start workflow (8 steps execute, state persisted)
   - Session end workflow (6 steps execute, commit created)
   - Orchestrator workflow tracking (agent invocations recorded)
   - Brain specialist context preservation (architect context in Brain note)
   - Concurrent updates (optimistic locking prevents corruption)
   - Security (tampered state rejected via signature verification)

2. **Test Execution**:
   - Run each scenario with real MCP + Inngest
   - Document results (PASS/FAIL) with evidence
   - Identify edge cases requiring fixes

3. **Performance Testing**:
   - Measure session start latency (target: <5s)
   - Measure state update latency (target: <500ms)
   - Measure workflow step latency (target: <2s per step)

**Acceptance Criteria**:

- [PASS] All 6 test scenarios pass without errors
- [PASS] Session start completes in <5s (95th percentile)
- [PASS] State updates complete in <500ms (95th percentile)
- [PASS] Workflow steps complete in <2s (95th percentile)
- [PASS] Zero state corruption under concurrent load (10 parallel updates)

**Testing Strategy**:

- Automated integration tests (Jest + supertest)
- Manual scenario testing (developer runs workflows)
- Load testing (k6 for concurrent updates)

**Evidence Location**: `.agents/qa/ADR-016-phase2-integration-tests.md`

**Risk**: Performance targets may require tuning. Brain MCP write latency is the critical path.

---

### Milestone 2.4: Hook Integration (SessionStart + PreToolUse)

**Effort**: 1 day
**Owner**: Implementer
**Dependencies**: Milestones 2.1 (workflows), 2.2 (Brain CLI), 2.3 (integration tests PASS)

**Deliverables**:

1. **SessionStart Hook** (`apps/claude-plugin/hooks/SessionStart/main.go`):
   - Trigger `session/protocol.start` event via Inngest
   - Poll session state via Brain CLI (not direct MCP)
   - Wait for `protocolStartComplete: true` with 30s timeout
   - Return aggregated context from session state

2. **PreToolUse Hook** (`apps/claude-plugin/cmd/hooks/pre_tool_use.go`):
   - Call `brain session get-state` (via Brain CLI)
   - Parse JSON output
   - Check `protocolStartComplete` flag
   - FAIL CLOSED: Block tools if state unavailable
   - EXPLICIT DISABLED: Only "disabled" mode bypasses gates

3. **Fail-Closed Behavior**:
   - Read-only tools allowed when state unknown
   - Destructive tools (Edit, Write, Bash) blocked
   - Clear error message with override instructions

**Acceptance Criteria**:

- [PASS] SessionStart hook triggers workflow successfully
- [PASS] SessionStart hook waits for protocol completion (polls every 500ms)
- [PASS] PreToolUse hook blocks tools when protocol incomplete
- [PASS] PreToolUse hook allows read-only tools when state unknown
- [PASS] PreToolUse hook requires explicit "disabled" mode to bypass gates

**Testing Strategy**:

- Integration test: SessionStart → workflow completes → PreToolUse allows tools
- Failure test: Workflow incomplete → PreToolUse blocks tools
- Timeout test: Workflow hangs → SessionStart times out (returns error)
- Security test: Tampered state → PreToolUse blocks tools (signature invalid)

**Evidence Location**: `.agents/qa/ADR-016-phase2-hooks-tests.md`

**Security Note**: Fail-closed behavior prevents protocol bypass via state manipulation.

---

## Phase 3: Migration + Documentation + Pre-PR Validation (Week 3)

**Status**: COMPLETE (2026-01-19)
**Duration**: 5 days (4 days optimistic, 7 days pessimistic)
**Goal**: Migrate HANDOFF.md to Brain notes, update documentation, run Pre-PR validation
**Total Effort**: 13 hours (1 day migration + 1 day docs + 0.5 days deletion + 0.5 days final docs + 1 day validation)

### Milestone 3.1: HANDOFF.md Migration

**Effort**: 1 day (3 hours)
**Owner**: Implementer
**Dependencies**: Phase 2 complete (Brain persistence operational)

**Deliverables**:

1. **Migration Script** (`scripts/Migrate-HandoffToBrain.ps1`):
   - Read `.agents/HANDOFF.md` content
   - Parse sections: Active Projects, Recent Sessions, Key Decisions, Blockers
   - Migrate to Brain notes with categories:
     - `projects/active-projects` - project dashboard
     - `sessions/recent-sessions` - last 10 sessions
     - `decisions/key-decisions` - architectural decisions not in ADRs
     - `blockers/current-blockers` - active blockers
   - Create initial session state with orchestrator workflow (if active session exists)

2. **Verification**:
   - Compare migrated content with original HANDOFF.md
   - Ensure no data loss
   - Document any content that couldn't be migrated automatically

**Acceptance Criteria**:

- [PASS] All HANDOFF.md sections migrated to Brain notes
- [PASS] Brain notes contain equivalent information
- [PASS] No data loss (content diff shows 100% coverage)
- [PASS] Session state created for active session (if exists)

**Testing Strategy**:

- Unit test: Parse HANDOFF.md sections
- Integration test: Migrate → read Brain notes → verify content match
- Idempotency test: Run migration twice (should not duplicate)

**Evidence Location**: `.agents/qa/ADR-016-phase3-migration-tests.md`

**Rollback Plan**: Archive original HANDOFF.md to `.agents/archive/HANDOFF-pre-adr016.md` before deletion.

---

### Milestone 3.2: Documentation Updates

**Effort**: 1 day
**Owner**: Implementer
**Dependencies**: Milestone 3.1 (migration complete)

**Deliverables**:

1. **Protocol Documentation** (`.agents/SESSION-PROTOCOL.md`):
   - Remove all HANDOFF.md references (10+ occurrences)
   - Add Brain notes + session state as context sources
   - Update session start/end checklists (remove HANDOFF.md read/update)

2. **Agent Documentation** (`AGENTS.md`):
   - Update memory system section (Brain notes replace HANDOFF.md)
   - Document session state as orchestrator workflow source of truth
   - Add Brain CLI commands for hook integration

3. **Bootstrap Command** (`apps/claude-plugin/commands/bootstrap.md`):
   - Remove HANDOFF.md loading logic
   - Add Brain notes loading (projects, sessions, decisions)

4. **Tool Implementation** (`apps/mcp/src/tools/bootstrap/index.ts`):
   - Remove HANDOFF.md file read
   - Add Brain note queries for context

**Acceptance Criteria**:

- [PASS] No HANDOFF.md references in SESSION-PROTOCOL.md
- [PASS] AGENTS.md documents Brain notes as context source
- [PASS] Bootstrap command loads Brain notes (not HANDOFF.md)
- [PASS] All documentation consistent with new architecture

**Testing Strategy**:

- Grep search: `grep -r "HANDOFF.md" .agents/ apps/` (should find only archive)
- Manual review: Read updated docs for consistency
- Bootstrap test: Run `/bootstrap` command → verify Brain notes loaded

**Evidence Location**: Session log (documentation checklist)

---

### Milestone 3.3: HANDOFF.md Deletion

**Effort**: 0.5 days
**Owner**: Implementer
**Dependencies**: Milestones 3.1 (migration), 3.2 (docs updated)

**Deliverables**:

1. **Archival**:
   - Copy `.agents/HANDOFF.md` to `.agents/archive/HANDOFF-2026-01-18.md`
   - Document archive location in commit message

2. **Deletion**:
   - Delete `.agents/HANDOFF.md` file
   - Update validation scripts to not expect HANDOFF.md

3. **Verification**:
   - Confirm no code references HANDOFF.md (except archive docs)
   - Run all tests to ensure no breakage

**Acceptance Criteria**:

- [PASS] HANDOFF.md archived to `.agents/archive/`
- [PASS] Original HANDOFF.md deleted from repository
- [PASS] No code references HANDOFF.md (grep verification)
- [PASS] All tests pass after deletion

**Testing Strategy**:

- Grep search: Verify no active code references (only archive mentions)
- Full test suite: Run all integration tests (should pass)

**Evidence Location**: Commit SHA (HANDOFF.md deletion commit)

**Rollback Plan**: Git restore from archive if critical issue discovered.

---

### Milestone 3.4: Final Documentation + ADR Update

**Effort**: 0.5 days (2 hours)
**Owner**: Implementer
**Dependencies**: Milestone 3.3 (HANDOFF.md deletion complete)

**Deliverables**:

1. **ADR-016 Confirmation Update**:
   - Mark ADR as "accepted" (change status from "proposed")
   - Add implementation validation results
   - Document actual vs estimated effort
   - Add post-implementation review schedule (30 days)

2. **Workflow Documentation** (`.agents/workflows/session-protocol.md`):
   - Document workflow architecture
   - Diagram event flow (session start → end)
   - List all event types and payloads

3. **Orchestrator Tracking Guide** (`.agents/workflows/orchestrator-tracking.md`):
   - Document orchestrator workflow schema
   - Guide for instrumenting orchestrator with events
   - Example agent invocation flow

**Acceptance Criteria**:

- [PASS] ADR-016 status updated to "accepted"
- [PASS] Implementation validation checklist complete
- [PASS] Workflow documentation published
- [PASS] Orchestrator tracking guide available

**Testing Strategy**:

- Review: Architect reviews documentation for accuracy
- Validation: All checklist items marked complete with evidence

**Evidence Location**: ADR-016 confirmation section

---

### Milestone 3.5: Pre-PR Validation (BLOCKING for PR)

**Effort**: 1 day (8 hours)
**Owner**: QA Agent
**Dependencies**: Milestone 3.4 (Final Documentation complete)
**Blocking**: PR creation (MANDATORY quality gate)

**Deliverables**:

1. **Cross-Cutting Concerns Audit**:
   - Extract hardcoded values to environment variables
   - Document all environment variables in README
   - Remove TODO/FIXME/XXX placeholders
   - Isolate test-only code from production

2. **Fail-Closed Design Verification**:
   - Validate exit code checking (LASTEXITCODE in PowerShell)
   - Verify error handling defaults to fail-safe
   - Verify security defaults to most restrictive
   - Verify protected branch scenarios tested

3. **Test-Implementation Alignment**:
   - Verify test parameters match implementation
   - Verify no drift between tests and production
   - Verify code coverage meets 80% threshold
   - Verify edge cases covered

4. **CI Environment Simulation**:
   - Run tests in CI mode (GITHUB_ACTIONS=true)
   - Verify build succeeds with CI flags
   - Verify protected branch behavior
   - Document CI environment differences

5. **Environment Variable Completeness**:
   - Verify all required vars documented
   - Verify default values defined
   - Verify no missing vars in CI
   - Verify variable propagation across workflow steps

6. **Session Protocol Validation**:
   - Run `Validate-SessionProtocol.ps1` with session log
   - Verify exit code 0 (PASS)
   - Fix any violations
   - Document validation evidence

**Acceptance Criteria**:

- [PASS] All 6 validation tasks complete
- [PASS] No hardcoded values (all in env vars or config)
- [PASS] Exit code validation implemented
- [PASS] Test coverage ≥80%
- [PASS] CI simulation passes
- [PASS] All environment variables documented
- [PASS] Session protocol validation PASS

**Testing Strategy**:

- Automated: Run Validate-SessionProtocol.ps1
- Manual: Review code for hardcoded values
- CI: Run full test suite in CI mode locally
- Evidence: Document all findings and fixes

**Evidence Location**: `.agents/qa/ADR-016-pre-pr-validation.md`

**BLOCKING GATE**: This milestone MUST complete with PASS before PR creation. Orchestrator receives APPROVED verdict only after validation evidence documented.

**Rationale**: Pre-PR validation catches issues that would otherwise require follow-up PRs (see PR #32→#33 pattern). One comprehensive validation prevents rework.

---

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Brain MCP unavailable during dev | Low | High | Cannot proceed without Brain MCP (architecture decision) |
| Inngest learning curve | Medium | Medium | Start with simple workflows, iterate |
| Concurrent update edge cases | Medium | High | Comprehensive concurrency testing (20+ parallel updates) |
| Session state size growth | High | Medium | Compaction strategy after 10 invocations (documented in ADR) |
| Hook latency exceeds budget | Medium | Medium | Optimize Brain CLI calls, add caching |
| HANDOFF.md migration data loss | Low | High | Manual verification before deletion, archive for rollback |

---

## Dependencies

### External Dependencies

- Brain MCP operational (BLOCKING - no fallback)
- Inngest (local dev server acceptable)
- PowerShell 7.4+ for validation scripts

### Internal Dependencies

- Session service exists (`apps/mcp/src/services/session/`)
- Brain MCP tools operational (`mcp__plugin_brain_brain__*`)
- Validation script exists (`scripts/Validate-SessionProtocol.ps1`)

### Cross-Phase Dependencies

- Phase 2 requires Phase 1 complete (schema + security must exist)
- Phase 3 requires Phase 2 complete (workflows operational before migration)

---

## Success Metrics

### Quantified Acceptance Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session protocol compliance | 95%+ | % of sessions with `protocolStartComplete: true` |
| Concurrent update success | 90%+ | % of 20 parallel updates that succeed |
| State corruption incidents | 0 | Manual inspection + signature verification |
| Hook gate check latency | <200ms P95 | Measure hook execution time |
| Session start latency | <5s P95 | Time from hook trigger to protocol complete |
| HANDOFF.md references | 0 | Grep count in active code (archive excluded) |

### Validation Evidence

All acceptance criteria require evidence:

- [PASS] - Test output, commit SHA, or tool output documented
- [FAIL] - Issue logged with reproduction steps
- [WARNING] - Non-critical issue documented

Evidence stored in:

- `.agents/qa/ADR-016-phase{N}-{milestone}-tests.md`
- Session logs for each implementation session
- ADR-016 confirmation section (final validation)

---

## Testing Strategy

### Unit Testing (Per Milestone)

- Jest + TypeScript for all new code
- Target: 80%+ code coverage
- Focus: Schema validation, locking logic, signing logic

### Integration Testing (Phase 3)

- Real MCP + Inngest + Brain notes
- 8 end-to-end scenarios (documented above)
- Performance benchmarks (latency + throughput)

### Security Testing

- Tampering test: Modify state, verify rejection
- Bypass test: Skip protocol, verify tools blocked
- Rotation test: Change secret, re-sign all sessions

### Load Testing

- Concurrent updates: 20 parallel (should succeed with retries)
- Stress test: 50 parallel (acceptable failure rate documented)

---

## Rollback Plan

### Phase 1 Rollback (Schema Changes)

- Git revert commits
- Database migration rollback (if schema stored in DB)
- Zero user impact (no user-facing changes yet)

### Phase 2 Rollback (Workflows + Hooks)

- Disable hook integration (feature flag)
- Stop Inngest workflows
- Fall back to manual bootstrap
- User impact: Protocol compliance drops to baseline (~70%)

### Phase 3 Rollback (HANDOFF.md Deletion)

- Git restore HANDOFF.md from archive
- Re-enable HANDOFF.md references in code
- Migration reversal: Brain notes → HANDOFF.md (manual)
- User impact: Merge conflicts resume

**Rollback Decision Point**: If integration testing (Milestone 3.4) reveals critical issues, rollback Phase 2 before deploying Phase 3.

---

## Migration Strategy

### Backward Compatibility

**None required (clean cutover per ADR-016).**

- No parallel operation (file cache deleted immediately)
- Existing sessions in file cache NOT migrated (start fresh)
- New sessions created directly in Brain notes

### Migration Steps

1. Delete file cache code (`session.json` logic removed)
2. Deploy Brain persistence (Phase 1)
3. Deploy workflows (Phase 2)
4. Migrate HANDOFF.md → Brain notes (Phase 3)
5. Delete HANDOFF.md (Phase 3)

### User Communication

- Announcement: HANDOFF.md eliminated, use Brain notes + session state
- Guide: How to query session state via Brain CLI
- FAQ: Where did my context go? (Answer: Brain notes + session logs)

---

## Post-Implementation Review

**Schedule**: 30 days after Phase 3 complete

**Review Topics**:

1. Session state size growth (compaction frequency)
2. Workflow execution performance (latency vs target)
3. Brain specialist context preservation effectiveness
4. Compaction strategy effectiveness
5. HANDOFF.md elimination impact on agent workflows

**Review Artifacts**:

- Performance metrics (P50, P95, P99 latencies)
- Incident log (state corruption, signature failures)
- User feedback (agents, developers)
- Recommendations for tuning or architectural changes

---

## Phase 4: P0 Validation Scripts (Week 4)

**Status**: COMPLETE (2026-01-19)
**Duration**: 8 days (7 days optimistic, 10 days pessimistic)
**Goal**: Migrate P0 validation scripts to Go compiled to WASM
**Total Effort**: 40 hours (24h development + 12h testing + 4h documentation)

### WASM Compilation Specification

**Target**: wasm32-wasi
**Compiler**: TinyGo 0.30+
**Runtime**: Node.js with @wasmer/wasi
**Build Command Pattern**:

```bash
tinygo build -o validate-consistency.wasm -target=wasi validate-consistency.go
```

**Integration**:

- WASM modules called from Node.js validation workflows
- WASI provides filesystem access for artifact scanning
- Exit codes: 0 (PASS), 1 (FAIL), 2 (WARNING)

### Milestone 4.1: Validate-Consistency Script Migration

**Effort**: 5 days (40 hours)
**Owner**: Implementer
**Dependencies**: Phase 3 complete
**Priority**: P0 (BLOCKING)

**Deliverables**:

1. **Cross-Reference Validation** (`packages/validation/validate-consistency.go`):
   - Task: TASK-015 (implement Go version)
   - Task: TASK-016 (write tests)
   - Requirement: REQ-006 (cross-reference validation operational)
   - **Note on Task Numbering**: TASK-014 was intentionally removed from the specification because HANDOFF.md migration is covered by ADR-016 Milestone 3.1 (planning phase), not as a separate task specification. Task sequence is TASK-001 through TASK-013, then TASK-015 through TASK-040 (39 total tasks).
   - Validates:
     - All document cross-references are valid
     - No orphan references to deleted files
     - Requirement traceability complete
   - Output: Validation report with PASS/FAIL status

2. **Test Suite** (`packages/validation/validate-consistency_test.go`):
   - Unit tests for cross-reference logic
   - Integration tests with sample artifacts
   - Edge case coverage (circular references, missing files)

3. **Documentation**:
   - Usage guide in `packages/validation/README.md`
   - Error message catalog
   - Integration with CI pipeline

**Acceptance Criteria**:

- [PASS] All cross-references validated correctly
- [PASS] Test coverage ≥80%
- [PASS] CI integration working
- [PASS] Error messages actionable

**Testing Strategy**:

- Unit test: Mock file system with invalid references
- Integration test: Run against `.agents/` artifacts
- Performance test: Validate 100+ documents in <30s

**Evidence Location**: `.agents/qa/ADR-016-phase4-consistency-tests.md`

---

### Milestone 4.2: Validate-PrePR Script Migration

**Effort**: 3 days (24 hours)
**Owner**: Implementer
**Dependencies**: Milestone 4.1 complete
**Priority**: P0 (BLOCKING)

**Deliverables**:

1. **Pre-PR Validation** (`packages/validation/validate-pre-pr.go`):
   - Task: TASK-017 (implement Go version)
   - Task: TASK-018 (write tests)
   - Requirement: REQ-007 (pre-PR enforcement operational)
   - Validates:
     - All cross-cutting concerns addressed
     - Fail-closed design implemented
     - Test-implementation alignment verified
     - CI environment simulation passed
     - Environment variables documented
   - Output: Comprehensive validation report

2. **Test Suite** (`packages/validation/validate-pre-pr_test.go`):
   - Unit tests for each validation check
   - Integration tests with sample PRs
   - Failure scenario testing

3. **Documentation**:
   - Pre-PR checklist guide
   - Validation report interpretation
   - CI enforcement setup

**Acceptance Criteria**:

- [PASS] All 5 validation checks operational
- [PASS] Test coverage ≥80%
- [PASS] CI enforcement working
- [PASS] Validation report actionable

**Testing Strategy**:

- Unit test: Mock implementation with violations
- Integration test: Run against sample PRs
- Regression test: Known issues from PR history

**Evidence Location**: `.agents/qa/ADR-016-phase4-pre-pr-tests.md`

---

## Phase 5: P1 Detection Scripts (Week 5)

**Status**: COMPLETE (2026-01-19)
**Duration**: 10 days (9 days optimistic, 12 days pessimistic)
**Goal**: Migrate P1 detection scripts to Go compiled to WASM
**Total Effort**: 48 hours (36h development + 8h testing + 4h documentation)

### Milestone 5.1: Detect-SkillViolation Script Migration

**Effort**: 3 days (24 hours)
**Owner**: Implementer
**Dependencies**: Phase 4 complete
**Priority**: P1

**Deliverables**:

1. **Skill Violation Detection** (`packages/validation/detect-skill-violation.go`):
   - Task: TASK-019 (implement Go version)
   - Task: TASK-020 (write tests)
   - Requirement: REQ-008 (skill validation operational)
   - Detects:
     - Raw `gh` commands when skills exist
     - Direct GitHub API calls instead of using skills
     - Pattern violations in skill usage
   - Output: Violation report with recommendations

2. **Test Suite** (`packages/validation/detect-skill-violation_test.go`):
   - Unit tests for detection logic
   - False positive testing
   - Integration tests with real code

**Acceptance Criteria**:

- [PASS] Violations detected accurately
- [PASS] False positive rate <5%
- [PASS] Test coverage ≥80%

**Testing Strategy**:

- Unit test: Known violations and compliant code
- Integration test: Run against codebase
- Benchmark: Performance on large codebases

**Evidence Location**: `.agents/qa/ADR-016-phase5-skill-violation-tests.md`

---

### Milestone 5.2: Detect-TestCoverageGaps Script Migration

**Effort**: 3 days (24 hours)
**Owner**: Implementer
**Dependencies**: Milestone 5.1 complete
**Priority**: P1

**Deliverables**:

1. **Test Coverage Detection** (`packages/validation/detect-test-coverage-gaps.go`):
   - Task: TASK-021 (implement Go version)
   - Task: TASK-022 (write tests)
   - Requirement: REQ-009 (test coverage detection operational)
   - Detects:
     - Untested functions
     - Missing edge case coverage
     - Low coverage modules
   - Output: Coverage gap report with priorities

2. **Test Suite** (`packages/validation/detect-test-coverage-gaps_test.go`):
   - Unit tests for gap detection
   - Integration with coverage tools
   - False negative prevention

**Acceptance Criteria**:

- [PASS] Coverage gaps identified accurately
- [PASS] Integration with Istanbul/NYC
- [PASS] Test coverage ≥80%

**Testing Strategy**:

- Unit test: Simulated coverage data
- Integration test: Real coverage reports
- Regression test: Known coverage gaps

**Evidence Location**: `.agents/qa/ADR-016-phase5-coverage-tests.md`

---

### Milestone 5.3: Check-SkillExists Script Migration

**Effort**: 2 days (16 hours)
**Owner**: Implementer
**Dependencies**: Milestone 5.2 complete
**Priority**: P1

**Deliverables**:

1. **Skill Existence Check** (`packages/validation/check-skill-exists.go`):
   - Task: TASK-023 (implement Go version)
   - Task: TASK-024 (write tests)
   - Requirement: REQ-010 (skill existence validation operational)
   - Checks:
     - Skill referenced in code exists in `.claude/skills/`
     - Skill format valid (SKILL.md, scripts present)
     - No dangling skill references
   - Output: Existence validation report

2. **Test Suite** (`packages/validation/check-skill-exists_test.go`):
   - Unit tests for existence checks
   - Integration tests with skill directory
   - Edge case coverage

**Acceptance Criteria**:

- [PASS] All skill references validated
- [PASS] Test coverage ≥80%
- [PASS] CI integration working

**Testing Strategy**:

- Unit test: Mock skill directory
- Integration test: Real `.claude/skills/` scan
- Negative test: Missing skills detected

**Evidence Location**: `.agents/qa/ADR-016-phase5-skill-exists-tests.md`

---

### Milestone 5.4: Validate-SkillFormat Script Migration

**Effort**: 2 days (16 hours)
**Owner**: Implementer
**Dependencies**: Milestone 5.3 complete
**Priority**: P1

**Deliverables**:

1. **Skill Format Validation** (`packages/validation/validate-skill-format.go`):
   - Task: TASK-029 (implement Go version)
   - Task: TASK-030 (write tests)
   - Requirement: REQ-013 (skill format validation operational)
   - Validates:
     - SKILL.md structure (sections present)
     - Script files executable
     - Documentation completeness
   - Output: Format validation report

2. **Test Suite** (`packages/validation/validate-skill-format_test.go`):
   - Unit tests for format checks
   - Integration tests with sample skills
   - Edge case coverage (partial skills)

**Acceptance Criteria**:

- [PASS] Skill format validated correctly
- [PASS] Test coverage ≥80%
- [PASS] CI integration working

**Testing Strategy**:

- Unit test: Mock malformed skills
- Integration test: Validate all skills in repo
- Regression test: Known format issues

**Evidence Location**: `.agents/qa/ADR-016-phase5-skill-format-tests.md`

---

## Phase 6: P2 Maintenance Scripts (Weeks 6-7)

**Status**: COMPLETE (2026-01-19)
**Duration**: 25 days (23 days optimistic, 30 days pessimistic)
**Goal**: Migrate P2 maintenance scripts to Go compiled to WASM
**Total Effort**: 28 hours (20h development + 6h testing + 2h documentation)

**Scope**: Migrate 7 remaining validation scripts to Go

| Script | Effort | Tasks | Priority |
|--------|--------|-------|----------|
| Validate-PlanningArtifacts | 4h | TASK-025, TASK-026 | P2 |
| Detect-StaleArtifacts | 3h | TASK-027, TASK-028 | P2 |
| Detect-NamingViolations | 3h | TASK-031, TASK-032 | P2 |
| Detect-MissingEvidence | 3h | TASK-033, TASK-034 | P2 |
| Validate-ArchiveStructure | 2h | TASK-035, TASK-036 | P2 |
| Detect-CircularDependencies | 2h | TASK-037, TASK-038 | P2 |
| Validate-EnvironmentDocs | 3h | TASK-039, TASK-040 | P2 |

**Total Scripts**: 7
**Total Effort**: 28 hours

### Milestone 6.1: Planning Artifacts Validation

**Effort**: 4 hours
**Scripts**: Validate-PlanningArtifacts
**Tasks**: TASK-025 (implement), TASK-026 (tests)

**Acceptance Criteria**:

- [PASS] Planning artifact consistency validated
- [PASS] Test coverage ≥80%

---

### Milestone 6.2: Stale Artifacts Detection

**Effort**: 3 hours
**Scripts**: Detect-StaleArtifacts
**Tasks**: TASK-027 (implement), TASK-028 (tests)

**Acceptance Criteria**:

- [PASS] Stale artifacts detected accurately
- [PASS] Test coverage ≥80%

---

### Milestone 6.3: Naming Violations Detection

**Effort**: 3 hours
**Scripts**: Detect-NamingViolations
**Tasks**: TASK-031 (implement), TASK-032 (tests)

**Acceptance Criteria**:

- [PASS] Naming violations detected
- [PASS] Test coverage ≥80%

---

### Milestone 6.4: Missing Evidence Detection

**Effort**: 3 hours
**Scripts**: Detect-MissingEvidence
**Tasks**: TASK-033 (implement), TASK-034 (tests)

**Acceptance Criteria**:

- [PASS] Missing evidence detected
- [PASS] Test coverage ≥80%

---

### Milestone 6.5: Archive Structure Validation

**Effort**: 2 hours
**Scripts**: Validate-ArchiveStructure
**Tasks**: TASK-035 (implement), TASK-036 (tests)

**Acceptance Criteria**:

- [PASS] Archive structure validated
- [PASS] Test coverage ≥80%

---

### Milestone 6.6: Circular Dependencies Detection

**Effort**: 2 hours
**Scripts**: Detect-CircularDependencies
**Tasks**: TASK-037 (implement), TASK-038 (tests)

**Acceptance Criteria**:

- [PASS] Circular dependencies detected
- [PASS] Test coverage ≥80%

---

### Milestone 6.7: Environment Documentation Validation

**Effort**: 3 hours
**Scripts**: Validate-EnvironmentDocs
**Tasks**: TASK-039 (implement), TASK-040 (tests)

**Acceptance Criteria**:

- [PASS] Environment docs validated
- [PASS] Test coverage ≥80%

---

## Updated Timeline Summary

| Phase | Duration | Start | End | Effort |
|-------|----------|-------|-----|--------|
| Phase 1 | 5 days | 2026-01-18 | 2026-01-24 | 44h |
| Phase 2 | 6 days | 2026-01-25 | 2026-02-02 | 24h |
| Phase 3 | 5 days | 2026-02-03 | 2026-02-10 | 13h |
| Phase 4 | 8 days | 2026-02-11 | 2026-02-21 | 40h |
| Phase 5 | 10 days | 2026-02-22 | 2026-03-07 | 48h |
| Phase 6 | 25 days | 2026-03-08 | 2026-04-08 | 28h |
| **Total** | **59 days** | **2026-01-18** | **2026-04-08** | **197h** |

**Note**: Phases 4-6 focus exclusively on validation script migrations to Go. Original ADR-016 session protocol scope remains in Phases 1-3.

---

## Related Documents

- **ADR-016**: [Automatic Session Protocol Enforcement](../architecture/ADR-016-automatic-session-protocol-enforcement.md)
- **SESSION-PROTOCOL.md**: [Session Protocol Requirements](../SESSION-PROTOCOL.md)
- **AGENTS.md**: [Agent System Documentation](../../AGENTS.md)
- **ADR-014**: HANDOFF.md Read-Only Status (superseded by ADR-016)

---

## Appendix: Compaction Strategy Specification

**Trigger**: `orchestratorWorkflow.agentHistory.length > 10`

**Compaction Logic**:

- Keep last 3 invocations in session state
- Store full history in Brain note `sessions/session-{id}-history-{timestamp}`
- Never compact decisions or verdicts (always preserved)

**Compaction Function**:

```typescript
async function compactSessionState(session: SessionState): Promise<CompactionResult> {
  const workflow = session.orchestratorWorkflow;
  if (!workflow || workflow.agentHistory.length <= 10) {
    throw new Error("Compaction not needed");
  }

  const recentInvocations = workflow.agentHistory.slice(-3);
  const historicalInvocations = workflow.agentHistory.slice(0, -3);

  const historyNotePath = `sessions/session-${session.sessionId}-history-${Date.now()}`;
  await brainMCP.writeNote({
    title: historyNotePath,
    content: JSON.stringify({
      sessionId: session.sessionId,
      compactedAt: new Date().toISOString(),
      fullHistory: historicalInvocations,
    }, null, 2),
    category: "session-history",
  });

  const compactedWorkflow = {
    ...workflow,
    agentHistory: recentInvocations,
    compactionHistory: [
      ...(workflow.compactionHistory || []),
      { notePath: historyNotePath, compactedAt: new Date().toISOString(), count: historicalInvocations.length },
    ],
  };

  return {
    compactedState: { ...session, orchestratorWorkflow: compactedWorkflow },
    historyNote: historyNotePath,
  };
}
```

**Validation**: Compacted state must pass schema validation before persisting.

**Rollback**: Full history preserved in Brain note for 30 days (configurable via `COMPACTION_RETENTION_DAYS`).

---

## Appendix: Fail-Closed Behavior Specification

**Problem**: Current gate_check.go fails open when state cannot be read, allowing all tools.

**Solution**: Change to fail-closed with explicit "disabled" mode check.

```go
func PerformGateCheck(tool string) *GateCheckResult {
  state, err := brainCLI.GetSessionState()

  // FAIL CLOSED: If state unavailable, block destructive tools
  if err != nil {
    if isReadOnlyTool(tool) {
      return &GateCheckResult{Allowed: true}
    }
    return &GateCheckResult{
      Allowed: false,
      Message: fmt.Sprintf("Session state unavailable. Blocking %s. Use /mode disabled to override.", tool),
      Mode:    "unknown",
    }
  }

  // EXPLICIT DISABLED: Only disabled mode bypasses all gates
  if state.CurrentMode == "disabled" {
    return &GateCheckResult{Allowed: true, Mode: "disabled"}
  }

  return CheckToolBlocked(tool, state.CurrentMode)
}

func isReadOnlyTool(tool string) bool {
  readOnlyTools := []string{"Read", "Glob", "Grep", "LSP", "WebFetch", "WebSearch"}
  for _, t := range readOnlyTools {
    if tool == t {
      return true
    }
  }
  return false
}
```

**Security Implications**:

- `analysis` mode: Read-only tools allowed, Edit/Write/Bash blocked
- `planning` mode: Read-only + Bash allowed, Edit/Write blocked
- `coding` mode: All tools allowed
- `disabled` mode: All tools allowed (explicit opt-out)
- `unknown` mode (error state): Only read-only tools allowed
