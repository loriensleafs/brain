package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/peterkloss/brain/packages/validation"
	"github.com/spf13/cobra"
)

var workflowCmd = &cobra.Command{
	Use:   "workflow",
	Short: "Workflow state management commands",
	Long:  `Commands for managing and querying workflow state from Inngest.`,
}

var workflowGetStateCmd = &cobra.Command{
	Use:   "get-state",
	Short: "Get current workflow state",
	Long: `Retrieves current workflow state including:
- mode: Current mode (analysis, planning, coding)
- task: Current task description
- sessionId: Session identifier
- updatedAt: Last state change timestamp

Used by hooks to check workflow context.`,
	RunE: runWorkflowGetState,
}

var workflowValidateCmd = &cobra.Command{
	Use:   "validate",
	Short: "Validate current workflow state",
	Long: `Validates the current workflow state:
- Checks mode is valid (analysis, planning, coding)
- Verifies task is set when in coding mode

Exit code 0 if valid, 1 if validation fails.`,
	RunE: runWorkflowValidate,
}

func init() {
	rootCmd.AddCommand(workflowCmd)
	workflowCmd.AddCommand(workflowGetStateCmd)
	workflowCmd.AddCommand(workflowValidateCmd)
}

func runWorkflowGetState(cmd *cobra.Command, args []string) error {
	// Create client and ensure server is running
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Call get_mode tool (no args needed)
	result, err := brainClient.CallTool("get_mode", map[string]interface{}{})
	if err != nil {
		// If Inngest/workflow unavailable, return empty state gracefully
		fmt.Println("{}")
		return nil
	}

	// Output result to stdout for hook consumption
	text := result.GetText()
	if text == "" {
		fmt.Println("{}")
	} else {
		fmt.Println(text)
	}
	return nil
}

func runWorkflowValidate(cmd *cobra.Command, args []string) error {
	// Create client and ensure server is running
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Get current workflow state
	result, err := brainClient.CallTool("get_mode", map[string]interface{}{})
	if err != nil {
		// No workflow state - validate empty state
		validationResult := validation.ValidateWorkflow(validation.WorkflowState{})
		output, _ := json.MarshalIndent(validationResult, "", "  ")
		fmt.Println(string(output))
		return nil
	}

	// Parse workflow state
	var state validation.WorkflowState
	text := result.GetText()
	if text != "" && text != "{}" {
		if err := json.Unmarshal([]byte(text), &state); err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing workflow state: %v\n", err)
			return err
		}
	}

	// Validate using shared package
	validationResult := validation.ValidateWorkflow(state)
	output, _ := json.MarshalIndent(validationResult, "", "  ")
	fmt.Println(string(output))

	if !validationResult.Valid {
		os.Exit(1)
	}
	return nil
}
