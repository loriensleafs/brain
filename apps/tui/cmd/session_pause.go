// Package cmd provides session management CLI commands.
//
// session_pause.go implements the `brain session pause` command.
// This command pauses an active session via the MCP session tool.
//
// See FEATURE-001-session-management for design details.
package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var pauseSessionProject string

// SessionTransitionResponse represents the MCP session pause/resume/complete response.
type SessionTransitionResponse struct {
	Success        bool   `json:"success"`
	SessionID      string `json:"sessionId"`
	PreviousStatus string `json:"previousStatus,omitempty"`
	NewStatus      string `json:"newStatus,omitempty"`
	Error          string `json:"error,omitempty"`
	Message        string `json:"message,omitempty"`
}

var pauseSessionCmd = &cobra.Command{
	Use:   "pause <session-id>",
	Short: "Pause an active session",
	Long: `Pauses an active session via the MCP session tool.

The session status changes from IN_PROGRESS to PAUSED. A paused
session can be resumed later with 'brain session resume'.

Arguments:
  session-id   Required. The session ID to pause (e.g., SESSION-2026-02-04_01-topic).

Flags:
  -p           Optional. Project name/path.

Exit codes:
  0 - Success, session paused
  1 - Error (session not found, already paused, MCP unavailable)

Output format:
  Session paused: SESSION-2026-02-04_01-feature-xyz
  Status: IN_PROGRESS -> PAUSED

Example:
  brain session pause SESSION-2026-02-04_01-feature-xyz
  brain session pause SESSION-2026-02-04_01-feature-xyz -p myproject`,
	Args: cobra.ExactArgs(1),
	RunE: runPauseSession,
}

func init() {
	sessionCmd.AddCommand(pauseSessionCmd)
	pauseSessionCmd.Flags().StringVarP(&pauseSessionProject, "project", "p", "", "Project name/path")
}

func runPauseSession(cmd *cobra.Command, args []string) error {
	sessionID := args[0]

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Build tool arguments
	toolArgs := map[string]any{
		"operation": "pause",
		"sessionId": sessionID,
	}
	if pauseSessionProject != "" {
		toolArgs["project"] = pauseSessionProject
	}

	result, err := brainClient.CallTool("session", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to pause session: %v\n", err)
		os.Exit(1)
	}

	text := result.GetText()
	if text == "" {
		fmt.Fprintf(os.Stderr, "Error: Empty response from MCP\n")
		os.Exit(1)
	}

	// Parse response to check for errors and format output
	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(text), &resp); err != nil {
		// If parsing fails, output raw text
		fmt.Println(text)
		return nil
	}

	if !resp.Success {
		if resp.Error == "SESSION_NOT_FOUND" {
			fmt.Fprintf(os.Stderr, "Error: Session not found: %s\n", sessionID)
		} else if resp.Error == "INVALID_STATUS_TRANSITION" {
			fmt.Fprintf(os.Stderr, "Error: Session cannot be paused (current status: %s)\n", resp.PreviousStatus)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Message)
		}
		os.Exit(1)
	}

	// Format success output
	fmt.Printf("Session paused: %s\n", resp.SessionID)
	fmt.Printf("Status: %s -> %s\n", resp.PreviousStatus, resp.NewStatus)

	return nil
}
