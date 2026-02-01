package validation

import (
	"testing"
)

func TestValidateBootstrapContextArgs(t *testing.T) {
	tests := []struct {
		name  string
		data  map[string]any
		valid bool
	}{
		{
			name:  "valid empty object",
			data:  map[string]any{},
			valid: true,
		},
		{
			name:  "valid with project",
			data:  map[string]any{"project": "my-project"},
			valid: true,
		},
		{
			name:  "valid with timeframe",
			data:  map[string]any{"timeframe": "7d"},
			valid: true,
		},
		{
			name:  "valid with include_referenced true",
			data:  map[string]any{"include_referenced": true},
			valid: true,
		},
		{
			name:  "valid with include_referenced false",
			data:  map[string]any{"include_referenced": false},
			valid: true,
		},
		{
			name:  "valid full",
			data:  map[string]any{"project": "my-project", "timeframe": "7d", "include_referenced": false},
			valid: true,
		},
		{
			name:  "invalid project type",
			data:  map[string]any{"project": 123},
			valid: false,
		},
		{
			name:  "invalid timeframe type",
			data:  map[string]any{"timeframe": 123},
			valid: false,
		},
		{
			name:  "invalid include_referenced type",
			data:  map[string]any{"include_referenced": "yes"},
			valid: false,
		},
		{
			name:  "additional properties rejected",
			data:  map[string]any{"unknownProp": "value"},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateBootstrapContextArgs(tt.data)
			if result != tt.valid {
				t.Errorf("ValidateBootstrapContextArgs() = %v, want %v", result, tt.valid)
			}
		})
	}
}

func TestParseBootstrapContextArgs(t *testing.T) {
	t.Run("applies defaults", func(t *testing.T) {
		args, err := ParseBootstrapContextArgs(map[string]any{})
		if err != nil {
			t.Fatalf("ParseBootstrapContextArgs() error = %v", err)
		}
		if args.Timeframe == nil || *args.Timeframe != "5d" {
			t.Errorf("Timeframe = %v, want %v", args.Timeframe, "5d")
		}
		if args.IncludeReferenced == nil || *args.IncludeReferenced != true {
			t.Errorf("IncludeReferenced = %v, want %v", args.IncludeReferenced, true)
		}
	})

	t.Run("preserves provided values", func(t *testing.T) {
		args, err := ParseBootstrapContextArgs(map[string]any{
			"project":            "my-project",
			"timeframe":          "7d",
			"include_referenced": false,
		})
		if err != nil {
			t.Fatalf("ParseBootstrapContextArgs() error = %v", err)
		}
		if args.Project == nil || *args.Project != "my-project" {
			t.Errorf("Project = %v, want %v", *args.Project, "my-project")
		}
		if args.Timeframe == nil || *args.Timeframe != "7d" {
			t.Errorf("Timeframe = %v, want %v", *args.Timeframe, "7d")
		}
		if args.IncludeReferenced == nil || *args.IncludeReferenced != false {
			t.Errorf("IncludeReferenced = %v, want %v", *args.IncludeReferenced, false)
		}
	})

	t.Run("returns error for invalid project type", func(t *testing.T) {
		_, err := ParseBootstrapContextArgs(map[string]any{"project": 123})
		if err == nil {
			t.Error("ParseBootstrapContextArgs() should return error for invalid project type")
		}
	})

	t.Run("returns error for additional properties", func(t *testing.T) {
		_, err := ParseBootstrapContextArgs(map[string]any{"unknownProp": "value"})
		if err == nil {
			t.Error("ParseBootstrapContextArgs() should return error for additional properties")
		}
	})
}

func TestGetBootstrapContextArgsErrors(t *testing.T) {
	t.Run("returns empty for valid data", func(t *testing.T) {
		errors := GetBootstrapContextArgsErrors(map[string]any{})
		if len(errors) != 0 {
			t.Errorf("GetBootstrapContextArgsErrors() returned %d errors, want 0", len(errors))
		}
	})

	t.Run("returns errors for invalid data", func(t *testing.T) {
		errors := GetBootstrapContextArgsErrors(map[string]any{"project": 123})
		if len(errors) == 0 {
			t.Error("GetBootstrapContextArgsErrors() should return errors for invalid project type")
		}
		// Check error structure
		for _, e := range errors {
			if e.Constraint == "" {
				t.Error("ValidationError.Constraint should not be empty")
			}
			if e.Message == "" {
				t.Error("ValidationError.Message should not be empty")
			}
		}
	})
}
