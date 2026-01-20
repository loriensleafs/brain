// Package cmd provides CLI commands for Brain TUI including session management.
//
// The session commands provide hook integration support by exposing session state
// to external processes (like Claude hooks) without direct MCP access.
//
// Architecture: Hook (Go) -> brain CLI -> MCP client -> Brain notes
//
// See ADR-016 for design details.
package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

// ============================================================================
// Session State Types (mirrors TypeScript types from apps/mcp/src/services/session/types.ts)
// ============================================================================

// WorkflowMode represents available workflow modes controlling tool access.
type WorkflowMode string

const (
	ModeAnalysis WorkflowMode = "analysis"
	ModePlanning WorkflowMode = "planning"
	ModeCoding   WorkflowMode = "coding"
	ModeDisabled WorkflowMode = "disabled"
)

// ModeHistoryEntry tracks each mode transition with timestamp.
type ModeHistoryEntry struct {
	Mode      WorkflowMode `json:"mode"`
	Timestamp string       `json:"timestamp"`
}

// OrchestratorWorkflow tracks the full state of an orchestrator-managed workflow.
type OrchestratorWorkflow struct {
	ActiveAgent      *string `json:"activeAgent"`
	WorkflowPhase    string  `json:"workflowPhase"`
	AgentHistory     []any   `json:"agentHistory"`
	Decisions        []any   `json:"decisions"`
	Verdicts         []any   `json:"verdicts"`
	PendingHandoffs  []any   `json:"pendingHandoffs"`
	CompactionHist   []any   `json:"compactionHistory"`
	StartedAt        string  `json:"startedAt"`
	LastAgentChange  string  `json:"lastAgentChange"`
}

// SessionState represents the full session state from Brain MCP.
// This matches the TypeScript SessionState interface from apps/mcp/src/services/session/types.ts.
type SessionState struct {
	CurrentMode            WorkflowMode          `json:"currentMode"`
	ModeHistory            []ModeHistoryEntry    `json:"modeHistory"`
	ProtocolStartComplete  bool                  `json:"protocolStartComplete"`
	ProtocolEndComplete    bool                  `json:"protocolEndComplete"`
	ProtocolStartEvidence  map[string]string     `json:"protocolStartEvidence"`
	ProtocolEndEvidence    map[string]string     `json:"protocolEndEvidence"`
	OrchestratorWorkflow   *OrchestratorWorkflow `json:"orchestratorWorkflow"`
	ActiveFeature          string                `json:"activeFeature,omitempty"`
	ActiveTask             string                `json:"activeTask,omitempty"`
	Version                int                   `json:"version"`
	CreatedAt              string                `json:"createdAt"`
	UpdatedAt              string                `json:"updatedAt"`
}

// LegacySessionState represents the simplified session state for backward compatibility.
type LegacySessionState struct {
	Mode    string `json:"mode,omitempty"`
	Task    string `json:"task,omitempty"`
	Feature string `json:"feature,omitempty"`
}

// SessionUpdates represents updates that can be applied to session state.
type SessionUpdates struct {
	Mode                  *WorkflowMode     `json:"mode,omitempty"`
	Task                  *string           `json:"task,omitempty"`
	Feature               *string           `json:"feature,omitempty"`
	ProtocolStartComplete *bool             `json:"protocolStartComplete,omitempty"`
	ProtocolStartEvidence map[string]string `json:"protocolStartEvidence,omitempty"`
	ProtocolEndComplete   *bool             `json:"protocolEndComplete,omitempty"`
	ProtocolEndEvidence   map[string]string `json:"protocolEndEvidence,omitempty"`
}

// ============================================================================
// Read-Only Tools Whitelist
// ============================================================================

// readOnlyTools lists tools that are safe to execute when session state is unavailable.
// These tools only read data and cannot modify the codebase.
var readOnlyTools = map[string]bool{
	"Read":      true,
	"Glob":      true,
	"Grep":      true,
	"LSP":       true,
	"WebFetch":  true,
	"WebSearch": true,
}

// IsReadOnlyTool returns true if the tool is in the read-only whitelist.
// Used by hooks for fail-closed behavior when session state is unavailable.
func IsReadOnlyTool(tool string) bool {
	return readOnlyTools[tool]
}

// ============================================================================
// Cobra Commands
// ============================================================================

// Project flag for session command
var sessionProject string

var sessionCmd = &cobra.Command{
	Use:   "session",
	Short: "Manage session state",
	Long: `Manage session state for Claude hook integration.

When called with -p/--project flag, returns complete SessionState JSON
that can be passed directly to validation functions.

Subcommands:
  get-state  Get current session state as JSON (for hooks)
  set-state  Update session state from JSON input

The session commands provide a bridge for Claude hooks to access
session state stored in Brain MCP notes without direct MCP access.

Example:
  brain session -p myproject
  brain session get-state
  echo '{"mode":"coding"}' | brain session set-state`,
	RunE: runSessionRoot,
}

var getStateCmd = &cobra.Command{
	Use:   "get-state",
	Short: "Get current session state as JSON",
	Long: `Returns the current session state as JSON to stdout.

Used by Claude hooks (PreToolUse, SessionStart) to read session state
without direct MCP access. The hook executes this command via exec.Command.

Exit codes:
  0 - Success, session state JSON on stdout
  1 - Error (MCP unavailable, no session)

Output format:
  Full SessionState JSON including:
  - sessionId: UUID of current session
  - currentMode: analysis|planning|coding|disabled
  - protocolStartComplete: boolean
  - protocolEndComplete: boolean
  - version: optimistic locking version

Example:
  brain session get-state | jq '.currentMode'`,
	RunE: runGetState,
}

var setStateCmd = &cobra.Command{
	Use:   "set-state",
	Short: "Update session state from JSON input",
	Long: `Updates session state from JSON provided via stdin or argument.

Used by hooks and workflows to update session state after
completing protocol steps.

Input format (partial updates supported):
  {
    "mode": "coding",
    "protocolStartComplete": true,
    "protocolStartEvidence": {
      "brainMcpInitialized": "2026-01-18T10:00:00Z"
    }
  }

Exit codes:
  0 - Success
  1 - Error (invalid JSON, MCP unavailable)

Example:
  echo '{"mode":"coding"}' | brain session set-state
  brain session set-state '{"protocolStartComplete":true}'`,
	RunE: runSetState,
}

func init() {
	rootCmd.AddCommand(sessionCmd)
	sessionCmd.AddCommand(getStateCmd)
	sessionCmd.AddCommand(setStateCmd)

	// Add project flag to session command
	sessionCmd.Flags().StringVarP(&sessionProject, "project", "p", "", "Project name/path to get session state for")
}

// runSessionRoot handles the session command when called with -p/--project flag.
// Returns complete SessionState JSON that can be passed to validation functions.
func runSessionRoot(cmd *cobra.Command, args []string) error {
	// If no project flag, show help
	if sessionProject == "" {
		return cmd.Help()
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Call the session tool with "get" operation
	// The project parameter is used by Brain MCP to scope the session
	result, err := brainClient.CallTool("session", map[string]any{
		"operation": "get",
		"project":   sessionProject,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to get session state: %v\n", err)
		os.Exit(1)
	}

	// Get raw text from result
	text := result.GetText()
	if text == "" {
		fmt.Fprintf(os.Stderr, "Error: No session state available\n")
		os.Exit(1)
	}

	// Output raw JSON (validation functions will parse it)
	fmt.Println(text)
	return nil
}

// runGetState implements the get-state subcommand.
func runGetState(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Call the session tool with "get" operation
	result, err := brainClient.CallTool("session", map[string]any{
		"operation": "get",
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to get session state: %v\n", err)
		os.Exit(1)
	}

	// Get raw text from result
	text := result.GetText()
	if text == "" {
		fmt.Fprintf(os.Stderr, "Error: No session state available\n")
		os.Exit(1)
	}

	// Output raw JSON (hooks will parse it)
	fmt.Println(text)
	return nil
}

// runSetState implements the set-state subcommand.
func runSetState(cmd *cobra.Command, args []string) error {
	var input []byte
	var err error

	// Read input from argument or stdin
	if len(args) > 0 {
		input = []byte(args[0])
	} else {
		input, err = io.ReadAll(os.Stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: Failed to read input: %v\n", err)
			os.Exit(1)
		}
	}

	// Validate JSON input
	var updates map[string]any
	if err := json.Unmarshal(input, &updates); err != nil {
		fmt.Fprintf(os.Stderr, "Error: Invalid JSON input: %v\n", err)
		os.Exit(1)
	}

	// Connect to Brain MCP
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Call the session tool with "set" operation
	result, err := brainClient.CallTool("session", map[string]any{
		"operation": "set",
		"updates":   updates,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to update session state: %v\n", err)
		os.Exit(1)
	}

	// Output result
	text := result.GetText()
	fmt.Println(text)
	return nil
}

// Legacy runSession for backward compatibility (brain session without subcommand)
func runSession(cmd *cobra.Command, args []string) error {
	// If no subcommand provided, show help
	return cmd.Help()
}
