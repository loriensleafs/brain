// Package cmd provides session management CLI commands.
//
// session_complete.go implements the `brain session complete` command.
// This command completes an active session via the MCP session tool.
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

var completeSessionProject string

var completeSessionCmd = &cobra.Command{
	Use:   "complete <session-id>",
	Short: "Complete an active session",
	Long: `Completes an active session via the MCP session tool.

The session status changes from IN_PROGRESS to COMPLETE. A completed
session cannot be resumed.

Arguments:
  session-id   Required. The session ID to complete (e.g., SESSION-2026-02-04_01-topic).

Flags:
  -p           Optional. Project name/path.

Exit codes:
  0 - Success, session completed
  1 - Error (session not found, already complete, MCP unavailable)

Output format:
  Session completed: SESSION-2026-02-04_01-feature-xyz
  Status: IN_PROGRESS -> COMPLETE

Example:
  brain session complete SESSION-2026-02-04_01-feature-xyz
  brain session complete SESSION-2026-02-04_01-feature-xyz -p myproject`,
	Args: cobra.ExactArgs(1),
	RunE: runCompleteSession,
}

func init() {
	sessionCmd.AddCommand(completeSessionCmd)
	completeSessionCmd.Flags().StringVarP(&completeSessionProject, "project", "p", "", "Project name/path")
}

func runCompleteSession(cmd *cobra.Command, args []string) error {
	sessionID := args[0]

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Build tool arguments
	toolArgs := map[string]any{
		"operation": "complete",
		"sessionId": sessionID,
	}
	if completeSessionProject != "" {
		toolArgs["project"] = completeSessionProject
	}

	result, err := brainClient.CallTool("session", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to complete session: %v\n", err)
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
			fmt.Fprintf(os.Stderr, "Error: Session cannot be completed (current status: %s)\n", resp.PreviousStatus)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Message)
		}
		os.Exit(1)
	}

	// Format success output
	fmt.Printf("Session completed: %s\n", resp.SessionID)
	fmt.Printf("Status: %s -> %s\n", resp.PreviousStatus, resp.NewStatus)

	return nil
}
