package internal

import (

	
)

// ValidateWorkflow validates the current workflow state.
// It checks that mode is valid (analysis/planning/coding) and task is set if in coding mode.
func ValidateWorkflow(state WorkflowState) ValidationResult {
	var checks []Check
	allPassed := true

	// Check 1: Mode is valid
	validModes := map[string]bool{
		"analysis": true,
		"planning": true,
		"coding":   true,
	}

	if state.Mode == "" {
		checks = append(checks, Check{
			Name:    "mode_valid",
			Passed:  true,
			Message: "No active workflow mode",
		})
	} else if validModes[state.Mode] {
		checks = append(checks, Check{
			Name:    "mode_valid",
			Passed:  true,
			Message: "Mode is valid: " + state.Mode,
		})
	} else {
		checks = append(checks, Check{
			Name:    "mode_valid",
			Passed:  false,
			Message: "Invalid mode: " + state.Mode + " (expected: analysis, planning, or coding)",
		})
		allPassed = false
	}

	// Check 2: Task is set if in coding mode
	if state.Mode == "coding" {
		if state.Task != "" {
			checks = append(checks, Check{
				Name:    "task_set",
				Passed:  true,
				Message: "Task is set: " + state.Task,
			})
		} else {
			checks = append(checks, Check{
				Name:    "task_set",
				Passed:  false,
				Message: "Coding mode requires a task to be set",
			})
			allPassed = false
		}
	}

	result := ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Workflow state is valid"
	} else {
		result.Message = "Workflow state validation failed"
		result.Remediation = "Set valid mode (analysis/planning/coding) and ensure task is set for coding mode"
	}

	return result
}
