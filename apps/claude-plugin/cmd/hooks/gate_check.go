package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
)

// SessionState represents the cached session state from brain MCP
type SessionState struct {
	Mode      string `json:"mode"`
	Task      string `json:"task,omitempty"`
	Feature   string `json:"feature,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

// GateCheckResult represents the result of a gate check
type GateCheckResult struct {
	Allowed bool   `json:"allowed"`
	Mode    string `json:"mode"`
	Tool    string `json:"tool"`
	Message string `json:"message,omitempty"`
}

// modeBlockedTools defines which tools are blocked in each mode
var modeBlockedTools = map[string][]string{
	"analysis": {"Edit", "Write", "Bash", "NotebookEdit"},
	"planning": {"Edit", "Write", "NotebookEdit"},
	"coding":   {},
	"disabled": {},
}

// getSessionStatePath returns the path to the session state file
func getSessionStatePath() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".local", "state", "brain", "session.json")
}

// ReadSessionState reads the session state from the cache file
func ReadSessionState() (*SessionState, error) {
	statePath := getSessionStatePath()
	if statePath == "" {
		return nil, fmt.Errorf("could not determine session state path")
	}

	data, err := os.ReadFile(statePath)
	if err != nil {
		if os.IsNotExist(err) {
			// No session state file - return disabled mode
			return &SessionState{Mode: "disabled"}, nil
		}
		return nil, fmt.Errorf("failed to read session state: %w", err)
	}

	var state SessionState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to parse session state: %w", err)
	}

	// Default to disabled if mode is empty
	if state.Mode == "" {
		state.Mode = "disabled"
	}

	return &state, nil
}

// CheckToolBlocked checks if a tool is blocked for the current mode
func CheckToolBlocked(tool string, mode string) *GateCheckResult {
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
	blockedTools, ok := modeBlockedTools[mode]
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

// PerformGateCheck reads session state and checks if a tool is allowed
func PerformGateCheck(tool string) *GateCheckResult {
	state, err := ReadSessionState()
	if err != nil {
		// On error reading state, allow the tool (fail open)
		return &GateCheckResult{
			Allowed: true,
			Mode:    "unknown",
			Tool:    tool,
			Message: fmt.Sprintf("Warning: could not read session state: %v", err),
		}
	}

	return CheckToolBlocked(tool, state.Mode)
}
