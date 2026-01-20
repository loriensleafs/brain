package main

import (
	"encoding/json"
	"io"
	"os"

	validation "github.com/peterkloss/brain/packages/validation"
)

// ValidateSessionInput represents the input for validate-session command
type ValidateSessionInput struct {
	SessionLogPath string `json:"sessionLogPath,omitempty"`
}

// ValidateSessionOutput represents the output for validate-session command
type ValidateSessionOutput struct {
	Valid       bool    `json:"valid"`
	Checks      []Check `json:"checks"`
	Message     string  `json:"message"`
	Remediation string  `json:"remediation,omitempty"`
}

// RunValidateSession handles the validate-session command
func RunValidateSession() error {
	// Read input from stdin (optional)
	input, _ := io.ReadAll(os.Stdin)

	var validateInput ValidateSessionInput
	if len(input) > 0 {
		json.Unmarshal(input, &validateInput)
	}

	// Load workflow state (brain session)
	workflowState, _ := loadWorkflowState()

	// Convert to validation package types
	var state *validation.WorkflowState
	if workflowState != nil {
		state = &validation.WorkflowState{
			Mode:      workflowState.Mode,
			Task:      workflowState.Task,
			SessionID: workflowState.SessionID,
			UpdatedAt: workflowState.UpdatedAt,
		}
	}

	// Run validation using shared package
	result := validation.ValidateSession(state)

	// Convert to output format
	output := ValidateSessionOutput{
		Valid:       result.Valid,
		Message:     result.Message,
		Remediation: result.Remediation,
	}

	for _, c := range result.Checks {
		output.Checks = append(output.Checks, Check{
			Name:    c.Name,
			Passed:  c.Passed,
			Message: c.Message,
		})
	}

	// Output JSON
	if err := outputJSON(output); err != nil {
		return err
	}

	// Exit with appropriate code
	if !result.Valid {
		os.Exit(1)
	}

	return nil
}
