package main

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"slices"
)

// SessionState represents the session state from Brain CLI.
// Matches the SessionState type in apps/tui/cmd/session.go.
type SessionState struct {
	SessionID             string             `json:"sessionId"`
	CurrentMode           string             `json:"currentMode"`
	ModeHistory           []ModeHistoryEntry `json:"modeHistory,omitempty"`
	ProtocolStartComplete bool               `json:"protocolStartComplete,omitempty"`
	ProtocolEndComplete   bool               `json:"protocolEndComplete,omitempty"`
	ProtocolStartEvidence map[string]string  `json:"protocolStartEvidence,omitempty"`
	ProtocolEndEvidence   map[string]string  `json:"protocolEndEvidence,omitempty"`
	ActiveFeature         string             `json:"activeFeature,omitempty"`
	ActiveTask            string             `json:"activeTask,omitempty"`
	Version               int                `json:"version,omitempty"`
	CreatedAt             string             `json:"createdAt,omitempty"`
	UpdatedAt             string             `json:"updatedAt,omitempty"`
}

// ModeHistoryEntry tracks each mode transition with timestamp.
type ModeHistoryEntry struct {
	Mode      string `json:"mode"`
	Timestamp string `json:"timestamp"`
}

// ReadOnlyTools lists tools that are safe to execute when session state is unavailable.
// These tools only read data and cannot modify the codebase.
var ReadOnlyTools = map[string]bool{
	"Read":      true,
	"Glob":      true,
	"Grep":      true,
	"LSP":       true,
	"WebFetch":  true,
	"WebSearch": true,
}

// isReadOnlyTool returns true if the tool is in the read-only whitelist.
func isReadOnlyTool(tool string) bool {
	return ReadOnlyTools[tool]
}

// GateCheckResult represents the result of a gate check
type GateCheckResult struct {
	Allowed bool   `json:"allowed"`
	Mode    string `json:"mode"`
	Tool    string `json:"tool"`
	Message string `json:"message,omitempty"`
}

// ModeBlockedTools defines which tools are blocked in each mode
var ModeBlockedTools = map[string][]string{
	"analysis": {"Edit", "Write", "Bash", "NotebookEdit"},
	"planning": {"Edit", "Write", "NotebookEdit"},
	"coding":   {},
	"disabled": {},
}

// ExecCommandGate is a variable holding the exec.Command function.
// This allows tests to override the command execution.
var ExecCommandGate = exec.Command

// getBrainSessionState calls the Brain CLI to get the current session state.
// Returns error if CLI unavailable, command fails, or output invalid.
func getBrainSessionState() (*SessionState, error) {
	cmd := ExecCommandGate("brain", "session", "get-state")
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("brain CLI failed (exit %d): %s", exitErr.ExitCode(), string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("brain CLI unavailable: %w", err)
	}

	var state SessionState
	if err := json.Unmarshal(output, &state); err != nil {
		return nil, fmt.Errorf("failed to parse session state: %w", err)
	}

	return &state, nil
}

// checkToolBlocked checks if a tool is blocked for the current mode
func checkToolBlocked(tool string, mode string) *GateCheckResult {
	result := &GateCheckResult{
		Allowed: true,
		Mode:    mode,
		Tool:    tool,
	}

	// If mode is disabled or empty, allow everything
	if mode == "disabled" || mode == "" {
		return result
	}

	// Get blocked tools for this mode
	blockedTools, ok := ModeBlockedTools[mode]
	if !ok {
		// Unknown mode - allow by default
		return result
	}

	// Check if tool is in blocked list
	if slices.Contains(blockedTools, tool) {
		result.Allowed = false
		result.Message = formatBlockMessage(tool, mode)
	}

	return result
}

// formatBlockMessage creates a user-friendly block message
func formatBlockMessage(tool string, mode string) string {
	modeDescriptions := map[string]string{
		"analysis": "Analysis mode is for research and investigation. Code modifications are not allowed.",
		"planning": "Planning mode is for design and planning. Direct file edits are not allowed.",
	}

	description, ok := modeDescriptions[mode]
	if !ok {
		description = fmt.Sprintf("Current mode (%s) does not allow this tool.", mode)
	}

	return fmt.Sprintf(
		"[BLOCKED] Tool '%s' is not allowed in %s mode.\n\n%s\n\nTo proceed with code changes, transition to coding mode first using: set_mode(mode=\"coding\")",
		tool, mode, description,
	)
}

// performGateCheck reads session state from Brain CLI and checks if a tool is allowed.
// Implements FAIL-CLOSED behavior per ADR-016 Resolution 4:
// - If state unavailable and tool is read-only: ALLOW
// - If state unavailable and tool is destructive: BLOCK
// - If mode is "disabled": ALLOW (explicit bypass)
// - Otherwise: Check mode-based blocking
func performGateCheck(tool string) *GateCheckResult {
	state, err := getBrainSessionState()

	// FAIL CLOSED: If state unavailable, block destructive tools
	if err != nil {
		if isReadOnlyTool(tool) {
			return &GateCheckResult{
				Allowed: true,
				Mode:    "unknown",
				Tool:    tool,
				Message: fmt.Sprintf("Session state unavailable (%v). Read-only tool allowed.", err),
			}
		}
		return &GateCheckResult{
			Allowed: false,
			Mode:    "unknown",
			Tool:    tool,
			Message: fmt.Sprintf("[BLOCKED] Session state unavailable. Cannot verify mode for destructive tool '%s'. Start a session or use read-only tools only.", tool),
		}
	}

	// EXPLICIT DISABLED: Only disabled mode bypasses all gates
	if state.CurrentMode == "disabled" {
		return &GateCheckResult{
			Allowed: true,
			Mode:    "disabled",
			Tool:    tool,
		}
	}

	// Normal mode-based checking
	return checkToolBlocked(tool, state.CurrentMode)
}
