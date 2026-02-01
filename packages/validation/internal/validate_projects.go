package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// ListProjectsArgs represents validated list_projects arguments.
// Matches the TypeScript ListProjectsArgs interface from generated/types.ts.
type ListProjectsArgs struct{}

// DeleteProjectArgs represents validated delete_project arguments.
// Matches the TypeScript DeleteProjectArgs interface from generated/types.ts.
type DeleteProjectArgs struct {
	Project     string `json:"project"`
	DeleteNotes *bool  `json:"delete_notes,omitempty"`
}

// DeleteProjectArgsDefaults contains default values for DeleteProjectArgs.
var DeleteProjectArgsDefaults = struct {
	DeleteNotes bool
}{
	DeleteNotes: false,
}

// ActiveProjectArgs represents validated active_project arguments.
// Matches the TypeScript ActiveProjectArgs interface from generated/types.ts.
type ActiveProjectArgs struct {
	Operation *string `json:"operation,omitempty"`
	Project   *string `json:"project,omitempty"`
}

// ActiveProjectArgsDefaults contains default values for ActiveProjectArgs.
var ActiveProjectArgsDefaults = struct {
	Operation string
}{
	Operation: "get",
}

var (
	listProjectsSchemaOnce     sync.Once
	listProjectsSchemaCompiled *jsonschema.Schema
	listProjectsSchemaErr      error
	listProjectsSchemaData     []byte

	deleteProjectSchemaOnce     sync.Once
	deleteProjectSchemaCompiled *jsonschema.Schema
	deleteProjectSchemaErr      error
	deleteProjectSchemaData     []byte

	activeProjectSchemaOnce     sync.Once
	activeProjectSchemaCompiled *jsonschema.Schema
	activeProjectSchemaErr      error
	activeProjectSchemaData     []byte
)

// SetListProjectsSchemaData sets the schema data for list_projects validation.
func SetListProjectsSchemaData(data []byte) {
	listProjectsSchemaData = data
}

// SetDeleteProjectSchemaData sets the schema data for delete_project validation.
func SetDeleteProjectSchemaData(data []byte) {
	deleteProjectSchemaData = data
}

// SetActiveProjectSchemaData sets the schema data for active_project validation.
func SetActiveProjectSchemaData(data []byte) {
	activeProjectSchemaData = data
}

// getListProjectsSchema returns the compiled list_projects schema, loading it once.
func getListProjectsSchema() (*jsonschema.Schema, error) {
	listProjectsSchemaOnce.Do(func() {
		if listProjectsSchemaData == nil {
			listProjectsSchemaErr = fmt.Errorf("list-projects schema data not set; call SetListProjectsSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(listProjectsSchemaData, &schemaDoc); err != nil {
			listProjectsSchemaErr = fmt.Errorf("failed to parse list-projects schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("list-projects.schema.json", schemaDoc); err != nil {
			listProjectsSchemaErr = fmt.Errorf("failed to add list-projects schema resource: %w", err)
			return
		}

		listProjectsSchemaCompiled, listProjectsSchemaErr = c.Compile("list-projects.schema.json")
	})
	return listProjectsSchemaCompiled, listProjectsSchemaErr
}

// getDeleteProjectSchema returns the compiled delete_project schema, loading it once.
func getDeleteProjectSchema() (*jsonschema.Schema, error) {
	deleteProjectSchemaOnce.Do(func() {
		if deleteProjectSchemaData == nil {
			deleteProjectSchemaErr = fmt.Errorf("delete-project schema data not set; call SetDeleteProjectSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(deleteProjectSchemaData, &schemaDoc); err != nil {
			deleteProjectSchemaErr = fmt.Errorf("failed to parse delete-project schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("delete-project.schema.json", schemaDoc); err != nil {
			deleteProjectSchemaErr = fmt.Errorf("failed to add delete-project schema resource: %w", err)
			return
		}

		deleteProjectSchemaCompiled, deleteProjectSchemaErr = c.Compile("delete-project.schema.json")
	})
	return deleteProjectSchemaCompiled, deleteProjectSchemaErr
}

// getActiveProjectSchema returns the compiled active_project schema, loading it once.
func getActiveProjectSchema() (*jsonschema.Schema, error) {
	activeProjectSchemaOnce.Do(func() {
		if activeProjectSchemaData == nil {
			activeProjectSchemaErr = fmt.Errorf("active-project schema data not set; call SetActiveProjectSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(activeProjectSchemaData, &schemaDoc); err != nil {
			activeProjectSchemaErr = fmt.Errorf("failed to parse active-project schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("active-project.schema.json", schemaDoc); err != nil {
			activeProjectSchemaErr = fmt.Errorf("failed to add active-project schema resource: %w", err)
			return
		}

		activeProjectSchemaCompiled, activeProjectSchemaErr = c.Compile("active-project.schema.json")
	})
	return activeProjectSchemaCompiled, activeProjectSchemaErr
}

// ValidateListProjectsArgs validates data against the ListProjectsArgs JSON Schema.
// Returns true if valid, false otherwise.
func ValidateListProjectsArgs(data any) bool {
	schema, err := getListProjectsSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseListProjectsArgs validates and parses data into ListProjectsArgs.
// Returns validated ListProjectsArgs or error with structured message.
func ParseListProjectsArgs(data any) (*ListProjectsArgs, error) {
	schema, err := getListProjectsSchema()
	if err != nil {
		return nil, fmt.Errorf("schema error: %w", err)
	}

	if err := schema.Validate(data); err != nil {
		return nil, FormatSchemaError(err)
	}

	return &ListProjectsArgs{}, nil
}

// GetListProjectsArgsErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetListProjectsArgsErrors(data any) []ValidationError {
	schema, err := getListProjectsSchema()
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

// ValidateDeleteProjectArgs validates data against the DeleteProjectArgs JSON Schema.
// Returns true if valid, false otherwise.
func ValidateDeleteProjectArgs(data any) bool {
	schema, err := getDeleteProjectSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseDeleteProjectArgs validates and parses data into DeleteProjectArgs with defaults applied.
// Returns validated DeleteProjectArgs or error with structured message.
func ParseDeleteProjectArgs(data any) (*DeleteProjectArgs, error) {
	schema, err := getDeleteProjectSchema()
	if err != nil {
		return nil, fmt.Errorf("schema error: %w", err)
	}

	if err := schema.Validate(data); err != nil {
		return nil, FormatSchemaError(err)
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	var args DeleteProjectArgs
	if err := json.Unmarshal(jsonBytes, &args); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	applyDeleteProjectArgsDefaults(&args)

	return &args, nil
}

// applyDeleteProjectArgsDefaults applies default values to optional fields.
func applyDeleteProjectArgsDefaults(args *DeleteProjectArgs) {
	if args.DeleteNotes == nil {
		deleteNotes := DeleteProjectArgsDefaults.DeleteNotes
		args.DeleteNotes = &deleteNotes
	}
}

// GetDeleteProjectArgsErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetDeleteProjectArgsErrors(data any) []ValidationError {
	schema, err := getDeleteProjectSchema()
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

// ValidateActiveProjectArgs validates data against the ActiveProjectArgs JSON Schema.
// Returns true if valid, false otherwise.
func ValidateActiveProjectArgs(data any) bool {
	schema, err := getActiveProjectSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseActiveProjectArgs validates and parses data into ActiveProjectArgs with defaults applied.
// Returns validated ActiveProjectArgs or error with structured message.
func ParseActiveProjectArgs(data any) (*ActiveProjectArgs, error) {
	schema, err := getActiveProjectSchema()
	if err != nil {
		return nil, fmt.Errorf("schema error: %w", err)
	}

	if err := schema.Validate(data); err != nil {
		return nil, FormatSchemaError(err)
	}

	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	var args ActiveProjectArgs
	if err := json.Unmarshal(jsonBytes, &args); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	applyActiveProjectArgsDefaults(&args)

	return &args, nil
}

// applyActiveProjectArgsDefaults applies default values to optional fields.
func applyActiveProjectArgsDefaults(args *ActiveProjectArgs) {
	if args.Operation == nil {
		operation := ActiveProjectArgsDefaults.Operation
		args.Operation = &operation
	}
}

// GetActiveProjectArgsErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetActiveProjectArgsErrors(data any) []ValidationError {
	schema, err := getActiveProjectSchema()
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
