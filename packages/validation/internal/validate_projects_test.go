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
	projectsSchemaDir := filepath.Join(packageRoot, "schemas", "tools", "projects")

	// Load list-projects schema
	listData, err := os.ReadFile(filepath.Join(projectsSchemaDir, "list-projects.schema.json"))
	if err != nil {
		panic("failed to load list-projects schema for tests: " + err.Error())
	}
	SetListProjectsSchemaData(listData)

	// Load delete-project schema
	deleteData, err := os.ReadFile(filepath.Join(projectsSchemaDir, "delete-project.schema.json"))
	if err != nil {
		panic("failed to load delete-project schema for tests: " + err.Error())
	}
	SetDeleteProjectSchemaData(deleteData)

	// Load active-project schema
	activeData, err := os.ReadFile(filepath.Join(projectsSchemaDir, "active-project.schema.json"))
	if err != nil {
		panic("failed to load active-project schema for tests: " + err.Error())
	}
	SetActiveProjectSchemaData(activeData)
}

func TestValidateListProjectsArgs(t *testing.T) {
	tests := []struct {
		name     string
		data     any
		expected bool
	}{
		{
			name:     "empty object is valid",
			data:     map[string]any{},
			expected: true,
		},
		{
			name:     "nil is not valid",
			data:     nil,
			expected: false,
		},
		{
			name: "additional properties rejected",
			data: map[string]any{
				"unknown": "prop",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateListProjectsArgs(tt.data)
			if result != tt.expected {
				t.Errorf("ValidateListProjectsArgs() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseListProjectsArgs(t *testing.T) {
	t.Run("accepts empty object", func(t *testing.T) {
		args, err := ParseListProjectsArgs(map[string]any{})
		if err != nil {
			t.Errorf("ParseListProjectsArgs() error = %v", err)
		}
		if args == nil {
			t.Error("ParseListProjectsArgs() returned nil")
		}
	})

	t.Run("rejects additional properties", func(t *testing.T) {
		_, err := ParseListProjectsArgs(map[string]any{
			"unknown": "prop",
		})
		if err == nil {
			t.Error("ParseListProjectsArgs() should reject additional properties")
		}
	})
}

func TestGetListProjectsArgsErrors(t *testing.T) {
	t.Run("returns empty slice for valid data", func(t *testing.T) {
		errors := GetListProjectsArgsErrors(map[string]any{})
		if len(errors) != 0 {
			t.Errorf("GetListProjectsArgsErrors() = %v, want empty slice", errors)
		}
	})

	t.Run("returns errors for invalid data", func(t *testing.T) {
		errors := GetListProjectsArgsErrors(map[string]any{"unknown": "prop"})
		if len(errors) == 0 {
			t.Error("GetListProjectsArgsErrors() should return errors for invalid data")
		}
	})
}

func TestValidateDeleteProjectArgs(t *testing.T) {
	tests := []struct {
		name     string
		data     any
		expected bool
	}{
		{
			name: "valid with project only",
			data: map[string]any{
				"project": "test-project",
			},
			expected: true,
		},
		{
			name: "valid with delete_notes false",
			data: map[string]any{
				"project":      "test-project",
				"delete_notes": false,
			},
			expected: true,
		},
		{
			name: "valid with delete_notes true",
			data: map[string]any{
				"project":      "test-project",
				"delete_notes": true,
			},
			expected: true,
		},
		{
			name:     "invalid without project",
			data:     map[string]any{},
			expected: false,
		},
		{
			name: "invalid with empty project",
			data: map[string]any{
				"project": "",
			},
			expected: false,
		},
		{
			name: "additional properties rejected",
			data: map[string]any{
				"project": "test",
				"unknown": "prop",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateDeleteProjectArgs(tt.data)
			if result != tt.expected {
				t.Errorf("ValidateDeleteProjectArgs() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseDeleteProjectArgs(t *testing.T) {
	t.Run("requires project parameter", func(t *testing.T) {
		_, err := ParseDeleteProjectArgs(map[string]any{})
		if err == nil {
			t.Error("ParseDeleteProjectArgs() should require project")
		}
	})

	t.Run("accepts project parameter", func(t *testing.T) {
		args, err := ParseDeleteProjectArgs(map[string]any{
			"project": "my-project",
		})
		if err != nil {
			t.Errorf("ParseDeleteProjectArgs() error = %v", err)
		}
		if args.Project != "my-project" {
			t.Errorf("Project = %v, want my-project", args.Project)
		}
	})

	t.Run("applies default for delete_notes", func(t *testing.T) {
		args, err := ParseDeleteProjectArgs(map[string]any{
			"project": "my-project",
		})
		if err != nil {
			t.Errorf("ParseDeleteProjectArgs() error = %v", err)
		}
		if args.DeleteNotes == nil || *args.DeleteNotes != false {
			t.Errorf("DeleteNotes = %v, want false", args.DeleteNotes)
		}
	})

	t.Run("accepts delete_notes parameter", func(t *testing.T) {
		args, err := ParseDeleteProjectArgs(map[string]any{
			"project":      "my-project",
			"delete_notes": true,
		})
		if err != nil {
			t.Errorf("ParseDeleteProjectArgs() error = %v", err)
		}
		if args.DeleteNotes == nil || *args.DeleteNotes != true {
			t.Errorf("DeleteNotes = %v, want true", args.DeleteNotes)
		}
	})
}

func TestGetDeleteProjectArgsErrors(t *testing.T) {
	t.Run("returns empty slice for valid data", func(t *testing.T) {
		errors := GetDeleteProjectArgsErrors(map[string]any{"project": "test"})
		if len(errors) != 0 {
			t.Errorf("GetDeleteProjectArgsErrors() = %v, want empty slice", errors)
		}
	})

	t.Run("returns errors for missing project", func(t *testing.T) {
		errors := GetDeleteProjectArgsErrors(map[string]any{})
		if len(errors) == 0 {
			t.Error("GetDeleteProjectArgsErrors() should return errors for missing project")
		}
	})
}

func TestValidateActiveProjectArgs(t *testing.T) {
	tests := []struct {
		name     string
		data     any
		expected bool
	}{
		{
			name:     "empty object is valid (uses default operation)",
			data:     map[string]any{},
			expected: true,
		},
		{
			name: "valid with get operation",
			data: map[string]any{
				"operation": "get",
			},
			expected: true,
		},
		{
			name: "valid with set operation and project",
			data: map[string]any{
				"operation": "set",
				"project":   "my-project",
			},
			expected: true,
		},
		{
			name: "valid with clear operation",
			data: map[string]any{
				"operation": "clear",
			},
			expected: true,
		},
		{
			name: "invalid operation",
			data: map[string]any{
				"operation": "invalid",
			},
			expected: false,
		},
		{
			name: "additional properties rejected",
			data: map[string]any{
				"operation": "get",
				"unknown":   "prop",
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateActiveProjectArgs(tt.data)
			if result != tt.expected {
				t.Errorf("ValidateActiveProjectArgs() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestParseActiveProjectArgs(t *testing.T) {
	t.Run("accepts empty object with default operation", func(t *testing.T) {
		args, err := ParseActiveProjectArgs(map[string]any{})
		if err != nil {
			t.Errorf("ParseActiveProjectArgs() error = %v", err)
		}
		if args.Operation == nil || *args.Operation != "get" {
			t.Errorf("Operation = %v, want get", args.Operation)
		}
	})

	t.Run("accepts get operation", func(t *testing.T) {
		args, err := ParseActiveProjectArgs(map[string]any{
			"operation": "get",
		})
		if err != nil {
			t.Errorf("ParseActiveProjectArgs() error = %v", err)
		}
		if args.Operation == nil || *args.Operation != "get" {
			t.Errorf("Operation = %v, want get", args.Operation)
		}
	})

	t.Run("accepts set operation with project", func(t *testing.T) {
		args, err := ParseActiveProjectArgs(map[string]any{
			"operation": "set",
			"project":   "my-project",
		})
		if err != nil {
			t.Errorf("ParseActiveProjectArgs() error = %v", err)
		}
		if args.Operation == nil || *args.Operation != "set" {
			t.Errorf("Operation = %v, want set", args.Operation)
		}
		if args.Project == nil || *args.Project != "my-project" {
			t.Errorf("Project = %v, want my-project", args.Project)
		}
	})

	t.Run("accepts clear operation", func(t *testing.T) {
		args, err := ParseActiveProjectArgs(map[string]any{
			"operation": "clear",
		})
		if err != nil {
			t.Errorf("ParseActiveProjectArgs() error = %v", err)
		}
		if args.Operation == nil || *args.Operation != "clear" {
			t.Errorf("Operation = %v, want clear", args.Operation)
		}
	})

	t.Run("rejects invalid operation", func(t *testing.T) {
		_, err := ParseActiveProjectArgs(map[string]any{
			"operation": "invalid",
		})
		if err == nil {
			t.Error("ParseActiveProjectArgs() should reject invalid operation")
		}
	})
}

func TestGetActiveProjectArgsErrors(t *testing.T) {
	t.Run("returns empty slice for valid data", func(t *testing.T) {
		errors := GetActiveProjectArgsErrors(map[string]any{})
		if len(errors) != 0 {
			t.Errorf("GetActiveProjectArgsErrors() = %v, want empty slice", errors)
		}
	})

	t.Run("returns errors for invalid operation", func(t *testing.T) {
		errors := GetActiveProjectArgsErrors(map[string]any{"operation": "invalid"})
		if len(errors) == 0 {
			t.Error("GetActiveProjectArgsErrors() should return errors for invalid operation")
		}
	})
}
