# Analysis: SessionStart Hook Context Injection

## 1. Objective and Scope

**Objective**: Understand how SessionStart hook output becomes Claude agent context and identify gaps between current and required implementation.

**Scope**: Hook configuration, output format, context injection mechanism, and comparison with bootstrap command output.

## 2. Context

SessionStart hook runs on fresh session start and after context compaction. Current implementation exists in `apps/claude-plugin/cmd/hooks/session_start.go` and calls `brain bootstrap` CLI command to get semantic context. Investigation needed to verify output format meets Claude requirements and contains necessary bootstrap information.

## 3. Approach

**Methodology**: Code analysis of hook implementation, documentation research, CLI output testing, memory system research.

**Tools Used**: Read (code analysis), WebSearch (Claude docs), WebFetch (hook specification), Brain MCP search (prior research), Bash (CLI testing).

**Limitations**: Claude config file not found at expected locations, indicating hooks may not be currently active in user environment.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| Hook outputs JSON to stdout | session_start.go line 211-213 | High |
| Calls brain bootstrap CLI subprocess | session_start.go line 124 | High |
| Wraps markdown in JSON structure | session_start.go line 132-134 | High |
| Two output approaches supported | Claude hooks documentation | High |
| No character limits documented | Claude hooks documentation | Medium |
| Hooks not currently configured | ~/.claude/hooks.json check | High |

### Facts (Verified)

**Hook Output Mechanism** (session_start.go):

```go
// Lines 12-20: Output structure
type SessionStartOutput struct {
    Success       bool               `json:"success"`
    Project       string             `json:"project,omitempty"`
    GitContext    *GitContextInfo    `json:"gitContext,omitempty"`
    BootstrapInfo map[string]any     `json:"bootstrapInfo,omitempty"`
    WorkflowState *WorkflowStateInfo `json:"workflowState,omitempty"`
    Error         string             `json:"error,omitempty"`
}

// Lines 211-213: JSON encoding to stdout
encoder := json.NewEncoder(os.Stdout)
encoder.SetIndent("", "  ")
return encoder.Encode(output)
```

**Bootstrap Context Retrieval** (session_start.go lines 117-136):

```go
func getBootstrapContext(project string) (map[string]any, error) {
    args := []string{"bootstrap"}
    if project != "" {
        args = append(args, "-p", project)
    }
    
    cmd := ExecCommandSession("brain", args...)
    output, err := cmd.Output()
    if err != nil {
        return nil, fmt.Errorf("brain bootstrap failed: %w", err)
    }
    
    // brain bootstrap returns Markdown, not JSON
    // Return the raw markdown content for Claude to parse
    result := map[string]any{
        "markdown": string(output),
    }
    
    return result, nil
}
```

**Brain Bootstrap Implementation** (bootstrap.go lines 35-62):

```go
func runBootstrap(cmd *cobra.Command, args []string) error {
    brainClient, err := client.EnsureServerRunning()
    if err != nil {
        return err
    }
    
    toolArgs := map[string]interface{}{
        "timeframe":          bootstrapTimeframe, // default: "5d"
        "include_referenced": true,
    }
    if bootstrapProject != "" {
        toolArgs["project"] = bootstrapProject
    }
    
    // Call the tool
    result, err := brainClient.CallTool("bootstrap_context", toolArgs)
    if err != nil {
        return err
    }
    
    // Output result to stdout
    fmt.Println(result.GetText())
    return nil
}
```

**Claude Hooks Documentation** (code.claude.com/docs/en/hooks):

Two output approaches supported:

1. **Plain Text stdout**: Any non-JSON text written to stdout with exit code 0 automatically added as context
2. **JSON with additionalContext**: Structured format allows combining with other fields

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "Context text here"
  }
}
```

Key characteristics:

- Only exit code 0 processes output
- Multiple hooks' additionalContext values concatenated
- No explicit character limits documented
- Context available for entire session

### Hypotheses (Unverified)

**Hook Configuration Status**: Hooks may not be actively configured in user environment based on:

- Missing ~/.claude/config.json
- Missing ~/.config/claude/config.json
- Only pre-compact hook found in ~/.claude/hooks.json

**Bootstrap Output Format**: Current implementation wraps markdown in JSON but does NOT use the hookSpecificOutput.additionalContext structure documented by Claude.

## 5. Results

### Current Implementation Output Structure

SessionStart hook outputs this JSON format:

```json
{
  "success": true,
  "project": "brain",
  "gitContext": {
    "branch": "main",
    "recentCommits": ["abc123 commit message", "..."],
    "status": "clean"
  },
  "bootstrapInfo": {
    "markdown": "## Memory Context [v6]\n**Project:** brain\n..."
  },
  "workflowState": {
    "mode": "analysis",
    "task": "...",
    "sessionId": "..."
  }
}
```

### Brain Bootstrap Output Format

Bootstrap CLI command outputs markdown directly:

```markdown
## Memory Context [v6]

**Project:** brain
**Retrieved:** 1/19/2026, 4:14:34 AM

### Active Features

- Feature-Auth: Authentication implementation
  - Status: IN_PROGRESS
  - Phases: 3 total, 2 complete
  
### Recent Decisions

- ADR-001: Use PostgreSQL for persistence
  - Rationale: ...
  
### Open Bugs

- BUG-042: Memory leak in search
  - Severity: HIGH
```

### Gap Analysis: Current vs Required

| Aspect | Current | Required | Gap |
|--------|---------|----------|-----|
| **Output Format** | Custom JSON structure | hookSpecificOutput.additionalContext | Format mismatch |
| **Bootstrap Call** | CLI subprocess | MCP tool (bootstrap_context) | Already using MCP via CLI |
| **Markdown Wrapping** | Nested in bootstrapInfo.markdown | Direct in additionalContext | Unnecessary nesting |
| **Git Context** | Included separately | Could be in markdown | Works but fragmented |
| **Workflow State** | Included separately | Could be in markdown | Works but fragmented |
| **Character Limit** | None enforced | None documented | No issue |
| **Depth Parameter** | Not used | depth=3 recommended | Missing graph traversal |
| **Startup vs Compact** | Same code | Different strategies | Missing differentiation |

### Current vs Documented Format

**Current implementation** outputs:

```json
{
  "success": true,
  "project": "brain",
  "bootstrapInfo": {
    "markdown": "..."
  }
}
```

**Documented format** expects:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "..."
  }
}
```

**Format Mismatch Severity**: Medium - Current format may work (plain stdout alternative), but does not follow documented JSON structure.

## 6. Discussion

### How Hook Output Becomes Context

Claude Code SessionStart hooks have two mechanisms:

1. **Plain Text Approach**: Non-JSON stdout automatically added as context
2. **JSON Approach**: hookSpecificOutput.additionalContext field extracted and added

Current implementation uses JSON but NOT the documented structure. This suggests either:

- Implementation predates current documentation
- Plain text fallback mechanism processes the output
- Claude extracts text content from any JSON structure

### Bootstrap Content Quality

Brain bootstrap command calls MCP `bootstrap_context` tool which provides:

- Active features with phases and tasks
- Recent decisions (5 day timeframe default)
- Open bugs
- Referenced notes
- Project identification

This content is semantically rich and appropriate for session initialization. The quality of WHAT is provided is good.

### Format Architecture Decision

Current architecture calls brain CLI as subprocess, which internally uses MCP client. This adds process overhead but maintains separation of concerns:

- Hook implementation: lightweight Go binary
- Bootstrap logic: maintained in brain CLI
- Memory access: handled by MCP server

Alternative would be hook directly calling MCP tools, requiring MCP client library in Go.

### Startup vs Compact Differentiation

Current implementation runs identical code for both matchers. Research (Brain memory: specs/context-bootstrap-design) recommends:

- **startup**: Recent 5 days + all-time important entities (depth 3)
- **compact**: Same as startup PLUS current day emphasis (depth 2)

This differentiation is missing from current implementation.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P1 | Fix output format to use hookSpecificOutput.additionalContext | Aligns with documented Claude API | Small (30 min) |
| P1 | Verify hooks are actually configured in user environment | Evidence suggests hooks not active | Small (15 min) |
| P2 | Add matcher differentiation (startup vs compact) | Post-compaction needs different context depth | Medium (2 hours) |
| P2 | Pass depth parameter to bootstrap_context tool | Enables graph traversal for richer context | Small (30 min) |
| P3 | Consider consolidating git/workflow into markdown | Single unified context block | Small (1 hour) |

### Recommended Output Format Change

**Current** (session_start.go lines 208-213):

```go
func RunSessionStart() error {
    output := buildSessionOutput()
    encoder := json.NewEncoder(os.Stdout)
    encoder.SetIndent("", "  ")
    return encoder.Encode(output)
}
```

**Recommended**:

```go
func RunSessionStart() error {
    output := buildSessionOutput()
    
    // Format as Claude hook specification requires
    hookOutput := map[string]interface{}{
        "hookSpecificOutput": map[string]interface{}{
            "hookEventName": "SessionStart",
            "additionalContext": formatContextMarkdown(output),
        },
    }
    
    encoder := json.NewEncoder(os.Stdout)
    encoder.SetIndent("", "  ")
    return encoder.Encode(hookOutput)
}

func formatContextMarkdown(output *SessionStartOutput) string {
    var sb strings.Builder
    
    // Git context
    if output.GitContext != nil {
        sb.WriteString(fmt.Sprintf("**Branch:** %s\n", output.GitContext.Branch))
        sb.WriteString(fmt.Sprintf("**Status:** %s\n\n", output.GitContext.Status))
    }
    
    // Bootstrap markdown
    if markdown, ok := output.BootstrapInfo["markdown"].(string); ok {
        sb.WriteString(markdown)
        sb.WriteString("\n\n")
    }
    
    // Workflow state
    if output.WorkflowState != nil && output.WorkflowState.Mode != "" {
        sb.WriteString(fmt.Sprintf("**Current Mode:** %s\n", output.WorkflowState.Mode))
        if output.WorkflowState.Task != "" {
            sb.WriteString(fmt.Sprintf("**Active Task:** %s\n", output.WorkflowState.Task))
        }
    }
    
    return sb.String()
}
```

### Matcher Differentiation Implementation

Add matcher parameter to bootstrap command:

```go
func getBootstrapContext(project string, matcher string) (map[string]any, error) {
    args := []string{"bootstrap"}
    if project != "" {
        args = append(args, "-p", project)
    }
    
    // Add matcher-specific flags
    switch matcher {
    case "startup":
        args = append(args, "--depth", "3", "--timeframe", "5d")
    case "compact":
        args = append(args, "--depth", "2", "--timeframe", "today", "--include-recent", "5d")
    }
    
    // ... rest of implementation
}
```

This requires brain bootstrap CLI to support depth and matcher-aware flags.

## 8. Conclusion

**Verdict**: Proceed with format fix
**Confidence**: High
**Rationale**: Current implementation produces rich semantic context but uses non-standard output format. Format fix is low-effort, high-value change.

### User Impact

**What changes for you**: SessionStart hook will inject context using documented Claude API format, ensuring compatibility with future Claude versions.

**Effort required**: 30-60 minutes for format fix, 2-4 hours for full matcher differentiation.

**Risk if ignored**: Current format may break with future Claude updates. Matcher differentiation gap means post-compaction recovery is suboptimal.

### Critical Path

1. **Immediate**: Verify hooks are configured (check why no config found)
2. **Short-term**: Fix output format to use hookSpecificOutput.additionalContext
3. **Medium-term**: Add matcher differentiation (startup vs compact)
4. **Long-term**: Consider MCP tool depth parameter support

### Data Quality Assessment

Bootstrap content quality: **High** - Provides active features, decisions, bugs, referenced notes with 5-day timeframe.

Format compliance: **Medium** - Works but doesn't match documented API structure.

Matcher differentiation: **Low** - Missing recommended distinction between startup and compact contexts.

## 9. Appendices

### Sources Consulted

- apps/claude-plugin/cmd/hooks/session_start.go (implementation)
- apps/tui/cmd/bootstrap.go (CLI bootstrap command)
- Brain memory: research/context-bootstrap/claude-code-hooks-research
- Brain memory: specs/context-bootstrap-design
- Brain memory: research/context-bootstrap/current-bootstrap-script-analysis
- [Claude Code Hooks Documentation](https://code.claude.com/docs/en/hooks)
- [SessionStart hook stdout bug report](https://github.com/anthropics/claude-code/issues/13650)

### Data Transparency

**Found**:

- Hook implementation code (session_start.go)
- Bootstrap CLI implementation (bootstrap.go)
- Claude hooks documentation with JSON structure
- Brain memory research on bootstrap design
- Test coverage for hook functions

**Not Found**:

- Active hooks configuration in user environment (~/.claude/config.json)
- Evidence of hooks actually running
- Character limit specifications
- Claude internal context injection mechanism details
