package adapters

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// ComposableDir represents a directory with _order.yaml, _variables.yaml,
// sections/, and variant-specific subdirectories (claude-code/, cursor/).
type ComposableDir struct {
	// Dir is the absolute path to the composable directory.
	Dir string
	// Order is the parsed section list from _order.yaml.
	Order []string
	// Variables maps variant name to variable key-value pairs.
	Variables map[string]map[string]string
}

// ─── Parsing ────────────────────────────────────────────────────────────────

// parseOrderYAML parses a _order.yaml file and returns the section list.
// Expected format:
//
//	sections:
//	  - sections/010-header.md
//	  - "{tool}/040-memory-delegation.md"
func parseOrderYAML(data string) []string {
	var sections []string
	inSections := false

	for _, line := range strings.Split(data, "\n") {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		if strings.HasPrefix(trimmed, "sections:") {
			inSections = true
			continue
		}

		if inSections && strings.HasPrefix(trimmed, "- ") {
			entry := strings.TrimPrefix(trimmed, "- ")
			// Strip surrounding quotes if present
			entry = strings.Trim(entry, `"'`)
			sections = append(sections, entry)
		}
	}

	return sections
}

// parseVariablesYAML parses a _variables.yaml file and returns a map of
// variant name to variable key-value pairs.
// Expected format:
//
//	claude-code:
//	  worker: "teammate"
//	  workers: "teammates"
//	cursor:
//	  worker: "agent"
//	  workers: "agents"
func parseVariablesYAML(data string) map[string]map[string]string {
	result := make(map[string]map[string]string)
	var currentVariant string

	for _, line := range strings.Split(data, "\n") {
		if strings.TrimSpace(line) == "" || strings.HasPrefix(strings.TrimSpace(line), "#") {
			continue
		}

		// Top-level key (variant name) — no leading whitespace, ends with ":"
		if !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") && strings.HasSuffix(strings.TrimSpace(line), ":") {
			currentVariant = strings.TrimSuffix(strings.TrimSpace(line), ":")
			result[currentVariant] = make(map[string]string)
			continue
		}

		// Indented key-value pair under a variant
		if currentVariant != "" {
			trimmed := strings.TrimSpace(line)
			key, value, found := strings.Cut(trimmed, ":")
			if !found {
				continue
			}
			key = strings.TrimSpace(key)
			value = strings.TrimSpace(value)
			// Strip surrounding quotes
			value = strings.Trim(value, `"'`)
			result[currentVariant][key] = value
		}
	}

	return result
}

// ─── Composition ────────────────────────────────────────────────────────────

// ReadComposableDir reads _order.yaml and _variables.yaml from a directory.
// Returns nil if the directory does not have an _order.yaml (not composable).
func ReadComposableDir(dir string) (*ComposableDir, error) {
	orderPath := filepath.Join(dir, "_order.yaml")
	orderData, err := os.ReadFile(orderPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read _order.yaml: %w", err)
	}

	order := parseOrderYAML(string(orderData))

	// Variables are optional
	variables := make(map[string]map[string]string)
	variablesPath := filepath.Join(dir, "_variables.yaml")
	variablesData, err := os.ReadFile(variablesPath)
	if err == nil {
		variables = parseVariablesYAML(string(variablesData))
	}

	return &ComposableDir{
		Dir:       dir,
		Order:     order,
		Variables: variables,
	}, nil
}

// ComposeFromDir composes content from a composable directory for the given variant.
// The variant determines which variant-specific files to load and which variables
// to substitute. Paths in _order.yaml containing {tool} are resolved to the
// variant's subdirectory.
func ComposeFromDir(dir, variant string, extraVars map[string]string) (string, error) {
	cd, err := ReadComposableDir(dir)
	if err != nil {
		return "", err
	}
	if cd == nil {
		return "", fmt.Errorf("directory %s is not composable (no _order.yaml)", dir)
	}

	// Build variable map: start with variant variables, overlay extraVars
	vars := make(map[string]string)
	if variantVars, ok := cd.Variables[variant]; ok {
		for k, v := range variantVars {
			vars[k] = v
		}
	}
	for k, v := range extraVars {
		vars[k] = v
	}

	// Compose sections in order
	var sections []string
	for _, entry := range cd.Order {
		// Resolve {tool} placeholder to variant name
		resolved := strings.ReplaceAll(entry, "{tool}", variant)

		sectionPath := filepath.Join(dir, resolved)
		content, err := os.ReadFile(sectionPath)
		if err != nil {
			if os.IsNotExist(err) {
				// Variant-specific files are optional; skip if missing
				continue
			}
			return "", fmt.Errorf("read section %s: %w", resolved, err)
		}

		section := string(content)
		// Apply variable substitution
		section = substituteVariables(section, vars)
		sections = append(sections, strings.TrimRight(section, "\n"))
	}

	return strings.Join(sections, "\n\n") + "\n", nil
}

// substituteVariables replaces {key} placeholders in content with variable values.
// Only replaces keys that exist in the vars map.
func substituteVariables(content string, vars map[string]string) string {
	for key, value := range vars {
		content = strings.ReplaceAll(content, "{"+key+"}", value)
	}
	return content
}

// ─── High-Level Compose Functions ───────────────────────────────────────────

// ComposeAgent composes an agent from a composable directory.
// Reads _order.yaml and _variables.yaml, loads sections, applies variable
// substitution, and injects frontmatter from brain.config.json.
func ComposeAgent(agentDir, variant string, config *BrainConfig) (*GeneratedFile, error) {
	agentName := filepath.Base(agentDir)

	// Get agent platform config for frontmatter
	agentConfig, ok := config.Agents[agentName]
	if !ok {
		return nil, nil
	}
	platformConfig := GetAgentPlatformConfig(agentConfig, variant)
	if platformConfig == nil {
		return nil, nil
	}

	content, err := ComposeFromDir(agentDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose agent %s: %w", agentName, err)
	}

	// Build frontmatter based on variant
	var result string
	switch variant {
	case "claude-code":
		fm := buildClaudeAgentFrontmatter(agentName, platformConfig)
		result = WithFrontmatter(fm, content)
	case "cursor":
		fm := make(map[string]any)
		if platformConfig.Description != "" {
			fm["description"] = platformConfig.Description
		}
		result = WithFrontmatter(fm, content)
	default:
		result = content
	}

	// Determine output path based on variant
	relPath := "agents/" + BrainPrefix(agentName) + ".md"

	return &GeneratedFile{
		RelativePath: relPath,
		Content:      result,
	}, nil
}

// buildClaudeAgentFrontmatter builds Claude Code frontmatter map from config.
func buildClaudeAgentFrontmatter(agentName string, config *AgentPlatformConfig) map[string]any {
	fm := make(map[string]any)
	fm["name"] = BrainPrefix(agentName)

	if config.Model != "" {
		fm["model"] = config.Model
	}
	if config.Description != "" {
		fm["description"] = config.Description
	}
	if config.Memory != "" {
		fm["memory"] = config.Memory
	}
	if config.Color != "" {
		fm["color"] = config.Color
	}
	if config.ArgumentHint != "" {
		fm["argument-hint"] = config.ArgumentHint
	}
	if len(config.AllowedTools) > 0 {
		fm["tools"] = toInterfaceSlice(config.AllowedTools)
	}
	if len(config.Skills) > 0 {
		fm["skills"] = toInterfaceSlice(config.Skills)
	}

	return fm
}

// ComposeInstructions composes an instructions file from a composable directory.
// For Claude Code, outputs as AGENTS.md. For Cursor, outputs as AGENTS.md.
func ComposeInstructions(instructionsDir, variant string) (*GeneratedFile, error) {
	content, err := ComposeFromDir(instructionsDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose instructions: %w", err)
	}

	return &GeneratedFile{
		RelativePath: "AGENTS.md",
		Content:      content,
	}, nil
}

// ComposeCommand composes a command from a composable directory.
// The command name is derived from the directory name.
func ComposeCommand(commandDir, variant string) (*GeneratedFile, error) {
	commandName := filepath.Base(commandDir)

	content, err := ComposeFromDir(commandDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose command %s: %w", commandName, err)
	}

	prefixed := BrainPrefix(commandName) + ".md"

	return &GeneratedFile{
		RelativePath: "commands/" + prefixed,
		Content:      content,
	}, nil
}

// ─── Directory Detection ────────────────────────────────────────────────────

// IsComposableDir returns true if the directory contains an _order.yaml file,
// indicating it should be composed rather than copied as-is.
func IsComposableDir(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "_order.yaml"))
	return err == nil
}
