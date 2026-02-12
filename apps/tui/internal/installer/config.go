package installer

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// ToolsConfig is the top-level container parsed from tools.config.yaml.
type ToolsConfig struct {
	Tools map[string]*ToolConfig `yaml:"tools"`
}

// ToolConfig defines all per-tool differences that drive the transform engine.
type ToolConfig struct {
	// Name is derived from the map key, not present in YAML.
	Name         string            `yaml:"-"`
	DisplayName  string            `yaml:"display_name"`
	Prefix       bool              `yaml:"prefix"`
	ConfigDir    string            `yaml:"config_dir"`
	Scopes       map[string]string `yaml:"scopes"`
	DefaultScope string            `yaml:"default_scope"`
	Agents       AgentConfig       `yaml:"agents"`
	Rules        RuleConfig        `yaml:"rules"`
	Hooks        ConfigFileConfig  `yaml:"hooks"`
	MCP          ConfigFileConfig  `yaml:"mcp"`
	Manifest     ManifestConfig    `yaml:"manifest"`
	Detection    DetectionConfig   `yaml:"detection"`
	Placement    string            `yaml:"placement"`
}

// AgentConfig controls how agent frontmatter is generated per tool.
type AgentConfig struct {
	Frontmatter []string `yaml:"frontmatter"`
}

// RuleConfig controls rule file generation per tool.
type RuleConfig struct {
	Extension        string            `yaml:"extension"`
	ExtraFrontmatter map[string]any    `yaml:"extra_frontmatter"`
	Routing          map[string]string `yaml:"routing"`           // filename -> output dir override (e.g., "AGENT-SYSTEM.md": ".agents/")
	InstructionsPath string            `yaml:"instructions_path"` // output path for composed instructions (e.g., "instructions/AGENTS.md")
}

// ConfigFileConfig controls hooks and MCP config file handling.
type ConfigFileConfig struct {
	Strategy string `yaml:"strategy"` // "direct", "merge", "none"
	Target   string `yaml:"target"`   // relative path within scope
}

// ManifestConfig controls how the tool manifest is generated.
type ManifestConfig struct {
	Type string `yaml:"type"` // "marketplace", "file_list"
}

// DetectionConfig controls how Brain installation is detected.
type DetectionConfig struct {
	BrainInstalled DetectionCheck `yaml:"brain_installed"`
}

// DetectionCheck is a discriminated union driven by the Type field.
type DetectionCheck struct {
	Type string   `yaml:"type"` // "json_key", "prefix_scan"
	File string   `yaml:"file"` // for json_key: path to JSON file
	Key  string   `yaml:"key"`  // for json_key: key to check
	Dirs []string `yaml:"dirs"` // for prefix_scan: directories to scan
}

// LoadToolConfigs reads and parses tools.config.yaml, populates derived fields,
// and validates every tool definition. Returns an error on any validation failure.
func LoadToolConfigs(path string) (*ToolsConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read tool config: %w", err)
	}

	var cfg ToolsConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse tool config: %w", err)
	}

	// Populate Name from map key.
	for name, tc := range cfg.Tools {
		tc.Name = name
	}

	if err := ValidateAllToolConfigs(&cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

// ValidateAllToolConfigs validates every tool in the config.
func ValidateAllToolConfigs(cfg *ToolsConfig) error {
	if len(cfg.Tools) == 0 {
		return fmt.Errorf("tool config: no tools defined")
	}

	var allErrs []string
	for name, tc := range cfg.Tools {
		if err := ValidateToolConfig(name, tc); err != nil {
			allErrs = append(allErrs, err.Error())
		}
	}

	if len(allErrs) > 0 {
		return fmt.Errorf("tool config validation failed:\n%s", strings.Join(allErrs, "\n"))
	}
	return nil
}

// Allowed values for enum-style config fields.
var (
	validStrategies = map[string]bool{"direct": true, "merge": true, "none": true}
	validPlacements = map[string]bool{"marketplace": true, "copy_and_merge": true}
	validManifests  = map[string]bool{"marketplace": true, "file_list": true}
)

// ValidateToolConfig checks all 11 validation rules from REQ-001.
func ValidateToolConfig(name string, tc *ToolConfig) error {
	var errs []string

	if name == "" {
		errs = append(errs, "name is required")
	}
	if tc.DisplayName == "" {
		errs = append(errs, "display_name is required")
	}
	if tc.ConfigDir == "" {
		errs = append(errs, "config_dir is required")
	}
	if len(tc.Scopes) == 0 {
		errs = append(errs, "at least one scope is required")
	}
	if _, ok := tc.Scopes[tc.DefaultScope]; !ok {
		errs = append(errs, fmt.Sprintf("default_scope %q not found in scopes", tc.DefaultScope))
	}
	if len(tc.Agents.Frontmatter) == 0 {
		errs = append(errs, "agents.frontmatter must list at least one field")
	}
	if !strings.HasPrefix(tc.Rules.Extension, ".") {
		errs = append(errs, "rules.extension must start with '.'")
	}
	if !validStrategies[tc.Hooks.Strategy] {
		errs = append(errs, fmt.Sprintf("hooks.strategy %q invalid; must be direct, merge, or none", tc.Hooks.Strategy))
	}
	if !validStrategies[tc.MCP.Strategy] {
		errs = append(errs, fmt.Sprintf("mcp.strategy %q invalid; must be direct, merge, or none", tc.MCP.Strategy))
	}
	if !validPlacements[tc.Placement] {
		errs = append(errs, fmt.Sprintf("placement %q invalid; must be marketplace or copy_and_merge", tc.Placement))
	}
	if !validManifests[tc.Manifest.Type] {
		errs = append(errs, fmt.Sprintf("manifest.type %q invalid; must be marketplace or file_list", tc.Manifest.Type))
	}

	if len(errs) > 0 {
		return fmt.Errorf("tool %q config invalid:\n  %s", name, strings.Join(errs, "\n  "))
	}
	return nil
}
