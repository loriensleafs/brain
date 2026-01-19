package validation

import "fmt"

// CheckTasks verifies that no IN_PROGRESS tasks are incomplete.
// Returns a validation result with a list of incomplete tasks if any.
func CheckTasks(tasks []map[string]interface{}) ValidationResult {
	var checks []Check
	incompleteTasks := []string{}

	for _, task := range tasks {
		status, hasStatus := task["status"].(string)
		name, hasName := task["name"].(string)

		if !hasName {
			name = "unnamed"
		}

		if hasStatus && status == "IN_PROGRESS" {
			// Check if task has required completion indicators
			completed, hasCompleted := task["completed"].(bool)
			if !hasCompleted || !completed {
				incompleteTasks = append(incompleteTasks, name)
			}
		}
	}

	if len(incompleteTasks) == 0 {
		checks = append(checks, Check{
			Name:    "in_progress_tasks",
			Passed:  true,
			Message: "No incomplete in-progress tasks",
		})
		return ValidationResult{
			Valid:   true,
			Checks:  checks,
			Message: "All in-progress tasks are complete",
		}
	}

	for _, taskName := range incompleteTasks {
		checks = append(checks, Check{
			Name:    "task_incomplete",
			Passed:  false,
			Message: fmt.Sprintf("Task incomplete: %s", taskName),
		})
	}

	return ValidationResult{
		Valid:       false,
		Checks:      checks,
		Message:     fmt.Sprintf("%d in-progress task(s) incomplete", len(incompleteTasks)),
		Remediation: "Complete or mark as done all in-progress tasks before proceeding",
	}
}
