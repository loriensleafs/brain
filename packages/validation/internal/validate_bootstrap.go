package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

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
	bootstrapSchemaData     []byte
)

// SetBootstrapSchemaData sets the schema data for bootstrap validation.
// This must be called before any validation functions are used.
// The data is typically embedded by the parent package.
func SetBootstrapSchemaData(data []byte) {
	bootstrapSchemaData = data
}

// getBootstrapSchema returns the compiled bootstrap schema, loading it once.
func getBootstrapSchema() (*jsonschema.Schema, error) {
	bootstrapSchemaOnce.Do(func() {
		if bootstrapSchemaData == nil {
			bootstrapSchemaErr = fmt.Errorf("bootstrap schema data not set; call SetBootstrapSchemaData first")
			return
		}

		// Parse JSON schema into interface{}
		var schemaDoc any
		if err := json.Unmarshal(bootstrapSchemaData, &schemaDoc); err != nil {
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
		return nil, FormatSchemaError(err)
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

	return ExtractValidationErrors(err)
}
