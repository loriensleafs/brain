// Package adapters provides cross-platform plugin transforms for Brain.
//
// Each adapter converts canonical content (agents, skills, commands, protocols,
// hooks, MCP) into a target platform's plugin format. Shared types and helpers
// live here; platform-specific logic lives in cursor.go and claudecode.go.
package adapters

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// GeneratedFile represents a single file produced by an adapter transform.
type GeneratedFile struct {
	// RelativePath is the path relative to the target platform's config directory.
	RelativePath string
	// Content is the file's text content.
	Content string
}

// BrainConfig represents the top-level brain.config.json structure.
type BrainConfig struct {
	Version   string                       `json:"version"`
	Targets   map[string]json.RawMessage   `json:"targets"`
	Agents    map[string]AgentToolConfig   `json:"agents"`
	Hooks     map[string]json.RawMessage   `json:"hooks"`
	Skills    map[string]json.RawMessage   `json:"skills"`
	Commands  map[string]json.RawMessage   `json:"commands"`
	Protocols map[string]json.RawMessage   `json:"protocols"`
}

// AgentToolConfig maps platform names to their agent config (or null).
// The "source" key holds the canonical agent path; platform keys hold
// AgentPlatformConfig or null (meaning "not for this platform").
type AgentToolConfig map[string]json.RawMessage

// AgentPlatformConfig holds per-platform agent frontmatter fields.
type AgentPlatformConfig struct {
	Model        string   `json:"model,omitempty"`
	AllowedTools []string `json:"tools,omitempty"`
	Memory       string   `json:"memory,omitempty"`
	Color        string   `json:"color,omitempty"`
	Description  string   `json:"description,omitempty"`
	ArgumentHint string   `json:"argument_hint,omitempty"`
	Skills       []string `json:"skills,omitempty"`
}

// HookPlatformConfig holds per-platform hook configuration.
type HookPlatformConfig struct {
	Event   string `json:"event"`
	Matcher string `json:"matcher,omitempty"`
	Timeout int    `json:"timeout,omitempty"`
}

// CanonicalAgent represents a parsed canonical agent markdown file.
type CanonicalAgent struct {
	// Name is the filename without extension (e.g., "architect").
	Name string
	// Body is the raw markdown body (everything after frontmatter).
	Body string
	// Frontmatter contains any YAML frontmatter fields from the canonical file.
	Frontmatter map[string]any
}

// JsonMergePayload is used for additive config merging in Cursor.
// The Go CLI reads these and merges them into the user's existing config
// without overwriting non-Brain keys.
type JsonMergePayload struct {
	ManagedKeys []string               `json:"managedKeys"`
	Content     map[string]any `json:"content"`
}

// ─── Brain Prefix ───────────────────────────────────────────────────────────

const brainEmoji = "\U0001F9E0"

// BrainPrefix adds the Brain emoji prefix to a filename if not already present.
func BrainPrefix(name string) string {
	prefix := brainEmoji + "-"
	if strings.HasPrefix(name, prefix) {
		return name
	}
	return prefix + name
}

// ─── Frontmatter Parsing ────────────────────────────────────────────────────

var frontmatterRE = regexp.MustCompile(`(?s)^---\n(.*?)\n---\n?(.*)$`)

// ParseFrontmatter splits a markdown file into its YAML frontmatter and body.
// Returns empty frontmatter if none found.
func ParseFrontmatter(raw string) (frontmatter map[string]any, body string) {
	match := frontmatterRE.FindStringSubmatch(raw)
	if match == nil {
		return map[string]any{}, raw
	}
	fm := ParseSimpleYAML(match[1])
	return fm, strings.TrimLeft(match[2], "\n")
}

// ParseSimpleYAML is a minimal YAML parser for agent frontmatter.
// Handles: scalars, simple arrays (inline [...] and block - item), one-level nesting.
// Does NOT handle complex nested structures, multi-line strings, or anchors.
func ParseSimpleYAML(yaml string) map[string]any {
	result := make(map[string]any)
	lines := strings.Split(yaml, "\n")
	var currentKey string
	var currentArray []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip empty lines and comments
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			if currentArray != nil && currentKey != "" {
				result[currentKey] = toInterfaceSlice(currentArray)
				currentArray = nil
				currentKey = ""
			}
			continue
		}

		// Block array item (  - value)
		if currentArray != nil && strings.HasPrefix(trimmed, "- ") {
			currentArray = append(currentArray, strings.TrimSpace(strings.TrimPrefix(trimmed, "- ")))
			continue
		}

		// Flush pending array
		if currentArray != nil && currentKey != "" {
			result[currentKey] = toInterfaceSlice(currentArray)
			currentArray = nil
		}

		// Key-value pair
		key, rawValue, found := strings.Cut(trimmed, ":")
		if !found {
			continue
		}
		rawValue = strings.TrimSpace(rawValue)

		// Inline array: [a, b, c]
		if strings.HasPrefix(rawValue, "[") && strings.HasSuffix(rawValue, "]") {
			inner := rawValue[1 : len(rawValue)-1]
			items := strings.Split(inner, ",")
			var cleaned []string
			for _, item := range items {
				s := strings.TrimSpace(item)
				if s != "" {
					cleaned = append(cleaned, s)
				}
			}
			result[key] = toInterfaceSlice(cleaned)
			currentKey = key
			continue
		}

		// Empty value followed by array items
		if rawValue == "" {
			currentKey = key
			currentArray = []string{}
			continue
		}

		// Scalar: quoted string
		if (strings.HasPrefix(rawValue, `"`) && strings.HasSuffix(rawValue, `"`)) ||
			(strings.HasPrefix(rawValue, "'") && strings.HasSuffix(rawValue, "'")) {
			result[key] = rawValue[1 : len(rawValue)-1]
			currentKey = key
			continue
		}

		// Scalar: boolean
		if rawValue == "true" {
			result[key] = true
			currentKey = key
			continue
		}
		if rawValue == "false" {
			result[key] = false
			currentKey = key
			continue
		}

		// Scalar: null
		if rawValue == "null" || rawValue == "~" {
			result[key] = nil
			currentKey = key
			continue
		}

		// Scalar: plain string
		result[key] = rawValue
		currentKey = key
	}

	// Flush trailing array
	if currentArray != nil && currentKey != "" {
		result[currentKey] = toInterfaceSlice(currentArray)
	}

	return result
}

func toInterfaceSlice(ss []string) []any {
	out := make([]any, len(ss))
	for i, s := range ss {
		out[i] = s
	}
	return out
}

// ─── YAML Serialization ─────────────────────────────────────────────────────

// SerializeYAML converts a map to a simple YAML frontmatter string.
func SerializeYAML(data map[string]any) string {
	var lines []string

	for key, value := range data {
		if value == nil {
			continue
		}

		switch v := value.(type) {
		case []any:
			if len(v) == 0 {
				continue
			}
			lines = append(lines, key+":")
			for _, item := range v {
				lines = append(lines, fmt.Sprintf("  - %v", item))
			}
		case []string:
			if len(v) == 0 {
				continue
			}
			lines = append(lines, key+":")
			for _, item := range v {
				lines = append(lines, fmt.Sprintf("  - %s", item))
			}
		case string:
			if strings.ContainsAny(v, ":#{}[]") || strings.HasPrefix(v, " ") || strings.HasSuffix(v, " ") {
				lines = append(lines, fmt.Sprintf(`%s: "%s"`, key, strings.ReplaceAll(v, `"`, `\"`)))
			} else {
				lines = append(lines, fmt.Sprintf("%s: %s", key, v))
			}
		case bool:
			lines = append(lines, fmt.Sprintf("%s: %t", key, v))
		case int:
			lines = append(lines, fmt.Sprintf("%s: %d", key, v))
		case float64:
			lines = append(lines, fmt.Sprintf("%s: %g", key, v))
		}
	}

	return strings.Join(lines, "\n")
}

// WithFrontmatter wraps content with YAML frontmatter.
func WithFrontmatter(frontmatter map[string]any, body string) string {
	yaml := SerializeYAML(frontmatter)
	if yaml == "" {
		return body
	}
	return "---\n" + yaml + "\n---\n\n" + body
}

// ─── File Discovery ─────────────────────────────────────────────────────────

// ReadCanonicalAgents reads all markdown files from a directory and parses
// them as canonical agents.
func ReadCanonicalAgents(agentsDir string) ([]CanonicalAgent, error) {
	entries, err := os.ReadDir(agentsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read agents dir: %w", err)
	}

	var agents []CanonicalAgent
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		if entry.Name() == ".gitkeep" {
			continue
		}

		raw, err := os.ReadFile(filepath.Join(agentsDir, entry.Name()))
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

// ReadBrainConfig reads brain.config.json from the project root.
func ReadBrainConfig(projectRoot string) (*BrainConfig, error) {
	data, err := os.ReadFile(filepath.Join(projectRoot, "brain.config.json"))
	if err != nil {
		return nil, fmt.Errorf("read brain.config.json: %w", err)
	}

	var config BrainConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("parse brain.config.json: %w", err)
	}

	return &config, nil
}

// GetAgentPlatformConfig extracts the platform-specific config for an agent.
// Returns nil if the agent is not configured for this platform, or if the
// platform key is explicitly set to null.
func GetAgentPlatformConfig(agentConfig AgentToolConfig, platform string) *AgentPlatformConfig {
	raw, ok := agentConfig[platform]
	if !ok {
		return nil
	}

	// Check for explicit null
	if string(raw) == "null" {
		return nil
	}

	var config AgentPlatformConfig
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil
	}

	return &config
}

// ScanMarkdownFiles returns all .md filenames (without path) in a directory.
func ScanMarkdownFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var files []string
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if entry.Name() == ".gitkeep" || entry.Name() == ".DS_Store" {
			continue
		}
		if strings.HasSuffix(entry.Name(), ".md") {
			files = append(files, entry.Name())
		}
	}

	return files, nil
}

// ScanAllFiles returns all non-hidden filenames in a directory.
func ScanAllFiles(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
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

// CollectFiles recursively collects all files in a directory, returning
// relative paths. Skips node_modules, .git, and .DS_Store.
func CollectFiles(dir string) ([]string, error) {
	var result []string

	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		name := d.Name()
		if d.IsDir() {
			if name == "node_modules" || name == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		if name == ".DS_Store" {
			return nil
		}

		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		result = append(result, rel)
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}

	return result, nil
}
