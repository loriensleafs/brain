package validation

import (
	"embed"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed schemas/tools/bootstrap-context.schema.json
var bootstrapSchemaFS embed.FS

// BootstrapContextArgs represents validated bootstrap context arguments.
// Matches the TypeScript BootstrapContextArgs interface from generated/types.ts.
type BootstrapContextArgs struct {
	Project           *string `json:"project,omitempty"`
	Timeframe         *string `json:"timeframe,omitempty"`
	IncludeReferenced *bool   `json:"include_referenced,omitempty"`
}

// BootstrapContextArgsDefaults contains default values for BootstrapContextArgs.
var BootstrapContextArgsDefaults = struct {
	Timeframe         string
	IncludeReferenced bool
}{
	Timeframe:         "5d",
	IncludeReferenced: true,
}

var (
	bootstrapSchemaOnce     sync.Once
	bootstrapSchemaCompiled *jsonschema.Schema
	bootstrapSchemaErr      error
)

// getBootstrapSchema returns the compiled bootstrap schema, loading it once.
func getBootstrapSchema() (*jsonschema.Schema, error) {
	bootstrapSchemaOnce.Do(func() {
		schemaData, err := bootstrapSchemaFS.ReadFile("schemas/tools/bootstrap-context.schema.json")
		if err != nil {
			bootstrapSchemaErr = fmt.Errorf("failed to read bootstrap schema: %w", err)
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(schemaData, &schemaDoc); err != nil {
			bootstrapSchemaErr = fmt.Errorf("failed to parse bootstrap schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("bootstrap-context.schema.json", schemaDoc); err != nil {
			bootstrapSchemaErr = fmt.Errorf("failed to add bootstrap schema resource: %w", err)
			return
		}

		bootstrapSchemaCompiled, bootstrapSchemaErr = c.Compile("bootstrap-context.schema.json")
	})
	return bootstrapSchemaCompiled, bootstrapSchemaErr
}

// ValidateBootstrapContextArgs validates data against the BootstrapContextArgs JSON Schema.
// Returns true if valid, false otherwise.
// Use GetBootstrapContextArgsErrors for detailed error information.
func ValidateBootstrapContextArgs(data any) bool {
	schema, err := getBootstrapSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseBootstrapContextArgs validates and parses data into BootstrapContextArgs with defaults applied.
// Returns validated BootstrapContextArgs or error with structured message.
func ParseBootstrapContextArgs(data any) (*BootstrapContextArgs, error) {
	schema, err := getBootstrapSchema()
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

	var args BootstrapContextArgs
	if err := json.Unmarshal(jsonBytes, &args); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	// Apply defaults
	applyBootstrapContextArgsDefaults(&args)

	return &args, nil
}

// applyBootstrapContextArgsDefaults applies default values to optional fields.
func applyBootstrapContextArgsDefaults(args *BootstrapContextArgs) {
	if args.Timeframe == nil {
		timeframe := BootstrapContextArgsDefaults.Timeframe
		args.Timeframe = &timeframe
	}
	if args.IncludeReferenced == nil {
		includeReferenced := BootstrapContextArgsDefaults.IncludeReferenced
		args.IncludeReferenced = &includeReferenced
	}
}

// GetBootstrapContextArgsErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetBootstrapContextArgsErrors(data any) []ValidationError {
	schema, err := getBootstrapSchema()
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
