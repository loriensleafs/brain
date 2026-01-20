<!-- markdownlint-disable MD013 -->
<!-- markdownlint-disable MD060 -->

# Analysis: Session Start Hook Gaps

## 1. Objective and Scope

**Objective**: Identify gaps between current session_start.go implementation and SESSION-PROTOCOL.md requirements, evaluate Brain CLI usage, and document correct implementation.

**Scope**: Analysis of session_start.go file, comparison with SESSION-PROTOCOL.md Phase 0-4 requirements, Brain CLI command evaluation, and implementation recommendations.

## 2. Context

The session_start.go hook is executed by Claude Code at the beginning of each session. It provides bootstrap context and workflow state to initialize agent context. User concerns indicate the current implementation does not use Brain CLI commands properly and may be missing required session protocol steps.

## 3. Approach

**Methodology**: Code review, protocol comparison, Brain CLI command testing, gap identification

**Tools Used**:

- Read tool for session_start.go analysis
- Read tool for SESSION-PROTOCOL.md review
- Bash tool for Brain CLI command testing
- Brain CLI v1.0.0 (confirmed available at /Users/peter.kloss/.local/bin/brain)

**Limitations**: Cannot test hook execution in Claude Code environment, recommendations based on protocol requirements and Brain CLI documentation only.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| Brain CLI available with session and bootstrap commands | `brain --help` output | High |
| Current implementation uses file system scanning for workflow state | session_start.go lines 90-114 | High |
| Current implementation attempts `brain context` and `brain status` (non-existent commands) | session_start.go lines 71-79 | High |
| SESSION-PROTOCOL requires Brain MCP initialization, not Brain CLI | SESSION-PROTOCOL.md lines 60-77 | High |
| Session protocol requires project identification FIRST | SESSION-PROTOCOL.md Phase 0, lines 51-59 | High |
| Hooks CAN prompt users | User statement in task description | Medium |

### Facts (Verified)

#### Available Brain CLI Commands

**Confirmed via `brain --help`**:

```text
Available Commands:
  bootstrap   Bootstrap semantic context for session initialization
  session     Get current session state
  workflow    Workflow state management commands
```

**`brain session` output format** (JSON):

```json
{
  "mode": "analysis"
}
```

**`brain bootstrap` output format** (Markdown):

```markdown
## Memory Context [v6]

**Project:** brain
**Retrieved:** 1/19/2026, 4:14:34 AM

### Active Features

- Feature notes...

### Recent Activity

- Recent notes...
```

**`brain bootstrap` auto-detection**:

- Uses `-p, --project string` flag
- Auto-detects project if not specified
- How auto-detection works: Not documented in help output

#### Current Implementation Analysis

**session_start.go structure**:

1. **Line 31-60**: `RunSessionStart()` - Main entry point
   - Calls `getBootstrapContext()` (lines 37-45)
   - Calls `loadWorkflowState()` (lines 48-54)
   - Returns JSON output

2. **Lines 62-88**: `getBootstrapContext()` - Attempts Brain CLI bootstrap
   - **Line 71**: Tries `brain context --format json` (INCORRECT - command does not exist)
   - **Line 75**: Falls back to `brain status --json` (INCORRECT - command does not exist)
   - **Lines 78-79**: Returns error if both fail

3. **Lines 90-115**: `loadWorkflowState()` - File system scanning
   - Scans multiple file locations:
     - `~/.brain/workflow-state.json`
     - `~/.claude/workflow-state.json`
     - `.brain/workflow-state.json`
     - `.claude/workflow-state.json`
   - Uses `BRAIN_STATE_DIR` environment variable if set
   - Parses JSON into `WorkflowStateInfo` struct

**Problems identified**:

1. **Wrong Brain CLI commands**: Uses `brain context` and `brain status` (neither exist)
2. **Should use**: `brain bootstrap` and `brain session`
3. **File system scanning**: Hardcoded paths instead of using Brain CLI
4. **No project identification**: Does not attempt to identify active project
5. **No user prompting**: Cannot ask user which project if auto-detection fails

#### SESSION-PROTOCOL Requirements

**Phase 0: Get oriented (lines 51-59)**:

```markdown
1. MUST run `git branch --show-current` to verify correct branch
2. MUST verify branch matches intended work context
3. MUST NOT proceed on main/master (create feature branch first)
4. MUST check recent commits `git log --oneline -5`
```

**Phase 1: Brain Initialization (lines 60-77)**:

```markdown
1. MUST call `mcp__plugin_brain_brain__bootstrap_context` (Brain MCP, not Brain CLI)
2. MUST load initial context via `mcp__plugin_brain_brain__read_note`
3. MUST NOT read files/search code until initialization succeeds
4. If initialization fails, MUST report failure and stop
```

**Phase 2: Context Retrieval (lines 79-111)**:

```markdown
1. MUST read memory-index note
2. MUST read notes from memory-index matching task keywords
3. MUST search Brain notes for cross-session context
4. SHOULD read PROJECT-PLAN.md if working on enhancement
```

**Phase 3: Import Shared Notes (lines 113-136)**:

```markdown
1. SHOULD run import script if available
2. SHOULD document import count
3. MAY skip if no note files present
```

**Phase 4: Skill Validation (lines 138-162)**:

```markdown
1. MUST verify .claude/skills/ directory exists
2. MUST list GitHub skill scripts
3. MUST read usage-mandatory note
4. MUST read PROJECT-CONSTRAINTS.md
5. MUST document skills in session log
```

**Phase 5: Session Log Creation (lines 164-180)**:

```markdown
1. MUST create session log at .agents/sessions/YYYY-MM-DD-session-NN.md
2. SHOULD create within first 5 tool calls
3. MUST include Protocol Compliance section
```

### Hypotheses (Unverified)

- Brain CLI `brain bootstrap` auto-detection uses current working directory to identify project
- Session hooks can access environment variables for project identification
- Claude Code may provide project context via environment variables or stdin

## 5. Results

### Current vs Expected Behavior

| Concern | Current Behavior | Expected Behavior | Gap Severity |
|---------|------------------|-------------------|--------------|
| **loadWorkflowState** | Scans file system for workflow-state.json | Use `brain session` command | High |
| **getBootstrapContext** | Uses `brain context` (non-existent) | Use `brain bootstrap` command | Critical |
| **Project Identification** | No project identification attempt | SHOULD identify active project first, prompt user if unable | High |
| **Missing Protocol Steps** | Only provides bootstrap + workflow state | Hook cannot execute Brain MCP tools (those are for Claude agent), but should provide richer context | Medium |

### Missing Session Protocol Steps

**Steps the hook CANNOT execute** (require Claude agent with Brain MCP access):

- Phase 1: Brain MCP initialization (`mcp__plugin_brain_brain__bootstrap_context`)
- Phase 2: Context retrieval (Brain MCP read/search operations)
- Phase 3: Import shared notes (requires PowerShell script execution)
- Phase 4: Skill validation (requires file system access and note reading)
- Phase 5: Session log creation (requires file write access)

**Steps the hook COULD provide**:

- Phase 0: Git branch verification and recent commits (pass to agent)
- Workflow state from Brain CLI (not file system)
- Bootstrap context from Brain CLI (correct command)
- Project identification (auto-detect or prompt)

**Conclusion**: The hook's role is to provide **initial context** to the agent. The agent (orchestrator or bootstrap command) is responsible for executing the full session protocol. The hook should provide the best possible starting context using Brain CLI.

### Correct Brain CLI Commands

| Current (Wrong) | Correct | Purpose |
|----------------|---------|---------|
| `brain context --format json` | `brain bootstrap -p [project]` | Get semantic context (features, decisions, bugs) |
| `brain status --json` | `brain session` | Get current workflow state (mode, task) |
| File system scan for workflow state | `brain session` | Session state includes workflow mode |

## 6. Discussion

### Key Issues

1. **Wrong Commands**: The hook attempts to use Brain CLI commands that do not exist. This causes the bootstrap context to always fail with error.

2. **File System Coupling**: The workflow state loader scans multiple hardcoded paths. This creates fragility and bypasses the Brain CLI abstraction.

3. **No Project Context**: The hook does not identify which project is active. Brain CLI's `brain bootstrap` can auto-detect projects, but if auto-detection fails, there is no fallback to prompt the user.

4. **Limited Output**: The hook only returns bootstrap info and workflow state. It could provide git branch context and other session initialization data.

### Protocol vs Hook Responsibilities

**Important distinction**: SESSION-PROTOCOL.md defines requirements for the **Claude agent** (orchestrator/bootstrap), not the hook. The hook's role is to provide initial context BEFORE the agent starts executing the protocol.

**Hook responsibilities**:

- Provide project identification (auto-detect or prompt)
- Provide git context (branch, recent commits)
- Provide Brain CLI bootstrap context
- Provide Brain CLI session state
- Return JSON output for Claude to consume

**Agent responsibilities** (cannot be in hook):

- Execute Brain MCP initialization
- Read Brain notes
- Create session log
- Execute full protocol checklist

### Brain CLI vs Brain MCP

**Brain CLI** (`brain` command):

- Read-only queries
- Markdown/JSON output
- Available in hooks (shell executable)
- Used for: `brain bootstrap`, `brain session`

**Brain MCP** (`mcp__plugin_brain_brain__*` tools):

- Read/write operations
- Available in Claude agent context
- Used for: Note CRUD, semantic search, knowledge graph
- NOT available in hooks

The hook should use Brain CLI. The agent uses Brain MCP.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Fix `getBootstrapContext()` to use `brain bootstrap` | Critical bug - current commands do not exist | Low (single line change) |
| P0 | Fix `loadWorkflowState()` to use `brain session` | Removes file system coupling, uses proper abstraction | Medium (replace function logic) |
| P1 | Add project identification as FIRST step | Enables Brain CLI to return project-specific context | Medium (new function, prompt handling) |
| P1 | Add git context to output (branch, recent commits) | Provides Phase 0 context for agent | Low (add git commands) |
| P2 | Add environment variable support for project override | Allows explicit project specification without prompting | Low (check env var) |

### P0: Fix getBootstrapContext()

**Current**:

```go
cmd := exec.Command(brainPath, "context", "--format", "json")
// Fallback
cmd = exec.Command(brainPath, "status", "--json")
```

**Corrected**:

```go
// Try auto-detection first
cmd := exec.Command(brainPath, "bootstrap")
output, err := cmd.Output()
if err != nil {
    return nil, fmt.Errorf("brain bootstrap failed: %w", err)
}

// Parse markdown output (bootstrap returns markdown, not JSON)
// Return as map[string]any with "markdown" key
result := map[string]any{
    "markdown": string(output),
}
return result, nil
```

**Note**: `brain bootstrap` returns Markdown, not JSON. The hook should return the raw Markdown for Claude to parse.

### P0: Fix loadWorkflowState()

**Current**: Scans file system for workflow-state.json

**Corrected**:

```go
func loadWorkflowState() (*WorkflowStateInfo, error) {
    brainPath, err := exec.LookPath("brain")
    if err != nil {
        return nil, fmt.Errorf("brain CLI not found")
    }

    cmd := exec.Command(brainPath, "session")
    output, err := cmd.Output()
    if err != nil {
        return nil, fmt.Errorf("brain session failed: %w", err)
    }

    var state WorkflowStateInfo
    if err := json.Unmarshal(output, &state); err != nil {
        return nil, fmt.Errorf("failed to parse session state: %w", err)
    }

    return &state, nil
}
```

**Expected JSON structure** (based on `brain session` output):

```json
{
  "mode": "analysis"
}
```

The `WorkflowStateInfo` struct may need updates to match actual session output schema.

### P1: Add Project Identification

**New function**:

```go
// identifyProject attempts to identify the active project
// Returns project name, or error if unable to identify
func identifyProject() (string, error) {
    // 1. Check BRAIN_PROJECT environment variable
    if project := os.Getenv("BRAIN_PROJECT"); project != "" {
        return project, nil
    }

    // 2. Try brain bootstrap auto-detection with empty project
    brainPath, err := exec.LookPath("brain")
    if err != nil {
        return "", fmt.Errorf("brain CLI not found")
    }

    // brain bootstrap auto-detects project from cwd
    cmd := exec.Command(brainPath, "bootstrap")
    output, err := cmd.Output()
    if err != nil {
        // Auto-detection failed
        return "", fmt.Errorf("auto-detection failed: %w", err)
    }

    // Parse project from bootstrap output
    // Expected format: "**Project:** brain"
    outputStr := string(output)
    if strings.Contains(outputStr, "**Project:**") {
        lines := strings.Split(outputStr, "\n")
        for _, line := range lines {
            if strings.HasPrefix(line, "**Project:**") {
                parts := strings.Split(line, ":")
                if len(parts) >= 2 {
                    project := strings.TrimSpace(parts[1])
                    return project, nil
                }
            }
        }
    }

    return "", fmt.Errorf("could not parse project from bootstrap output")
}
```

**Prompt user if auto-detection fails** (user confirmed hooks CAN prompt):

```go
// If identifyProject returns error, prompt user
fmt.Fprintln(os.Stderr, "Unable to identify active project.")
fmt.Fprintln(os.Stderr, "Enter project name (or press Enter to skip):")
reader := bufio.NewReader(os.Stdin)
project, _ := reader.ReadString('\n')
project = strings.TrimSpace(project)
if project == "" {
    // User skipped, continue without project
    project = "unknown"
}
```

**Integration in RunSessionStart()**:

```go
func RunSessionStart() error {
    output := SessionStartOutput{
        Success: true,
    }

    // FIRST: Identify project
    project, err := identifyProject()
    if err != nil {
        // Prompt user (if stderr is available)
        project = promptForProject()
    }
    output.Project = project

    // Get bootstrap context with project
    bootstrapInfo, err := getBootstrapContextWithProject(project)
    // ... rest of function
}
```

### P1: Add Git Context

**New function**:

```go
type GitContextInfo struct {
    Branch        string   `json:"branch"`
    RecentCommits []string `json:"recentCommits"`
    Status        string   `json:"status"`
}

func getGitContext() (*GitContextInfo, error) {
    context := &GitContextInfo{}

    // Get current branch
    cmd := exec.Command("git", "branch", "--show-current")
    output, err := cmd.Output()
    if err == nil {
        context.Branch = strings.TrimSpace(string(output))
    }

    // Get recent commits
    cmd = exec.Command("git", "log", "--oneline", "-5")
    output, err = cmd.Output()
    if err == nil {
        lines := strings.Split(strings.TrimSpace(string(output)), "\n")
        context.RecentCommits = lines
    }

    // Get status
    cmd = exec.Command("git", "status", "--porcelain")
    output, err = cmd.Output()
    if err == nil {
        if len(output) == 0 {
            context.Status = "clean"
        } else {
            context.Status = "dirty"
        }
    }

    return context, nil
}
```

**Add to SessionStartOutput**:

```go
type SessionStartOutput struct {
    Success       bool               `json:"success"`
    Project       string             `json:"project,omitempty"`
    GitContext    *GitContextInfo    `json:"gitContext,omitempty"`
    BootstrapInfo map[string]any     `json:"bootstrapInfo,omitempty"`
    WorkflowState *WorkflowStateInfo `json:"workflowState,omitempty"`
    Error         string             `json:"error,omitempty"`
}
```

### Implementation Summary

**Corrected session_start.go workflow**:

```text
1. Identify project (auto-detect or prompt)
2. Get git context (branch, commits, status)
3. Call `brain bootstrap -p [project]` for semantic context
4. Call `brain session` for workflow state
5. Return JSON with all context
```

**Output JSON schema**:

```json
{
  "success": true,
  "project": "brain",
  "gitContext": {
    "branch": "main",
    "recentCommits": [
      "abc123d chore: initial commit"
    ],
    "status": "clean"
  },
  "bootstrapInfo": {
    "markdown": "## Memory Context [v6]\n..."
  },
  "workflowState": {
    "mode": "analysis"
  }
}
```

## 8. Conclusion

**Verdict**: Significant gaps exist between current implementation and Brain CLI capabilities. Critical bugs prevent hook from functioning correctly.

**Confidence**: High

**Rationale**: Current implementation uses non-existent Brain CLI commands (`brain context`, `brain status`) and bypasses Brain CLI with file system scanning. Correct commands (`brain bootstrap`, `brain session`) are available and documented. Project identification is missing, which should be the FIRST step.

### User Impact

**What changes for you**: Session start hook will provide accurate project context, git state, and Brain semantic context instead of errors.

**Effort required**: P0 fixes are low-effort (single function rewrites). P1 enhancements require new functions but follow established patterns.

**Risk if ignored**: Hook continues to return errors or empty context, forcing agents to operate without session initialization data. This violates SESSION-PROTOCOL Phase 0 requirements.

## 9. Appendices

### Sources Consulted

- `/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd/hooks/session_start.go` - Current implementation
- `/Users/peter.kloss/Dev/brain/apps/claude-plugin/agents/SESSION-PROTOCOL.md` - Protocol requirements
- `brain --help` - Brain CLI command reference
- `brain session --help` - Session command documentation
- `brain bootstrap --help` - Bootstrap command documentation
- `brain session` - Live command output testing
- `brain bootstrap -p brain` - Live command output testing

### Data Transparency

**Found**:

- Brain CLI commands: bootstrap, session, workflow
- Bootstrap output format (Markdown with project, features, recent activity)
- Session output format (JSON with mode field)
- Hook responsibilities vs agent responsibilities distinction

**Not Found**:

- Brain CLI auto-detection algorithm (how it identifies project from cwd)
- Complete session state schema (only observed `mode` field)
- Environment variables Claude Code provides to hooks
- Whether hooks have access to stdin for user prompts (user confirmed they do)
