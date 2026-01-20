package main

import (
	"encoding/json"
	"fmt"
	"os"

	validation "github.com/peterkloss/brain/packages/validation"
)

// StopOutput represents the output for stop hook
type StopOutput struct {
	Continue    bool    `json:"continue"`
	Message     string  `json:"message,omitempty"`
	Checks      []Check `json:"checks,omitempty"`
	Remediation string  `json:"remediation,omitempty"`
}

// Check represents a validation check result
type Check struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message,omitempty"`
}

// RunStop handles the stop hook
// It validates the session before ending and outputs {"continue": true/false}
func RunStop() error {
	output := StopOutput{
		Continue: true,
	}

	// Load workflow state (brain session)
	workflowState, err := loadWorkflowState()
	if err != nil {
		// No workflow state - allow stop
		output.Message = "No active workflow - session can end"
		return outputJSON(output)
	}

	// Convert to validation package types
	state := &validation.WorkflowState{
		Mode:      workflowState.Mode,
		Task:      workflowState.Task,
		SessionID: workflowState.SessionID,
		UpdatedAt: workflowState.UpdatedAt,
	}

	// Run stop readiness validation (not full session protocol validation)
	// Stop readiness is informational only - it should WARN, not BLOCK
	result := validation.ValidateStopReadiness(state)

	// Convert checks
	for _, c := range result.Checks {
		output.Checks = append(output.Checks, Check{
			Name:    c.Name,
			Passed:  c.Passed,
			Message: c.Message,
		})
	}

	output.Continue = result.Valid
	output.Message = result.Message
	output.Remediation = result.Remediation

	// Output JSON first
	if err := outputJSON(output); err != nil {
		return err
	}

	// Exit code 2 = block if validation failed
	if !result.Valid {
		os.Exit(2)
	}

	return nil
}

// outputJSON writes JSON output to stdout
func outputJSON(v any) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(v); err != nil {
		return fmt.Errorf("failed to encode output: %w", err)
	}
	return nil
}
