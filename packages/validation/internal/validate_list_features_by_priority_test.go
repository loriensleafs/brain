package internal

import (
	"testing"
)

// testSchemaData is the schema used for testing
var testListFeaturesByPrioritySchemaData = []byte(`{
	"$schema": "http://json-schema.org/draft-07/schema#",
	"$id": "https://brain.dev/schemas/tools/list-features-by-priority.json",
	"title": "ListFeaturesByPriorityArgs",
	"type": "object",
	"properties": {
		"project": {"type": "string"},
		"entity_type": {"type": "string", "enum": ["feature", "task", "phase"], "default": "feature"},
		"include_completed": {"type": "boolean", "default": false},
		"format": {"type": "string", "enum": ["list", "tree"], "default": "list"}
	},
	"required": [],
	"additionalProperties": false
}`)

func init() {
	// Initialize schema data for tests
	SetListFeaturesByPrioritySchemaData(testListFeaturesByPrioritySchemaData)
}

func TestValidateListFeaturesByPriorityArgs_EmptyObject(t *testing.T) {
	input := map[string]any{}
	if !ValidateListFeaturesByPriorityArgs(input) {
		t.Error("expected empty object to be valid")
	}
}

func TestValidateListFeaturesByPriorityArgs_WithProject(t *testing.T) {
	input := map[string]any{"project": "test-project"}
	if !ValidateListFeaturesByPriorityArgs(input) {
		t.Error("expected object with project to be valid")
	}
}

func TestValidateListFeaturesByPriorityArgs_ValidEntityTypes(t *testing.T) {
	types := []string{"feature", "task", "phase"}
	for _, entityType := range types {
		input := map[string]any{"entity_type": entityType}
		if !ValidateListFeaturesByPriorityArgs(input) {
			t.Errorf("expected entity_type '%s' to be valid", entityType)
		}
	}
}

func TestValidateListFeaturesByPriorityArgs_InvalidEntityType(t *testing.T) {
	input := map[string]any{"entity_type": "invalid"}
	if ValidateListFeaturesByPriorityArgs(input) {
		t.Error("expected invalid entity_type to fail validation")
	}
}

func TestValidateListFeaturesByPriorityArgs_ValidFormats(t *testing.T) {
	formats := []string{"list", "tree"}
	for _, format := range formats {
		input := map[string]any{"format": format}
		if !ValidateListFeaturesByPriorityArgs(input) {
			t.Errorf("expected format '%s' to be valid", format)
		}
	}
}

func TestValidateListFeaturesByPriorityArgs_InvalidFormat(t *testing.T) {
	input := map[string]any{"format": "table"}
	if ValidateListFeaturesByPriorityArgs(input) {
		t.Error("expected invalid format to fail validation")
	}
}

func TestValidateListFeaturesByPriorityArgs_AdditionalPropertiesRejected(t *testing.T) {
	input := map[string]any{"unknown_field": "value"}
	if ValidateListFeaturesByPriorityArgs(input) {
		t.Error("expected additional properties to fail validation")
	}
}

func TestValidateListFeaturesByPriorityArgs_AllFields(t *testing.T) {
	input := map[string]any{
		"project":           "test-project",
		"entity_type":       "feature",
		"include_completed": false,
		"format":            "list",
	}
	if !ValidateListFeaturesByPriorityArgs(input) {
		t.Error("expected all valid fields to pass validation")
	}
}

func TestParseListFeaturesByPriorityArgs_AppliesDefaults(t *testing.T) {
	args, err := ParseListFeaturesByPriorityArgs(map[string]any{})
	if err != nil {
		t.Fatalf("ParseListFeaturesByPriorityArgs() error = %v", err)
	}

	if args.EntityType == nil || *args.EntityType != "feature" {
		t.Errorf("expected entity_type default 'feature', got %v", args.EntityType)
	}

	if args.IncludeCompleted == nil || *args.IncludeCompleted != false {
		t.Errorf("expected include_completed default false, got %v", args.IncludeCompleted)
	}

	if args.Format == nil || *args.Format != "list" {
		t.Errorf("expected format default 'list', got %v", args.Format)
	}
}

func TestParseListFeaturesByPriorityArgs_PreservesValues(t *testing.T) {
	input := map[string]any{
		"project":           "my-project",
		"entity_type":       "task",
		"include_completed": true,
		"format":            "tree",
	}
	args, err := ParseListFeaturesByPriorityArgs(input)
	if err != nil {
		t.Fatalf("ParseListFeaturesByPriorityArgs() error = %v", err)
	}

	if args.Project == nil || *args.Project != "my-project" {
		t.Errorf("expected project 'my-project', got %v", args.Project)
	}

	if args.EntityType == nil || *args.EntityType != "task" {
		t.Errorf("expected entity_type 'task', got %v", args.EntityType)
	}

	if args.IncludeCompleted == nil || *args.IncludeCompleted != true {
		t.Errorf("expected include_completed true, got %v", args.IncludeCompleted)
	}

	if args.Format == nil || *args.Format != "tree" {
		t.Errorf("expected format 'tree', got %v", args.Format)
	}
}

func TestParseListFeaturesByPriorityArgs_InvalidInput(t *testing.T) {
	input := map[string]any{"entity_type": "invalid"}
	_, err := ParseListFeaturesByPriorityArgs(input)
	if err == nil {
		t.Error("expected error for invalid input, got nil")
	}
}

func TestGetListFeaturesByPriorityArgsErrors_ValidInput(t *testing.T) {
	errors := GetListFeaturesByPriorityArgsErrors(map[string]any{})
	if len(errors) != 0 {
		t.Errorf("expected no errors for valid input, got %v", errors)
	}
}

func TestGetListFeaturesByPriorityArgsErrors_InvalidInput(t *testing.T) {
	errors := GetListFeaturesByPriorityArgsErrors(map[string]any{"entity_type": "invalid"})
	if len(errors) == 0 {
		t.Error("expected errors for invalid input, got none")
	}
}
