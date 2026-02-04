package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

// HookInput represents the JSON input from Claude Code hooks.
// Claude Code sends this via stdin when invoking hooks.
type HookInput struct {
	SessionID string `json:"session_id"`
	CWD       string `json:"cwd"`
}

// SessionStartOutput represents the internal output structure (used during processing)
type SessionStartOutput struct {
	Success       bool               `json:"success"`
	Project       string             `json:"project,omitempty"`
	GitContext    *GitContextInfo    `json:"gitContext,omitempty"`
	BootstrapInfo map[string]any     `json:"bootstrapInfo,omitempty"`
	WorkflowState *WorkflowStateInfo `json:"workflowState,omitempty"`
	OpenSessions  []OpenSession      `json:"openSessions,omitempty"`
	ActiveSession *ActiveSession     `json:"activeSession,omitempty"`
	Error         string             `json:"error,omitempty"`
}

// HookSpecificOutput represents Claude Code's expected hook output structure
type HookSpecificOutput struct {
	HookEventName     string `json:"hookEventName"`
	AdditionalContext string `json:"additionalContext"`
}

// HookOutput represents the top-level Claude Code hook response
type HookOutput struct {
	HookSpecificOutput HookSpecificOutput `json:"hookSpecificOutput"`
}

// GitContextInfo contains git repository context
type GitContextInfo struct {
	Branch        string   `json:"branch,omitempty"`
	RecentCommits []string `json:"recentCommits,omitempty"`
	Status        string   `json:"status,omitempty"`
}

// WorkflowStateInfo represents workflow state information
type WorkflowStateInfo struct {
	Mode        string `json:"mode,omitempty"`
	Description string `json:"description,omitempty"`
	SessionID   string `json:"sessionId,omitempty"`
	UpdatedAt   string `json:"updatedAt,omitempty"`
	Task        string `json:"task,omitempty"`
}

// OpenSession represents a session with status: IN_PROGRESS or PAUSED
// Matches TypeScript type from apps/mcp/src/services/session/types.ts
type OpenSession struct {
	SessionID string `json:"sessionId"`
	Status    string `json:"status"` // "IN_PROGRESS" or "PAUSED"
	Date      string `json:"date"`
	Branch    string `json:"branch,omitempty"`
	Topic     string `json:"topic,omitempty"`
	Permalink string `json:"permalink"`
}

// ActiveSession represents the currently active session (status: IN_PROGRESS)
// Only ONE session can be active at a time.
// Matches TypeScript type from apps/mcp/src/services/session/types.ts
type ActiveSession struct {
	SessionID string                   `json:"sessionId"`
	Status    string                   `json:"status"` // Always "IN_PROGRESS"
	Path      string                   `json:"path"`
	Mode      string                   `json:"mode,omitempty"`
	Task      string                   `json:"task,omitempty"`
	Branch    string                   `json:"branch,omitempty"`
	Date      string                   `json:"date"`
	Topic     string                   `json:"topic,omitempty"`
	IsValid   bool                     `json:"isValid"`
	Checks    []SessionValidationCheck `json:"checks"`
}

// SessionValidationCheck represents a single validation check result
type SessionValidationCheck struct {
	Name   string `json:"name"`
	Passed bool   `json:"passed"`
}

// BootstrapMetadata contains metadata about the bootstrap context
type BootstrapMetadata struct {
	Project     string `json:"project"`
	GeneratedAt string `json:"generated_at"`
	NoteCount   int    `json:"note_count"`
	Timeframe   string `json:"timeframe"`
}

// BootstrapResponse represents the structured JSON output from bootstrap_context
// Matches the StructuredContent interface from structuredOutput.ts
type BootstrapResponse struct {
	Metadata      BootstrapMetadata `json:"metadata"`
	OpenSessions  []OpenSession     `json:"open_sessions"`
	ActiveSession *ActiveSession    `json:"active_session"`
	// Other fields omitted - we only need session data
}

// ExecCommandSession is a variable holding the exec.Command function.
// This allows tests to override the command execution.
var ExecCommandSession = exec.Command

// identifyProject attempts to identify the active project for session start.
// Uses the resolution hierarchy:
// 1. BM_PROJECT env var
// 2. BM_ACTIVE_PROJECT env var (legacy)
// 3. BRAIN_PROJECT env var (Go-specific, backwards compatibility)
// 4. CWD match against code_paths from ~/.config/brain/config.json
// 5. Returns error (caller should prompt user)
//
// The cwd parameter allows overriding the working directory for project resolution.
// When empty, falls back to os.Getwd().
func identifyProject(cwd string) (string, error) {
	// Resolve CWD if not provided
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return "", fmt.Errorf("could not get working directory: %w", err)
		}
	}

	// Use unified resolution with CWD matching
	project := resolveProjectWithCwd("", cwd)
	if project != "" {
		return project, nil
	}

	return "", fmt.Errorf("could not identify project from environment or CWD")
}

// getGitContext retrieves git repository context for Phase 0 requirements.
func getGitContext() (*GitContextInfo, error) {
	context := &GitContextInfo{}

	// Get current branch
	cmd := ExecCommandSession("git", "branch", "--show-current")
	output, err := cmd.Output()
	if err == nil {
		context.Branch = strings.TrimSpace(string(output))
	}

	// Get recent commits (last 5)
	cmd = ExecCommandSession("git", "log", "--oneline", "-5")
	output, err = cmd.Output()
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		if len(lines) > 0 && lines[0] != "" {
			context.RecentCommits = lines
		}
	}

	// Get working tree status
	cmd = ExecCommandSession("git", "status", "--porcelain")
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

// BootstrapContextResult contains both raw markdown and parsed session data
type BootstrapContextResult struct {
	Markdown      string
	OpenSessions  []OpenSession
	ActiveSession *ActiveSession
	ParsedJSON    bool // true if structured JSON was successfully parsed
}

// getBootstrapContext calls the brain CLI bootstrap command to get semantic context.
// Returns both raw markdown and parsed session data (if JSON parsing succeeds).
func getBootstrapContext(project string) (*BootstrapContextResult, error) {
	// Build command args - include project if specified
	args := []string{"bootstrap"}
	if project != "" {
		args = append(args, "-p", project)
	}

	cmd := ExecCommandSession("brain", args...)
	output, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("brain bootstrap failed: %w", err)
	}

	result := &BootstrapContextResult{
		Markdown: string(output),
	}

	// Try to parse as JSON first (new bootstrap_context format)
	// If JSON parsing fails, fall back to markdown parsing
	var bootstrapResp BootstrapResponse
	if err := json.Unmarshal(output, &bootstrapResp); err == nil {
		// Successfully parsed as JSON
		result.OpenSessions = bootstrapResp.OpenSessions
		result.ActiveSession = bootstrapResp.ActiveSession
		result.ParsedJSON = true
	}

	return result, nil
}

// parseOpenSessionsFromMarkdown extracts open sessions from bootstrap markdown output.
// LEGACY: Used as fallback when JSON parsing fails.
// Looks for the "### Session State" section and parses session entries.
// Format: - SESSION-YYYY-MM-DD_NN-topic (STATUS) (branch: `branch-name`)
func parseOpenSessionsFromMarkdown(markdown string) []OpenSession {
	var sessions []OpenSession

	// Find the Session State section (new format)
	sectionStart := strings.Index(markdown, "### Session State")
	if sectionStart == -1 {
		// Try legacy format
		sectionStart = strings.Index(markdown, "### Open Sessions")
		if sectionStart == -1 {
			return sessions
		}
	}

	// Find the end of the section (next ### or end of string)
	sectionContent := markdown[sectionStart:]
	nextSection := strings.Index(sectionContent[3:], "###") // Skip the "###" we found
	if nextSection != -1 {
		sectionContent = sectionContent[:nextSection+3]
	}

	// Parse session entries (new format): - SESSION-ID - topic (STATUS) (branch: `branch-name`)
	// Also supports: - [[SESSION-ID]] (branch: `branch-name`)
	sessionPattern := regexp.MustCompile(`-\s*(?:\[\[)?([^\]\s(]+(?:\s*-\s*[^\](\s]+)?)(?:\]\])?\s*(?:-\s*([^(]+))?\s*\((IN_PROGRESS|PAUSED|in_progress|paused)\)(?:\s*\(branch:\s*` + "`" + `?([^` + "`" + `\)]+)` + "`" + `?\))?`)
	matches := sessionPattern.FindAllStringSubmatch(sectionContent, -1)

	for _, match := range matches {
		if len(match) < 4 {
			continue
		}

		sessionID := strings.TrimSpace(match[1])
		topic := ""
		if len(match) > 2 && match[2] != "" {
			topic = strings.TrimSpace(match[2])
		}
		status := strings.ToUpper(strings.TrimSpace(match[3]))

		session := OpenSession{
			SessionID: sessionID,
			Status:    status,
			Topic:     topic,
		}

		// Extract date from session ID (SESSION-YYYY-MM-DD pattern)
		datePattern := regexp.MustCompile(`(\d{4}-\d{2}-\d{2})`)
		if dateMatch := datePattern.FindStringSubmatch(sessionID); len(dateMatch) > 1 {
			session.Date = dateMatch[1]
		}

		// Extract branch if present
		if len(match) > 4 && match[4] != "" {
			session.Branch = strings.TrimSpace(match[4])
		}

		sessions = append(sessions, session)
	}

	return sessions
}

// formatSessionInstructions generates mandatory instructions for Claude when no active session exists.
// Per FEATURE-001-session-management: Hooks CANNOT create or resume sessions directly.
// Hook provides instructions to AI, AI uses AskUserQuestion and MCP session tools.
func formatSessionInstructions(openSessions []OpenSession) string {
	var sb strings.Builder

	sb.WriteString("DO THE FOLLOWING IMMEDIATELY, without waiting for user input, BEFORE anything else:\n\n")

	if len(openSessions) > 0 {
		// Open sessions exist - present options to user
		sb.WriteString("### Open Sessions Detected\n\n")
		sb.WriteString(fmt.Sprintf("Found %d session(s) that can be resumed:\n\n", len(openSessions)))

		for i, session := range openSessions {
			displayName := session.SessionID
			if session.Topic != "" {
				displayName = fmt.Sprintf("%s - %s", session.SessionID, session.Topic)
			}
			sb.WriteString(fmt.Sprintf("%d. **%s** (%s)\n", i+1, displayName, session.Status))
			if session.Date != "" {
				sb.WriteString(fmt.Sprintf("   - Date: %s\n", session.Date))
			}
			if session.Branch != "" {
				sb.WriteString(fmt.Sprintf("   - Branch: %s\n", session.Branch))
			}
		}

		sb.WriteString("\n**MANDATORY ACTION**: Use the AskUserQuestion tool to ask the user:\n\n")
		sb.WriteString("```\n")
		sb.WriteString("I found open sessions. Would you like to:\n")
		sb.WriteString("1. Start a new session\n")
		for i, session := range openSessions {
			displayName := session.SessionID
			if session.Topic != "" {
				displayName = fmt.Sprintf("%s - %s", session.SessionID, session.Topic)
			}
			sb.WriteString(fmt.Sprintf("%d. Continue session: %s\n", i+2, displayName))
		}
		sb.WriteString("```\n\n")

		sb.WriteString("**AFTER user responds**:\n\n")
		sb.WriteString("- If user selects existing session: Use MCP `session` tool with operation=`resume` and sessionId=`<selected session ID>`\n")
		sb.WriteString("- If user selects new session: Use AskUserQuestion to ask about the session topic, then use MCP `session` tool with operation=`create` and topic=`<user's response>`\n\n")
	} else {
		// No open sessions - create new session
		sb.WriteString("### No Active Session\n\n")
		sb.WriteString("**MANDATORY ACTION**: Use the AskUserQuestion tool to ask the user:\n\n")
		sb.WriteString("```\n")
		sb.WriteString("What would you like to work on in this session? (This will be the session topic)\n")
		sb.WriteString("```\n\n")
		sb.WriteString("**AFTER user responds**: Use MCP `session` tool with operation=`create` and topic=`<user's response>`\n\n")
	}

	sb.WriteString("**THEN** complete the session start protocol:\n")
	sb.WriteString("- Call bootstrap_context to load full project context\n")
	sb.WriteString("- Verify git branch with `git branch --show-current`\n")
	sb.WriteString("- Load and acknowledge session state\n")

	return sb.String()
}

// formatActiveSessionContext formats context when an active session already exists.
// In this case, openSessions are NOT included in output per hook flow spec.
func formatActiveSessionContext(activeSession *ActiveSession) string {
	var sb strings.Builder

	sb.WriteString("### Active Session\n\n")

	displayName := activeSession.SessionID
	if activeSession.Topic != "" {
		displayName = fmt.Sprintf("%s - %s", activeSession.SessionID, activeSession.Topic)
	}

	sb.WriteString(fmt.Sprintf("**Session**: %s\n", displayName))
	sb.WriteString(fmt.Sprintf("**Status**: %s\n", activeSession.Status))
	sb.WriteString(fmt.Sprintf("**Date**: %s\n", activeSession.Date))

	if activeSession.Branch != "" {
		sb.WriteString(fmt.Sprintf("**Branch**: %s\n", activeSession.Branch))
	}
	if activeSession.Mode != "" {
		sb.WriteString(fmt.Sprintf("**Mode**: %s\n", activeSession.Mode))
	}
	if activeSession.Task != "" {
		sb.WriteString(fmt.Sprintf("**Current Task**: %s\n", activeSession.Task))
	}

	// Show validation status
	if activeSession.IsValid {
		sb.WriteString("\n**Validation**: All checks passed\n")
	} else {
		sb.WriteString("\n**Validation**: Some checks failed\n")
		for _, check := range activeSession.Checks {
			status := "PASS"
			if !check.Passed {
				status = "FAIL"
			}
			sb.WriteString(fmt.Sprintf("- %s: [%s]\n", check.Name, status))
		}
	}

	sb.WriteString("\n**Continue with session start protocol**: Load context and verify state.\n")

	return sb.String()
}

// loadWorkflowState retrieves workflow state using brain session command.
func loadWorkflowState() (*WorkflowStateInfo, error) {
	// Use brain session get-state command to get current session state
	cmd := ExecCommandSession("brain", "session", "get-state")
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

// setActiveProject sets the active project in the MCP server via brain CLI.
// This ensures the project is set for subsequent MCP tool calls in this session.
func setActiveProject(project string) error {
	cmd := ExecCommandSession("brain", "projects", "active", "-p", project)
	_, err := cmd.Output()
	if err != nil {
		return fmt.Errorf("failed to set active project: %w", err)
	}
	return nil
}

// noProjectInstructions returns the context message when no project is identified.
// This instructs Claude to prompt the user to select a project.
func noProjectInstructions() string {
	return `DO THE FOLLOWING IMMEDIATELY, DO NOT WAIT FOR THE USER TO PROMPT YOU.

No active project is set.

Use AskUserQuestion to ask the user which project they want to work with.

After the user selects a project:
1. Set the project: active_project with operation="set" and project=<selected>
2. Run full session start protocol:
   - Call bootstrap_context to load project context
   - Create session log at .agents/sessions/YYYY-MM-DD-session-NN.md
   - Load session state
   - Verify git branch and commit

Available projects can be found with: list_projects
`
}

// buildSessionOutput constructs the complete session start output.
// The cwd parameter is the working directory from hook input, used for project resolution.
func buildSessionOutput(cwd string) *SessionStartOutput {
	output := &SessionStartOutput{
		Success: true,
	}

	// FIRST: Identify project (required for bootstrap context)
	project, err := identifyProject(cwd)
	if err != nil {
		// Project identification failed - return success with instructions
		// to prompt user for project selection via AskUserQuestion
		output.Success = true
		output.BootstrapInfo = map[string]any{
			"noProject": true,
		}
		return output
	}
	output.Project = project

	// Set active project in MCP server after successful auto-detection
	// This ensures all subsequent MCP tool calls use this project
	if err := setActiveProject(project); err != nil {
		// Non-fatal - project was identified, but MCP server might not be running
		// Bootstrap context will still work with explicit project parameter
		output.BootstrapInfo = map[string]any{
			"warning": fmt.Sprintf("Project identified but could not set active: %v", err),
		}
	}

	// Get git context for Phase 0 requirements
	gitContext, err := getGitContext()
	if err != nil {
		// Graceful degradation - git context is helpful but not required
		output.GitContext = &GitContextInfo{}
	} else {
		output.GitContext = gitContext
	}

	// Get bootstrap context from brain CLI with project
	bootstrapResult, err := getBootstrapContext(project)
	if err != nil {
		// Graceful degradation - don't fail the hook
		output.BootstrapInfo = map[string]any{
			"warning": fmt.Sprintf("Could not get bootstrap context: %v", err),
		}
	} else {
		output.BootstrapInfo = map[string]any{
			"markdown":   bootstrapResult.Markdown,
			"parsedJSON": bootstrapResult.ParsedJSON,
		}

		// Use parsed session data if available from JSON
		if bootstrapResult.ParsedJSON {
			output.OpenSessions = bootstrapResult.OpenSessions
			output.ActiveSession = bootstrapResult.ActiveSession
		} else {
			// Fall back to markdown parsing for legacy bootstrap output
			output.OpenSessions = parseOpenSessionsFromMarkdown(bootstrapResult.Markdown)
		}
	}

	// Get workflow state from brain CLI
	workflowState, err := loadWorkflowState()
	if err != nil {
		// Graceful degradation - don't fail the hook
		output.WorkflowState = &WorkflowStateInfo{}
	} else {
		output.WorkflowState = workflowState
	}

	return output
}

// formatContextMarkdown formats the session output as a single markdown string
// for Claude Code's additionalContext field.
//
// Implements hook flow logic per FEATURE-001-session-management:
// - IF activeSession exists: pass context, DO NOT include openSessions in output
// - IF no activeSession but openSessions exist: include mandatory AskUserQuestion instructions
// - IF no sessions: instructions for new session creation via AskUserQuestion
func formatContextMarkdown(output *SessionStartOutput) string {
	var sb strings.Builder

	// Handle error case
	if !output.Success {
		sb.WriteString(fmt.Sprintf("**Error:** %s\n", output.Error))
		return sb.String()
	}

	// Handle no project case - return instructions to prompt user
	if output.BootstrapInfo != nil {
		if noProject, ok := output.BootstrapInfo["noProject"].(bool); ok && noProject {
			return noProjectInstructions()
		}
	}

	// Git context header
	if output.GitContext != nil {
		if output.GitContext.Branch != "" {
			sb.WriteString(fmt.Sprintf("**Branch:** %s\n", output.GitContext.Branch))
		}
		if output.GitContext.Status != "" {
			sb.WriteString(fmt.Sprintf("**Status:** %s\n", output.GitContext.Status))
		}
		sb.WriteString("\n")
	}

	// HOOK FLOW LOGIC: Handle session state per FEATURE-001 specification
	//
	// IF activeSession exists:
	//   - Pass context to AI (active session info)
	//   - DO NOT include openSessions in output
	//   - AI does complete session start protocol
	//
	// IF no activeSession:
	//   - Provide mandatory instructions via additionalContext
	//   - Include openSessions list if any exist
	//   - Tell AI to use AskUserQuestion for user interaction
	//   - AI uses MCP session tool to create/resume based on user response
	if output.ActiveSession != nil {
		// Active session exists - pass context, skip openSessions
		sb.WriteString(formatActiveSessionContext(output.ActiveSession))
	} else {
		// No active session - provide mandatory instructions
		sb.WriteString(formatSessionInstructions(output.OpenSessions))
	}

	sb.WriteString("\n")

	// Bootstrap markdown (main content) - include if available
	if output.BootstrapInfo != nil {
		if markdown, ok := output.BootstrapInfo["markdown"].(string); ok && markdown != "" {
			sb.WriteString("\n---\n\n")
			sb.WriteString("### Project Context\n\n")
			sb.WriteString(markdown)
			sb.WriteString("\n")
		}
		if warning, ok := output.BootstrapInfo["warning"].(string); ok && warning != "" {
			sb.WriteString(fmt.Sprintf("**Warning:** %s\n", warning))
		}
	}

	// Workflow state (additional context, does not affect hook flow)
	if output.WorkflowState != nil && output.WorkflowState.Mode != "" {
		sb.WriteString("\n### Workflow State\n")
		sb.WriteString(fmt.Sprintf("**Mode:** %s\n", output.WorkflowState.Mode))
		if output.WorkflowState.Task != "" {
			sb.WriteString(fmt.Sprintf("**Task:** %s\n", output.WorkflowState.Task))
		}
		if output.WorkflowState.SessionID != "" {
			sb.WriteString(fmt.Sprintf("**Session:** %s\n", output.WorkflowState.SessionID))
		}
	}

	return sb.String()
}

// readHookInput reads and parses the JSON input from stdin.
// Returns empty HookInput if stdin is empty or cannot be parsed.
func readHookInput() HookInput {
	var input HookInput

	data, err := io.ReadAll(os.Stdin)
	if err != nil || len(data) == 0 {
		return input
	}

	// Ignore parse errors - return empty input on failure
	_ = json.Unmarshal(data, &input)
	return input
}

// RunSessionStart handles the session-start hook
// It calls brain CLI for bootstrap context and loads workflow state
func RunSessionStart() error {
	// Read hook input from stdin to get CWD
	hookInput := readHookInput()

	output := buildSessionOutput(hookInput.CWD)

	// Format as Claude Code hook specification requires
	hookOutput := HookOutput{
		HookSpecificOutput: HookSpecificOutput{
			HookEventName:     "SessionStart",
			AdditionalContext: formatContextMarkdown(output),
		},
	}

	// Output JSON to stdout
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(hookOutput)
}

// getPluginRoot returns the plugin root directory
func getPluginRoot() string {
	// Check environment variable first
	if root := os.Getenv("CLAUDE_PLUGIN_ROOT"); root != "" {
		return root
	}

	// Fall back to executable directory
	// Binary is at hooks/scripts/brain-hooks, need to go up 3 levels to claude-plugin/
	if exe, err := os.Executable(); err == nil {
		return filepath.Dir(filepath.Dir(filepath.Dir(exe)))
	}

	return ""
}

// resolveSkillsPath resolves the skills directory path
func resolveSkillsPath() string {
	root := getPluginRoot()
	if root == "" {
		// Try current directory
		if _, err := os.Stat("skills"); err == nil {
			return "skills"
		}
		return ""
	}
	return filepath.Join(root, "skills")
}

// containsAny checks if text contains any of the given patterns (case-insensitive)
func containsAny(text string, patterns []string) bool {
	lowerText := strings.ToLower(text)
	for _, pattern := range patterns {
		if strings.Contains(lowerText, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}
