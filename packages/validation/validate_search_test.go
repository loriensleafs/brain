package validation

import (
	"testing"
)

func TestValidateSearchArgs(t *testing.T) {
	tests := []struct {
		name  string
		data  map[string]any
		valid bool
	}{
		{
			name:  "valid minimal",
			data:  map[string]any{"query": "test"},
			valid: true,
		},
		{
			name:  "valid full",
			data:  map[string]any{"query": "test", "limit": 50, "threshold": 0.5, "mode": "semantic", "depth": 2, "project": "brain", "full_context": true},
			valid: true,
		},
		{
			name:  "missing query",
			data:  map[string]any{},
			valid: false,
		},
		{
			name:  "empty query",
			data:  map[string]any{"query": ""},
			valid: false,
		},
		{
			name:  "limit below minimum",
			data:  map[string]any{"query": "test", "limit": 0},
			valid: false,
		},
		{
			name:  "limit above maximum",
			data:  map[string]any{"query": "test", "limit": 101},
			valid: false,
		},
		{
			name:  "threshold below minimum",
			data:  map[string]any{"query": "test", "threshold": -0.1},
			valid: false,
		},
		{
			name:  "threshold above maximum",
			data:  map[string]any{"query": "test", "threshold": 1.1},
			valid: false,
		},
		{
			name:  "invalid mode",
			data:  map[string]any{"query": "test", "mode": "invalid"},
			valid: false,
		},
		{
			name:  "depth below minimum",
			data:  map[string]any{"query": "test", "depth": -1},
			valid: false,
		},
		{
			name:  "depth above maximum",
			data:  map[string]any{"query": "test", "depth": 4},
			valid: false,
		},
		{
			name:  "additional properties rejected",
			data:  map[string]any{"query": "test", "unknownProp": "value"},
			valid: false,
		},
		{
			name:  "valid mode auto",
			data:  map[string]any{"query": "test", "mode": "auto"},
			valid: true,
		},
		{
			name:  "valid mode semantic",
			data:  map[string]any{"query": "test", "mode": "semantic"},
			valid: true,
		},
		{
			name:  "valid mode keyword",
			data:  map[string]any{"query": "test", "mode": "keyword"},
			valid: true,
		},
		{
			name:  "valid mode hybrid",
			data:  map[string]any{"query": "test", "mode": "hybrid"},
			valid: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateSearchArgs(tt.data)
			if result != tt.valid {
				t.Errorf("ValidateSearchArgs() = %v, want %v", result, tt.valid)
			}
		})
	}
}

func TestParseSearchArgs(t *testing.T) {
	t.Run("applies defaults", func(t *testing.T) {
		args, err := ParseSearchArgs(map[string]any{"query": "test"})
		if err != nil {
			t.Fatalf("ParseSearchArgs() error = %v", err)
		}
		if args.Query != "test" {
			t.Errorf("Query = %v, want %v", args.Query, "test")
		}
		if args.Limit == nil || *args.Limit != 10 {
			t.Errorf("Limit = %v, want %v", args.Limit, 10)
		}
		if args.Threshold == nil || *args.Threshold != 0.7 {
			t.Errorf("Threshold = %v, want %v", args.Threshold, 0.7)
		}
		if args.Mode == nil || *args.Mode != "auto" {
			t.Errorf("Mode = %v, want %v", args.Mode, "auto")
		}
		if args.Depth == nil || *args.Depth != 0 {
			t.Errorf("Depth = %v, want %v", args.Depth, 0)
		}
		if args.FullContext == nil || *args.FullContext != false {
			t.Errorf("FullContext = %v, want %v", args.FullContext, false)
		}
	})

	t.Run("preserves provided values", func(t *testing.T) {
		args, err := ParseSearchArgs(map[string]any{
			"query":        "my query",
			"limit":        50,
			"threshold":    0.5,
			"mode":         "semantic",
			"depth":        2,
			"project":      "my-project",
			"full_context": true,
		})
		if err != nil {
			t.Fatalf("ParseSearchArgs() error = %v", err)
		}
		if args.Query != "my query" {
			t.Errorf("Query = %v, want %v", args.Query, "my query")
		}
		if args.Limit == nil || *args.Limit != 50 {
			t.Errorf("Limit = %v, want %v", *args.Limit, 50)
		}
		if args.Threshold == nil || *args.Threshold != 0.5 {
			t.Errorf("Threshold = %v, want %v", *args.Threshold, 0.5)
		}
		if args.Mode == nil || *args.Mode != "semantic" {
			t.Errorf("Mode = %v, want %v", *args.Mode, "semantic")
		}
		if args.Depth == nil || *args.Depth != 2 {
			t.Errorf("Depth = %v, want %v", *args.Depth, 2)
		}
		if args.Project == nil || *args.Project != "my-project" {
			t.Errorf("Project = %v, want %v", *args.Project, "my-project")
		}
		if args.FullContext == nil || *args.FullContext != true {
			t.Errorf("FullContext = %v, want %v", *args.FullContext, true)
		}
	})

	t.Run("returns error for invalid data", func(t *testing.T) {
		_, err := ParseSearchArgs(map[string]any{"query": ""})
		if err == nil {
			t.Error("ParseSearchArgs() should return error for empty query")
		}
	})

	t.Run("returns error for missing query", func(t *testing.T) {
		_, err := ParseSearchArgs(map[string]any{})
		if err == nil {
			t.Error("ParseSearchArgs() should return error for missing query")
		}
	})
}

func TestGetSearchArgsErrors(t *testing.T) {
	t.Run("returns empty for valid data", func(t *testing.T) {
		errors := GetSearchArgsErrors(map[string]any{"query": "test"})
		if len(errors) != 0 {
			t.Errorf("GetSearchArgsErrors() returned %d errors, want 0", len(errors))
		}
	})

	t.Run("returns errors for invalid data", func(t *testing.T) {
		errors := GetSearchArgsErrors(map[string]any{"query": ""})
		if len(errors) == 0 {
			t.Error("GetSearchArgsErrors() should return errors for empty query")
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
