package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

var (
	workflowSchemaOnce     sync.Once
	workflowSchemaCompiled *jsonschema.Schema
	workflowSchemaErr      error
	workflowSchemaData     []byte
)

// SetWorkflowSchemaData sets the schema data for workflow validation.
// This must be called before any validation functions are used.
// The data is typically embedded by the parent package.
func SetWorkflowSchemaData(data []byte) {
	workflowSchemaData = data
}

// getWorkflowSchema returns the compiled workflow schema, loading it once.
func getWorkflowSchema() (*jsonschema.Schema, error) {
	workflowSchemaOnce.Do(func() {
		if workflowSchemaData == nil {
			workflowSchemaErr = fmt.Errorf("workflow schema data not set; call SetWorkflowSchemaData first")
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(workflowSchemaData, &schemaDoc); err != nil {
			workflowSchemaErr = fmt.Errorf("failed to parse workflow schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("workflow.schema.json", schemaDoc); err != nil {
			workflowSchemaErr = fmt.Errorf("failed to add workflow schema resource: %w", err)
			return
		}

		workflowSchemaCompiled, workflowSchemaErr = c.Compile("workflow.schema.json")
	})
	return workflowSchemaCompiled, workflowSchemaErr
}

// ValidateWorkflowState validates data against the WorkflowState JSON Schema.
// Returns true if valid, false otherwise.
// Use GetWorkflowStateErrors for detailed error information.
func ValidateWorkflowState(data any) bool {
	schema, err := getWorkflowSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseWorkflowState validates and parses data into WorkflowState.
// Returns validated WorkflowState or error with structured message.
func ParseWorkflowState(data any) (*WorkflowState, error) {
	schema, err := getWorkflowSchema()
	if err != nil {
		return nil, fmt.Errorf("schema error: %w", err)
	}

	// Validate against schema
	if err := schema.Validate(data); err != nil {
		return nil, FormatSchemaError(err)
	}

	// Convert to JSON and back to apply structure
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	var state WorkflowState
	if err := json.Unmarshal(jsonBytes, &state); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	return &state, nil
}

// GetWorkflowStateErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetWorkflowStateErrors(data any) []ValidationError {
	schema, err := getWorkflowSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(data)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// ValidateWorkflow validates the current workflow state and returns a ValidationResult.
// This is the legacy API that returns Check-based results for backward compatibility.
// For schema-based validation, use ValidateWorkflowState or ParseWorkflowState.
func ValidateWorkflow(state WorkflowState) ValidationResult {
	var checks []Check
	allPassed := true

	// Convert state to map for schema validation
	stateMap := map[string]any{
		"mode": state.Mode,
	}
	if state.Task != "" {
		stateMap["task"] = state.Task
	}
	if state.SessionID != "" {
		stateMap["sessionId"] = state.SessionID
	}
	if state.UpdatedAt != "" {
		stateMap["updatedAt"] = state.UpdatedAt
	}

	// Get validation errors
	errors := GetWorkflowStateErrors(stateMap)

	// Check 1: Mode is valid
	modeValid := true
	modeMessage := ""

	if state.Mode == "" {
		modeMessage = "No active workflow mode"
	} else {
		// Check if mode error exists
		for _, err := range errors {
			if err.Field == "/mode" || (err.Field == "" && err.Constraint == "enum") {
				modeValid = false
				modeMessage = "Invalid mode: " + state.Mode + " (expected: analysis, planning, or coding)"
				break
			}
		}
		if modeValid {
			modeMessage = "Mode is valid: " + state.Mode
		}
	}

	checks = append(checks, Check{
		Name:    "mode_valid",
		Passed:  modeValid,
		Message: modeMessage,
	})
	if !modeValid {
		allPassed = false
	}

	// Check 2: Task is set if in coding mode
	if state.Mode == "coding" {
		taskSet := state.Task != ""
		taskMessage := ""
		if taskSet {
			taskMessage = "Task is set: " + state.Task
		} else {
			taskMessage = "Coding mode requires a task to be set"
		}

		checks = append(checks, Check{
			Name:    "task_set",
			Passed:  taskSet,
			Message: taskMessage,
		})
		if !taskSet {
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
