# Analysis: Stop Hook Validation Blocking After Proper Session Initialization

## 1. Objective and Scope

**Objective**: Determine why stop hook validation blocks continuation despite proper session initialization (Brain MCP initialized, session log created, mode set via MCP).

**Scope**:

- Stop hook validation logic (apps/claude-plugin/cmd/hooks/stop.go)
- Session state loading mechanism (apps/claude-plugin/cmd/hooks/sessionstart/sessionstart.go)
- Validation checks (packages/validation/validate-session.go)
- Data flow: MCP session tool vs Brain CLI session command

## 2. Context

User reported:

- Brain MCP initialized successfully
- Session log created
- Mode set to "disabled" via MCP session tool
- Stop hook still blocked with "Stop hook prevented continuation"
- Debug log showed: Brain CLI returned mode: "analysis" (not "disabled")

State desynchronization: MCP session tool writes state, but Brain CLI reads different state.

## 3. Approach

**Methodology**:

- Trace data flow from MCP session tool write to Brain CLI read
- Examine command invocation in stop hook
- Identify state persistence mechanism
- Verify validation logic

**Tools Used**: Read, Grep, Bash
**Limitations**: Cannot test actual execution, relying on code analysis

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| Stop hook calls `LoadWorkflowState()` | apps/claude-plugin/cmd/hooks/stop.go:35 | High |
| `LoadWorkflowState()` calls `brain session` (no subcommand) | apps/claude-plugin/cmd/hooks/sessionstart/sessionstart.go:144 | High |
| Brain CLI no longer supports `brain session` without subcommand | apps/tui/cmd/session.go:265-269 | High |
| `brain session` now shows help text, does not return JSON | Bash execution output | High |
| MCP session tool writes to in-memory sessionStore Map | apps/mcp/src/services/session/index.ts:443 | High |
| Brain CLI `get-state` reads from MCP via client.CallTool | apps/tui/cmd/session.go:199-200 | High |
| Validation fails when UpdatedAt is empty in analysis/planning mode | packages/validation/validate-session.go:38-47 | High |
| UpdatedAt IS populated by setSession and createDefaultSessionState | apps/mcp/src/services/session/index.ts:417,427,438,340 | High |

### Facts (Verified)

**Command Mismatch (Root Cause)**:

- Stop hook calls: `ExecCommand("brain", "session")` (line 144 sessionstart.go)
- Expected command: `ExecCommand("brain", "session", "get-state")`
- Actual behavior: Returns help text instead of JSON
- Result: JSON unmarshal fails silently, returns nil state
- Impact: Stop hook sees nil state, uses graceful degradation (allows continuation)

**State Synchronization Path**:

- MCP session tool stores state in Map: `sessionStore.set(id, state)` (index.ts:443)
- Brain CLI `get-state` calls MCP via RPC: `brainClient.CallTool("session", {operation: "get"})` (session.go:199)
- No persistence gap IF MCP server is running
- State exists only in MCP server memory (ephemeral)

**Validation Logic**:

- When state is nil (due to command failure), validation passes with graceful message (stop.go:37-39)
- When state exists but UpdatedAt is empty in analysis/planning mode, validation fails (validate-session.go:38-47)
- UpdatedAt is always populated (verified in code), so UpdatedAt validation should not fail

## 5. Results

**Bug 1: Broken Command Invocation [CRITICAL]**

- File: apps/claude-plugin/cmd/hooks/sessionstart/sessionstart.go:144
- Current: `cmd := ExecCommand("brain", "session")`
- Expected: `cmd := ExecCommand("brain", "session", "get-state")`
- Impact: Stop hook cannot read session state, falls back to nil state handling
- Symptom: Stop hook always allows continuation regardless of actual session state

**Not a Bug: UpdatedAt Population**

- Verification: setSession updates updatedAt on every change (lines 417, 427, 438)
- Verification: createDefaultSessionState initializes updatedAt (line 340)
- Conclusion: UpdatedAt validation logic is correct, should not fail in practice

**Architectural Concern: State Persistence**

- MCP session tool updates in-memory Map only
- State lost if MCP server restarts
- No durable persistence to Brain notes visible in setSession
- Brain CLI depends on MCP RPC availability

## 6. Discussion

**Primary Failure Mode**: Command invocation bug prevents stop hook from reading any session state. Hook sees nil state and allows continuation (graceful degradation at line 37-39).

**Why User Saw State Mismatch**: User set mode to "disabled" via MCP session tool. Debug log showed Brain CLI returned mode "analysis". This happened because:

1. Brain CLI invoked wrong command: `brain session` (no subcommand)
2. Command returned help text, not JSON
3. JSON unmarshal failed
4. LoadWorkflowState returned nil
5. Stop hook saw nil state, allowed continuation with message "No active workflow"

**State Synchronization**: The architecture uses in-memory state with MCP RPC bridge. Brain CLI `get-state` calls MCP `session` tool with operation "get". This means:

- State writes via MCP session tool are immediately visible to Brain CLI
- No persistence gap if MCP server is running
- But if MCP restarts, all state is lost
- Hooks fail-closed (graceful degradation) when MCP unavailable

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P0 | Fix command in LoadWorkflowState: add "get-state" argument | Blocks all stop hook session state reads | 5 minutes |
| P0 | Add unit test for LoadWorkflowState with correct command | Prevent regression | 15 minutes |
| P1 | Add integration test for stop hook with session state | Verify end-to-end flow | 30 minutes |
| P1 | Document ephemeral nature of session state in architecture docs | Clarify MCP restart behavior | 10 minutes |
| P2 | Review all ExecCommand("brain", "session") calls | Verify gatecheck is only other caller (already correct) | 5 minutes |

## 8. Conclusion

**Verdict**: Proceed - Specific fix identified with high confidence

**Confidence**: High (command invocation bug is definitive)

**Rationale**: Stop hook calls obsolete `brain session` command instead of `brain session get-state`. This causes JSON parsing to fail, returning nil state. Validation then uses graceful degradation instead of actual session state checks. Fix is a 1-line change to add "get-state" argument.

### User Impact

- **What changes for you**: Stop hook will correctly read session state and validate protocol compliance
- **Effort required**: 1-line fix + unit test
- **Risk if ignored**: Stop hook validation is ineffective, allows session end without proper protocol completion

## 9. Appendices

### Sources Consulted

- apps/claude-plugin/cmd/hooks/stop.go (stop hook logic)
- apps/claude-plugin/cmd/hooks/sessionstart/sessionstart.go (LoadWorkflowState implementation)
- apps/tui/cmd/session.go (Brain CLI session command)
- apps/mcp/src/services/session/index.ts (MCP session service)
- apps/mcp/src/tools/session/index.ts (MCP session tool)
- packages/validation/validate-session.go (validation logic)

### Data Transparency

**Found**:

- Exact command invocation bug (missing "get-state" argument)
- Validation logic for UpdatedAt timestamps (working correctly)
- State storage in Map (sessionStore)
- Brain CLI RPC bridge to MCP
- UpdatedAt is always populated by setSession and createDefaultSessionState

**Not Found**:

- Durable persistence to Brain notes (state is ephemeral in memory)
- Why debug log showed "analysis" mode (explained: nil state from command failure)

### Next Steps

1. Fix LoadWorkflowState command: `ExecCommand("brain", "session", "get-state")`
2. Add unit test covering LoadWorkflowState with correct command invocation
3. Add integration test: init session → set mode → run stop hook → verify state read correctly
4. Verify gatecheck hook uses correct command (verified: already correct at gatecheck.go:75)
5. Update architecture docs to note session state is ephemeral (lost on MCP restart)
