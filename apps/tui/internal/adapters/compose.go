package adapters

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// OrderYAML represents the parsed _order.yaml file for composable directories.
type OrderYAML struct {
	Name     string
	Sections []string
	Variants map[string]VariantConfig
}

// VariantConfig holds per-variant composition settings from _order.yaml.
type VariantConfig struct {
	Frontmatter string            // path to frontmatter file (e.g., _frontmatter.yaml)
	Variables   string            // path to variables file (e.g., _variables.yaml)
	Overrides   map[string]string // section name -> override file name
	Inserts     []string          // files to inject at VARIANT_INSERT
}

// ─── Parsing ────────────────────────────────────────────────────────────────

// parseOrderYAML parses a _order.yaml file including the variants section.
func parseOrderYAML(data string) *OrderYAML {
	result := &OrderYAML{
		Variants: make(map[string]VariantConfig),
	}

	var currentBlock string       // "sections", "variants"
	var currentVariant string     // e.g., "claude-code", "cursor"
	var currentSubBlock string    // "overrides", "inserts_at_VARIANT_INSERT"
	var currentVariantConfig VariantConfig

	for _, line := range strings.Split(data, "\n") {
		trimmed := strings.TrimSpace(line)

		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}

		// Top-level keys (no indent)
		if !strings.HasPrefix(line, " ") && !strings.HasPrefix(line, "\t") {
			// Save any in-progress variant
			if currentVariant != "" {
				result.Variants[currentVariant] = currentVariantConfig
				currentVariant = ""
			}

			if strings.HasPrefix(trimmed, "name:") {
				result.Name = strings.TrimSpace(strings.TrimPrefix(trimmed, "name:"))
			} else if strings.HasPrefix(trimmed, "sections:") {
				currentBlock = "sections"
				currentSubBlock = ""
			} else if strings.HasPrefix(trimmed, "variants:") {
				currentBlock = "variants"
				currentSubBlock = ""
			} else {
				currentBlock = ""
			}
			continue
		}

		// Indent level 1 (2 spaces)
		indent := len(line) - len(strings.TrimLeft(line, " \t"))

		switch currentBlock {
		case "sections":
			if strings.HasPrefix(trimmed, "- ") {
				entry := strings.TrimPrefix(trimmed, "- ")
				entry = strings.Trim(entry, `"'`)
				// Strip inline comments
				if idx := strings.Index(entry, "#"); idx > 0 {
					entry = strings.TrimSpace(entry[:idx])
				}
				result.Sections = append(result.Sections, entry)
			}

		case "variants":
			// Variant name (indent exactly 2, ends with ":", no spaces in name)
			if indent == 2 && strings.HasSuffix(trimmed, ":") && !strings.Contains(trimmed, " ") {
				// Save previous variant
				if currentVariant != "" {
					result.Variants[currentVariant] = currentVariantConfig
				}
				currentVariant = strings.TrimSuffix(trimmed, ":")
				currentVariantConfig = VariantConfig{
					Overrides: make(map[string]string),
				}
				currentSubBlock = ""
				continue
			}

			if currentVariant == "" {
				continue
			}

			// Variant properties
			if strings.HasPrefix(trimmed, "frontmatter:") {
				currentVariantConfig.Frontmatter = strings.TrimSpace(strings.TrimPrefix(trimmed, "frontmatter:"))
				currentSubBlock = ""
			} else if strings.HasPrefix(trimmed, "variables:") {
				currentVariantConfig.Variables = strings.TrimSpace(strings.TrimPrefix(trimmed, "variables:"))
				currentSubBlock = ""
			} else if strings.HasPrefix(trimmed, "overrides:") {
				currentSubBlock = "overrides"
			} else if strings.HasPrefix(trimmed, "inserts_at_VARIANT_INSERT:") {
				currentSubBlock = "inserts_at_VARIANT_INSERT"
			} else if strings.HasPrefix(trimmed, "- ") {
				entry := strings.TrimPrefix(trimmed, "- ")
				entry = strings.Trim(entry, `"'`)
				if currentSubBlock == "inserts_at_VARIANT_INSERT" {
					currentVariantConfig.Inserts = append(currentVariantConfig.Inserts, entry)
				}
			} else if strings.Contains(trimmed, ":") && currentSubBlock == "overrides" {
				key, value, _ := strings.Cut(trimmed, ":")
				key = strings.TrimSpace(key)
				value = strings.TrimSpace(value)
				currentVariantConfig.Overrides[key] = value
			}
		}
	}

	// Save last variant
	if currentVariant != "" {
		result.Variants[currentVariant] = currentVariantConfig
	}

	return result
}

// parseVariablesYAML parses a flat key: value YAML file into a string map.
func parseVariablesYAML(data string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(data, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		key, value, found := strings.Cut(trimmed, ":")
		if !found {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		result[key] = value
	}
	return result
}

// ─── Composition ────────────────────────────────────────────────────────────

// substituteVariables replaces {key} placeholders in content with variable values.
func substituteVariables(content string, vars map[string]string) string {
	for key, value := range vars {
		content = strings.ReplaceAll(content, "{"+key+"}", value)
	}
	return content
}

// readSection reads a section file, checking variant override first, then shared.
// For filesystem: looks in {dir}/{variant}/{name}.md then {dir}/sections/{name}.md
func readSection(dir, variant, name string) (string, error) {
	// Check variant override first
	overridePath := filepath.Join(dir, variant, name+".md")
	if data, err := os.ReadFile(overridePath); err == nil {
		return string(data), nil
	}

	// Fall back to shared section
	sharedPath := filepath.Join(dir, "sections", name+".md")
	data, err := os.ReadFile(sharedPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// readSectionFromSource reads a section file from a TemplateSource.
func readSectionFromSource(src *TemplateSource, relDir, variant, name string) (string, error) {
	// Check variant override first
	data, err := src.ReadFile(relDir + "/" + variant + "/" + name + ".md")
	if err == nil {
		return string(data), nil
	}

	// Fall back to shared section
	data, err = src.ReadFile(relDir + "/sections/" + name + ".md")
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// composeWithOrder assembles sections based on the parsed order and variant config.
// readFn is called for each section name and returns its content.
func composeWithOrder(order *OrderYAML, variant string, vars map[string]string, readFn func(name string) (string, error)) (string, error) {
	vc := order.Variants[variant]

	var sections []string
	for _, entry := range order.Sections {
		if entry == "VARIANT_INSERT" {
			// Expand variant-specific inserts
			for _, insert := range vc.Inserts {
				content, err := readFn(insert)
				if err != nil {
					continue // variant inserts are optional
				}
				content = substituteVariables(content, vars)
				sections = append(sections, strings.TrimRight(content, "\n"))
			}
			continue
		}

		// Check if this section has a variant override
		if _, hasOverride := vc.Overrides[entry]; hasOverride {
			// readFn already checks variant dir first, so this works naturally
		}

		content, err := readFn(entry)
		if err != nil {
			continue // optional sections
		}
		content = substituteVariables(content, vars)
		sections = append(sections, strings.TrimRight(content, "\n"))
	}

	return strings.Join(sections, "\n\n") + "\n", nil
}

// ComposeFromDir composes content from a composable directory for the given variant.
func ComposeFromDir(dir, variant string, extraVars map[string]string) (string, error) {
	orderData, err := os.ReadFile(filepath.Join(dir, "_order.yaml"))
	if err != nil {
		return "", fmt.Errorf("read _order.yaml: %w", err)
	}

	order := parseOrderYAML(string(orderData))

	// Read variant variables
	vars := make(map[string]string)
	vc := order.Variants[variant]
	if vc.Variables != "" {
		varData, err := os.ReadFile(filepath.Join(dir, variant, vc.Variables))
		if err == nil {
			vars = parseVariablesYAML(string(varData))
		}
	}
	for k, v := range extraVars {
		vars[k] = v
	}

	return composeWithOrder(order, variant, vars, func(name string) (string, error) {
		return readSection(dir, variant, name)
	})
}

// ComposeFromSource composes content from a TemplateSource for the given variant.
func ComposeFromSource(src *TemplateSource, relDir, variant string, extraVars map[string]string) (string, error) {
	orderData, err := src.ReadFile(relDir + "/_order.yaml")
	if err != nil {
		return "", fmt.Errorf("read _order.yaml: %w", err)
	}

	order := parseOrderYAML(string(orderData))

	// Read variant variables
	vars := make(map[string]string)
	vc := order.Variants[variant]
	if vc.Variables != "" {
		varData, err := src.ReadFile(relDir + "/" + variant + "/" + vc.Variables)
		if err == nil {
			vars = parseVariablesYAML(string(varData))
		}
	}
	for k, v := range extraVars {
		vars[k] = v
	}

	return composeWithOrder(order, variant, vars, func(name string) (string, error) {
		return readSectionFromSource(src, relDir, variant, name)
	})
}

// ─── High-Level Compose Functions ───────────────────────────────────────────

// ComposeAgent composes an agent from a composable directory.
func ComposeAgent(agentDir, variant string, config *BrainConfig) (*GeneratedFile, error) {
	agentName := filepath.Base(agentDir)

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

	return &GeneratedFile{
		RelativePath: "agents/" + BrainPrefix(agentName) + ".md",
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
func ComposeCommand(commandDir, variant string) (*GeneratedFile, error) {
	commandName := filepath.Base(commandDir)

	content, err := ComposeFromDir(commandDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose command %s: %w", commandName, err)
	}

	return &GeneratedFile{
		RelativePath: "commands/" + BrainPrefix(commandName) + ".md",
		Content:      content,
	}, nil
}

// ─── Source-Aware Compose Functions ──────────────────────────────────────────

// ComposeAgentFromSource composes an agent using a TemplateSource.
func ComposeAgentFromSource(src *TemplateSource, relDir, variant string, config *BrainConfig) (*GeneratedFile, error) {
	agentName := filepath.Base(relDir)

	agentConfig, ok := config.Agents[agentName]
	if !ok {
		return nil, nil
	}
	platformConfig := GetAgentPlatformConfig(agentConfig, variant)
	if platformConfig == nil {
		return nil, nil
	}

	content, err := ComposeFromSource(src, relDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose agent %s: %w", agentName, err)
	}

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

	return &GeneratedFile{
		RelativePath: "agents/" + BrainPrefix(agentName) + ".md",
		Content:      result,
	}, nil
}

// ComposeInstructionsFromSource composes instructions using a TemplateSource.
func ComposeInstructionsFromSource(src *TemplateSource, relDir, variant string) (*GeneratedFile, error) {
	content, err := ComposeFromSource(src, relDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose instructions: %w", err)
	}

	return &GeneratedFile{
		RelativePath: "AGENTS.md",
		Content:      content,
	}, nil
}

// ComposeCommandFromSource composes a command using a TemplateSource.
func ComposeCommandFromSource(src *TemplateSource, relDir, variant string) (*GeneratedFile, error) {
	commandName := filepath.Base(relDir)

	content, err := ComposeFromSource(src, relDir, variant, nil)
	if err != nil {
		return nil, fmt.Errorf("compose command %s: %w", commandName, err)
	}

	return &GeneratedFile{
		RelativePath: "commands/" + BrainPrefix(commandName) + ".md",
		Content:      content,
	}, nil
}

// ─── Directory Detection ────────────────────────────────────────────────────

// ReadComposableDir reads and parses _order.yaml from a directory.
// Returns nil if the directory does not have an _order.yaml (not composable).
func ReadComposableDir(dir string) (*OrderYAML, error) {
	orderPath := filepath.Join(dir, "_order.yaml")
	data, err := os.ReadFile(orderPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read _order.yaml: %w", err)
	}
	return parseOrderYAML(string(data)), nil
}

// IsComposableDir returns true if the directory contains an _order.yaml file.
func IsComposableDir(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "_order.yaml"))
	return err == nil
}
