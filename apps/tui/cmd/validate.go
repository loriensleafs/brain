package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/peterkloss/brain/packages/validation"
	"github.com/spf13/cobra"
)

var sessionLogPath string

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Session validation commands",
	Long:  `Commands for validating session state before exit.`,
}

var validateSessionCmd = &cobra.Command{
	Use:   "session [session-log-path]",
	Short: "Validate session completeness",
	Long: `Validates session before exit:
- Checks all IN_PROGRESS tasks are DONE or paused
- Verifies recent knowledge capture (within frequency window)
- Confirms workflow state is persisted

If --session-log is provided, also validates the session log file:
- File exists with correct naming (YYYY-MM-DD-session-NN.md)
- Required sections present (Session Start, Session End)
- All checklist items completed

Exit code 0 if valid, 1 if validation fails.
Used by Stop hook to enforce session completion.

Examples:
  brain validate session
  brain validate session --session-log .agents/sessions/2026-01-14-session-01.md
  brain validate session .agents/sessions/2026-01-14-session-01.md`,
	RunE: runValidateSession,
}

func init() {
	rootCmd.AddCommand(validateCmd)
	validateCmd.AddCommand(validateSessionCmd)
	validateSessionCmd.Flags().StringVarP(&sessionLogPath, "session-log", "s", "", "Path to session log file to validate")
}

func runValidateSession(cmd *cobra.Command, args []string) error {
	// Determine session log path from flag or positional arg
	logPath := sessionLogPath
	if logPath == "" && len(args) > 0 {
		logPath = args[0]
	}

	// If session log path provided, validate it
	if logPath != "" {
		result := validation.ValidateSessionLog(logPath)
		output, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(output))

		if !result.Valid {
			os.Exit(1)
		}
		return nil
	}

	// Otherwise, validate Brain MCP session state
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		outputError("Failed to connect to Brain MCP")
		return err
	}

	// Get session state from brain session
	var state *validation.WorkflowState
	sessionResult, err := brainClient.CallTool("session", map[string]any{
		"operation": "get",
	})
	if err == nil {
		var sessionData validation.WorkflowState
		if json.Unmarshal([]byte(sessionResult.GetText()), &sessionData) == nil {
			state = &sessionData
		}
	}

	// Validate session state
	result := validation.ValidateSession(state)

	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))

	if !result.Valid {
		os.Exit(1)
	}
	return nil
}

func outputError(msg string) {
	result := validation.ValidationResult{
		Valid:   false,
		Message: msg,
	}
	output, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(output))
}
