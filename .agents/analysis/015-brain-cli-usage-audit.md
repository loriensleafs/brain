# Analysis: Brain CLI Command Usage Audit

## 1. Objective and Scope

**Objective**: Verify correctness of all Brain CLI command invocations across Claude plugin hook files.

**Scope**: Five hook files in `/apps/claude-plugin/cmd/hooks/`

## 2. Context

Hook files invoke Brain CLI via `exec.Command("brain", ...)` to interact with session state and workflow management. Incorrect command names or arguments will cause runtime failures. This audit cross-references actual command usage against Brain CLI help documentation.

## 3. Approach

**Methodology**:

1. Read all hook files and identify `exec.Command("brain", ...)` calls
2. Run `brain --help` and subcommand help to verify command existence
3. Cross-reference expected vs actual command signatures

**Tools Used**:

- Read tool (hook files)
- Bash tool (Brain CLI help)
- grep for command patterns

**Limitations**: Cannot test runtime behavior without active Brain MCP server and session state.

## 4. Data and Analysis

### Available Brain CLI Commands

From `brain --help`:

| Command | Purpose |
|---------|---------|
| `bootstrap` | Bootstrap semantic context for session initialization |
| `embed` | Generate embeddings for notes |
| `help` | Help about any command |
| `mcp` | Manage the Brain MCP server |
| `search` | Search the knowledge base |
| `session` | Get current session state |
| `validate` | Session validation commands |
| `workflow` | Workflow state management commands |

### Available Subcommands

| Command | Subcommands |
|---------|-------------|
| `session` | `get-state`, `set-state` (plus `-p/--project` flag for root) |
| `workflow` | `get-state`, `validate` |
| `validate` | `session` |

### Hook File Command Usage

#### 1. session_start.go

| Line | Command | Status | Notes |
|------|---------|--------|-------|
| 55 | `brain bootstrap` | [PASS] | Command exists |
| 124 | `brain bootstrap -p <project>` | [PASS] | Command exists with project flag |
| 142 | `brain session get-state` | [PASS] | Subcommand exists |

**Verification**: All commands verified correct.

#### 2. gate_check.go

| Line | Command | Status | Notes |
|------|---------|--------|-------|
| 72 | `brain session get-state` | [PASS] | Subcommand exists |

**Verification**: Command verified correct.

#### 3. stop.go

| Line | Command | Status | Notes |
|------|---------|--------|-------|
| 34 | `loadWorkflowState()` | [INDIRECT] | Function defined in session_start.go, uses `brain session get-state` |

**Verification**: Indirect usage through shared function. Verified correct by session_start.go audit.

#### 4. pre_tool_use.go

| Line | Command | Status | Notes |
|------|---------|--------|-------|
| 41 | `performGateCheck()` | [INDIRECT] | Function defined in gate_check.go, uses `brain session get-state` |

**Verification**: Indirect usage through shared function. Verified correct by gate_check.go audit.

#### 5. validate_session.go

| Line | Command | Status | Notes |
|------|---------|--------|-------|
| 35 | `loadWorkflowState()` | [INDIRECT] | Function defined in session_start.go, uses `brain session get-state` |

**Verification**: Indirect usage through shared function. Verified correct by session_start.go audit.

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| All Brain CLI commands used in hooks exist | Brain CLI help output + hook file analysis | High |
| `brain session get-state` is the primary command (used by 4 of 5 hooks) | grep pattern analysis | High |
| `brain bootstrap` is only used by session_start.go | Code inspection | High |
| No invalid commands found | Cross-reference verification | High |

### Facts (Verified)

- Brain CLI provides `session get-state` subcommand (verified via `brain session --help`)
- Brain CLI provides `bootstrap` command with `-p/--project` flag (verified via `brain bootstrap --help`)
- All hook invocations use correct command syntax: `exec.Command("brain", "session", "get-state")`
- No hooks use the deprecated `brain workflow get-state` command (workflow commands exist but are not used by hooks)

### Command Migration Status

**Historical Note**: Analysis of workflow.go shows that `brain workflow get-state` exists and calls the `get_mode` MCP tool. However, hooks have standardized on `brain session get-state` which calls the `session` MCP tool with operation "get".

**Current State**: Session commands are the canonical interface for hooks per ADR-016.

## 5. Results

**All Brain CLI commands used in hook files are correct.**

| Metric | Value |
|--------|-------|
| Total hook files audited | 5 |
| Direct Brain CLI calls | 3 |
| Indirect Brain CLI calls (via shared functions) | 3 |
| Invalid commands found | 0 |
| Correctness rate | 100% |

**Command Frequency:**

| Command | Usage Count | Files |
|---------|-------------|-------|
| `brain session get-state` | 4 | session_start.go, gate_check.go, stop.go (indirect), validate_session.go (indirect) |
| `brain bootstrap` | 1 | session_start.go |
| `brain bootstrap -p <project>` | 1 | session_start.go |

## 6. Discussion

The hook implementation shows consistent use of Brain CLI commands with proper error handling. Key observations:

1. **Standardization**: All hooks use `brain session get-state` consistently, not the alternative `brain workflow get-state`. This aligns with ADR-016's decision to use session commands as the hook interface.

2. **Shared Functions**: Three hooks (stop.go, pre_tool_use.go, validate_session.go) use shared functions (`loadWorkflowState`, `performGateCheck`) from session_start.go and gate_check.go. This prevents command duplication and ensures consistency.

3. **Bootstrap Usage**: Only session_start.go calls `brain bootstrap`, which is correct as bootstrap context is only needed during Phase 0 (session initialization).

4. **No Deprecated Commands**: Despite the existence of `brain workflow get-state`, no hooks use it. All use the newer `brain session get-state` interface.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P2 | Document Brain CLI command contract | Prevent regressions if Brain CLI commands change | Low |
| P2 | Add integration tests for Brain CLI commands | Catch command signature changes during CI | Medium |

## 8. Conclusion

**Verdict**: Proceed
**Confidence**: High
**Rationale**: All Brain CLI commands are verified correct. No mismatches found between hook usage and Brain CLI implementation.

### User Impact

- **What changes for you**: No action required. All hook commands are correct.
- **Effort required**: Zero
- **Risk if ignored**: Not applicable (audit found no issues)

## 9. Appendices

### Sources Consulted

- `/apps/claude-plugin/cmd/hooks/session_start.go`
- `/apps/claude-plugin/cmd/hooks/gate_check.go`
- `/apps/claude-plugin/cmd/hooks/stop.go`
- `/apps/claude-plugin/cmd/hooks/pre_tool_use.go`
- `/apps/claude-plugin/cmd/hooks/validate_session.go`
- `/apps/tui/cmd/session.go` (Brain CLI session command implementation)
- `/apps/tui/cmd/workflow.go` (Brain CLI workflow command implementation)
- Brain CLI help output (`brain --help`, `brain session --help`, `brain workflow --help`)

### Data Transparency

- **Found**: All Brain CLI command signatures verified against help output and source code
- **Not Found**: No invalid commands or signature mismatches detected
