package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// ListFeaturesByPriorityArgs represents validated list_features_by_priority arguments.
// Matches the TypeScript ListFeaturesByPriorityArgs interface from generated/types.ts.
type ListFeaturesByPriorityArgs struct {
	Project          *string `json:"project,omitempty"`
	EntityType       *string `json:"entity_type,omitempty"`
	IncludeCompleted *bool   `json:"include_completed,omitempty"`
	Format           *string `json:"format,omitempty"`
}

// ListFeaturesByPriorityArgsDefaults contains default values for ListFeaturesByPriorityArgs.
var ListFeaturesByPriorityArgsDefaults = struct {
	EntityType       string
	IncludeCompleted bool
	Format           string
}{
	EntityType:       "feature",
	IncludeCompleted: false,
	Format:           "list",
}

var (
	listFeaturesByPrioritySchemaOnce     sync.Once
	listFeaturesByPrioritySchemaCompiled *jsonschema.Schema
	listFeaturesByPrioritySchemaErr      error
	listFeaturesByPrioritySchemaData     []byte
)

// SetListFeaturesByPrioritySchemaData sets the schema data for list_features_by_priority validation.
// This must be called before any validation functions are used.
// The data is typically embedded by the parent package.
func SetListFeaturesByPrioritySchemaData(data []byte) {
	listFeaturesByPrioritySchemaData = data
}

// getListFeaturesByPrioritySchema returns the compiled schema, loading it once.
func getListFeaturesByPrioritySchema() (*jsonschema.Schema, error) {
	listFeaturesByPrioritySchemaOnce.Do(func() {
		if listFeaturesByPrioritySchemaData == nil {
			listFeaturesByPrioritySchemaErr = fmt.Errorf("list_features_by_priority schema data not set; call SetListFeaturesByPrioritySchemaData first")
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(listFeaturesByPrioritySchemaData, &schemaDoc); err != nil {
			listFeaturesByPrioritySchemaErr = fmt.Errorf("failed to parse list_features_by_priority schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("list-features-by-priority.schema.json", schemaDoc); err != nil {
			listFeaturesByPrioritySchemaErr = fmt.Errorf("failed to add list_features_by_priority schema resource: %w", err)
			return
		}

		listFeaturesByPrioritySchemaCompiled, listFeaturesByPrioritySchemaErr = c.Compile("list-features-by-priority.schema.json")
	})
	return listFeaturesByPrioritySchemaCompiled, listFeaturesByPrioritySchemaErr
}

// ValidateListFeaturesByPriorityArgs validates data against the ListFeaturesByPriorityArgs JSON Schema.
// Returns true if valid, false otherwise.
// Use GetListFeaturesByPriorityArgsErrors for detailed error information.
func ValidateListFeaturesByPriorityArgs(data any) bool {
	schema, err := getListFeaturesByPrioritySchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseListFeaturesByPriorityArgs validates and parses data into ListFeaturesByPriorityArgs with defaults applied.
// Returns validated ListFeaturesByPriorityArgs or error with structured message.
func ParseListFeaturesByPriorityArgs(data any) (*ListFeaturesByPriorityArgs, error) {
	schema, err := getListFeaturesByPrioritySchema()
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

	var args ListFeaturesByPriorityArgs
	if err := json.Unmarshal(jsonBytes, &args); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	// Apply defaults
	applyListFeaturesByPriorityArgsDefaults(&args)

	return &args, nil
}

// applyListFeaturesByPriorityArgsDefaults applies default values to optional fields.
func applyListFeaturesByPriorityArgsDefaults(args *ListFeaturesByPriorityArgs) {
	if args.EntityType == nil {
		entityType := ListFeaturesByPriorityArgsDefaults.EntityType
		args.EntityType = &entityType
	}
	if args.IncludeCompleted == nil {
		includeCompleted := ListFeaturesByPriorityArgsDefaults.IncludeCompleted
		args.IncludeCompleted = &includeCompleted
	}
	if args.Format == nil {
		format := ListFeaturesByPriorityArgsDefaults.Format
		args.Format = &format
	}
}

// GetListFeaturesByPriorityArgsErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetListFeaturesByPriorityArgsErrors(data any) []ValidationError {
	schema, err := getListFeaturesByPrioritySchema()
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
