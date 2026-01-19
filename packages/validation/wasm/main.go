//go:build wasm

package main

import (
	"syscall/js"

	"github.com/peterkloss/brain/packages/validation"
)

// validateSessionWrapper wraps ValidateSession for JS interop
func validateSessionWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		// Extract workflow state from JS object (optional)
		var workflowState *validation.WorkflowState
		if len(args) > 0 {
			stateArg := args[0]
			if !stateArg.IsNull() && !stateArg.IsUndefined() {
				workflowState = &validation.WorkflowState{
					Mode:      getStringField(stateArg, "mode"),
					Task:      getStringField(stateArg, "task"),
					SessionID: getStringField(stateArg, "sessionId"),
					UpdatedAt: getStringField(stateArg, "updatedAt"),
				}
			}
		}

		result := validation.ValidateSession(workflowState)
		return resultToJS(result)
	})
}

// validateWorkflowWrapper wraps ValidateWorkflow for JS interop
func validateWorkflowWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 {
			return map[string]any{"valid": false, "message": "Missing argument: workflowState"}
		}

		stateArg := args[0]
		state := validation.WorkflowState{
			Mode:      getStringField(stateArg, "mode"),
			Task:      getStringField(stateArg, "task"),
			SessionID: getStringField(stateArg, "sessionId"),
		}

		result := validation.ValidateWorkflow(state)
		return resultToJS(result)
	})
}

// detectScenarioWrapper wraps DetectScenario for JS interop
func detectScenarioWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 {
			return map[string]any{"detected": false}
		}

		prompt := args[0].String()
		result := validation.DetectScenario(prompt)

		return map[string]any{
			"detected":    result.Detected,
			"scenario":    result.Scenario,
			"keywords":    stringSliceToJS(result.Keywords),
			"recommended": result.Recommended,
			"directory":   result.Directory,
			"noteType":    result.NoteType,
		}
	})
}

// checkTasksWrapper wraps CheckTasks for JS interop
func checkTasksWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 {
			return map[string]any{"valid": true, "checks": []any{}, "message": "No tasks provided"}
		}

		tasksArg := args[0]
		tasks := jsArrayToMapSlice(tasksArg)
		result := validation.CheckTasks(tasks)
		return resultToJS(result)
	})
}

// resultToJS converts ValidationResult to JS-compatible map
func resultToJS(r validation.ValidationResult) map[string]any {
	checks := make([]any, len(r.Checks))
	for i, c := range r.Checks {
		checks[i] = map[string]any{
			"name":    c.Name,
			"passed":  c.Passed,
			"message": c.Message,
		}
	}
	return map[string]any{
		"valid":       r.Valid,
		"checks":      checks,
		"message":     r.Message,
		"remediation": r.Remediation,
	}
}

// getStringField safely extracts a string field from a JS object
func getStringField(obj js.Value, field string) string {
	val := obj.Get(field)
	if val.IsUndefined() || val.IsNull() {
		return ""
	}
	return val.String()
}

// stringSliceToJS converts a Go string slice to a JS array
func stringSliceToJS(slice []string) []any {
	result := make([]any, len(slice))
	for i, s := range slice {
		result[i] = s
	}
	return result
}

// jsArrayToMapSlice converts a JS array to a slice of maps
func jsArrayToMapSlice(arr js.Value) []map[string]interface{} {
	if arr.IsUndefined() || arr.IsNull() {
		return nil
	}

	length := arr.Length()
	result := make([]map[string]interface{}, length)

	for i := 0; i < length; i++ {
		obj := arr.Index(i)
		m := make(map[string]interface{})

		// Extract common task fields
		if status := obj.Get("status"); !status.IsUndefined() {
			m["status"] = status.String()
		}
		if name := obj.Get("name"); !name.IsUndefined() {
			m["name"] = name.String()
		}
		if completed := obj.Get("completed"); !completed.IsUndefined() {
			m["completed"] = completed.Bool()
		}

		result[i] = m
	}
	return result
}

func main() {
	// Register validation functions globally
	js.Global().Set("brainValidateSession", validateSessionWrapper())
	js.Global().Set("brainValidateWorkflow", validateWorkflowWrapper())
	js.Global().Set("brainDetectScenario", detectScenarioWrapper())
	js.Global().Set("brainCheckTasks", checkTasksWrapper())

	// Keep the program running
	select {}
}
