package validation

// ValidateSession validates session state for completeness before ending.
// Pass the state from `brain session` command output.
func ValidateSession(state *WorkflowState) ValidationResult {
	var checks []Check
	allPassed := true

	// Check 1: Workflow state persisted
	if state != nil && state.Mode != "" {
		checks = append(checks, Check{
			Name:    "workflow_state",
			Passed:  true,
			Message: "Workflow state persisted with mode: " + state.Mode,
		})
	} else {
		checks = append(checks, Check{
			Name:    "workflow_state",
			Passed:  true,
			Message: "No active workflow state",
		})
	}

	// Check 2: Recent activity (derived from UpdatedAt)
	if state != nil && state.UpdatedAt != "" {
		checks = append(checks, Check{
			Name:    "recent_activity",
			Passed:  true,
			Message: "Recent activity at: " + state.UpdatedAt,
		})
	} else {
		shouldFail := state != nil &&
			(state.Mode == "analysis" || state.Mode == "planning")
		checks = append(checks, Check{
			Name:    "recent_activity",
			Passed:  !shouldFail,
			Message: "No recent activity captured",
		})
		if shouldFail {
			allPassed = false
		}
	}

	// Check 3: Task status (derived from Task field)
	if state == nil || state.Task == "" {
		checks = append(checks, Check{
			Name:    "task_status",
			Passed:  true,
			Message: "No active task",
		})
	} else {
		checks = append(checks, Check{
			Name:    "task_status",
			Passed:  true,
			Message: "Active task: " + state.Task,
		})
	}

	result := ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Session ready to end"
	} else {
		result.Message = "Session validation failed"
		result.Remediation = "Capture observations before ending session"
	}

	return result
}
