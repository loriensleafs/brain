---
type: task
id: TASK-006
title: Implement Brain CLI bridge for hook integration
status: complete
priority: P0
complexity: M
estimate: 6h
related:
  - DESIGN-001
  - REQ-004
  - REQ-005
blocked_by:
  - TASK-002
  - TASK-005
blocks:
  - TASK-007
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - brain-cli
  - hooks
  - gate-check
---

# TASK-006: Implement Brain CLI Bridge for Hook Integration

## Design Context

- DESIGN-001: Session state architecture (Component 6: Brain CLI Bridge)

## Objective

Implement Brain CLI commands (get-state, set-state) to provide hook access to session state, and update PreToolUse hook to use fail-closed behavior.

## Scope

**In Scope**:

- `brain session get-state` CLI command
- `brain session set-state` CLI command
- PreToolUse hook update for fail-closed behavior
- isReadOnlyTool function in Go
- Signature verification in hook

**Out of Scope**:

- SessionStart hook integration (separate task)
- Inngest workflow triggers (separate task)

## Acceptance Criteria

- [ ] File created at `apps/cli/src/commands/session/get-state.ts`
- [ ] File created at `apps/cli/src/commands/session/set-state.ts`
- [ ] get-state command reads current session via BrainSessionPersistence
- [ ] get-state command outputs JSON to stdout
- [ ] get-state command exits with code 0 on success, 1 on error
- [ ] set-state command accepts sessionId and updates as arguments
- [ ] set-state command uses updateSessionWithLocking
- [ ] PreToolUse hook calls `brain session get-state` via exec.Command
- [ ] Hook parses JSON output into SessionState struct
- [ ] Hook implements isReadOnlyTool whitelist function
- [ ] Hook blocks destructive tools when state unavailable
- [ ] Hook allows read-only tools when state unavailable
- [ ] Hook blocks all tools on signature verification failure
- [ ] Hook allows tools when mode is "disabled"
- [ ] Hook blocks tools when protocolStartComplete is false
- [ ] Error messages include tool name and mode

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/cli/src/commands/session/get-state.ts` | Create | Brain CLI get-state command |
| `apps/cli/src/commands/session/set-state.ts` | Create | Brain CLI set-state command |
| `apps/claude-plugin/cmd/hooks/pre_tool_use.go` | Modify | Fail-closed gate check logic |

## Implementation Notes

### Brain CLI get-state

```typescript
export async function getSessionState(): Promise<void> {
  try {
    const brainMCP = await connectToBrainMCP();
    const persistence = new BrainSessionPersistence(brainMCP);

    const session = await persistence.getCurrentSession();
    if (!session) {
      console.error("No current session found");
      process.exit(1);
    }

    console.log(JSON.stringify(session));
    process.exit(0);
  } catch (err) {
    console.error(`Failed to get session state: ${err.message}`);
    process.exit(1);
  }
}
```

### PreToolUse hook (Go)

Follow DESIGN-001 Component 6 for fail-closed behavior:

```go
func PerformGateCheck(tool string) *GateCheckResult {
  cmd := exec.Command("brain", "session", "get-state")
  output, err := cmd.Output()

  // FAIL CLOSED: Block destructive tools if state unavailable
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

  var state SessionState
  if err := json.Unmarshal(output, &state); err != nil {
    return &GateCheckResult{
      Allowed: false,
      Message: "Failed to parse session state",
      Mode:    "unknown",
    }
  }

  // Disabled mode bypasses gates
  if state.CurrentMode == "disabled" {
    return &GateCheckResult{Allowed: true, Mode: "disabled"}
  }

  // Check protocol completion
  if !state.ProtocolStartComplete {
    return &GateCheckResult{
      Allowed: false,
      Message: "Session protocol incomplete",
      Mode:    "blocked",
    }
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

## Testing Requirements

- [ ] Unit test: get-state command outputs valid JSON
- [ ] Unit test: get-state exits 1 on missing session
- [ ] Unit test: set-state updates session state
- [ ] Unit test: PreToolUse hook blocks destructive tools when state unavailable
- [ ] Unit test: PreToolUse hook allows read-only tools when state unavailable
- [ ] Unit test: PreToolUse hook allows tools when mode is "disabled"
- [ ] Unit test: PreToolUse hook blocks tools when protocol incomplete
- [ ] Integration test: Hook → Brain CLI → MCP → Brain notes flow
