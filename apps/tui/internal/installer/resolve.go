package installer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/adrg/frontmatter"
	"gopkg.in/yaml.v3"
)

// ─── File Discovery ─────────────────────────────────────────────────────────

// ReadAgents reads canonical agent files from a TemplateSource directory.
func ReadAgents(src *TemplateSource, relDir string) ([]CanonicalAgent, error) {
	entries, err := src.ReadDir(relDir)
	if err != nil {
		return nil, nil
	}

	var agents []CanonicalAgent
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		if entry.Name() == ".gitkeep" {
			continue
		}

		raw, err := src.ReadFile(relDir + "/" + entry.Name())
		if err != nil {
			return nil, fmt.Errorf("read agent %s: %w", entry.Name(), err)
		}

		fm, body := ParseFrontmatter(string(raw))
		name := strings.TrimSuffix(entry.Name(), ".md")
		agents = append(agents, CanonicalAgent{
			Name:        name,
			Body:        body,
			Frontmatter: fm,
		})
	}

	return agents, nil
}

// Config reads and parses brain.config.json from the project root.
// brain.config.json lives alongside templates/, not inside it.
func (s *TemplateSource) Config() (*Config, error) {
	data, err := os.ReadFile(filepath.Join(s.ProjectRoot(), ConfigFile))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", ConfigFile, err)
	}
	return parseConfig(data)
}

// parseConfig unmarshals raw JSON into a Config.
func parseConfig(data []byte) (*Config, error) {
	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse brain.config.json: %w", err)
	}
	return &config, nil
}

// ListFiles returns all non-hidden filenames in a TemplateSource directory.
func ListFiles(src *TemplateSource, relDir string) ([]string, error) {
	entries, err := src.ReadDir(relDir)
	if err != nil {
		return nil, nil
	}

	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if name == ".gitkeep" || name == ".DS_Store" || strings.HasPrefix(name, ".") {
			continue
		}
		files = append(files, name)
	}

	return files, nil
}

// WalkFiles recursively collects all file paths relative to relDir via TemplateSource.
func WalkFiles(src *TemplateSource, relDir string) ([]string, error) {
	var result []string

	err := src.WalkDir(relDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		name := d.Name()
		if d.IsDir() {
			if name == "node_modules" || name == ".git" {
				return fs.SkipDir
			}
			return nil
		}

		if name == ".DS_Store" {
			return nil
		}

		// Get path relative to relDir
		rel := strings.TrimPrefix(path, relDir+"/")
		if rel != path {
			result = append(result, rel)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

// WriteGeneratedFiles writes a slice of generated files to the given output directory.
// Creates parent directories as needed.
func WriteGeneratedFiles(files []GeneratedFile, outputDir string) error {
	for _, f := range files {
		fullPath := filepath.Join(outputDir, f.RelativePath)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return fmt.Errorf("create dir for %s: %w", f.RelativePath, err)
		}
		if err := os.WriteFile(fullPath, []byte(f.Content), 0644); err != nil {
			return fmt.Errorf("write %s: %w", f.RelativePath, err)
		}
	}
	return nil
}

// ─── Frontmatter Parsing ────────────────────────────────────────────────────

// ParseFrontmatter splits a markdown file into its YAML frontmatter and body.
// Returns empty frontmatter if none found.
func ParseFrontmatter(raw string) (fm map[string]any, body string) {
	fm = make(map[string]any)
	rest, err := frontmatter.Parse(strings.NewReader(raw), &fm)
	if err != nil {
		return map[string]any{}, raw
	}
	return fm, strings.TrimLeft(string(rest), "\n")
}

// ParseSimpleYAML parses a YAML string into a map using yaml.v3.
func ParseSimpleYAML(raw string) map[string]any {
	result := make(map[string]any)
	if err := yaml.Unmarshal([]byte(raw), &result); err != nil {
		return result
	}
	return result
}

// ToInterfaceSlice converts a string slice to an any slice.
func ToInterfaceSlice(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}

// ─── YAML Serialization ─────────────────────────────────────────────────────

// SerializeYAML converts a map to a YAML string using yaml.v3.
// Nil values and empty slices are filtered out before marshaling.
func SerializeYAML(data map[string]any) string {
	filtered := make(map[string]any, len(data))
	for k, v := range data {
		if v == nil {
			continue
		}
		switch s := v.(type) {
		case []any:
			if len(s) == 0 {
				continue
			}
		case []string:
			if len(s) == 0 {
				continue
			}
		}
		filtered[k] = v
	}
	if len(filtered) == 0 {
		return ""
	}

	var buf bytes.Buffer
	enc := yaml.NewEncoder(&buf)
	enc.SetIndent(2)
	if err := enc.Encode(filtered); err != nil {
		return ""
	}
	enc.Close()

	return strings.TrimRight(buf.String(), "\n")
}

// WithFrontmatter wraps content with YAML frontmatter.
func WithFrontmatter(fm map[string]any, body string) string {
	serialized := SerializeYAML(fm)
	if serialized == "" {
		return body
	}
	return "---\n" + serialized + "\n---\n\n" + body
}

// ─── Compose Types ──────────────────────────────────────────────────────────

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

// ─── Compose Parsing ────────────────────────────────────────────────────────

// ParseOrderYAML parses a _order.yaml file including the variants section.
func ParseOrderYAML(data string) *OrderYAML {
	result := &OrderYAML{
		Variants: make(map[string]VariantConfig),
	}

	var currentBlock string    // "sections", "variants"
	var currentVariant string  // e.g., "claude-code", "cursor"
	var currentSubBlock string // "overrides", "inserts_at_VARIANT_INSERT"
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

// ParseVariables parses a flat key: value YAML file into a string map.
func ParseVariables(data string) map[string]string {
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

// ExpandVars replaces {key} placeholders in content with variable values.
func ExpandVars(content string, vars map[string]string) string {
	for key, value := range vars {
		content = strings.ReplaceAll(content, "{"+key+"}", value)
	}
	return content
}

// ComposeWithOrder assembles sections based on the parsed order and variant config.
// readFn is called for each section name and returns its content.
func ComposeWithOrder(order *OrderYAML, variant string, vars map[string]string, readFn func(name string) (string, error)) (string, error) {
	vc := order.Variants[variant]

	var sections []string
	for _, entry := range order.Sections {
		if entry == "VARIANT_INSERT" {
			for _, insert := range vc.Inserts {
				content, err := readFn(insert)
				if err != nil {
					continue // variant inserts are optional
				}
				content = ExpandVars(content, vars)
				sections = append(sections, strings.TrimRight(content, "\n"))
			}
			continue
		}

		content, err := readFn(entry)
		if err != nil {
			continue // optional sections
		}
		content = ExpandVars(content, vars)
		sections = append(sections, strings.TrimRight(content, "\n"))
	}

	return strings.Join(sections, "\n\n") + "\n", nil
}

// Compose composes content from a TemplateSource for the given variant.
// Reads section files from the source, checking {relDir}/{variant}/{name}.md first,
// then falling back to {relDir}/sections/{name}.md.
func Compose(src *TemplateSource, relDir, variant string, extraVars map[string]string) (string, error) {
	orderData, err := src.ReadFile(relDir + "/_order.yaml")
	if err != nil {
		return "", fmt.Errorf("read _order.yaml: %w", err)
	}

	order := ParseOrderYAML(string(orderData))
	vars := loadVariables(src, relDir, variant, order, extraVars)

	return ComposeWithOrder(order, variant, vars, func(name string) (string, error) {
		// Check variant override first, then shared section
		if data, err := src.ReadFile(relDir + "/" + variant + "/" + name + ".md"); err == nil {
			return string(data), nil
		}
		data, err := src.ReadFile(relDir + "/sections/" + name + ".md")
		if err != nil {
			return "", err
		}
		return string(data), nil
	})
}

// loadVariables reads variant variables from a TemplateSource and merges with extraVars.
func loadVariables(src *TemplateSource, relDir, variant string, order *OrderYAML, extraVars map[string]string) map[string]string {
	vars := make(map[string]string)
	if vc := order.Variants[variant]; vc.Variables != "" {
		if data, err := src.ReadFile(relDir + "/" + variant + "/" + vc.Variables); err == nil {
			vars = ParseVariables(string(data))
		}
	}
	for k, v := range extraVars {
		vars[k] = v
	}
	return vars
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
	return ParseOrderYAML(string(data)), nil
}

// IsComposableDir returns true if the directory contains an _order.yaml file.
func IsComposableDir(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, "_order.yaml"))
	return err == nil
}
