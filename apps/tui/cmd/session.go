package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

// SessionState represents the session state from Brain MCP.
type SessionState struct {
	Mode    string `json:"mode,omitempty"`
	Task    string `json:"task,omitempty"`
	Feature string `json:"feature,omitempty"`
}

var sessionCmd = &cobra.Command{
	Use:   "session",
	Short: "Get current session state",
	Long: `Returns the current session state including:
- mode: Current workflow mode (analysis, planning, coding, disabled)
- task: Description of current task
- feature: Active feature slug/path

Example:
  brain session`,
	RunE: runSession,
}

func init() {
	rootCmd.AddCommand(sessionCmd)
}

func runSession(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Call the session tool with "get" operation
	result, err := brainClient.CallTool("session", map[string]any{
		"operation": "get",
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Parse and pretty-print the result
	text := result.GetText()

	// Try to parse as JSON and pretty-print
	var state SessionState
	if err := json.Unmarshal([]byte(text), &state); err == nil {
		output, _ := json.MarshalIndent(state, "", "  ")
		fmt.Println(string(output))
	} else {
		// If not valid JSON, just output raw text
		fmt.Println(text)
	}

	return nil
}
