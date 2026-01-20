# Analysis: Session Protocol Validation Enforcement Integration

## 1. Objective and Scope

**Objective**: Determine where the `validate-session-protocol.go` validation package is integrated into enforcement mechanisms and identify gaps.

**Scope**: Investigation covers Inngest workflows, Brain CLI commands, Claude hooks, CI workflows, and pre-commit hooks.

## 2. Context

The validation package at `packages/validation/validate-session-protocol.go` implements comprehensive session protocol validation with 10 checks (file existence, filename format, required sections, MUST items, Brain MCP evidence, git branch documentation, commit SHA, markdown lint).

The SESSION-PROTOCOL.md and ADR-016 documentation reference `Validate-SessionProtocol.ps1` as the enforcement script, but this is a PowerShell script that does not exist. The Go validation package appears to be the actual implementation.

## 3. Approach

**Methodology**: Code search for validation package imports and function calls across the codebase.

**Tools Used**:

- `Grep` for pattern matching across Go and TypeScript files
- `Read` for detailed code examination
- File system traversal to identify hook locations

**Limitations**: PowerShell validation script does not exist, making documentation-implementation drift analysis incomplete.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|------------|
| Inngest workflow calls validation script (NOT Go package) | `apps/mcp/src/inngest/workflows/sessionProtocolEnd.ts:293-336` | High |
| Brain CLI uses `ValidateSessionLog` function | `apps/tui/cmd/validate.go:59` | High |
| Claude hooks use `ValidateSession` function | `apps/claude-plugin/cmd/hooks/stop.go:50`, `validate_session.go:49` | High |
| NO usage of `ValidateSessionProtocol` Go function | Search returned 0 matches in apps/mcp, apps/tui, apps/claude-plugin | High |
| PowerShell script referenced but does not exist | `sessionProtocolEnd.ts:297` references `scripts/Validate-SessionProtocol.ps1` | High |
| Go package has comprehensive tests | `tests/validate-session-protocol_test.go:335-589` | High |

### Facts (Verified)

1. **Inngest Workflow (`sessionProtocolEnd.ts`)** executes PowerShell script, NOT Go package
   - Line 297: `const scriptPath = path.join(workingDirectory, "scripts", "Validate-SessionProtocol.ps1");`
   - Function `runProtocolValidation()` shells out to `pwsh` command
   - Validation failure blocks session close (line 639-649)

2. **Brain CLI (`apps/tui/cmd/validate.go`)** uses `ValidateSessionLog`, NOT `ValidateSessionProtocol`
   - Line 59: `result := validation.ValidateSessionLog(logPath)`
   - Validates session log completeness but NOT full protocol compliance

3. **Claude Hooks** use `ValidateSession`, NOT `ValidateSessionProtocol`
   - `stop.go:50`: Calls `validation.ValidateSession(state)` for workflow state checks
   - Does NOT validate session protocol MUST requirements

4. **CI Workflows**: No GitHub Actions workflows exist for session protocol validation
   - Search for `.github/workflows/*.yml` found only node_modules dependencies
   - No CI enforcement of validation

5. **Pre-commit Hooks**: No git hooks call validation
   - `.git/hooks/` contains only sample files
   - No active pre-commit enforcement

6. **Go Validation Package** has 3 exported functions:
   - `ValidateSessionProtocol(sessionLogPath)` - Full 10-check validation
   - `ValidateSessionLog(sessionLogPath)` - Session log completeness only
   - `ValidateSession(state)` - Workflow state validation only

### Hypotheses (Unverified)

- PowerShell script was planned but never implemented, replaced by Go package
- Inngest workflow expects PowerShell script but should use Go package directly
- Documentation drift: SESSION-PROTOCOL.md references non-existent PowerShell script

## 5. Results

**Integration Status by Enforcement Point**:

| Enforcement Point | Expected Tool | Actual Tool | Status |
|-------------------|---------------|-------------|--------|
| Inngest `sessionProtocolEnd` | `ValidateSessionProtocol` | PowerShell script (non-existent) | [FAIL] |
| Brain CLI `brain validate session` | `ValidateSessionProtocol` | `ValidateSessionLog` (partial) | [WARNING] |
| Claude hooks (Stop) | `ValidateSessionProtocol` | `ValidateSession` (workflow only) | [WARNING] |
| CI workflows | `ValidateSessionProtocol` | None | [FAIL] |
| Pre-commit hooks | `ValidateSessionProtocol` | None | [FAIL] |

**Validation Function Usage**:

| Function | Checks Performed | Used By |
|----------|------------------|---------|
| `ValidateSessionProtocol` | 10 checks (full protocol) | NOTHING (0 callers) |
| `ValidateSessionLog` | Session log completeness | Brain CLI |
| `ValidateSession` | Workflow state only | Claude hooks |

**Quantified Gap**: 0 out of 5 enforcement points use the comprehensive `ValidateSessionProtocol` function.

## 6. Discussion

The validation package exists with comprehensive 10-check validation, but NO enforcement mechanism actually uses it. The Inngest workflow attempts to call a non-existent PowerShell script, causing Step 5 validation to fail silently.

The Brain CLI and Claude hooks use partial validation functions that check session log completeness or workflow state, but NOT the full protocol compliance (Brain MCP initialization, Brain note updates, git branch documentation, commit SHA, markdown lint).

This creates a critical gap: sessions can close without satisfying MUST requirements from SESSION-PROTOCOL.md because enforcement is bypassed.

**Pattern**: Documentation references PowerShell script, implementation provides Go package, integrations use neither for full validation.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Fix Inngest workflow to call Go package | Unblocks automated session protocol enforcement | 2 hours |
| P0 | Update Brain CLI to use `ValidateSessionProtocol` | Enables manual validation of full protocol | 1 hour |
| P1 | Add CI workflow for session protocol validation | Prevents protocol violations from merging | 3 hours |
| P1 | Update documentation to reference Go package | Eliminates confusion about PowerShell script | 1 hour |
| P2 | Add pre-commit hook for session logs | Catches violations before commit | 2 hours |

## 8. Conclusion

**Verdict**: Reject - Validation infrastructure exists but is NOT integrated

**Confidence**: High (verified via code search and function call analysis)

**Rationale**: The Go validation package provides comprehensive session protocol validation with 10 checks, but zero enforcement mechanisms call the `ValidateSessionProtocol` function. The Inngest workflow attempts to execute a non-existent PowerShell script, causing validation to fail silently. The Brain CLI and Claude hooks use partial validation functions that do not enforce the full protocol.

### User Impact

- **What changes for you**: Sessions can currently close without satisfying MUST requirements from SESSION-PROTOCOL.md. Fixing integration will block session close until all protocol steps are complete.
- **Effort required**: 2-3 hours to integrate validation into Inngest workflow and Brain CLI
- **Risk if ignored**: Protocol violations accumulate, sessions close with incomplete evidence, cross-session context is lost

## 9. Appendices

### Sources Consulted

- `packages/validation/validate-session-protocol.go` (validation implementation)
- `apps/mcp/src/inngest/workflows/sessionProtocolEnd.ts` (Inngest workflow)
- `apps/tui/cmd/validate.go` (Brain CLI validation command)
- `apps/claude-plugin/cmd/hooks/stop.go` (Claude Stop hook)
- `apps/claude-plugin/cmd/hooks/validate_session.go` (Claude validation)
- `tests/validate-session-protocol_test.go` (validation tests)

### Data Transparency

- **Found**: Go validation package with `ValidateSessionProtocol`, `ValidateSessionLog`, `ValidateSession` functions
- **Found**: Inngest workflow attempts to call PowerShell script at `scripts/Validate-SessionProtocol.ps1`
- **Found**: Brain CLI uses `ValidateSessionLog` (partial validation)
- **Found**: Claude hooks use `ValidateSession` (workflow state only)
- **Not Found**: Any caller of `ValidateSessionProtocol` (full protocol validation)
- **Not Found**: PowerShell script at `scripts/Validate-SessionProtocol.ps1`
- **Not Found**: CI workflows for session protocol validation
- **Not Found**: Pre-commit hooks for session protocol validation

### Integration Fix Details

**Inngest Workflow Fix** (`apps/mcp/src/inngest/workflows/sessionProtocolEnd.ts`):

Replace lines 293-336 (PowerShell script execution) with direct Go package call:

```typescript
import { ValidateSessionProtocol } from "../../../packages/validation/wasm";

async function runProtocolValidation(
  workingDirectory: string,
  sessionLogPath: string
): Promise<ProtocolValidationResult> {
  try {
    const result = ValidateSessionProtocol(sessionLogPath);
    return {
      exitCode: result.valid ? 0 : 1,
      passed: result.valid,
      output: result.message,
      errors: result.checks.filter(c => !c.passed).map(c => c.message),
    };
  } catch (error) {
    return {
      exitCode: 1,
      passed: false,
      output: "",
      errors: [error.message],
    };
  }
}
```

**Brain CLI Fix** (`apps/tui/cmd/validate.go`):

Change line 59 from `ValidateSessionLog` to `ValidateSessionProtocol`:

```go
result := validation.ValidateSessionProtocol(logPath)
```

**Documentation Fix**:

Update `apps/claude-plugin/agents/SESSION-PROTOCOL.md` lines 689-705 to reference Go package:

```markdown
The `packages/validation` Go package provides session protocol validation:

```bash
brain validate session --session-log .agents/sessions/2026-01-14-session-01.md
```
