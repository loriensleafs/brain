package internal

import (
	"encoding/json"
	"testing"
)

// Test schema data - embedded directly for unit tests
var testBrainConfigSchema = []byte(`{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://brain.dev/schemas/config/brain-config.json",
  "title": "BrainConfig",
  "type": "object",
  "properties": {
    "$schema": { "type": "string" },
    "version": { "type": "string", "const": "2.0.0" },
    "defaults": { "$ref": "#/$defs/DefaultsConfig" },
    "projects": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/ProjectConfig" },
      "default": {}
    },
    "sync": { "$ref": "#/$defs/SyncConfig" },
    "logging": { "$ref": "#/$defs/LoggingConfig" },
    "watcher": { "$ref": "#/$defs/WatcherConfig" }
  },
  "required": ["version", "defaults", "projects", "sync", "logging", "watcher"],
  "additionalProperties": false,
  "$defs": {
    "MemoriesMode": {
      "type": "string",
      "enum": ["DEFAULT", "CODE", "CUSTOM"]
    },
    "LogLevel": {
      "type": "string",
      "enum": ["trace", "debug", "info", "warn", "error"]
    },
    "ProjectConfig": {
      "type": "object",
      "properties": {
        "code_path": { "type": "string", "minLength": 1 },
        "memories_path": { "type": "string" },
        "memories_mode": { "$ref": "#/$defs/MemoriesMode" }
      },
      "required": ["code_path"],
      "additionalProperties": false
    },
    "DefaultsConfig": {
      "type": "object",
      "properties": {
        "memories_location": { "type": "string", "minLength": 1 },
        "memories_mode": { "$ref": "#/$defs/MemoriesMode", "default": "DEFAULT" }
      },
      "required": ["memories_location"],
      "additionalProperties": false
    },
    "SyncConfig": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "delay_ms": { "type": "integer", "minimum": 0, "default": 500 }
      },
      "additionalProperties": false
    },
    "LoggingConfig": {
      "type": "object",
      "properties": {
        "level": { "$ref": "#/$defs/LogLevel", "default": "info" }
      },
      "additionalProperties": false
    },
    "WatcherConfig": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean", "default": true },
        "debounce_ms": { "type": "integer", "minimum": 0, "default": 2000 }
      },
      "additionalProperties": false
    }
  }
}`)

func init() {
	// Initialize schema data for all tests
	SetBrainConfigSchemaData(testBrainConfigSchema)
}

func TestValidateBrainConfig_ValidMinimal(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
		"projects": map[string]any{},
		"sync":     map[string]any{},
		"logging":  map[string]any{},
		"watcher":  map[string]any{},
	}

	if !ValidateBrainConfig(data) {
		errors := GetBrainConfigErrors(data)
		t.Errorf("Expected valid config, got errors: %v", errors)
	}
}

func TestValidateBrainConfig_ValidFull(t *testing.T) {

	data := map[string]any{
		"$schema": "https://brain.dev/schemas/config-v2.json",
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
			"memories_mode":     "DEFAULT",
		},
		"projects": map[string]any{
			"brain": map[string]any{
				"code_path":     "/Users/dev/brain",
				"memories_path": "/Users/dev/memories/brain",
				"memories_mode": "CUSTOM",
			},
		},
		"sync": map[string]any{
			"enabled":  true,
			"delay_ms": 500,
		},
		"logging": map[string]any{
			"level": "debug",
		},
		"watcher": map[string]any{
			"enabled":     true,
			"debounce_ms": 2000,
		},
	}

	if !ValidateBrainConfig(data) {
		errors := GetBrainConfigErrors(data)
		t.Errorf("Expected valid config, got errors: %v", errors)
	}
}

func TestValidateBrainConfig_MissingVersion(t *testing.T) {

	data := map[string]any{
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (missing version), got valid")
	}

	errors := GetBrainConfigErrors(data)
	if len(errors) == 0 {
		t.Error("Expected validation errors, got none")
	}
}

func TestValidateBrainConfig_WrongVersion(t *testing.T) {

	data := map[string]any{
		"version": "1.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (wrong version), got valid")
	}
}

func TestValidateBrainConfig_MissingDefaults(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (missing defaults), got valid")
	}
}

func TestValidateBrainConfig_InvalidMemoriesMode(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
			"memories_mode":     "INVALID",
		},
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (invalid memories_mode), got valid")
	}
}

func TestValidateBrainConfig_InvalidLogLevel(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
		"logging": map[string]any{
			"level": "verbose",
		},
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (invalid log level), got valid")
	}
}

func TestValidateBrainConfig_ProjectMissingCodePath(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
		"projects": map[string]any{
			"test": map[string]any{
				"memories_path": "/test/memories",
			},
		},
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (project missing code_path), got valid")
	}
}

func TestValidateBrainConfig_AdditionalProperties(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
		"unknown_field": "value",
	}

	if ValidateBrainConfig(data) {
		t.Error("Expected invalid config (additional properties), got valid")
	}
}

func TestParseBrainConfig_AppliesDefaults(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
		},
		"projects": map[string]any{},
		"sync":     map[string]any{},
		"logging":  map[string]any{},
		"watcher":  map[string]any{},
	}

	config, err := ParseBrainConfig(data)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	if config.Defaults.MemoriesMode != MemoriesModeDefault {
		t.Errorf("Expected memories_mode DEFAULT, got %s", config.Defaults.MemoriesMode)
	}

	if !config.Sync.Enabled {
		t.Error("Expected sync.enabled true")
	}

	if config.Sync.DelayMs != 500 {
		t.Errorf("Expected sync.delay_ms 500, got %d", config.Sync.DelayMs)
	}

	if config.Logging.Level != LogLevelInfo {
		t.Errorf("Expected logging.level info, got %s", config.Logging.Level)
	}

	if !config.Watcher.Enabled {
		t.Error("Expected watcher.enabled true")
	}

	if config.Watcher.DebounceMs != 2000 {
		t.Errorf("Expected watcher.debounce_ms 2000, got %d", config.Watcher.DebounceMs)
	}

	if config.Projects == nil {
		t.Error("Expected projects to be initialized")
	}
}

func TestParseBrainConfig_PreservesExplicitValues(t *testing.T) {

	data := map[string]any{
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/custom",
			"memories_mode":     "CODE",
		},
		"projects": map[string]any{},
		"sync": map[string]any{
			"enabled":  false,
			"delay_ms": 1000,
		},
		"logging": map[string]any{
			"level": "debug",
		},
		"watcher": map[string]any{
			"enabled":     false,
			"debounce_ms": 5000,
		},
	}

	config, err := ParseBrainConfig(data)
	if err != nil {
		t.Fatalf("Parse failed: %v", err)
	}

	if config.Defaults.MemoriesLocation != "~/custom" {
		t.Errorf("Expected memories_location ~/custom, got %s", config.Defaults.MemoriesLocation)
	}

	if config.Defaults.MemoriesMode != MemoriesModeCode {
		t.Errorf("Expected memories_mode CODE, got %s", config.Defaults.MemoriesMode)
	}

	if config.Logging.Level != LogLevelDebug {
		t.Errorf("Expected logging.level debug, got %s", config.Logging.Level)
	}
}

func TestDefaultBrainConfig(t *testing.T) {
	config := DefaultBrainConfig()

	if config.Version != "2.0.0" {
		t.Errorf("Expected version 2.0.0, got %s", config.Version)
	}

	if config.Schema == nil || *config.Schema != "https://brain.dev/schemas/config-v2.json" {
		t.Error("Expected schema URL")
	}

	if config.Defaults.MemoriesLocation != "~/memories" {
		t.Errorf("Expected memories_location ~/memories, got %s", config.Defaults.MemoriesLocation)
	}

	if config.Defaults.MemoriesMode != MemoriesModeDefault {
		t.Errorf("Expected memories_mode DEFAULT, got %s", config.Defaults.MemoriesMode)
	}

	if config.Projects == nil {
		t.Error("Expected projects to be initialized")
	}

	if len(config.Projects) != 0 {
		t.Errorf("Expected empty projects, got %d", len(config.Projects))
	}
}

func TestBrainConfig_JSONRoundTrip(t *testing.T) {
	config := DefaultBrainConfig()

	// Add a project
	config.Projects["test"] = ProjectConfig{
		CodePath: "/test/code",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(config)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	// Unmarshal back
	var parsed BrainConfig
	if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	if parsed.Version != config.Version {
		t.Errorf("Version mismatch: got %s, want %s", parsed.Version, config.Version)
	}

	if parsed.Defaults.MemoriesLocation != config.Defaults.MemoriesLocation {
		t.Errorf("MemoriesLocation mismatch: got %s, want %s",
			parsed.Defaults.MemoriesLocation, config.Defaults.MemoriesLocation)
	}

	if len(parsed.Projects) != len(config.Projects) {
		t.Errorf("Projects count mismatch: got %d, want %d",
			len(parsed.Projects), len(config.Projects))
	}

	if parsed.Projects["test"].CodePath != "/test/code" {
		t.Errorf("Project code_path mismatch: got %s", parsed.Projects["test"].CodePath)
	}
}
