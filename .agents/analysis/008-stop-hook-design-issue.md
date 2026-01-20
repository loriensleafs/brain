# Analysis: Stop Hook Design Issue - Inappropriate Validation Blocking

## 1. Objective and Scope

**Objective**: Determine why stop hook blocks continuation after `brain session` command fix, and assess whether validation logic is appropriate for interactive sessions.

**Scope**: Stop hook validation logic, workflow state structure, and appropriateness of session-end checks during interactive sessions.

## 2. Context

Stop hook was updated to use `brain session get-state` instead of `brain session`, which fixed the command invocation. However, the hook still blocks with "Stop hook prevented continuation" message. This analysis investigates the validation logic to determine if checks are appropriate for an interactive session stop hook.

## 3. Approach

**Methodology**: Code analysis of stop hook logic and validation functions

**Tools Used**: Read, Grep, bash for runtime state inspection

**Limitations**: None - all relevant code accessible

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|------------|
| Stop hook calls ValidateSession with workflow state | stop.go:51 | High |
| ValidateSession checks for UpdatedAt field presence | validate-session.go:31-48 | High |
| Current workflow state lacks UpdatedAt field | `brain session get-state` output | High |
| Validation fails when mode is "analysis" or "planning" and UpdatedAt missing | validate-session.go:38-48 | High |
| Stop hook exits with code 2 (block) on validation failure | stop.go:72-74 | High |

### Facts (Verified)

**Stop Hook Logic** (stop.go):

- Loads workflow state using `brain session get-state`
- Converts to validation package WorkflowState type
- Calls validation.ValidateSession(state)
- Blocks continuation (exit code 2) if result.Valid is false

**Validation Logic** (validate-session.go:11-78):

- Check 1: Workflow state persisted (always passes if state exists)
- Check 2: Recent activity (CRITICAL ISSUE)
  - Passes if UpdatedAt field is populated
  - **FAILS if state.Mode is "analysis" or "planning" and UpdatedAt is empty**
  - This is line 38-48
- Check 3: Task status (always passes)

**Current Workflow State**:

```json
{
  "mode": "analysis"
}
```

**Problem**: UpdatedAt field is not populated in current workflow state structure.

### Root Cause Analysis

The validation logic in `validate-session.go` lines 38-48 is designed for **session-end protocol validation**, not interactive stop hook validation:

```go
shouldFail := state != nil &&
    (state.Mode == "analysis" || state.Mode == "planning")
checks = append(checks, Check{
    Name:    "recent_activity",
    Passed:  !shouldFail,
    Message: "No recent activity captured",
})
if shouldFail {
    allPassed = false
}
```

This check assumes:

1. Session is ending (not just pausing)
2. User has completed work and should have captured observations
3. UpdatedAt should be populated with recent activity timestamp

**But stop hook fires on every session stop**, including:

- User hitting Ctrl+C during active work
- Session pause for context switching
- Temporary interruptions

## 5. Results

ValidateSession function performs **session completion validation** (checks appropriate for session end protocol), not **stop readiness validation** (checks appropriate for pausing/interrupting a session).

Blocking behaviors observed:

- Mode "analysis" or "planning" + missing UpdatedAt = validation failure
- Validation failure = exit code 2
- Exit code 2 = blocked continuation

Current state triggers this exact scenario:

- Mode: "analysis" ✓
- UpdatedAt: missing ✓
- Result: Block continuation ✓

## 6. Discussion

The validation logic is checking for **session protocol compliance** (appropriate for end-of-session validation scripts), not **stop readiness** (appropriate for interactive stop hooks).

**Inappropriate for Stop Hook**:

- Session End checklist completion
- Brain memory update evidence
- Commit SHA evidence
- QA report paths

These checks are meant for **completed sessions**, not **interrupted sessions**.

**Design Mismatch**:
Stop hook should validate **graceful pause readiness**, not **session completion protocol**. The distinction:

| Validation Type | Purpose | Example Checks |
|----------------|---------|----------------|
| **Stop Readiness** | Can session pause safely? | No uncommitted destructive changes, no processes blocking shutdown |
| **Session Completion** | Did session follow protocol? | Checklist complete, memories updated, artifacts committed |

Stop hook is performing Session Completion validation when it should perform Stop Readiness validation.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P0 | Create separate ValidateStopReadiness function | Stop hook needs different checks than session protocol validation | 2-3 hours |
| P0 | Update stop hook to use ValidateStopReadiness instead of ValidateSession | Current function checks wrong things | 30 minutes |
| P1 | Remove blocking behavior from stop hook | Warn instead of block - user knows best when to stop | 15 minutes |
| P1 | Move session protocol validation to explicit command | User runs validation script manually or via CI, not on every stop | 1 hour |

**Proposed ValidateStopReadiness checks**:

1. Workflow state can be persisted (already working)
2. No critical uncommitted state (future enhancement)
3. No blocking processes (future enhancement)

**NOT checked by ValidateStopReadiness**:

- Session End checklist completion
- Memory update evidence
- Commit evidence
- QA report paths

These belong in explicit session-end validation (`brain session validate` or similar).

## 8. Conclusion

**Verdict**: Design Issue - Stop hook performs wrong type of validation

**Confidence**: High

**Rationale**: Stop hook checks session completion protocol (appropriate for end-of-session validation) instead of stop readiness (appropriate for pause/interrupt). This causes false blocking on legitimate interruptions.

### User Impact

- **What changes for you**: Stop hook will warn instead of block when session is paused before completion
- **Effort required**: Validation logic refactoring (estimated 4-5 hours)
- **Risk if ignored**: Users cannot pause sessions in "analysis" or "planning" mode without triggering false validation failures

### Immediate Workaround

Until fixed, users can:

1. Change mode to something other than "analysis" or "planning" before stopping
2. Populate UpdatedAt field in workflow state (requires brain CLI changes)
3. Disable stop hook temporarily (not recommended)

## 9. Appendices

### Sources Consulted

- `/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd/hooks/stop.go`
- `/Users/peter.kloss/Dev/brain/packages/validation/validate-session.go`
- `/Users/peter.kloss/Dev/brain/apps/claude-plugin/hooks/hooks.json`

### Data Transparency

- **Found**: Stop hook logic, validation checks, workflow state structure, blocking conditions
- **Not Found**: Design rationale for why session completion validation is used for stop hook (no documentation found)

### Related Files

- `validate-session-protocol.go` - Full session protocol validation (even more checks inappropriate for stop hook)
- `types.go` - ValidationResult and Check structures
- `sessionstart.go` - Workflow state loading logic
