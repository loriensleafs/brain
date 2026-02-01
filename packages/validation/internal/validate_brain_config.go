package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// MemoriesMode determines where project memories are stored.
type MemoriesMode string

const (
	MemoriesModeDefault MemoriesMode = "DEFAULT"
	MemoriesModeCode    MemoriesMode = "CODE"
	MemoriesModeCustom  MemoriesMode = "CUSTOM"
)

// LogLevel for Brain operations.
type LogLevel string

const (
	LogLevelTrace LogLevel = "trace"
	LogLevelDebug LogLevel = "debug"
	LogLevelInfo  LogLevel = "info"
	LogLevelWarn  LogLevel = "warn"
	LogLevelError LogLevel = "error"
)

// ProjectConfig represents project-specific configuration.
type ProjectConfig struct {
	CodePath     string        `json:"code_path"`
	MemoriesPath *string       `json:"memories_path,omitempty"`
	MemoriesMode *MemoriesMode `json:"memories_mode,omitempty"`
}

// DefaultsConfig represents global default settings.
type DefaultsConfig struct {
	MemoriesLocation string       `json:"memories_location"`
	MemoriesMode     MemoriesMode `json:"memories_mode"`
}

// SyncConfig represents file synchronization settings.
type SyncConfig struct {
	Enabled bool `json:"enabled"`
	DelayMs int  `json:"delay_ms"`
}

// LoggingConfig represents logging configuration.
type LoggingConfig struct {
	Level LogLevel `json:"level"`
}

// WatcherConfig represents file watcher configuration.
type WatcherConfig struct {
	Enabled    bool `json:"enabled"`
	DebounceMs int  `json:"debounce_ms"`
}

// BrainConfig represents the complete Brain configuration.
type BrainConfig struct {
	Schema   *string                  `json:"$schema,omitempty"`
	Version  string                   `json:"version"`
	Defaults DefaultsConfig           `json:"defaults"`
	Projects map[string]ProjectConfig `json:"projects"`
	Sync     SyncConfig               `json:"sync"`
	Logging  LoggingConfig            `json:"logging"`
	Watcher  WatcherConfig            `json:"watcher"`
}

// BrainConfigDefaults contains default values for BrainConfig.
var BrainConfigDefaults = struct {
	Version          string
	MemoriesMode     MemoriesMode
	SyncEnabled      bool
	SyncDelayMs      int
	LogLevel         LogLevel
	WatcherEnabled   bool
	WatcherDebounce  int
}{
	Version:          "2.0.0",
	MemoriesMode:     MemoriesModeDefault,
	SyncEnabled:      true,
	SyncDelayMs:      500,
	LogLevel:         LogLevelInfo,
	WatcherEnabled:   true,
	WatcherDebounce:  2000,
}

var (
	brainConfigSchemaOnce     sync.Once
	brainConfigSchemaCompiled *jsonschema.Schema
	brainConfigSchemaErr      error
	brainConfigSchemaData     []byte
)

// SetBrainConfigSchemaData sets the schema data for BrainConfig validation.
// This must be called before any validation functions are used.
func SetBrainConfigSchemaData(data []byte) {
	brainConfigSchemaData = data
}

// getBrainConfigSchema returns the compiled schema, loading it once.
func getBrainConfigSchema() (*jsonschema.Schema, error) {
	brainConfigSchemaOnce.Do(func() {
		if brainConfigSchemaData == nil {
			brainConfigSchemaErr = fmt.Errorf("brain config schema data not set; call SetBrainConfigSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(brainConfigSchemaData, &schemaDoc); err != nil {
			brainConfigSchemaErr = fmt.Errorf("failed to parse brain config schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("brain-config.schema.json", schemaDoc); err != nil {
			brainConfigSchemaErr = fmt.Errorf("failed to add brain config schema resource: %w", err)
			return
		}

		brainConfigSchemaCompiled, brainConfigSchemaErr = c.Compile("brain-config.schema.json")
	})
	return brainConfigSchemaCompiled, brainConfigSchemaErr
}

// ValidateBrainConfig validates data against the BrainConfig JSON Schema.
// Returns true if valid, false otherwise.
func ValidateBrainConfig(data any) bool {
	schema, err := getBrainConfigSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// ParseBrainConfig validates and parses data into BrainConfig with defaults applied.
// Returns validated BrainConfig or error with structured message.
func ParseBrainConfig(data any) (*BrainConfig, error) {
	schema, err := getBrainConfigSchema()
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

	var config BrainConfig
	if err := json.Unmarshal(jsonBytes, &config); err != nil {
		return nil, fmt.Errorf("unmarshal error: %w", err)
	}

	applyBrainConfigDefaults(&config)

	return &config, nil
}

// applyBrainConfigDefaults applies default values to optional fields.
func applyBrainConfigDefaults(config *BrainConfig) {
	// Projects defaults to empty map
	if config.Projects == nil {
		config.Projects = make(map[string]ProjectConfig)
	}

	// Defaults.MemoriesMode defaults to DEFAULT
	if config.Defaults.MemoriesMode == "" {
		config.Defaults.MemoriesMode = BrainConfigDefaults.MemoriesMode
	}

	// Sync defaults
	if !config.Sync.Enabled && config.Sync.DelayMs == 0 {
		config.Sync.Enabled = BrainConfigDefaults.SyncEnabled
		config.Sync.DelayMs = BrainConfigDefaults.SyncDelayMs
	}

	// Logging defaults
	if config.Logging.Level == "" {
		config.Logging.Level = BrainConfigDefaults.LogLevel
	}

	// Watcher defaults
	if !config.Watcher.Enabled && config.Watcher.DebounceMs == 0 {
		config.Watcher.Enabled = BrainConfigDefaults.WatcherEnabled
		config.Watcher.DebounceMs = BrainConfigDefaults.WatcherDebounce
	}
}

// GetBrainConfigErrors returns structured validation errors for data.
// Returns empty slice if valid.
func GetBrainConfigErrors(data any) []ValidationError {
	schema, err := getBrainConfigSchema()
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

// DefaultBrainConfig returns a new BrainConfig with default values.
func DefaultBrainConfig() *BrainConfig {
	schemaURL := "https://brain.dev/schemas/config-v2.json"
	return &BrainConfig{
		Schema:  &schemaURL,
		Version: BrainConfigDefaults.Version,
		Defaults: DefaultsConfig{
			MemoriesLocation: "~/memories",
			MemoriesMode:     BrainConfigDefaults.MemoriesMode,
		},
		Projects: make(map[string]ProjectConfig),
		Sync: SyncConfig{
			Enabled: BrainConfigDefaults.SyncEnabled,
			DelayMs: BrainConfigDefaults.SyncDelayMs,
		},
		Logging: LoggingConfig{
			Level: BrainConfigDefaults.LogLevel,
		},
		Watcher: WatcherConfig{
			Enabled:    BrainConfigDefaults.WatcherEnabled,
			DebounceMs: BrainConfigDefaults.WatcherDebounce,
		},
	}
}
