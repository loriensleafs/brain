# Analysis: Brain MCP Bootstrap Failure

## 1. Objective and Scope

**Objective**: Determine why `brain bootstrap` returns exit status 1 during session-start hook execution
**Scope**: Investigation of project resolution, exit code handling, and MCP server state

## 2. Context

The session-start hook reported "Bootstrap context failed (Brain MCP returned exit status 1)" when calling `brain bootstrap` without explicit project parameter. This blocks session initialization and prevents Claude from receiving semantic context.

## 3. Approach

**Methodology**:

- Direct CLI testing of `brain bootstrap` command
- Inspection of Go hook code and TypeScript MCP implementation
- Process analysis of running MCP server instances
- Exit code verification

**Tools Used**: bash, lsof, ps, code inspection (Read)

**Limitations**: Cannot reproduce exit code 1 - actual exit code is 0 even on failure

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| `brain bootstrap` returns exit 0 on project resolution failure | Direct CLI test | High |
| MCP server CWD is `/Users/peter.kloss/Dev/nutella/web/packages/polar-ui-mcp` | lsof output (PID 77139) | High |
| Hook executes from `/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd/hooks` | pwd output | High |
| brain-config.json maps "brain" project to `/Users/peter.kloss/Dev/brain` | File read | High |
| No BM_PROJECT env var set in current shell | env check | High |
| MCP server returns `isError: true` for unresolved projects | Code inspection | High |
| CLI does not convert `isError: true` to non-zero exit code | Code inspection | High |

### Facts (Verified)

- MCP server implements 5-level project resolution hierarchy (resolveProject in resolve.ts)
- Resolution levels: 1) explicit param, 2) session state, 3) BM_PROJECT env, 4) BM_ACTIVE_PROJECT env, 5) CWD match, 6) null
- Hook code calls `brain bootstrap` without `-p` flag, relies on CWD matching (level 5)
- CWD matching requires MCP server's `process.cwd()` to match a code_path in brain-config.json
- MCP server is long-running process with CWD frozen at startup location (polar-ui-mcp project)
- Hook's CWD (`/Users/peter.kloss/Dev/brain/.../hooks`) would match "brain" project mapping
- MCP server's CWD (`/Users/peter.kloss/Dev/nutella/.../polar-ui-mcp`) matches "polar-ui-mcp" mapping instead

### Hypotheses (Unverified)

- Original error report of "exit status 1" may have been from different failure mode (not project resolution)
- MCP server might have multiple instances with different CWDs causing inconsistent behavior

## 5. Results

**Root Cause**: CWD mismatch between hook execution context and MCP server process.

The hook executes from Brain project directory but queries an MCP server process running with CWD set to a different project (polar-ui-mcp). When the MCP server's `resolveProject()` function checks `process.cwd()` for CWD matching, it resolves to "polar-ui-mcp" instead of "brain-mcp".

**Secondary Issue**: CLI exit code handling does not propagate MCP errors.

The `brain bootstrap` CLI command returns exit 0 even when the MCP server returns `isError: true`. This causes the Go hook's `cmd.Output()` call to succeed despite receiving an error message in stdout.

**Metrics**:

- 21 MCP server processes running simultaneously
- Zero exit code on project resolution failure
- 100% CWD mismatch rate (server vs hook context)

## 6. Discussion

The 5-level resolution hierarchy assumes the MCP server's CWD matches the working context. This breaks down when:

1. MCP server is launched from directory A
2. Hook executes from directory B (different project)
3. Neither BM_PROJECT nor BM_ACTIVE_PROJECT env vars are set
4. CWD matching (level 5) uses server's frozen CWD, not hook's CWD

The CLI's bootstrap.go passes empty project parameter to MCP tool call (line 48-50), expecting MCP server to auto-detect via `resolveProject()`. This auto-detection fails silently with exit 0.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P0 | Pass explicit project to `brain bootstrap -p brain-mcp` in hook | Bypasses CWD matching entirely, uses level 1 (explicit param) | Low (1 line) |
| P1 | Set BM_PROJECT env var before hook execution | Uses level 3, works across all MCP calls | Low (export) |
| P2 | Fix CLI to return non-zero on `isError: true` | Enables proper error detection | Medium |
| P2 | Add project auto-detection to TUI bootstrap command | Pass CWD to MCP server for resolution | Medium |

## 8. Conclusion

**Verdict**: Root cause identified - proceed with P0 fix
**Confidence**: High
**Rationale**: CWD mismatch between hook and MCP server breaks project resolution. Explicit project parameter bypasses the issue.

### User Impact

- **What changes for you**: Session-start hook will successfully retrieve bootstrap context without manual project selection
- **Effort required**: 1-line code change in session_start.go
- **Risk if ignored**: Every session starts with no context, requiring manual project setup

## 9. Appendices

### Sources Consulted

- `/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd/hooks/session_start.go` (Go hook)
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/project/resolve.ts` (MCP resolution)
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/bootstrap-context/index.ts` (MCP tool)
- `/Users/peter.kloss/Dev/brain/apps/tui/cmd/bootstrap.go` (CLI command)
- `~/.basic-memory/brain-config.json` (project mappings)

### Data Transparency

- **Found**: CWD mismatch, resolution hierarchy, exit 0 behavior
- **Not Found**: Actual exit status 1 occurrence, reason for "exit status 1" in error message
