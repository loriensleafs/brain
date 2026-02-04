// Package cmd provides session management CLI commands.
//
// session_create.go implements the `brain session create` command.
// This command creates a new session via the MCP session tool.
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

var createSessionTopic string
var createSessionProject string

// SessionCreateResponse represents the MCP session create response.
type SessionCreateResponse struct {
	Success    bool    `json:"success"`
	SessionID  string  `json:"sessionId"`
	Path       string  `json:"path"`
	AutoPaused *string `json:"autoPaused,omitempty"`
	Error      string  `json:"error,omitempty"`
	Message    string  `json:"message,omitempty"`
}

var createSessionCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new session",
	Long: `Creates a new session via the MCP session tool.

The session is created with status IN_PROGRESS. If another session
is currently IN_PROGRESS, it will be auto-paused.

Flags:
  --topic    Required. The topic/description for the session.
  -p         Optional. Project name/path to scope the session.

Exit codes:
  0 - Success, session created
  1 - Error (topic empty, MCP unavailable, etc.)

Output format:
  Session created: SESSION-2026-02-04_01-feature-xyz
  Path: sessions/SESSION-2026-02-04_01-feature-xyz.md

Example:
  brain session create --topic "implement session commands"
  brain session create --topic "bugfix" -p myproject`,
	RunE: runCreateSession,
}

func init() {
	sessionCmd.AddCommand(createSessionCmd)
	createSessionCmd.Flags().StringVar(&createSessionTopic, "topic", "", "Topic/description for the session (required)")
	createSessionCmd.Flags().StringVarP(&createSessionProject, "project", "p", "", "Project name/path")
	createSessionCmd.MarkFlagRequired("topic")
}

func runCreateSession(cmd *cobra.Command, args []string) error {
	if createSessionTopic == "" {
		fmt.Fprintf(os.Stderr, "Error: --topic flag is required\n")
		os.Exit(1)
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to connect to Brain MCP: %v\n", err)
		os.Exit(1)
	}

	// Build tool arguments
	toolArgs := map[string]any{
		"operation": "create",
		"topic":     createSessionTopic,
	}
	if createSessionProject != "" {
		toolArgs["project"] = createSessionProject
	}

	result, err := brainClient.CallTool("session", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: Failed to create session: %v\n", err)
		os.Exit(1)
	}

	text := result.GetText()
	if text == "" {
		fmt.Fprintf(os.Stderr, "Error: Empty response from MCP\n")
		os.Exit(1)
	}

	// Parse response to check for errors and format output
	var resp SessionCreateResponse
	if err := json.Unmarshal([]byte(text), &resp); err != nil {
		// If parsing fails, output raw text
		fmt.Println(text)
		return nil
	}

	if !resp.Success {
		fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Message)
		os.Exit(1)
	}

	// Format success output
	fmt.Printf("Session created: %s\n", resp.SessionID)
	fmt.Printf("Path: %s\n", resp.Path)
	if resp.AutoPaused != nil {
		fmt.Printf("Auto-paused: %s\n", *resp.AutoPaused)
	}

	return nil
}
