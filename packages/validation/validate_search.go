package validation

import (
	"embed"
	"encoding/json"
	"fmt"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed schemas/tools/search.schema.json
var searchSchemaFS embed.FS

// SearchArgs represents validated search arguments.
// Matches the TypeScript SearchArgs interface from generated/types.ts.
type SearchArgs struct {
	Query       string  `json:"query"`
	Limit       *int    `json:"limit,omitempty"`
	Threshold   *float64 `json:"threshold,omitempty"`
	Mode        *string `json:"mode,omitempty"`
	Depth       *int    `json:"depth,omitempty"`
	Project     *string `json:"project,omitempty"`
	FullContext *bool   `json:"full_context,omitempty"`
}

// SearchArgsDefaults contains default values for SearchArgs.
var SearchArgsDefaults = struct {
	Limit       int
	Threshold   float64
	Mode        string
	Depth       int
	FullContext bool
}{
	Limit:       10,
	Threshold:   0.7,
	Mode:        "auto",
	Depth:       0,
	FullContext: false,
}

var (
	searchSchemaOnce     sync.Once
	searchSchemaCompiled *jsonschema.Schema
	searchSchemaErr      error
)

// getSearchSchema returns the compiled search schema, loading it once.
func getSearchSchema() (*jsonschema.Schema, error) {
	searchSchemaOnce.Do(func() {
		schemaData, err := searchSchemaFS.ReadFile("schemas/tools/search.schema.json")
		if err != nil {
			searchSchemaErr = fmt.Errorf("failed to read search schema: %w", err)
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(schemaData, &schemaDoc); err != nil {
			searchSchemaErr = fmt.Errorf("failed to parse search schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("search.schema.json", schemaDoc); err != nil {
			searchSchemaErr = fmt.Errorf("failed to add search schema resource: %w", err)
			return
		}

		searchSchemaCompiled, searchSchemaErr = c.Compile("search.schema.json")
	})
	return searchSchemaCompiled, searchSchemaErr
}

// ValidateSearchArgs validates data against the SearchArgs JSON Schema.
// Returns true if valid, false otherwise.
// Use GetSearchArgsErrors for detailed error information.
func ValidateSearchArgs(data any) bool {
	schema, err := getSearchSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseSearchArgs validates and parses data into SearchArgs with defaults applied.
// Returns validated SearchArgs or error with structured message.
func ParseSearchArgs(data any) (*SearchArgs, error) {
	schema, err := getSearchSchema()
	if err != nil {
		return nil, fmt.Errorf("schema error: %w", err)
	}

	// Validate against schema
	if err := schema.Validate(data); err != nil {
		return nil, formatSchemaError(err)
	}

	// Convert to JSON and back to apply structure
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal error: %w", err)
	}

	var args SearchArgs
	if err := json.Unmarshal(jsonBytes, &args); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	// Apply defaults
	applySearchArgsDefaults(&args)

	return &args, nil
}

// applySearchArgsDefaults applies default values to optional fields.
func applySearchArgsDefaults(args *SearchArgs) {
	if args.Limit == nil {
		limit := SearchArgsDefaults.Limit
		args.Limit = &limit
	}
	if args.Threshold == nil {
		threshold := SearchArgsDefaults.Threshold
		args.Threshold = &threshold
	}
	if args.Mode == nil {
		mode := SearchArgsDefaults.Mode
		args.Mode = &mode
	}
	if args.Depth == nil {
		depth := SearchArgsDefaults.Depth
		args.Depth = &depth
	}
	if args.FullContext == nil {
		fullContext := SearchArgsDefaults.FullContext
		args.FullContext = &fullContext
	}
}

// GetSearchArgsErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetSearchArgsErrors(data any) []ValidationError {
	schema, err := getSearchSchema()
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

	return extractValidationErrors(err)
}

// formatSchemaError converts jsonschema validation errors to a readable string.
func formatSchemaError(err error) error {
	validationErrors := extractValidationErrors(err)
	if len(validationErrors) == 0 {
		return fmt.Errorf("validation failed")
	}

	var parts []string
	for _, ve := range validationErrors {
		field := ve.Field
		if field == "" {
			field = "root"
		}
		parts = append(parts, fmt.Sprintf("%s: %s (%s)", field, ve.Message, ve.Constraint))
	}
	return fmt.Errorf(strings.Join(parts, "; "))
}

// extractValidationErrors extracts ValidationError slice from jsonschema error.
func extractValidationErrors(err error) []ValidationError {
	if err == nil {
		return []ValidationError{}
	}

	var errors []ValidationError

	// Handle ValidationError from jsonschema v6
	if ve, ok := err.(*jsonschema.ValidationError); ok {
		errors = append(errors, extractFromValidationError(ve)...)
	} else {
		// Generic error
		errors = append(errors, ValidationError{
			Field:      "",
			Constraint: "unknown",
			Message:    err.Error(),
		})
	}

	return errors
}

// extractFromValidationError recursively extracts errors from ValidationError.
func extractFromValidationError(ve *jsonschema.ValidationError) []ValidationError {
	var errors []ValidationError

	// Get instance location as path string
	instancePath := "/" + strings.Join(ve.InstanceLocation, "/")
	if instancePath == "/" {
		instancePath = ""
	}

	// Get constraint from ErrorKind's KeywordPath
	constraint := "unknown"
	if ve.ErrorKind != nil {
		keywordPath := ve.ErrorKind.KeywordPath()
		if len(keywordPath) > 0 {
			constraint = keywordPath[len(keywordPath)-1]
		}
	}

	// Get error message
	message := ve.Error()
	if message == "" {
		message = "Validation failed"
	}

	// Add this error
	errors = append(errors, ValidationError{
		Field:      instancePath,
		Constraint: constraint,
		Message:    message,
	})

	// Process causes (nested errors)
	for _, cause := range ve.Causes {
		errors = append(errors, extractFromValidationError(cause)...)
	}

	return errors
}
