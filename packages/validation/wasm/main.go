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

// validateSessionProtocolWrapper wraps ValidateSessionProtocolFromContent for JS interop.
// Takes session log content and optional path for filename validation.
func validateSessionProtocolWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 {
			return sessionProtocolResultToJS(validation.SessionProtocolValidationResult{
				ValidationResult: validation.ValidationResult{
					Valid:   false,
					Message: "Missing argument: sessionLogContent",
				},
			})
		}

		content := args[0].String()
		sessionLogPath := ""
		if len(args) > 1 && !args[1].IsUndefined() && !args[1].IsNull() {
			sessionLogPath = args[1].String()
		}

		result := validation.ValidateSessionProtocolFromContent(content, sessionLogPath)
		return sessionProtocolResultToJS(result)
	})
}

// validateConsistencyWrapper wraps ValidateConsistencyFromContent for JS interop.
// Takes epic, prd, tasks, plan content strings, feature name, and checkpoint number.
func validateConsistencyWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 6 {
			return consistencyResultToJS(validation.ConsistencyValidationResult{
				ValidationResult: validation.ValidationResult{
					Valid:   false,
					Message: "Missing arguments: requires epicContent, prdContent, tasksContent, planContent, feature, checkpoint",
				},
			})
		}

		epicContent := getStringArg(args, 0)
		prdContent := getStringArg(args, 1)
		tasksContent := getStringArg(args, 2)
		planContent := getStringArg(args, 3)
		feature := getStringArg(args, 4)
		checkpoint := 1
		if len(args) > 5 && !args[5].IsUndefined() && !args[5].IsNull() {
			checkpoint = args[5].Int()
		}

		result := validation.ValidateConsistencyFromContent(epicContent, prdContent, tasksContent, planContent, feature, checkpoint)
		return consistencyResultToJS(result)
	})
}

// validateNamingConventionWrapper wraps ValidateNamingConvention for JS interop.
// Takes filename and pattern type.
func validateNamingConventionWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 2 {
			return map[string]any{"valid": false, "message": "Missing arguments: requires filename, pattern"}
		}

		filename := args[0].String()
		pattern := args[1].String()

		valid := validation.ValidateNamingConvention(filename, pattern)
		return map[string]any{
			"valid":    valid,
			"filename": filename,
			"pattern":  pattern,
		}
	})
}

// validateArtifactNamingWrapper wraps ValidateArtifactNaming for JS interop.
// Takes a file path and returns whether it follows naming conventions.
func validateArtifactNamingWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 {
			return map[string]any{"valid": false, "message": "Missing argument: filePath"}
		}

		filePath := args[0].String()
		valid, patternType := validation.ValidateArtifactNaming(filePath)

		return map[string]any{
			"valid":       valid,
			"filePath":    filePath,
			"patternType": patternType,
		}
	})
}

// validatePrePRWrapper wraps ValidatePrePRFromContent for JS interop.
// Takes a map of filename -> content strings and optional quickMode boolean.
func validatePrePRWrapper() js.Func {
	return js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) < 1 {
			return prePRResultToJS(validation.PrePRValidationResult{
				ValidationResult: validation.ValidationResult{
					Valid:   false,
					Message: "Missing argument: sourceContent (object with filename keys)",
				},
			})
		}

		// Extract source content from JS object
		sourceContent := make(map[string]string)
		contentArg := args[0]
		if !contentArg.IsNull() && !contentArg.IsUndefined() {
			// Get keys from the object
			keys := js.Global().Get("Object").Call("keys", contentArg)
			keysLen := keys.Length()
			for i := 0; i < keysLen; i++ {
				key := keys.Index(i).String()
				val := contentArg.Get(key)
				if !val.IsUndefined() && !val.IsNull() {
					sourceContent[key] = val.String()
				}
			}
		}

		// Check for quick mode
		quickMode := false
		if len(args) > 1 && !args[1].IsUndefined() && !args[1].IsNull() {
			quickMode = args[1].Bool()
		}

		result := validation.ValidatePrePRFromContent(sourceContent, quickMode)
		return prePRResultToJS(result)
	})
}

// prePRResultToJS converts PrePRValidationResult to JS-compatible map
func prePRResultToJS(r validation.PrePRValidationResult) map[string]any {
	checks := make([]any, len(r.Checks))
	for i, c := range r.Checks {
		checks[i] = map[string]any{
			"name":    c.Name,
			"passed":  c.Passed,
			"message": c.Message,
		}
	}

	return map[string]any{
		"valid":         r.Valid,
		"checks":        checks,
		"message":       r.Message,
		"remediation":   r.Remediation,
		"mode":          r.Mode,
		"totalDuration": r.TotalDuration,
		"crossCuttingConcerns": map[string]any{
			"passed":              r.CrossCuttingConcerns.Passed,
			"issues":              stringSliceToJS(r.CrossCuttingConcerns.Issues),
			"hardcodedValues":     stringSliceToJS(r.CrossCuttingConcerns.HardcodedValues),
			"todoComments":        stringSliceToJS(r.CrossCuttingConcerns.TodoComments),
			"duplicateCode":       stringSliceToJS(r.CrossCuttingConcerns.DuplicateCode),
			"undocumentedEnvVars": stringSliceToJS(r.CrossCuttingConcerns.UndocumentedEnvVars),
		},
		"failSafeDesign": map[string]any{
			"passed":                r.FailSafeDesign.Passed,
			"issues":                stringSliceToJS(r.FailSafeDesign.Issues),
			"missingExitCodeChecks": stringSliceToJS(r.FailSafeDesign.MissingExitCodeChecks),
			"missingErrorHandling":  stringSliceToJS(r.FailSafeDesign.MissingErrorHandling),
			"insecureDefaults":      stringSliceToJS(r.FailSafeDesign.InsecureDefaults),
			"silentFailures":        stringSliceToJS(r.FailSafeDesign.SilentFailures),
		},
		"testImplementation": map[string]any{
			"passed":              r.TestImplementation.Passed,
			"issues":              stringSliceToJS(r.TestImplementation.Issues),
			"parameterDrift":      stringSliceToJS(r.TestImplementation.ParameterDrift),
			"missingTestCoverage": stringSliceToJS(r.TestImplementation.MissingTestCoverage),
			"mockDivergence":      stringSliceToJS(r.TestImplementation.MockDivergence),
			"coveragePercent":     r.TestImplementation.CoveragePercent,
		},
		"ciEnvironment": map[string]any{
			"passed":           r.CIEnvironment.Passed,
			"issues":           stringSliceToJS(r.CIEnvironment.Issues),
			"ciFlagsVerified":  r.CIEnvironment.CIFlagsVerified,
			"buildVerified":    r.CIEnvironment.BuildVerified,
			"configDocumented": r.CIEnvironment.ConfigDocumented,
		},
		"environmentVariables": map[string]any{
			"passed":          r.EnvironmentVariables.Passed,
			"issues":          stringSliceToJS(r.EnvironmentVariables.Issues),
			"documentedVars":  stringSliceToJS(r.EnvironmentVariables.DocumentedVars),
			"missingDefaults": stringSliceToJS(r.EnvironmentVariables.MissingDefaults),
			"missingInCI":     stringSliceToJS(r.EnvironmentVariables.MissingInCI),
		},
	}
}

// consistencyResultToJS converts ConsistencyValidationResult to JS-compatible map
func consistencyResultToJS(r validation.ConsistencyValidationResult) map[string]any {
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
		"basePath":    r.BasePath,
		"feature":     r.Feature,
		"checkpoint":  r.Checkpoint,
		"artifacts": map[string]any{
			"epic":  r.Artifacts.Epic,
			"prd":   r.Artifacts.PRD,
			"tasks": r.Artifacts.Tasks,
			"plan":  r.Artifacts.Plan,
		},
		"scopeAlignment": map[string]any{
			"passed": r.ScopeAlignment.Passed,
			"issues": stringSliceToJS(r.ScopeAlignment.Issues),
		},
		"requirementCoverage": map[string]any{
			"passed":           r.RequirementCoverage.Passed,
			"issues":           stringSliceToJS(r.RequirementCoverage.Issues),
			"requirementCount": r.RequirementCoverage.RequirementCount,
			"taskCount":        r.RequirementCoverage.TaskCount,
		},
		"namingConventions": map[string]any{
			"passed": r.NamingConventions.Passed,
			"issues": stringSliceToJS(r.NamingConventions.Issues),
		},
		"crossReferences": map[string]any{
			"passed":     r.CrossReferences.Passed,
			"issues":     stringSliceToJS(r.CrossReferences.Issues),
			"references": stringSliceToJS(r.CrossReferences.References),
		},
		"taskCompletion": map[string]any{
			"passed":       r.TaskCompletion.Passed,
			"issues":       stringSliceToJS(r.TaskCompletion.Issues),
			"total":        r.TaskCompletion.Total,
			"completed":    r.TaskCompletion.Completed,
			"p0Incomplete": stringSliceToJS(r.TaskCompletion.P0Incomplete),
			"p1Incomplete": stringSliceToJS(r.TaskCompletion.P1Incomplete),
		},
	}
}

// getStringArg safely extracts a string from args at index
func getStringArg(args []js.Value, index int) string {
	if index >= len(args) {
		return ""
	}
	val := args[index]
	if val.IsUndefined() || val.IsNull() {
		return ""
	}
	return val.String()
}

// sessionProtocolResultToJS converts SessionProtocolValidationResult to JS-compatible map
func sessionProtocolResultToJS(r validation.SessionProtocolValidationResult) map[string]any {
	checks := make([]any, len(r.Checks))
	for i, c := range r.Checks {
		checks[i] = map[string]any{
			"name":    c.Name,
			"passed":  c.Passed,
			"message": c.Message,
		}
	}

	return map[string]any{
		"valid":            r.Valid,
		"checks":           checks,
		"message":          r.Message,
		"remediation":      r.Remediation,
		"sessionLogPath":   r.SessionLogPath,
		"brainInitialized": r.BrainInitialized,
		"brainUpdated":     r.BrainUpdated,
		"startChecklist": map[string]any{
			"totalMustItems":       r.StartChecklist.TotalMustItems,
			"completedMustItems":   r.StartChecklist.CompletedMustItems,
			"totalShouldItems":     r.StartChecklist.TotalShouldItems,
			"completedShouldItems": r.StartChecklist.CompletedShouldItems,
			"missingMustItems":     stringSliceToJS(r.StartChecklist.MissingMustItems),
			"missingShouldItems":   stringSliceToJS(r.StartChecklist.MissingShouldItems),
		},
		"endChecklist": map[string]any{
			"totalMustItems":       r.EndChecklist.TotalMustItems,
			"completedMustItems":   r.EndChecklist.CompletedMustItems,
			"totalShouldItems":     r.EndChecklist.TotalShouldItems,
			"completedShouldItems": r.EndChecklist.CompletedShouldItems,
			"missingMustItems":     stringSliceToJS(r.EndChecklist.MissingMustItems),
			"missingShouldItems":   stringSliceToJS(r.EndChecklist.MissingShouldItems),
		},
	}
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
	js.Global().Set("brainValidateSessionProtocol", validateSessionProtocolWrapper())
	js.Global().Set("brainValidateConsistency", validateConsistencyWrapper())
	js.Global().Set("brainValidateNamingConvention", validateNamingConventionWrapper())
	js.Global().Set("brainValidateArtifactNaming", validateArtifactNamingWrapper())
	js.Global().Set("brainValidatePrePR", validatePrePRWrapper())

	// Keep the program running
	select {}
}
