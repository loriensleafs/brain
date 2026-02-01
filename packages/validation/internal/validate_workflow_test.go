package internal

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func init() {
	// Load schema data for tests
	_, currentFile, _, _ := runtime.Caller(0)
	packageRoot := filepath.Dir(filepath.Dir(currentFile))
	schemaPath := filepath.Join(packageRoot, "schemas", "domain", "workflow.schema.json")
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		panic("failed to load workflow schema for tests: " + err.Error())
	}
	SetWorkflowSchemaData(data)
}

func TestValidateWorkflowState(t *testing.T) {
	tests := []struct {
		name  string
		data  map[string]any
		valid bool
	}{
		{
			name:  "valid empty mode (no active workflow)",
			data:  map[string]any{"mode": ""},
			valid: true,
		},
		{
			name:  "valid analysis mode",
			data:  map[string]any{"mode": "analysis"},
			valid: true,
		},
		{
			name:  "valid planning mode",
			data:  map[string]any{"mode": "planning"},
			valid: true,
		},
		{
			name:  "valid coding mode with task",
			data:  map[string]any{"mode": "coding", "task": "Implement feature X"},
			valid: true,
		},
		{
			name:  "invalid mode value",
			data:  map[string]any{"mode": "invalid"},
			valid: false,
		},
		{
			name:  "coding mode without task (conditional validation)",
			data:  map[string]any{"mode": "coding"},
			valid: false,
		},
		{
			name:  "coding mode with empty task (conditional validation)",
			data:  map[string]any{"mode": "coding", "task": ""},
			valid: false,
		},
		{
			name:  "analysis mode with optional task",
			data:  map[string]any{"mode": "analysis", "task": "Research API options"},
			valid: true,
		},
		{
			name:  "valid with sessionId",
			data:  map[string]any{"mode": "analysis", "sessionId": "abc123"},
			valid: true,
		},
		{
			name:  "valid with updatedAt",
			data:  map[string]any{"mode": "planning", "updatedAt": "2025-01-15T10:30:00Z"},
			valid: true,
		},
		{
			name:  "valid full state",
			data:  map[string]any{"mode": "coding", "task": "Implement X", "sessionId": "abc", "updatedAt": "2025-01-15T10:30:00Z"},
			valid: true,
		},
		{
			name:  "additional properties rejected",
			data:  map[string]any{"mode": "analysis", "unknownProp": "value"},
			valid: false,
		},
		{
			name:  "invalid mode type (number)",
			data:  map[string]any{"mode": 123},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateWorkflowState(tt.data)
			if result != tt.valid {
				t.Errorf("ValidateWorkflowState() = %v, want %v", result, tt.valid)
			}
		})
	}
}

func TestParseWorkflowState(t *testing.T) {
	t.Run("parses valid state", func(t *testing.T) {
		state, err := ParseWorkflowState(map[string]any{
			"mode":      "coding",
			"task":      "Implement feature",
			"sessionId": "abc123",
			"updatedAt": "2025-01-15T10:30:00Z",
		})
		if err != nil {
			t.Fatalf("ParseWorkflowState() error = %v", err)
		}
		if state.Mode != "coding" {
			t.Errorf("Mode = %v, want %v", state.Mode, "coding")
		}
		if state.Task != "Implement feature" {
			t.Errorf("Task = %v, want %v", state.Task, "Implement feature")
		}
		if state.SessionID != "abc123" {
			t.Errorf("SessionID = %v, want %v", state.SessionID, "abc123")
		}
		if state.UpdatedAt != "2025-01-15T10:30:00Z" {
			t.Errorf("UpdatedAt = %v, want %v", state.UpdatedAt, "2025-01-15T10:30:00Z")
		}
	})

	t.Run("returns error for invalid mode", func(t *testing.T) {
		_, err := ParseWorkflowState(map[string]any{"mode": "invalid"})
		if err == nil {
			t.Error("ParseWorkflowState() should return error for invalid mode")
		}
	})

	t.Run("returns error for coding without task", func(t *testing.T) {
		_, err := ParseWorkflowState(map[string]any{"mode": "coding"})
		if err == nil {
			t.Error("ParseWorkflowState() should return error for coding mode without task")
		}
	})

	t.Run("returns error for additional properties", func(t *testing.T) {
		_, err := ParseWorkflowState(map[string]any{"mode": "analysis", "unknownProp": "value"})
		if err == nil {
			t.Error("ParseWorkflowState() should return error for additional properties")
		}
	})
}

func TestGetWorkflowStateErrors(t *testing.T) {
	t.Run("returns empty for valid data", func(t *testing.T) {
		errors := GetWorkflowStateErrors(map[string]any{"mode": "analysis"})
		if len(errors) != 0 {
			t.Errorf("GetWorkflowStateErrors() returned %d errors, want 0", len(errors))
		}
	})

	t.Run("returns errors for invalid mode", func(t *testing.T) {
		errors := GetWorkflowStateErrors(map[string]any{"mode": "invalid"})
		if len(errors) == 0 {
			t.Error("GetWorkflowStateErrors() should return errors for invalid mode")
		}
		for _, e := range errors {
			if e.Constraint == "" {
				t.Error("ValidationError.Constraint should not be empty")
			}
			if e.Message == "" {
				t.Error("ValidationError.Message should not be empty")
			}
		}
	})

	t.Run("returns errors for coding without task", func(t *testing.T) {
		errors := GetWorkflowStateErrors(map[string]any{"mode": "coding"})
		if len(errors) == 0 {
			t.Error("GetWorkflowStateErrors() should return errors for coding mode without task")
		}
	})
}

func TestValidateWorkflow(t *testing.T) {
	tests := []struct {
		name        string
		state       WorkflowState
		valid       bool
		checkCount  int
		remediation string
	}{
		{
			name:       "valid empty mode",
			state:      WorkflowState{Mode: ""},
			valid:      true,
			checkCount: 1,
		},
		{
			name:       "valid analysis mode",
			state:      WorkflowState{Mode: "analysis"},
			valid:      true,
			checkCount: 1,
		},
		{
			name:       "valid planning mode",
			state:      WorkflowState{Mode: "planning"},
			valid:      true,
			checkCount: 1,
		},
		{
			name:       "valid coding mode with task",
			state:      WorkflowState{Mode: "coding", Task: "Implement feature"},
			valid:      true,
			checkCount: 2,
		},
		{
			name:        "invalid mode",
			state:       WorkflowState{Mode: "invalid"},
			valid:       false,
			checkCount:  1,
			remediation: "Set valid mode (analysis/planning/coding) and ensure task is set for coding mode",
		},
		{
			name:        "coding mode without task",
			state:       WorkflowState{Mode: "coding"},
			valid:       false,
			checkCount:  2,
			remediation: "Set valid mode (analysis/planning/coding) and ensure task is set for coding mode",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateWorkflow(tt.state)

			if result.Valid != tt.valid {
				t.Errorf("ValidateWorkflow().Valid = %v, want %v", result.Valid, tt.valid)
			}

			if len(result.Checks) != tt.checkCount {
				t.Errorf("ValidateWorkflow() check count = %d, want %d", len(result.Checks), tt.checkCount)
			}

			if tt.remediation != "" && result.Remediation != tt.remediation {
				t.Errorf("ValidateWorkflow().Remediation = %q, want %q", result.Remediation, tt.remediation)
			}

			// Verify message is set
			if result.Message == "" {
				t.Error("ValidateWorkflow().Message should not be empty")
			}
		})
	}
}

func TestValidateWorkflowCheckDetails(t *testing.T) {
	t.Run("mode_valid check name", func(t *testing.T) {
		result := ValidateWorkflow(WorkflowState{Mode: "analysis"})
		if len(result.Checks) == 0 {
			t.Fatal("Expected at least one check")
		}
		if result.Checks[0].Name != "mode_valid" {
			t.Errorf("Check name = %v, want %v", result.Checks[0].Name, "mode_valid")
		}
	})

	t.Run("task_set check only for coding mode", func(t *testing.T) {
		// Analysis mode should not have task_set check
		analysisResult := ValidateWorkflow(WorkflowState{Mode: "analysis"})
		for _, check := range analysisResult.Checks {
			if check.Name == "task_set" {
				t.Error("task_set check should not appear for analysis mode")
			}
		}

		// Coding mode should have task_set check
		codingResult := ValidateWorkflow(WorkflowState{Mode: "coding", Task: "Test"})
		hasTaskSetCheck := false
		for _, check := range codingResult.Checks {
			if check.Name == "task_set" {
				hasTaskSetCheck = true
				break
			}
		}
		if !hasTaskSetCheck {
			t.Error("task_set check should appear for coding mode")
		}
	})

	t.Run("check messages contain context", func(t *testing.T) {
		result := ValidateWorkflow(WorkflowState{Mode: "coding", Task: "Implement X"})
		for _, check := range result.Checks {
			if check.Name == "mode_valid" && check.Message == "" {
				t.Error("mode_valid check should have message")
			}
			if check.Name == "task_set" && check.Message == "" {
				t.Error("task_set check should have message")
			}
		}
	})
}
