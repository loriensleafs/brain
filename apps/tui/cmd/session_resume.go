// Package cmd provides session management CLI commands.
//
// session_resume.go implements the `brain session resume` command.
// This command resumes a paused session via the MCP session tool.
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

var resumeSessionProject string

var resumeSessionCmd = &cobra.Command{
	Use:   "resume <session-id>",
	Short: "Resume a paused session",
	Long: `Resumes a paused session via the MCP session tool.

The session status changes from PAUSED to IN_PROGRESS. If another
session is currently IN_PROGRESS, it will be auto-paused first.

Arguments:
  session-id   Required. The session ID to resume (e.g., SESSION-2026-02-04_01-topic).

Flags:
  -p           Optional. Project name/path.

Exit codes:
  0 - Success, session resumed
  1 - Error (session not found, not paused, auto-pause failed, MCP unavailable)

Output format:
  Session resumed: SESSION-2026-02-04_01-feature-xyz
  Status: PAUSED -> IN_PROGRESS

Example:
  brain session resume SESSION-2026-02-04_01-feature-xyz
  brain session resume SESSION-2026-02-04_01-feature-xyz -p myproject`,
	Args: cobra.ExactArgs(1),
	RunE: runResumeSession,
}

func init() {
	sessionCmd.AddCommand(resumeSessionCmd)
	resumeSessionCmd.Flags().StringVarP(&resumeSessionProject, "project", "p", "", "Project name/path")
}

func runResumeSession(cmd *cobra.Command, args []string) error {
	sessionID := args[0]

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Build tool arguments
	toolArgs := map[string]any{
		"operation": "resume",
		"sessionId": sessionID,
	}
	if resumeSessionProject != "" {
		toolArgs["project"] = resumeSessionProject
	}

	result, err := brainClient.CallTool("session", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to resume session: %v\n", err)
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
			fmt.Fprintf(os.Stderr, "Error: Session cannot be resumed (current status: %s)\n", resp.PreviousStatus)
		} else if resp.Error == "AUTO_PAUSE_FAILED" {
			fmt.Fprintf(os.Stderr, "Error: Failed to auto-pause existing session: %s\n", resp.Message)
		} else {
			fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Message)
		}
		os.Exit(1)
	}

	// Format success output
	fmt.Printf("Session resumed: %s\n", resp.SessionID)
	fmt.Printf("Status: %s -> %s\n", resp.PreviousStatus, resp.NewStatus)

	return nil
}
