package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
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

// ExecCommandSession is a variable holding the exec.Command function.
// This allows tests to override the command execution.
var ExecCommandSession = exec.Command

// identifyProject attempts to identify the active project for session start.
// Uses the 5-level resolution hierarchy:
// 1. BM_PROJECT env var
// 2. BM_ACTIVE_PROJECT env var (legacy)
// 3. BRAIN_PROJECT env var (Go-specific, backwards compatibility)
// 4. CWD match against code_paths from ~/.basic-memory/brain-config.json
// 5. Returns error (caller should prompt user)
//
// NOTE: CWD matching is ONLY used here in session_start, not in CLI commands.
// The cwd parameter allows overriding the working directory for project resolution.
// When empty, falls back to os.Getwd().
func identifyProject(cwd string) (string, error) {
	// First try env vars via resolveProject (no CWD matching there)
	project := resolveProject("", "")
	if project != "" {
		return project, nil
	}

	// Session start gets special CWD matching
	// Resolve CWD if not provided
	if cwd == "" {
		var err error
		cwd, err = os.Getwd()
		if err != nil {
			return "", fmt.Errorf("could not get working directory: %w", err)
		}
	}

	// Load brain config for CWD matching
	config, err := loadBrainConfig()
	if err != nil {
		return "", fmt.Errorf("could not load brain config: %w", err)
	}

	// Try CWD matching against configured code paths
	project = matchCwdToProject(cwd, config.CodePaths)
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

// getBootstrapContext calls the brain CLI bootstrap command to get semantic context.
func getBootstrapContext(project string) (map[string]any, error) {
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

	// brain bootstrap returns Markdown, not JSON
	// Return the raw markdown content for Claude to parse
	result := map[string]any{
		"markdown": string(output),
	}

	return result, nil
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
	bootstrapInfo, err := getBootstrapContext(project)
	if err != nil {
		// Graceful degradation - don't fail the hook
		output.BootstrapInfo = map[string]any{
			"warning": fmt.Sprintf("Could not get bootstrap context: %v", err),
		}
	} else {
		output.BootstrapInfo = bootstrapInfo
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
// for Claude Code's additionalContext field
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

	// Bootstrap markdown (main content)
	if output.BootstrapInfo != nil {
		if markdown, ok := output.BootstrapInfo["markdown"].(string); ok && markdown != "" {
			sb.WriteString(markdown)
			sb.WriteString("\n")
		}
		if warning, ok := output.BootstrapInfo["warning"].(string); ok && warning != "" {
			sb.WriteString(fmt.Sprintf("**Warning:** %s\n", warning))
		}
	}

	// Workflow state
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
