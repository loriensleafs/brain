# ADR-015 Implementation Plan: Session Protocol Automation

**Project**: Session State MCP with Hook Integration
**ADR**: [ADR-015](../architecture/ADR-015-session-protocol-automation.md)
**Start Date**: 2026-01-18
**Target Completion**: 2026-02-03 (10 working days realistic, ±30%)
**Scope**: Phase 1 Option 4 - Full ai-agents Parity (8-12 weeks)

---

## Executive Summary

Implement Session State MCP to automate session protocol compliance through verification-based enforcement. Target 95%+ compliance rate (improvement from ~70% baseline) by replacing manual `/bootstrap` command with automatic state machine tracking.

**Success Criteria** (from ADR-015):
- 95%+ compliance rate for sessions completing MUST requirements before work
- <5% manual bootstrap usage per 100 sessions (recovery mechanism only)
- Observable violations via blocking messages in transcript
- Accurate state tracking via session-current-state memory

---

## Prerequisites

**Before starting Phase 1, verify these dependencies:**

| Prerequisite | Verification Command | Fallback Strategy |
|--------------|---------------------|-------------------|
| Claude Code v2.1.9+ | `claude --version` | Defer to Phase 2 or use exit code messaging only |
| Brain MCP operational | `mcp__plugin_brain_brain__list_directory` | File-based state storage (`.agents/sessions/.session-state.json`) |
| PostToolUse hook support | Test PostToolUse hook with sample tool call | Polling Brain MCP tool history (slower, adds latency) |
| Git repository initialized | `git rev-parse --git-dir` | Cannot proceed (fundamental requirement) |

**Risk Mitigation**: If any dependency unavailable, Phase 1-2 implementation continues (state machine + basic hook integration). Phase 3 evidence collection deferred until dependencies met. Partial deployment still improves compliance vs current state.

---

## Phase 1: Session State MCP Core

**Duration**: 3 days realistic (2 days optimistic, 4 days pessimistic)
**Goal**: Implement state machine with Serena integration and core tools

### Tasks

#### Task 1.1: Project Setup and State Machine Definition

**Effort**: 4 hours
**Owner**: Implementer

**Activities**:
1. Create package structure at `apps/session-state-mcp/`
2. Initialize TypeScript project with MCP SDK dependencies
3. Define SessionPhase enum (14 phases: INIT through COMPLETE)
4. Define state transition table with gates and blocking flags
5. Create Protocol parser to load requirements from SESSION-PROTOCOL.md

**Deliverables**:
- `package.json` with dependencies (MCP SDK, TypeScript)
- `src/state-machine/phases.ts` with SessionPhase enum
- `src/state-machine/transitions.ts` with TRANSITIONS table
- `src/protocol/parser.ts` for SESSION-PROTOCOL.md parsing

**Acceptance Criteria**:
- [ ] State machine compiles without errors
- [ ] All 14 phases defined in SessionPhase enum
- [ ] Transition table maps all phases to gates
- [ ] Protocol parser extracts RFC 2119 requirements

**Evidence Location**: Session log Protocol Compliance section

---

#### Task 1.2: Serena Integration Layer

**Effort**: 4 hours
**Owner**: Implementer

**Activities**:
1. Implement SerenaIntegration class with Brain MCP tool wrappers
2. Create memory operations: write_memory, read_memory, edit_memory, list_memories
3. Implement file-based fallback when Brain MCP unavailable
4. Create withSerenaFallback helper for graceful degradation

**Deliverables**:
- `src/serena/integration.ts` with SerenaIntegration class
- `src/serena/fallback.ts` with file-based storage
- Tool call wrappers for `mcp__plugin_brain_brain__*` tools

**Acceptance Criteria**:
- [ ] SerenaIntegration can write/read/edit memories
- [ ] Fallback writes to `.agents/sessions/.session-state.json`
- [ ] Graceful degradation tested (Brain MCP offline scenario)
- [ ] Memory naming follows convention: session-current-state, session-history, session-violations-log

**Evidence Location**: Unit test results documented in session log

---

#### Task 1.3: session_start Tool Implementation

**Effort**: 6 hours
**Owner**: Implementer

**Activities**:
1. Implement session_start tool with auto-detection of git state
2. Generate session IDs with format `YYYY-MM-DD-session-NN`
3. Initialize state machine at INIT phase
4. Load checklist from SESSION-PROTOCOL.md via parser
5. Persist state via Serena (or file fallback)
6. Return blocking checklist (not tool calls)

**Deliverables**:
- `src/tools/session_start.ts` with session_start implementation
- `src/resources/state.ts` with SessionState type definition
- `src/resources/checklist.ts` with checklist loading logic

**Acceptance Criteria**:
- [ ] session_start creates session-current-state memory
- [ ] Session ID follows naming convention
- [ ] Checklist contains all MUST/SHOULD requirements from protocol
- [ ] State persists via Brain MCP (or file fallback if unavailable)
- [ ] Tool returns blocking checklist, not tool calls
- [ ] Error if session already active

**Evidence Location**: Integration test output in session log

---

#### Task 1.4: validate_gate Tool Implementation

**Effort**: 8 hours
**Owner**: Implementer

**Activities**:
1. Implement validate_gate tool with phase-specific validation logic
2. Create validation logic for each gate: BRAIN_INIT, CONTEXT_RETRIEVAL, SKILL_VALIDATION, SESSION_LOG, BRANCH_CHECK, QUALITY_GATE, QA_GATE, GIT_COMMIT
3. Implement evidence collection from state.evidence
4. Support PASS/FAIL/SKIPPED status with evidence
5. Handle docs-only and investigation-only skip patterns

**Deliverables**:
- `src/tools/validate_gate.ts` with validate_gate implementation
- Gate validation logic for 8 major gates
- Evidence-based verification (tool outputs, file existence, content hashes)

**Acceptance Criteria**:
- [ ] BRAIN_INIT gate validates Serena MCP responding
- [ ] CONTEXT_RETRIEVAL gate validates HANDOFF.md read (content hash)
- [ ] SKILL_VALIDATION gate validates skills directory and usage-mandatory read
- [ ] SESSION_LOG gate validates session log file exists
- [ ] BRANCH_CHECK gate validates branch documented, not main/master
- [ ] QUALITY_GATE gate validates markdownlint passed
- [ ] QA_GATE gate validates QA report exists OR skip evidence provided
- [ ] GIT_COMMIT gate validates commit exists with conventional format
- [ ] Evidence stored in state for traceability

**Evidence Location**: Unit test results for each gate in session log

---

#### Task 1.5: Supporting Tools Implementation

**Effort**: 4 hours
**Owner**: Implementer

**Activities**:
1. Implement advance_phase tool to progress state machine
2. Implement record_evidence tool to store verification evidence
3. Implement get_state tool to query current session state
4. Implement session_end tool to complete session and archive state

**Deliverables**:
- `src/tools/advance_phase.ts`
- `src/tools/record_evidence.ts`
- `src/tools/get_state.ts`
- `src/tools/session_end.ts`

**Acceptance Criteria**:
- [ ] advance_phase validates transition rules before advancing
- [ ] record_evidence appends to state.evidence map
- [ ] get_state returns current phase, gates status, violations
- [ ] session_end archives state to session-history, deletes session-current-state
- [ ] session_end supports skip_qa parameter for docs-only sessions

**Evidence Location**: Unit test coverage report in session log

---

#### Task 1.6: Unit Tests

**Effort**: 6 hours
**Owner**: QA

**Activities**:
1. Write unit tests for session_start (session creation, rejection of duplicate)
2. Write unit tests for validate_gate (PASS/FAIL/SKIPPED scenarios)
3. Write unit tests for state machine transitions
4. Write unit tests for Serena integration and fallback
5. Achieve 80%+ code coverage

**Deliverables**:
- `tests/unit/session_start.test.ts`
- `tests/unit/validate_gate.test.ts`
- `tests/unit/state-machine.test.ts`
- `tests/unit/serena-integration.test.ts`
- Coverage report

**Acceptance Criteria**:
- [ ] session_start rejects duplicate session
- [ ] validate_gate correctly validates all 8 gates
- [ ] State machine prevents invalid transitions
- [ ] Serena fallback works when Brain MCP unavailable
- [ ] Coverage: 80%+ lines, 75%+ branches

**Evidence Location**: Coverage report artifact in session log

---

### Phase 1 Milestones

**Milestone 1.1**: State machine and Serena integration (Day 1)
**Milestone 1.2**: Core tools (session_start, validate_gate) (Day 2)
**Milestone 1.3**: Supporting tools and unit tests (Day 3)

### Phase 1 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Brain MCP changes break integration | Low | High | Use versioned Brain MCP tools; implement fallback |
| Protocol parser fails on SESSION-PROTOCOL.md format | Medium | Medium | Manual checklist fallback; validate parser early |
| State machine transitions too rigid | Low | Medium | Support manual override via session_end force_complete |

---

## Phase 2: Hook Integration

**Duration**: 2 days realistic (1 day optimistic, 3 days pessimistic)
**Goal**: Integrate Session State MCP with brain-hooks binary for automatic session start

### Tasks

#### Task 2.1: Modify brain-hooks Binary

**Effort**: 4 hours
**Owner**: DevOps

**Activities**:
1. Update SessionStart hook in `apps/claude-plugin/cmd/hooks/session_start.go`
2. Call Session State MCP session_start tool instead of direct Brain calls
3. Format blocking message from session_start result
4. Return HookResult with exit code 2 and additionalContext

**Deliverables**:
- Modified `apps/claude-plugin/cmd/hooks/session_start.go`
- Hook calls `session_state.session_start` with user prompt
- Blocking message formatted with checklist

**Acceptance Criteria**:
- [ ] SessionStart hook calls session_start tool
- [ ] Hook returns exit code 2 (block agent action)
- [ ] additionalContext contains blocking message with checklist
- [ ] Hook handles session_start errors gracefully

**Evidence Location**: Hook execution logs in session log

---

#### Task 2.2: Update hooks.json Configuration

**Effort**: 2 hours
**Owner**: DevOps

**Activities**:
1. Add Session State MCP to MCP registry in Claude Code config
2. Configure SessionStart hook to call session_start
3. Test hook configuration with sample session

**Deliverables**:
- Updated `.claude/hooks.json` or equivalent config
- MCP registry entry for session-state MCP

**Acceptance Criteria**:
- [ ] Session State MCP registered in Claude Code
- [ ] SessionStart hook fires on new session
- [ ] Blocking message appears in agent transcript
- [ ] Hook does not break existing sessions

**Evidence Location**: Configuration file diffs in session log

---

#### Task 2.3: Integration Testing with Hooks

**Effort**: 4 hours
**Owner**: QA

**Activities**:
1. Start Claude Code session and verify SessionStart hook fires
2. Verify blocking message appears in agent transcript before first tool call
3. Test session_start rejection of duplicate session
4. Test hook graceful degradation if Session State MCP unavailable

**Deliverables**:
- `tests/integration/hook-integration.test.ts`
- Manual test session log with hook evidence

**Acceptance Criteria**:
- [ ] Hook fires automatically on session start
- [ ] Blocking message visible in transcript
- [ ] Agent sees checklist before work begins
- [ ] Hook fails gracefully if MCP unavailable (logs error, continues)

**Evidence Location**: Integration test transcript in session log

---

### Phase 2 Milestones

**Milestone 2.1**: brain-hooks binary updated (Day 1)
**Milestone 2.2**: hooks.json configured and tested (Day 2)

### Phase 2 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Claude Code version lacks additionalContext support | Medium | High | Check version early; fallback to exit code messaging |
| Hook breaks existing sessions | Low | Critical | Test with and without Session State MCP |
| Hook latency delays session start | Low | Low | Measure latency; optimize if >1 second |

---

## Phase 3: Evidence Collection

**Duration**: 2 days realistic (1 day optimistic, 3 days pessimistic)
**Goal**: Implement PostToolUse hook to detect Brain MCP tool completions and advance phases

### Tasks

#### Task 3.1: PostToolUse Hook Listener

**Effort**: 4 hours
**Owner**: DevOps

**Activities**:
1. Register PostToolUse hook in brain-hooks configuration
2. Detect Brain MCP tool calls (pattern: `mcp__plugin_brain_brain__*`)
3. Call Session State MCP record_evidence with tool name and output
4. Map tool calls to gates (e.g., bootstrap_context -> BRAIN_INIT)

**Deliverables**:
- Modified `apps/claude-plugin/cmd/hooks/post_tool_use.go`
- PostToolUse hook configuration in hooks.json
- Tool call detection and mapping logic

**Acceptance Criteria**:
- [ ] PostToolUse hook fires after Brain MCP tool calls
- [ ] Hook extracts tool name and output
- [ ] Hook calls record_evidence with correct phase mapping
- [ ] Hook handles errors without breaking agent flow

**Evidence Location**: PostToolUse hook logs in session log

---

#### Task 3.2: Alternative Tools Handling

**Effort**: 4 hours
**Owner**: Implementer

**Activities**:
1. Implement alternative tool detection (e.g., Read tool for HANDOFF.md)
2. Validate file paths against expected protocol paths
3. Support outcome-based verification (not tool-prescriptive)
4. Update validate_gate to accept alternative evidence sources

**Deliverables**:
- `src/tools/alternative-tools.ts` with detection logic
- Updated validate_gate to check alternative evidence

**Acceptance Criteria**:
- [ ] Read(".agents/HANDOFF.md") satisfies CONTEXT_RETRIEVAL gate
- [ ] Bash: git branch satisfies BRANCH_CHECK gate
- [ ] Write tool satisfies SESSION_LOG gate
- [ ] File content hashes validated when applicable

**Evidence Location**: Unit tests for alternative tools in session log

---

#### Task 3.3: Gate Validation and Phase Advancement

**Effort**: 4 hours
**Owner**: Implementer

**Activities**:
1. Implement automatic validate_gate call after record_evidence
2. Implement automatic advance_phase if gate passes
3. Update session-current-state with new phase
4. Inject updated phase state into agent context (if supported)

**Deliverables**:
- `src/tools/auto-advance.ts` with automatic phase advancement
- Updated record_evidence to trigger validation

**Acceptance Criteria**:
- [ ] Gates validate automatically after evidence recorded
- [ ] Phases advance automatically when gates pass
- [ ] Agent queries get_state to see current phase
- [ ] Phase updates visible in session-current-state memory

**Evidence Location**: Integration test logs showing automatic advancement

---

#### Task 3.4: Violation Handling and Recovery

**Effort**: 4 hours
**Owner**: Implementer

**Activities**:
1. Implement violation detection when MUST requirements fail
2. Append violations to session-violations-log
3. Transition to BLOCKED phase for critical violations
4. Provide recovery instructions via get_blocked_reason tool

**Deliverables**:
- `src/tools/violation-handler.ts` with violation logic
- `src/tools/get_blocked_reason.ts` to return recovery steps

**Acceptance Criteria**:
- [ ] MUST requirement failure logs violation
- [ ] BLOCKED phase prevents work continuation
- [ ] get_blocked_reason returns actionable recovery steps
- [ ] Violations persist in session-violations-log for audit

**Evidence Location**: Violation handling tests in session log

---

### Phase 3 Milestones

**Milestone 3.1**: PostToolUse hook implemented (Day 1)
**Milestone 3.2**: Evidence collection and automatic advancement (Day 2)

### Phase 3 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| PostToolUse hook not supported | Medium | High | Fallback to polling Brain MCP tool history (slower) |
| Tool call detection misses edge cases | Medium | Medium | Comprehensive test suite with diverse tool calls |
| Automatic advancement too aggressive | Low | Medium | Add manual validation mode for debugging |

---

## Phase 4: Testing & Validation

**Duration**: 2 days realistic (1 day optimistic, 3 days pessimistic)
**Goal**: Comprehensive testing and validation before production deployment

### Tasks

#### Task 4.1: Integration Test Suite

**Effort**: 6 hours
**Owner**: QA

**Activities**:
1. Write integration tests for full session lifecycle
2. Test all 14 phase transitions with gates
3. Test Brain MCP unavailable fallback scenario
4. Test violation handling and recovery
5. Test alternative tools detection

**Deliverables**:
- `tests/integration/full-session.test.ts`
- `tests/integration/fallback.test.ts`
- `tests/integration/violation-recovery.test.ts`
- `tests/integration/alternative-tools.test.ts`

**Acceptance Criteria**:
- [ ] Full session lifecycle completes successfully (INIT -> COMPLETE)
- [ ] Fallback storage works when Brain MCP unavailable
- [ ] Violations block work and provide recovery instructions
- [ ] Alternative tools (Read, Bash) satisfy gates
- [ ] All integration tests pass

**Evidence Location**: Integration test results artifact in session log

---

#### Task 4.2: Manual Session Testing

**Effort**: 4 hours
**Owner**: QA + Implementer

**Activities**:
1. Start real Claude Code session with Session State MCP enabled
2. Complete full protocol checklist
3. Verify blocking messages appear in transcript
4. Verify phase transitions via get_state
5. Document any UX issues or confusion

**Deliverables**:
- Manual test session log at `.agents/sessions/YYYY-MM-DD-session-manual-test.md`
- UX feedback document

**Acceptance Criteria**:
- [ ] SessionStart hook fires and displays checklist
- [ ] Agent completes all MUST requirements before work
- [ ] Phase advances automatically as gates pass
- [ ] session-current-state memory reflects correct phase
- [ ] session_end completes successfully

**Evidence Location**: Manual test session log

---

#### Task 4.3: Update Validate-SessionProtocol.ps1

**Effort**: 3 hours
**Owner**: Implementer

**Activities**:
1. Add optional Session State MCP check to Validate-SessionProtocol.ps1
2. Fast path: Query get_state for validation status
3. Fallback: Existing file-based validation
4. Update validation script documentation

**Deliverables**:
- Modified `scripts/Validate-SessionProtocol.ps1`
- Updated script documentation

**Acceptance Criteria**:
- [ ] Script queries Session State MCP if available
- [ ] Script reports phase and gates status
- [ ] Script falls back to file validation if MCP unavailable
- [ ] Script exit code reflects protocol compliance

**Evidence Location**: Script test results in session log

---

#### Task 4.4: Performance Testing

**Effort**: 3 hours
**Owner**: QA

**Activities**:
1. Measure session_start latency (<2 seconds target)
2. Measure validate_gate latency per gate
3. Measure PostToolUse hook overhead per tool call
4. Identify and document any performance bottlenecks

**Deliverables**:
- Performance test report with latency measurements
- Optimization recommendations (if needed)

**Acceptance Criteria**:
- [ ] session_start completes in <2 seconds
- [ ] validate_gate completes in <500ms per gate
- [ ] PostToolUse hook adds <100ms overhead per tool call
- [ ] No performance regressions from baseline

**Evidence Location**: Performance test report in session log

---

### Phase 4 Milestones

**Milestone 4.1**: Integration tests complete (Day 1)
**Milestone 4.2**: Manual testing and validation script updated (Day 2)

### Phase 4 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Manual testing reveals UX issues | High | Medium | Iterate on blocking message format |
| Performance unacceptable | Low | Medium | Optimize state queries; add caching |
| Edge cases not covered by tests | Medium | Medium | Expand test suite based on manual findings |

---

## Phase 5: Documentation & Rollout

**Duration**: 1 day realistic (0.5 days optimistic, 2 days pessimistic)
**Goal**: Document implementation and prepare for production deployment

### Tasks

#### Task 5.1: Update SESSION-PROTOCOL.md

**Effort**: 2 hours
**Owner**: Architect

**Activities**:
1. Add reference to Session State MCP in SESSION-PROTOCOL.md
2. Document automatic enforcement via hooks
3. Update bootstrap command documentation (now recovery mechanism)
4. Document validation via get_state

**Deliverables**:
- Updated `SESSION-PROTOCOL.md` with Session State MCP references
- Updated bootstrap command documentation

**Acceptance Criteria**:
- [ ] SESSION-PROTOCOL.md references Session State MCP
- [ ] Automatic enforcement via hooks documented
- [ ] Bootstrap command described as recovery mechanism
- [ ] get_state usage documented

**Evidence Location**: Documentation diff in session log

---

#### Task 5.2: Create Deployment Documentation

**Effort**: 2 hours
**Owner**: DevOps

**Activities**:
1. Document installation steps for Session State MCP
2. Document Claude Code configuration
3. Document verification steps post-deployment
4. Document rollback procedure

**Deliverables**:
- `apps/session-state-mcp/README.md` with installation steps
- `apps/session-state-mcp/DEPLOYMENT.md` with deployment procedures

**Acceptance Criteria**:
- [ ] Installation steps documented
- [ ] Configuration examples provided
- [ ] Verification steps clear
- [ ] Rollback procedure documented

**Evidence Location**: Documentation files committed

---

#### Task 5.3: Production Deployment

**Effort**: 2 hours
**Owner**: DevOps + Implementer

**Activities**:
1. Deploy Session State MCP to production environment
2. Update Claude Code configuration with Session State MCP
3. Enable SessionStart hook
4. Monitor first 10 sessions for issues

**Deliverables**:
- Session State MCP deployed and configured
- 10-session monitoring report

**Acceptance Criteria**:
- [ ] Session State MCP installed and running
- [ ] Claude Code configuration updated
- [ ] SessionStart hook fires on new sessions
- [ ] First 10 sessions show 100% hook firing rate
- [ ] No critical errors in first 10 sessions

**Evidence Location**: Deployment log and monitoring report in session log

---

#### Task 5.4: Post-Implementation Review

**Effort**: 2 hours
**Owner**: Retrospective agent

**Activities**:
1. Run 10 sessions with Session State MCP enabled
2. Measure protocol compliance rate (target: 95%+)
3. Measure manual bootstrap usage (target: <5%)
4. Document observable violations
5. Extract learnings for skill updates

**Deliverables**:
- Post-implementation review document at `.agents/retrospective/YYYY-MM-DD-adr-015-review.md`
- Skill updates for learned patterns

**Acceptance Criteria**:
- [ ] 95%+ of sessions complete MUST requirements before work
- [ ] <5% manual bootstrap usage per 100 sessions
- [ ] Violations observable via blocking messages
- [ ] session-current-state accurately reflects phase transitions
- [ ] Learnings extracted and documented

**Evidence Location**: Post-implementation review document

---

### Phase 5 Milestones

**Milestone 5.1**: Documentation complete (Morning)
**Milestone 5.2**: Production deployment and monitoring (Afternoon)

### Phase 5 Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Deployment breaks existing sessions | Low | Critical | Rollback immediately; test with and without MCP |
| Documentation incomplete | Low | Low | Review documentation before deployment |
| Post-implementation metrics not collected | Medium | Low | Automate metrics collection via session-violations-log |

---

## Overall Timeline

```
Week 1 (Phase 1)
├─ Day 1: State machine and Serena integration (Tasks 1.1, 1.2)
├─ Day 2: Core tools (session_start, validate_gate) (Tasks 1.3, 1.4)
└─ Day 3: Supporting tools and unit tests (Tasks 1.5, 1.6)

Week 2 (Phase 2-3)
├─ Day 4: Hook integration (Tasks 2.1, 2.2, 2.3)
├─ Day 5: Evidence collection (Tasks 3.1, 3.2)
└─ Day 6: Gate validation and violation handling (Tasks 3.3, 3.4)

Week 3 (Phase 4-5)
├─ Day 7: Integration tests (Tasks 4.1, 4.2)
├─ Day 8: Validation script and performance testing (Tasks 4.3, 4.4)
├─ Day 9: Documentation and deployment (Tasks 5.1, 5.2, 5.3)
└─ Day 10: Post-implementation review (Task 5.4)
```

**Optimistic**: 8 days (if integration smooth, no edge cases)
**Realistic**: 10 days (buffer for testing and debugging)
**Pessimistic**: 15 days (if PostToolUse integration complex or Brain MCP changes needed)

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Brain MCP unavailable | Low | High | File-based fallback implemented in Phase 1 |
| Claude Code version lacks additionalContext | Medium | High | Check version early; fallback to exit code messaging |
| PostToolUse hook not supported | Medium | High | Fallback to polling Brain MCP tool history |
| Agent confusion with blocking messages | High | Medium | Iterate on message format during manual testing |
| Performance unacceptable | Low | Medium | Optimize state queries; add caching |
| Protocol parser breaks on format changes | Medium | Medium | Manual checklist fallback; validate parser early |
| Deployment breaks existing sessions | Low | Critical | Rollback immediately; test with and without MCP |
| Edge cases not covered by tests | Medium | Medium | Expand test suite based on manual findings |

---

## Success Metrics (from ADR-015)

**Baseline** (current state):
- ~70% Session Start compliance (trust-based with prompts)
- ~30% manual bootstrap usage

**Target** (post-implementation):
- 95%+ Session Start compliance (verification with gates)
- <5% manual bootstrap usage per 100 sessions

**Improvement**: +25 percentage points compliance

**Measurement**:
1. **Protocol compliance rate**: Sessions complete MUST requirements before work
   - Source: session-violations-log analysis
   - Calculation: (sessions with no MUST violations) / (total sessions)

2. **Manual bootstrap usage**: Command invocation logs
   - Source: Claude Code command history
   - Calculation: (bootstrap invocations) / (total sessions)

3. **Session start latency**: Hook execution time
   - Source: Hook logs
   - Target: <2 seconds

4. **Gate false positives**: Violation log review
   - Source: session-violations-log
   - Target: <1% of validations

5. **Agent confusion incidents**: Session log analysis
   - Source: Session logs with user clarification requests
   - Target: 0 per 100 sessions

---

## Rollback Plan

**Triggers for rollback**:
- Session start latency >5 seconds
- >10% of sessions fail to start due to Session State MCP
- Critical bugs discovered in state machine logic
- Agent confusion rate >5% per 100 sessions

**Rollback Procedure**:

```bash
# Step 1: Disable SessionStart hook
# Edit .claude/hooks.json or equivalent config
# Comment out or remove SessionStart hook entry

# Step 2: Disable Session State MCP
# Edit Claude Code MCP config
# Remove or disable session-state MCP server

# Step 3: Restore manual bootstrap
# No code changes needed; bootstrap command still exists

# Step 4: Notify agents
# Update SESSION-PROTOCOL.md to indicate manual bootstrap required

# Step 5: Monitor rollback
# Verify sessions start normally
# Verify bootstrap command usage increases
```

**Estimated rollback time**: 1 hour

**Data Impact**: Session state is ephemeral (deleted at session end). No data migration required for rollback.

---

## Dependencies

**Blocking dependencies**:
- Brain MCP operational (fallback available)
- Claude Code v2.1.9+ for additionalContext (fallback available)
- Git repository initialized (fundamental requirement, no fallback)

**Non-blocking dependencies**:
- PostToolUse hook support (fallback: polling)
- SESSION-PROTOCOL.md format stable (fallback: manual checklist)

---

## Known Edge Cases (Acceptable 5% Failure Modes)

From ADR-015:
- Agent explicitly overrides protocol (user-directed exception)
- Brain MCP and file fallback both unavailable (degraded environment)
- Session State MCP crash mid-session (recovery mechanism activates)

**Handling**: Document in session-violations-log for retrospective analysis. Do not block user work for acceptable edge cases.

---

## Validation Checkpoints

| Phase | Checkpoint | Verification |
|-------|-----------|--------------|
| Phase 1 | State machine compiles | `npm run build` succeeds |
| Phase 1 | Unit tests pass | `npm test` shows 80%+ coverage |
| Phase 2 | Hook fires on session start | Manual test shows blocking message |
| Phase 3 | Evidence collection works | PostToolUse hook logs show tool calls |
| Phase 4 | Integration tests pass | All integration tests green |
| Phase 4 | Manual session completes | session_end returns COMPLETE |
| Phase 5 | Deployment successful | First 10 sessions show 100% hook firing |
| Phase 5 | Compliance metrics met | 95%+ sessions complete MUST requirements |

---

## References

- **ADR-015**: [ADR-015-session-protocol-automation.md](../architecture/ADR-015-session-protocol-automation.md)
- **SESSION-PROTOCOL**: [SESSION-PROTOCOL.md](../SESSION-PROTOCOL.md)
- **Session State MCP Spec**: [session-state-mcp-spec.md](../specs/session-state-mcp-spec.md)
- **MCP TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Brain MCP**: https://github.com/cloudmcp/serena
- **Claude Code Hooks**: https://docs.anthropic.com/claude-code/hooks

---

## Notes for Next Session

- Phase 1 can begin immediately after prerequisite verification
- Brain MCP fallback enables progress even if dependency unavailable
- Manual testing in Phase 4 is critical for UX validation
- Post-implementation review (Phase 5.4) feeds into continuous improvement

---

**Estimated Total Effort**: 10 days (±30%)
- Optimistic: 8 days
- Realistic: 10 days
- Pessimistic: 15 days

**Confidence Level**: Medium (based on Brain MCP implementation reference: ~8 days)
