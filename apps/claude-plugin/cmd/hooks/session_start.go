package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// SessionStartOutput represents the output of session-start hook
type SessionStartOutput struct {
	Success       bool           `json:"success"`
	BootstrapInfo map[string]any `json:"bootstrapInfo,omitempty"`
	WorkflowState *WorkflowStateInfo `json:"workflowState,omitempty"`
	Error         string         `json:"error,omitempty"`
}

// WorkflowStateInfo represents workflow state information
type WorkflowStateInfo struct {
	Mode        string `json:"mode,omitempty"`
	Description string `json:"description,omitempty"`
	SessionID   string `json:"sessionId,omitempty"`
	UpdatedAt   string `json:"updatedAt,omitempty"`
	Task        string `json:"task,omitempty"`
}

// RunSessionStart handles the session-start hook
// It calls brain CLI for bootstrap context and loads workflow state
func RunSessionStart() error {
	output := SessionStartOutput{
		Success: true,
	}

	// Try to get bootstrap context from brain CLI
	bootstrapInfo, err := getBootstrapContext()
	if err != nil {
		// Graceful degradation - don't fail the hook
		output.BootstrapInfo = map[string]any{
			"warning": fmt.Sprintf("Could not get bootstrap context: %v", err),
		}
	} else {
		output.BootstrapInfo = bootstrapInfo
	}

	// Try to load workflow state
	workflowState, err := loadWorkflowState()
	if err != nil {
		// Graceful degradation - don't fail the hook
		output.WorkflowState = &WorkflowStateInfo{}
	} else {
		output.WorkflowState = workflowState
	}

	// Output JSON to stdout
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}

// getBootstrapContext calls the brain CLI to get bootstrap context
func getBootstrapContext() (map[string]any, error) {
	// Check if brain CLI is available
	brainPath, err := exec.LookPath("brain")
	if err != nil {
		return nil, fmt.Errorf("brain CLI not found in PATH")
	}

	// Call brain CLI for bootstrap context
	cmd := exec.Command(brainPath, "context", "--format", "json")
	output, err := cmd.Output()
	if err != nil {
		// Try alternative command
		cmd = exec.Command(brainPath, "status", "--json")
		output, err = cmd.Output()
		if err != nil {
			return nil, fmt.Errorf("failed to get context from brain CLI: %w", err)
		}
	}

	var result map[string]any
	if err := json.Unmarshal(output, &result); err != nil {
		return nil, fmt.Errorf("failed to parse brain CLI output: %w", err)
	}

	return result, nil
}

// loadWorkflowState loads workflow state from the state file
func loadWorkflowState() (*WorkflowStateInfo, error) {
	// Look for workflow state in standard locations
	stateLocations := []string{
		filepath.Join(os.Getenv("HOME"), ".brain", "workflow-state.json"),
		filepath.Join(os.Getenv("HOME"), ".claude", "workflow-state.json"),
		".brain/workflow-state.json",
		".claude/workflow-state.json",
	}

	// Also check BRAIN_STATE_DIR environment variable
	if stateDir := os.Getenv("BRAIN_STATE_DIR"); stateDir != "" {
		stateLocations = append([]string{filepath.Join(stateDir, "workflow-state.json")}, stateLocations...)
	}

	for _, location := range stateLocations {
		if data, err := os.ReadFile(location); err == nil {
			var state WorkflowStateInfo
			if err := json.Unmarshal(data, &state); err == nil {
				return &state, nil
			}
		}
	}

	return nil, fmt.Errorf("no workflow state found")
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
