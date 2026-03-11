package installer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"sort"
	"strings"
	"time"

	"github.com/adrg/xdg"
	jsonpatch "github.com/evanphx/json-patch/v5"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
	"golang.org/x/sync/errgroup"
)

// ─── ToolInstaller ──────────────────────────────────────────────────────────

// ToolInstaller implements the Tool interface for a single AI coding tool
// (e.g., Claude Code, Cursor). All behavior is driven by its ToolConfig,
// composing BuildAll with a PlacementStrategy instead of per-tool
// hardcoded logic.
type ToolInstaller struct {
	config        *ToolConfig
	placement     PlacementStrategy
	scopeOverride string // set via SetScope; empty means use DefaultScope
}

// NewToolInstaller creates a ToolInstaller for the given tool config.
func NewToolInstaller(config *ToolConfig) *ToolInstaller {
	return &ToolInstaller{
		config:    config,
		placement: placementFor(config),
	}
}

func (t *ToolInstaller) Name() string        { return t.config.Name }
func (t *ToolInstaller) DisplayName() string  { return t.config.DisplayName }
func (t *ToolInstaller) AdapterTarget() string { return t.config.Name }

// ConfigDir returns the tool's configuration directory, expanding ~ to the home dir.
func (t *ToolInstaller) ConfigDir() string {
	expanded, err := ExpandHome(t.config.ConfigDir)
	if err != nil {
		return t.config.ConfigDir
	}
	return expanded
}

// IsToolInstalled reports whether the tool's config directory exists on disk.
func (t *ToolInstaller) IsToolInstalled() bool {
	_, err := os.Stat(t.ConfigDir())
	return err == nil
}

// IsBrainInstalled dispatches on the detection config to check whether Brain
// content has been installed into the tool.
func (t *ToolInstaller) IsBrainInstalled() bool {
	det := t.config.Detection.BrainInstalled
	switch det.Type {
	case "json_key":
		return t.hasJSONKey(det)
	case "prefix_scan":
		return t.hasBrainFiles(det)
	default:
		return false
	}
}

// hasJSONKey checks for a specific key in a JSON file relative to ConfigDir.
func (t *ToolInstaller) hasJSONKey(det DetectionCheck) bool {
	path := filepath.Join(t.ConfigDir(), det.File)
	data, err := os.ReadFile(path)
	if err != nil {
		return false
	}
	return gjson.GetBytes(data, det.Key).Exists()
}

// hasBrainFiles checks for brain-prefixed files in the listed directories.
func (t *ToolInstaller) hasBrainFiles(det DetectionCheck) bool {
	brainPrefix := BrainEmoji + "-"
	configDir := t.ConfigDir()

	for _, dir := range det.Dirs {
		entries, err := os.ReadDir(filepath.Join(configDir, dir))
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() && strings.HasPrefix(e.Name(), brainPrefix) {
				return true
			}
		}
	}
	return false
}

// SetScope overrides the default scope for the next Install call.
// Returns an error if the scope is not defined in the tool's Scopes map.
func (t *ToolInstaller) SetScope(scope string) error {
	if _, ok := t.config.Scopes[scope]; !ok {
		available := t.Scopes()
		return fmt.Errorf("scope %q not found for tool %q; available scopes: %s",
			scope, t.config.Name, strings.Join(available, ", "))
	}
	t.scopeOverride = scope
	return nil
}

// Scopes returns the scope names defined in the tool's config, sorted.
func (t *ToolInstaller) Scopes() []string {
	scopes := make([]string, 0, len(t.config.Scopes))
	for k := range t.config.Scopes {
		scopes = append(scopes, k)
	}
	sort.Strings(scopes)
	return scopes
}

// scope returns the scope override if set, otherwise the tool's default.
func (t *ToolInstaller) scope() string {
	if t.scopeOverride != "" {
		return t.scopeOverride
	}
	return t.config.DefaultScope
}

// Install executes a rollback-safe pipeline: clean -> build -> place -> manifest.
func (t *ToolInstaller) Install(ctx context.Context, src *TemplateSource) error {
	scope := t.scope()
	var output *BuildOutput
	engineSrc := NewFilesystemSource(src.ProjectRoot())

	p := &Pipeline{
		Steps: []Step{
			{
				Name:      "clean-previous",
				Condition: func() bool { return t.IsBrainInstalled() },
				Action: func(ctx context.Context) error {
					return t.placement.Clean(ctx, t.config, scope)
				},
			},
			{
				Name: "build",
				Action: func(ctx context.Context) error {
					brainConfig, err := engineSrc.Config()
					if err != nil {
						return fmt.Errorf("read brain config: %w", err)
					}
					out, err := BuildAll(engineSrc, t.config, brainConfig)
					if err != nil {
						return fmt.Errorf("build: %w", err)
					}
					output = out
					return nil
				},
			},
			{
				Name:      "place",
				Condition: func() bool { return output != nil },
				Action: func(ctx context.Context) error {
					return t.placement.Place(ctx, output, t.config, scope)
				},
				Undo: func(ctx context.Context) error {
					return t.placement.Clean(ctx, t.config, scope)
				},
			},
			{
				Name: "write-manifest",
				Action: func(ctx context.Context) error {
					return WriteManifest(t.Name(), t.installedPaths(scope, output))
				},
				Undo: func(ctx context.Context) error {
					return RemoveManifest(t.Name())
				},
			},
		},
	}
	return p.Execute(ctx)
}

// Uninstall reads the manifest and removes all placed files.
func (t *ToolInstaller) Uninstall(ctx context.Context) error {
	m, err := ReadManifest(t.Name())
	if err != nil {
		// No manifest: fall back to placement.Clean for best-effort removal.
		scope := t.scope()
		t.placement.Clean(ctx, t.config, scope)
		return nil
	}

	for _, f := range m.Files {
		os.Remove(f)
	}

	RemoveManifest(t.Name())
	return nil
}

// installedPaths returns paths that were placed on disk, for the manifest.
func (t *ToolInstaller) installedPaths(scope string, output *BuildOutput) []string {
	if output == nil {
		return nil
	}

	targetDir, err := ResolveScopePath(t.config, scope)
	if err != nil {
		return nil
	}

	var paths []string
	for _, f := range output.AllFiles() {
		paths = append(paths, filepath.Join(targetDir, f.RelativePath))
	}
	return paths
}

// RegisterFromConfig loads tools.config.yaml and registers a ToolInstaller
// for each tool. Skips tools whose slug is already registered (allowing existing
// registrations to take precedence during the transition period).
func RegisterFromConfig(configPath string) error {
	cfg, err := LoadToolConfigs(configPath)
	if err != nil {
		return fmt.Errorf("load tool configs: %w", err)
	}

	for name, tc := range cfg.Tools {
		if _, exists := Get(name); exists {
			continue
		}
		Register(NewToolInstaller(tc))
	}
	return nil
}

// RegisterFromParsed registers ToolInstallers from pre-parsed config.
// This is useful when the config has already been loaded and validated.
func RegisterFromParsed(cfg *ToolsConfig) {
	for _, tc := range cfg.Tools {
		if _, exists := Get(tc.Name); exists {
			continue
		}
		Register(NewToolInstaller(tc))
	}
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

// Step represents a single unit of work in an installation pipeline.
type Step struct {
	Name      string
	Condition func() bool
	Action    func(ctx context.Context) error
	Undo      func(ctx context.Context) error
}

// Pipeline executes steps sequentially with reverse-order rollback on failure.
type Pipeline struct {
	Steps []Step
}

// Execute runs each step in order. If a step fails or the context is cancelled,
// it calls Undo on all completed steps in reverse order.
// Undo errors are collected and returned alongside the original error.
func (p *Pipeline) Execute(ctx context.Context) error {
	var completed []Step

	for _, step := range p.Steps {
		if err := ctx.Err(); err != nil {
			return p.rollback(ctx, completed, fmt.Errorf("pipeline cancelled: %w", err))
		}

		if step.Condition != nil && !step.Condition() {
			continue
		}

		if err := step.Action(ctx); err != nil {
			return p.rollback(ctx, completed, fmt.Errorf("step %q failed: %w", step.Name, err))
		}

		completed = append(completed, step)
	}

	return nil
}

func (p *Pipeline) rollback(ctx context.Context, completed []Step, cause error) error {
	var undoErrs []error

	for i := len(completed) - 1; i >= 0; i-- {
		if completed[i].Undo == nil {
			continue
		}
		if err := completed[i].Undo(ctx); err != nil {
			undoErrs = append(undoErrs, fmt.Errorf("undo %q: %w", completed[i].Name, err))
		}
	}

	if len(undoErrs) == 0 {
		return cause
	}

	return errors.Join(append([]error{cause}, undoErrs...)...)
}

// ─── Executor ───────────────────────────────────────────────────────────────

// Result holds the outcome of a single tool's installation.
type Result struct {
	Name string
	Err  error
}

// InstallAll runs Install on each tool in parallel using errgroup.
// Returns a result for every tool, even on partial failure.
func InstallAll(ctx context.Context, tools []Tool, src *TemplateSource) []Result {
	if len(tools) == 0 {
		return nil
	}

	run := func(ctx context.Context, tool Tool) Result {
		return Result{Name: tool.Name(), Err: tool.Install(ctx, src)}
	}

	if len(tools) == 1 {
		return []Result{run(ctx, tools[0])}
	}

	results := make([]Result, len(tools))
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(len(tools))

	for i, tool := range tools {
		g.Go(func() error {
			results[i] = run(gctx, tool)
			return results[i].Err
		})
	}

	// Wait for all goroutines. We ignore the aggregate error because
	// individual errors are captured in results.
	_ = g.Wait()

	return results
}

// Errors extracts a map of tool-name to error from results, omitting
// tools that succeeded.
func Errors(results []Result) map[string]error {
	errs := make(map[string]error)
	for _, r := range results {
		if r.Err != nil {
			errs[r.Name] = r.Err
		}
	}
	if len(errs) == 0 {
		return nil
	}
	return errs
}

// ─── Manifest ───────────────────────────────────────────────────────────────

// Manifest tracks what was installed for a given tool.
type Manifest struct {
	Tool  string   `json:"tool"`
	Files []string `json:"files"`
}

func init() {
	// On macOS, XDG defaults to ~/Library paths. Override to ~/.cache and
	// ~/.local/share to match Brain's convention (consistent across platforms).
	if runtime.GOOS == "darwin" {
		home, err := os.UserHomeDir()
		if err == nil {
			if os.Getenv("XDG_CACHE_HOME") == "" {
				xdg.CacheHome = filepath.Join(home, ".cache")
			}
			if os.Getenv("XDG_DATA_HOME") == "" {
				xdg.DataHome = filepath.Join(home, ".local", "share")
			}
		}
	}
}

// CacheDir returns the Brain cache directory using XDG.
func CacheDir() string {
	return filepath.Join(xdg.CacheHome, "brain")
}

// DataDir returns the Brain data directory using XDG (~/.local/share/brain).
// This is where distribution-installed templates and config files live.
func DataDir() string {
	return filepath.Join(xdg.DataHome, "brain")
}

// ManifestPath returns the path to a tool's install manifest.
func ManifestPath(tool string) string {
	return filepath.Join(CacheDir(), fmt.Sprintf("manifest-%s.json", tool))
}

// WriteManifest writes an install manifest for the given tool.
func WriteManifest(tool string, files []string) error {
	data, err := json.MarshalIndent(Manifest{Tool: tool, Files: files}, "", "  ")
	if err != nil {
		return err
	}
	path := ManifestPath(tool)
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// ReadManifest reads a tool's install manifest.
func ReadManifest(tool string) (*Manifest, error) {
	data, err := os.ReadFile(ManifestPath(tool))
	if err != nil {
		return nil, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// RemoveManifest deletes a tool's install manifest.
func RemoveManifest(tool string) error {
	return os.Remove(ManifestPath(tool))
}

// ─── Placement Strategy ─────────────────────────────────────────────────────

// PlacementStrategy defines how generated files are placed on disk.
// BuildOutput is defined in build.go.
type PlacementStrategy interface {
	// Place writes generated files to the target location.
	Place(ctx context.Context, output *BuildOutput, tool *ToolConfig, scope string) error

	// Clean removes previously placed files before a fresh install.
	Clean(ctx context.Context, tool *ToolConfig, scope string) error
}

// placementFor returns the appropriate strategy for the tool's placement config.
func placementFor(tool *ToolConfig) PlacementStrategy {
	switch tool.Placement {
	case "marketplace":
		return &MarketplacePlacement{}
	case "copy_and_merge":
		return &CopyAndMergePlacement{}
	default:
		return &MarketplacePlacement{}
	}
}

// ResolveScopePath expands ~ to the user's home directory and returns the
// absolute target directory for the given scope. Relative paths (e.g., project
// scope ".claude/") are resolved against the current working directory.
func ResolveScopePath(tool *ToolConfig, scope string) (string, error) {
	path, ok := tool.Scopes[scope]
	if !ok {
		return "", fmt.Errorf("scope %q not found in tool %q", scope, tool.Name)
	}
	expanded, err := ExpandHome(path)
	if err != nil {
		return "", err
	}
	if !filepath.IsAbs(expanded) {
		cwd, err := os.Getwd()
		if err != nil {
			return "", fmt.Errorf("resolve working directory: %w", err)
		}
		expanded = filepath.Join(cwd, expanded)
	}
	return expanded, nil
}

// ExpandHome replaces a leading ~ with the user's home directory.
func ExpandHome(path string) (string, error) {
	if !strings.HasPrefix(path, "~") {
		return path, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, path[1:]), nil
}

// --------------------------------------------------------------------------
// MarketplacePlacement
// --------------------------------------------------------------------------

// MarketplacePlacement writes all output files to a marketplace directory and
// registers the marketplace in known_marketplaces.json. This matches the
// existing claudecode.go install flow.
type MarketplacePlacement struct{}

func (m *MarketplacePlacement) Place(ctx context.Context, output *BuildOutput, tool *ToolConfig, scope string) error {
	targetDir, err := ResolveScopePath(tool, scope)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("create marketplace dir: %w", err)
	}

	// Write all generated files to the marketplace directory.
	if err := WriteGeneratedFiles(output.AllFiles(), targetDir); err != nil {
		return fmt.Errorf("write marketplace files: %w", err)
	}

	// Generate plugin.json.
	if err := m.writePluginJSON(targetDir); err != nil {
		return fmt.Errorf("write plugin.json: %w", err)
	}

	// Generate marketplace.json.
	if err := m.writeMarketplaceJSON(targetDir, tool); err != nil {
		return fmt.Errorf("write marketplace.json: %w", err)
	}

	// Register in known_marketplaces.json.
	configDir, err := ExpandHome(tool.ConfigDir)
	if err != nil {
		return err
	}
	if err := registerMarketplace(configDir, targetDir); err != nil {
		return fmt.Errorf("register marketplace: %w", err)
	}

	return nil
}

func (m *MarketplacePlacement) Clean(ctx context.Context, tool *ToolConfig, scope string) error {
	targetDir, err := ResolveScopePath(tool, scope)
	if err != nil {
		return err
	}

	// Remove the marketplace directory.
	os.RemoveAll(targetDir)

	// Deregister from known_marketplaces.json.
	configDir, err := ExpandHome(tool.ConfigDir)
	if err != nil {
		return err
	}
	deregisterMarketplace(configDir)

	return nil
}

// writePluginJSON generates the plugin.json manifest in the marketplace dir.
func (m *MarketplacePlacement) writePluginJSON(marketplaceDir string) error {
	var files []string
	err := filepath.WalkDir(marketplaceDir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if d.Name() == ".DS_Store" {
			return nil
		}
		rel, relErr := filepath.Rel(marketplaceDir, path)
		if relErr != nil {
			return relErr
		}
		files = append(files, rel)
		return nil
	})
	if err != nil && !os.IsNotExist(err) {
		return err
	}

	plugin := map[string]any{
		"name":    "brain",
		"version": "1.0.0",
		"files":   files,
	}
	data, err := json.MarshalIndent(plugin, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(filepath.Join(marketplaceDir, "plugin.json"), data, 0600)
}

// writeMarketplaceJSON generates the marketplace.json metadata file.
func (m *MarketplacePlacement) writeMarketplaceJSON(marketplaceDir string, tool *ToolConfig) error {
	metadata := map[string]any{
		"name":        "brain",
		"displayName": tool.DisplayName,
		"description": "Brain plugin for " + tool.DisplayName,
		"version":     "1.0.0",
	}
	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(filepath.Join(marketplaceDir, "marketplace.json"), data, 0600)
}

// registerMarketplace adds the Brain entry to known_marketplaces.json.
func registerMarketplace(configDir, marketplaceDir string) error {
	pluginsDir := filepath.Join(configDir, "plugins")
	path := filepath.Join(pluginsDir, "known_marketplaces.json")
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		raw = []byte("{}")
	}

	entry, err := json.Marshal(map[string]any{
		"source": map[string]any{
			"source": "directory",
			"path":   marketplaceDir,
		},
		"installLocation": marketplaceDir,
		"lastUpdated":     time.Now().UTC().Format(time.RFC3339Nano),
	})
	if err != nil {
		return err
	}

	result, err := sjson.SetRawBytes(raw, "brain", entry)
	if err != nil {
		return err
	}
	return os.WriteFile(path, result, 0600)
}

// deregisterMarketplace removes the Brain entry from known_marketplaces.json.
func deregisterMarketplace(configDir string) {
	path := filepath.Join(configDir, "plugins", "known_marketplaces.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return
	}

	result, err := sjson.DeleteBytes(raw, "brain")
	if err != nil {
		return
	}
	os.WriteFile(path, result, 0600)
}

// --------------------------------------------------------------------------
// CopyAndMergePlacement
// --------------------------------------------------------------------------

// CopyAndMergePlacement copies content directories to the target and applies
// RFC 7396 JSON merge for hooks and MCP config files. This matches the existing
// cursor.go install flow.
type CopyAndMergePlacement struct{}

func (c *CopyAndMergePlacement) Place(ctx context.Context, output *BuildOutput, tool *ToolConfig, scope string) error {
	targetDir, err := ResolveScopePath(tool, scope)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("create target dir: %w", err)
	}

	// Write content directories (agents, skills, commands, rules).
	contentFiles := slices.Concat(output.Agents, output.Skills, output.Commands, output.Rules)
	if err := WriteGeneratedFiles(contentFiles, targetDir); err != nil {
		return err
	}

	// Handle hooks: merge or direct write depending on tool config.
	if err := c.placeConfigFiles(output.Hooks, tool.Hooks, targetDir); err != nil {
		return fmt.Errorf("place hooks: %w", err)
	}

	// Handle MCP: merge or direct write depending on tool config.
	if err := c.placeConfigFiles(output.MCP, tool.MCP, targetDir); err != nil {
		return fmt.Errorf("place mcp: %w", err)
	}

	return nil
}

// placeConfigFiles handles hooks or MCP files based on the config strategy.
func (c *CopyAndMergePlacement) placeConfigFiles(files []GeneratedFile, cfg ConfigFileConfig, targetDir string) error {
	if len(files) == 0 {
		return nil
	}

	switch cfg.Strategy {
	case "merge":
		return c.mergeConfigFiles(files, cfg, targetDir)
	case "direct":
		for _, f := range files {
			dst := filepath.Join(targetDir, f.RelativePath)
			if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
				return err
			}
			if err := os.WriteFile(dst, []byte(f.Content), 0600); err != nil {
				return err
			}
		}
		return nil
	default:
		return nil
	}
}

// mergeConfigFiles applies RFC 7396 JSON merge for config files that contain
// a merge payload (managedKeys + content).
func (c *CopyAndMergePlacement) mergeConfigFiles(files []GeneratedFile, cfg ConfigFileConfig, targetDir string) error {
	for _, f := range files {
		// Check if this file is a merge payload.
		var payload struct {
			ManagedKeys []string        `json:"managedKeys"`
			Content     json.RawMessage `json:"content"`
		}
		if err := json.Unmarshal([]byte(f.Content), &payload); err != nil || payload.Content == nil {
			// Not a merge payload; write directly.
			dst := filepath.Join(targetDir, f.RelativePath)
			if err := os.MkdirAll(filepath.Dir(dst), 0755); err != nil {
				return err
			}
			if err := os.WriteFile(dst, []byte(f.Content), 0644); err != nil {
				return err
			}
			continue
		}

		// Apply RFC 7396 merge to the target config file.
		targetPath := filepath.Join(targetDir, cfg.Target)
		existing := []byte("{}")
		if raw, err := os.ReadFile(targetPath); err == nil {
			existing = raw
		}

		merged, err := jsonpatch.MergePatch(existing, payload.Content)
		if err != nil {
			return fmt.Errorf("merge patch %s: %w", cfg.Target, err)
		}

		// Pretty-print the merged JSON.
		var buf json.RawMessage
		if err := json.Unmarshal(merged, &buf); err != nil {
			return fmt.Errorf("re-parse merged %s: %w", cfg.Target, err)
		}
		out, err := json.MarshalIndent(buf, "", "  ")
		if err != nil {
			return fmt.Errorf("marshal merged %s: %w", cfg.Target, err)
		}
		out = append(out, '\n')

		if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
			return fmt.Errorf("create dir for %s: %w", cfg.Target, err)
		}
		if err := os.WriteFile(targetPath, out, 0600); err != nil {
			return fmt.Errorf("write merged %s: %w", cfg.Target, err)
		}
	}
	return nil
}

func (c *CopyAndMergePlacement) Clean(ctx context.Context, tool *ToolConfig, scope string) error {
	targetDir, err := ResolveScopePath(tool, scope)
	if err != nil {
		return err
	}

	brainPrefix := BrainEmoji + "-"

	// Remove Brain-prefixed files from content directories.
	for _, sub := range []string{AgentsDir, CommandsDir, RulesDir} {
		dir := filepath.Join(targetDir, sub)
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() && strings.HasPrefix(e.Name(), brainPrefix) {
				os.Remove(filepath.Join(dir, e.Name()))
			}
		}
	}

	// Remove Brain-prefixed skill directories.
	skillsDir := filepath.Join(targetDir, SkillsDir)
	if entries, err := os.ReadDir(skillsDir); err == nil {
		for _, e := range entries {
			if e.IsDir() && strings.HasPrefix(e.Name(), brainPrefix) {
				os.RemoveAll(filepath.Join(skillsDir, e.Name()))
			}
		}
	}

	// Remove Brain-managed keys from hooks.json.
	if tool.Hooks.Strategy == "merge" {
		cleanManagedKeys(filepath.Join(targetDir, tool.Hooks.Target))
	}

	// Remove Brain-managed keys from mcp.json.
	if tool.MCP.Strategy == "merge" {
		cleanManagedKeys(filepath.Join(targetDir, tool.MCP.Target))
	}

	return nil
}

// cleanManagedKeys removes Brain-managed keys from a JSON config file.
// It checks for keys with a "brain" prefix and removes them.
func cleanManagedKeys(targetPath string) {
	raw, err := os.ReadFile(targetPath)
	if err != nil {
		return
	}

	result := raw
	parsed := gjson.ParseBytes(result)
	parsed.ForEach(func(key, _ gjson.Result) bool {
		k := key.String()
		if strings.HasPrefix(strings.ToLower(k), "brain") {
			result, _ = sjson.DeleteBytes(result, k)
		}
		return true
	})

	// Check nested structures (e.g., mcpServers.brain-*)
	for _, parent := range []string{"mcpServers", "hooks"} {
		parentResult := gjson.GetBytes(result, parent)
		if !parentResult.Exists() || !parentResult.IsObject() {
			continue
		}
		parentResult.ForEach(func(key, _ gjson.Result) bool {
			k := key.String()
			if strings.HasPrefix(strings.ToLower(k), "brain") {
				result, _ = sjson.DeleteBytes(result, parent+"."+k)
			}
			return true
		})
		// Remove empty parent.
		parentAfter := gjson.GetBytes(result, parent)
		if parentAfter.Exists() && parentAfter.IsObject() && len(parentAfter.Map()) == 0 {
			result, _ = sjson.DeleteBytes(result, parent)
		}
	}

	// If only metadata keys remain, delete the file.
	final := gjson.ParseBytes(result)
	meaningful := 0
	final.ForEach(func(key, _ gjson.Result) bool {
		k := key.String()
		if k != "version" && k != "$schema" {
			meaningful++
		}
		return true
	})
	if meaningful == 0 {
		os.Remove(targetPath)
		return
	}

	if len(result) > 0 && result[len(result)-1] != '\n' {
		result = append(result, '\n')
	}
	os.WriteFile(targetPath, result, 0600)
}
