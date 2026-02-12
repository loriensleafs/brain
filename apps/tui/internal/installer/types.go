package installer

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
)

// ─── Generated Output ───────────────────────────────────────────────────────

// GeneratedFile represents a single file produced by an adapter transform.
type GeneratedFile struct {
	// RelativePath is the path relative to the target platform's config directory.
	RelativePath string
	// Content is the file's text content.
	Content string
}

// ─── Brain Config ───────────────────────────────────────────────────────────

// Config represents the top-level brain.config.json structure.
type Config struct {
	Version   string                     `json:"version"`
	Targets   map[string]json.RawMessage `json:"targets"`
	Agents    map[string]AgentToolConfig `json:"agents"`
	Hooks     map[string]json.RawMessage `json:"hooks"`
	Skills    map[string]json.RawMessage `json:"skills"`
	Commands  map[string]json.RawMessage `json:"commands"`
	Protocols map[string]json.RawMessage `json:"protocols"`
}

// AgentToolConfig maps platform names to their agent config (or null).
// The "source" key holds the canonical agent path; platform keys hold
// AgentFrontmatter or null (meaning "not for this platform").
type AgentToolConfig map[string]json.RawMessage

// AgentFrontmatter holds per-platform agent frontmatter fields.
type AgentFrontmatter struct {
	Model        string   `json:"model,omitempty"`
	AllowedTools []string `json:"tools,omitempty"`
	Memory       string   `json:"memory,omitempty"`
	Color        string   `json:"color,omitempty"`
	Description  string   `json:"description,omitempty"`
	ArgumentHint string   `json:"argument_hint,omitempty"`
	Skills       []string `json:"skills,omitempty"`
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

// MergePayload is used for additive config merging in Cursor.
// The Go CLI reads these and merges them into the user's existing config
// without overwriting non-Brain keys.
type MergePayload struct {
	ManagedKeys []string       `json:"managedKeys"`
	Content     map[string]any `json:"content"`
}

// TargetConfig holds per-target platform settings from brain.config.json.
type TargetConfig struct {
	Prefix bool `json:"prefix"`
}

// ShouldPrefix returns whether filenames should be prefixed with the brain emoji
// for the given variant, as configured in the targets section.
func (c *Config) ShouldPrefix(variant string) bool {
	raw, ok := c.Targets[variant]
	if !ok {
		return false
	}
	var tc TargetConfig
	if err := json.Unmarshal(raw, &tc); err != nil {
		return false
	}
	return tc.Prefix
}

// ─── Well-Known Paths ───────────────────────────────────────────────────────

const (
	// ConfigFile is the brain.config.json filename at the project root.
	ConfigFile = "brain.config.json"

	// Template directory names used by both TemplateSource reads and transform output.
	AgentsDir    = "agents"
	SkillsDir    = "skills"
	CommandsDir  = "commands"
	ProtocolsDir = "protocols"
	HooksDir     = "hooks"
	ConfigsDir   = "configs"
	RulesDir     = "rules"
)

// ─── Brain Prefix ───────────────────────────────────────────────────────────

const BrainEmoji = "\U0001F9E0"

// BrainPrefix adds the Brain emoji prefix to a filename if not already present.
func BrainPrefix(name string) string {
	prefix := BrainEmoji + "-"
	if strings.HasPrefix(name, prefix) {
		return name
	}
	return prefix + name
}

// MaybePrefix conditionally applies the brain emoji prefix.
func MaybePrefix(name string, prefix bool) string {
	if prefix {
		return BrainPrefix(name)
	}
	return name
}

// ─── Agent Config Helpers ───────────────────────────────────────────────────

// GetAgentFrontmatter extracts the platform-specific config for an agent.
// Returns nil if the agent is not configured for this platform, or if the
// platform key is explicitly set to null.
func GetAgentFrontmatter(agentConfig AgentToolConfig, platform string) *AgentFrontmatter {
	raw, ok := agentConfig[platform]
	if !ok {
		return nil
	}

	// Check for explicit null
	if string(raw) == "null" {
		return nil
	}

	var config AgentFrontmatter
	if err := json.Unmarshal(raw, &config); err != nil {
		return nil
	}

	return &config
}

// ─── Tool Registry ──────────────────────────────────────────────────────────

// Tool is the primary interface for installing Brain into an AI coding tool.
// Implementations are registered via Register and looked up by slug.
type Tool interface {
	// Name returns the tool's slug identifier (e.g., "claude-code", "cursor").
	Name() string
	// DisplayName returns the human-readable name (e.g., "Claude Code", "Cursor").
	DisplayName() string
	// ConfigDir returns the tool's configuration directory path.
	ConfigDir() string
	// IsToolInstalled reports whether the tool binary/config exists on disk.
	IsToolInstalled() bool
	// IsBrainInstalled reports whether Brain content is already present in the tool.
	IsBrainInstalled() bool
	// Install installs Brain content into the tool using the given template source.
	Install(ctx context.Context, src *TemplateSource) error
	// Uninstall removes Brain content from the tool.
	Uninstall(ctx context.Context) error
	// AdapterTarget returns the adapter transform key for this tool.
	AdapterTarget() string
}

// registry holds all registered tools, keyed by slug.
// Registration happens during init(), before any concurrent access,
// so no mutex is needed.
var registry = map[string]Tool{}

// Register adds a Tool to the global registry.
// It panics if a tool with the same Name() slug is already registered.
func Register(t Tool) {
	slug := t.Name()
	if _, exists := registry[slug]; exists {
		panic("installer: duplicate registration for " + slug)
	}
	registry[slug] = t
}

// Get returns the Tool registered under the given slug, and
// a boolean indicating whether it was found.
func Get(slug string) (Tool, bool) {
	t, ok := registry[slug]
	return t, ok
}

// All returns a slice of all registered Tools, sorted
// alphabetically by slug for deterministic ordering.
func All() []Tool {
	result := make([]Tool, 0, len(registry))
	for _, t := range registry {
		result = append(result, t)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].Name() < result[j].Name()
	})
	return result
}

// ResetRegistry clears the registry. Exported for cross-package testing.
func ResetRegistry() {
	registry = map[string]Tool{}
}
