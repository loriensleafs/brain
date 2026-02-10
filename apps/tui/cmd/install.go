package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/peterkloss/brain-tui/internal/adapters"
	"github.com/peterkloss/brain-tui/embedded"
	"github.com/spf13/cobra"
)

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install Brain for AI coding tools",
	Long: `Installs Brain agents, skills, commands, and hooks for selected tools.

Supported: Claude Code, Cursor.

For Claude Code, Brain installs as a plugin using symlinks.
For Cursor, Brain uses file copy with additive JSON merge for hooks and MCP.
Instructions are delivered via composable rules (never modifies user config).`,
	RunE: runInstall,
}

var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Uninstall Brain from AI coding tools",
	Long: `Removes Brain content from selected tools.

Removes all 🧠-prefixed files and manifest-tracked entries.
Never touches user-created files.`,
	RunE: runUninstall,
}

func init() {
	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(uninstallCmd)
}

// ─── Tool Detection ──────────────────────────────────────────────────────────

type toolInfo struct {
	Name      string
	Installed bool
	ConfigDir string
}

func detectTools() []toolInfo {
	home, _ := os.UserHomeDir()
	tools := []toolInfo{
		{Name: "Claude Code", ConfigDir: filepath.Join(home, ".claude")},
		{Name: "Cursor", ConfigDir: filepath.Join(home, ".cursor")},
	}

	for i := range tools {
		_, err := os.Stat(tools[i].ConfigDir)
		tools[i].Installed = err == nil
	}

	return tools
}

// ─── Project Root ────────────────────────────────────────────────────────────

func findProjectRoot() (string, error) {
	// Walk up from cwd looking for brain.config.json
	dir, err := os.Getwd()
	if err != nil {
		return "", err
	}

	for {
		if _, err := os.Stat(filepath.Join(dir, "brain.config.json")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	// Fallback: ~/Dev/brain
	home, _ := os.UserHomeDir()
	fallback := filepath.Join(home, "Dev", "brain")
	if _, err := os.Stat(filepath.Join(fallback, "brain.config.json")); err == nil {
		return fallback, nil
	}

	return "", fmt.Errorf("cannot find brain.config.json; run from the Brain project directory")
}

// ─── Install Manifest ────────────────────────────────────────────────────────

type installManifest struct {
	Tool        string   `json:"tool"`
	Files       []string `json:"files"`       // file paths installed (agents, commands, rules, scripts)
	Dirs        []string `json:"dirs"`        // directories installed (skills)
	HookKeys    []string `json:"hookKeys"`    // hook event keys merged into hooks.json
	MCPServers  []string `json:"mcpServers"`  // MCP server names merged into mcp.json
}

func manifestPath(tool string) string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cache", "brain", fmt.Sprintf("manifest-%s.json", tool))
}

func writeManifest(tool string, files []string) error {
	m := installManifest{Tool: tool, Files: files}
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	dir := filepath.Dir(manifestPath(tool))
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	return os.WriteFile(manifestPath(tool), data, 0644)
}

func readManifest(tool string) (*installManifest, error) {
	data, err := os.ReadFile(manifestPath(tool))
	if err != nil {
		return nil, err
	}
	var m installManifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return &m, nil
}

// ─── Installed Dependencies Tracking ─────────────────────────────────────────

func depsManifestPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cache", "brain", "installed-deps.json")
}

func writeInstalledDeps(deps []string) error {
	data, err := json.MarshalIndent(deps, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	dir := filepath.Dir(depsManifestPath())
	os.MkdirAll(dir, 0755)
	return os.WriteFile(depsManifestPath(), data, 0644)
}

func readInstalledDeps() []string {
	data, err := os.ReadFile(depsManifestPath())
	if err != nil {
		return nil
	}
	var deps []string
	json.Unmarshal(data, &deps)
	return deps
}

// ─── Template Source ─────────────────────────────────────────────────────────

// resolveTemplateSource returns a TemplateSource for reading templates.
// Prefers the real filesystem (development), falls back to embedded templates.
func resolveTemplateSource() *adapters.TemplateSource {
	// Try to find project root on the filesystem first
	projectRoot, err := findProjectRoot()
	if err == nil {
		return adapters.NewFilesystemSource(projectRoot)
	}

	// Fall back to embedded templates
	// Use a reasonable default for projectRoot (used for path resolution in MCP config)
	home, _ := os.UserHomeDir()
	return adapters.NewEmbeddedSource(embedded.FS(), filepath.Join(home, "Dev", "brain"))
}

// ─── Adapter Invocation ──────────────────────────────────────────────────────

func runAdapterStage(projectRoot, target, outputDir string) error {
	brainConfig, err := adapters.ReadBrainConfig(projectRoot)
	if err != nil {
		return fmt.Errorf("read config: %w", err)
	}

	var files []adapters.GeneratedFile
	switch target {
	case "claude-code":
		output, err := adapters.TransformClaudeCode(projectRoot, brainConfig)
		if err != nil {
			return fmt.Errorf("transform claude-code: %w", err)
		}
		files = output.AllFiles()
	case "cursor":
		output, err := adapters.CursorTransform(projectRoot, brainConfig)
		if err != nil {
			return fmt.Errorf("transform cursor: %w", err)
		}
		files = append(files, output.Agents...)
		files = append(files, output.Rules...)
		files = append(files, output.Hooks...)
		files = append(files, output.MCP...)
	default:
		return fmt.Errorf("unknown target: %s", target)
	}

	return adapters.WriteGeneratedFiles(files, outputDir)
}

// runAdapterStageFromSource runs adapter transforms using a TemplateSource.
func runAdapterStageFromSource(src *adapters.TemplateSource, target, outputDir string) error {
	brainConfig, err := adapters.ReadBrainConfigFromSource(src)
	if err != nil {
		return fmt.Errorf("read config: %w", err)
	}

	var files []adapters.GeneratedFile
	switch target {
	case "claude-code":
		output, err := adapters.TransformClaudeCodeFromSource(src, brainConfig)
		if err != nil {
			return fmt.Errorf("transform claude-code: %w", err)
		}
		files = output.AllFiles()
	case "cursor":
		output, err := adapters.CursorTransformFromSource(src, brainConfig)
		if err != nil {
			return fmt.Errorf("transform cursor: %w", err)
		}
		files = append(files, output.Agents...)
		files = append(files, output.Skills...)
		files = append(files, output.Commands...)
		files = append(files, output.Rules...)
		files = append(files, output.Hooks...)
		files = append(files, output.MCP...)
	default:
		return fmt.Errorf("unknown target: %s", target)
	}

	return adapters.WriteGeneratedFiles(files, outputDir)
}

// ─── Claude Code Install ─────────────────────────────────────────────────────

func installClaudeCode(src *adapters.TemplateSource) error {
	home, _ := os.UserHomeDir()
	pluginsDir := filepath.Join(home, ".claude", "plugins")
	marketplaceDir := filepath.Join(pluginsDir, "marketplaces", "brain")
	cacheDir := filepath.Join(pluginsDir, "cache", "brain", "--", "unknown")

	fmt.Println("  Running adapter transforms...")
	// Run adapter to staging directory first
	stagingDir := filepath.Join(home, ".cache", "brain", "staging", "claude-code")
	if err := os.RemoveAll(stagingDir); err != nil {
		return fmt.Errorf("clean staging: %w", err)
	}
	if err := runAdapterStageFromSource(src, "claude-code", stagingDir); err != nil {
		return fmt.Errorf("adapter: %w", err)
	}

	// Symlink from staging to plugin directories
	fmt.Println("  Creating plugin symlinks...")
	for _, targetDir := range []string{marketplaceDir, cacheDir} {
		if err := os.RemoveAll(targetDir); err != nil {
			return fmt.Errorf("clean target: %w", err)
		}
		if err := symlinkPluginContent(stagingDir, targetDir); err != nil {
			return fmt.Errorf("symlink to %s: %w", targetDir, err)
		}
	}

	// Register marketplace
	if err := registerMarketplace(pluginsDir, marketplaceDir); err != nil {
		return fmt.Errorf("marketplace registration: %w", err)
	}

	// Collect all installed file paths for manifest
	var installed []string
	installed = append(installed, marketplaceDir, cacheDir)

	if err := writeManifest("claude-code", installed); err != nil {
		fmt.Printf("  Warning: failed to write manifest: %v\n", err)
	}

	fmt.Println("  [COMPLETE] Claude Code plugin installed")
	return nil
}

func uninstallClaudeCode() error {
	home, _ := os.UserHomeDir()
	pluginsDir := filepath.Join(home, ".claude", "plugins")

	// Remove plugin directories
	os.RemoveAll(filepath.Join(pluginsDir, "marketplaces", "brain"))
	os.RemoveAll(filepath.Join(pluginsDir, "cache", "brain"))
	fmt.Println("  Removed plugin directories")

	// Remove from known_marketplaces.json
	kmPath := filepath.Join(pluginsDir, "known_marketplaces.json")
	if raw, err := os.ReadFile(kmPath); err == nil {
		data := map[string]any{}
		json.Unmarshal(raw, &data)
		delete(data, "brain")
		out, _ := json.MarshalIndent(data, "", "  ")
		os.WriteFile(kmPath, out, 0644)
		fmt.Println("  Removed from known_marketplaces.json")
	}

	// Remove staging
	stagingDir := filepath.Join(home, ".cache", "brain", "staging", "claude-code")
	os.RemoveAll(stagingDir)

	// Remove manifest
	os.Remove(manifestPath("claude-code"))

	fmt.Println("  [COMPLETE] Claude Code plugin uninstalled")
	return nil
}

// ─── Cursor Install ─────────────────────────────────────────────────────────

func installCursor(src *adapters.TemplateSource) error {
	home, _ := os.UserHomeDir()
	cursorDir := filepath.Join(home, ".cursor")

	fmt.Println("  Running adapter transforms...")
	stagingDir := filepath.Join(home, ".cache", "brain", "staging", "cursor")
	if err := os.RemoveAll(stagingDir); err != nil {
		return fmt.Errorf("clean staging: %w", err)
	}
	if err := runAdapterStageFromSource(src, "cursor", stagingDir); err != nil {
		return fmt.Errorf("adapter: %w", err)
	}

	// File copy (not symlinks -- Cursor symlinks are broken)
	var installed []string

	// Copy agents to .cursor/agents/
	agentsDir := filepath.Join(stagingDir, "agents")
	if _, err := os.Stat(agentsDir); err == nil {
		fmt.Println("  Copying agents to .cursor/agents/...")
		targetAgentsDir := filepath.Join(cursorDir, "agents")
		if err := os.MkdirAll(targetAgentsDir, 0755); err != nil {
			return fmt.Errorf("create agents dir: %w", err)
		}
		copied, err := copyBrainFiles(agentsDir, targetAgentsDir)
		if err != nil {
			return fmt.Errorf("copy agents: %w", err)
		}
		installed = append(installed, copied...)
	}

	// Copy commands to .cursor/commands/
	commandsDir := filepath.Join(stagingDir, "commands")
	if _, err := os.Stat(commandsDir); err == nil {
		fmt.Println("  Copying commands to .cursor/commands/...")
		targetCommandsDir := filepath.Join(cursorDir, "commands")
		if err := os.MkdirAll(targetCommandsDir, 0755); err != nil {
			return fmt.Errorf("create commands dir: %w", err)
		}
		copied, err := copyBrainFiles(commandsDir, targetCommandsDir)
		if err != nil {
			return fmt.Errorf("copy commands: %w", err)
		}
		installed = append(installed, copied...)
	}

	// Copy rules to .cursor/rules/
	rulesDir := filepath.Join(stagingDir, "rules")
	if _, err := os.Stat(rulesDir); err == nil {
		fmt.Println("  Copying rules to .cursor/rules/...")
		targetRulesDir := filepath.Join(cursorDir, "rules")
		if err := os.MkdirAll(targetRulesDir, 0755); err != nil {
			return fmt.Errorf("create rules dir: %w", err)
		}
		copied, err := copyBrainFiles(rulesDir, targetRulesDir)
		if err != nil {
			return fmt.Errorf("copy rules: %w", err)
		}
		installed = append(installed, copied...)
	}

	// Copy reference docs to ~/.agents/
	dotsAgentsDir := filepath.Join(stagingDir, ".agents")
	if _, err := os.Stat(dotsAgentsDir); err == nil {
		fmt.Println("  Copying reference docs to ~/.agents/...")
		targetDotsAgentsDir := filepath.Join(home, ".agents")
		if err := os.MkdirAll(targetDotsAgentsDir, 0755); err != nil {
			return fmt.Errorf("create .agents dir: %w", err)
		}
		copied, err := copyBrainFiles(dotsAgentsDir, targetDotsAgentsDir)
		if err != nil {
			return fmt.Errorf("copy .agents: %w", err)
		}
		installed = append(installed, copied...)
	}

	// Track directories for skills
	var installedDirs []string
	var hookKeys []string
	var mcpServers []string

	// Copy skills to .cursor/skills/
	skillsDir := filepath.Join(stagingDir, "skills")
	if _, err := os.Stat(skillsDir); err == nil {
		fmt.Println("  Copying skills to .cursor/skills/...")
		targetSkillsDir := filepath.Join(cursorDir, "skills")
		if err := os.MkdirAll(targetSkillsDir, 0755); err != nil {
			return fmt.Errorf("create skills dir: %w", err)
		}
		copied, err := copyBrainFilesRecursive(skillsDir, targetSkillsDir)
		if err != nil {
			return fmt.Errorf("copy skills: %w", err)
		}
		installed = append(installed, copied...)
		// Track top-level skill directories for removal
		entries, _ := os.ReadDir(targetSkillsDir)
		for _, e := range entries {
			if e.IsDir() && strings.HasPrefix(e.Name(), "\xf0\x9f\xa7\xa0-") {
				installedDirs = append(installedDirs, filepath.Join(targetSkillsDir, e.Name()))
			}
		}
	}

	// JSON merge for hooks
	hooksMergePath := filepath.Join(stagingDir, "hooks", "hooks.merge.json")
	if _, err := os.Stat(hooksMergePath); err == nil {
		fmt.Println("  Merging hooks.json...")
		hooksTarget := filepath.Join(cursorDir, "hooks.json")
		merged, err := jsonMerge(hooksMergePath, hooksTarget)
		if err != nil {
			fmt.Printf("  Warning: hooks merge failed: %v\n", err)
		} else {
			hookKeys = append(hookKeys, merged...)
		}

		// Copy hook scripts
		scriptsDir := filepath.Join(stagingDir, "hooks", "scripts")
		if _, err := os.Stat(scriptsDir); err == nil {
			targetScriptsDir := filepath.Join(cursorDir, "hooks", "scripts")
			if err := os.MkdirAll(targetScriptsDir, 0755); err == nil {
				copied, err := copyBrainFiles(scriptsDir, targetScriptsDir)
				if err != nil {
					fmt.Printf("  Warning: hook scripts copy failed: %v\n", err)
				} else {
					installed = append(installed, copied...)
				}
			}
		}
	}

	// JSON merge for MCP
	mcpMergePath := filepath.Join(stagingDir, "mcp", "mcp.merge.json")
	if _, err := os.Stat(mcpMergePath); err == nil {
		fmt.Println("  Merging mcp.json...")
		mcpTarget := filepath.Join(cursorDir, "mcp.json")
		merged, err := jsonMerge(mcpMergePath, mcpTarget)
		if err != nil {
			fmt.Printf("  Warning: MCP merge failed: %v\n", err)
		} else {
			mcpServers = append(mcpServers, merged...)
		}
	}

	manifest := installManifest{
		Tool:       "cursor",
		Files:      installed,
		Dirs:       installedDirs,
		HookKeys:   hookKeys,
		MCPServers: mcpServers,
	}
	data, _ := json.MarshalIndent(manifest, "", "  ")
	data = append(data, '\n')
	dir := filepath.Dir(manifestPath("cursor"))
	os.MkdirAll(dir, 0755)
	if err := os.WriteFile(manifestPath("cursor"), data, 0644); err != nil {
		fmt.Printf("  Warning: failed to write manifest: %v\n", err)
	}

	fmt.Println("  [COMPLETE] Cursor plugin installed")
	return nil
}

func uninstallCursor() error {
	home, _ := os.UserHomeDir()
	cursorDir := filepath.Join(home, ".cursor")

	// Read manifest to know what was installed
	m, err := readManifest("cursor")
	if err != nil {
		return fmt.Errorf("no install manifest found: %w", err)
	}

	// Remove Brain-managed files (agents, commands, rules, hook scripts, .agents docs)
	removedDirs := make(map[string]bool)
	for _, f := range m.Files {
		if err := os.Remove(f); err == nil {
			fmt.Printf("  Removed: %s\n", f)
			removedDirs[filepath.Dir(f)] = true
		}
	}

	// Remove Brain-managed directories (🧠-prefixed skill dirs)
	for _, d := range m.Dirs {
		if err := os.RemoveAll(d); err == nil {
			fmt.Printf("  Removed: %s\n", d)
			removedDirs[filepath.Dir(d)] = true
		}
	}

	// Clean up any directories that are now empty after file removal
	for dir := range removedDirs {
		removeEmptyDirChain(dir, home)
	}

	// Clean hooks.json: remove Brain-managed hook event keys
	if len(m.HookKeys) > 0 {
		hooksPath := filepath.Join(cursorDir, "hooks.json")
		if err := jsonRemoveKeys(hooksPath, m.HookKeys); err != nil {
			fmt.Printf("  Warning: failed to clean hooks.json: %v\n", err)
		} else {
			fmt.Println("  Cleaned hooks.json")
		}
	}

	// Clean mcp.json: remove Brain-managed MCP servers
	if len(m.MCPServers) > 0 {
		mcpPath := filepath.Join(cursorDir, "mcp.json")
		if err := jsonRemoveKeys(mcpPath, m.MCPServers); err != nil {
			fmt.Printf("  Warning: failed to clean mcp.json: %v\n", err)
		} else {
			fmt.Println("  Cleaned mcp.json")
		}
	}

	// Remove staging
	stagingDir := filepath.Join(home, ".cache", "brain", "staging", "cursor")
	os.RemoveAll(stagingDir)

	// Remove manifest
	os.Remove(manifestPath("cursor"))

	fmt.Println("  [COMPLETE] Cursor plugin uninstalled")
	return nil
}

// copyBrainFiles copies files from src to dst. Creates dst if needed. Returns paths of copied files.
func copyBrainFiles(src, dst string) ([]string, error) {
	if err := os.MkdirAll(dst, 0755); err != nil {
		return nil, fmt.Errorf("create directory %s: %w", dst, err)
	}

	var copied []string
	entries, err := os.ReadDir(src)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() || entry.Name() == ".DS_Store" || entry.Name() == ".gitkeep" {
			continue
		}
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		// Remove existing symlinks so we replace with a real file
		if info, err := os.Lstat(dstPath); err == nil && info.Mode()&os.ModeSymlink != 0 {
			os.Remove(dstPath)
		}

		data, err := os.ReadFile(srcPath)
		if err != nil {
			return copied, fmt.Errorf("read %s: %w", srcPath, err)
		}
		if err := os.WriteFile(dstPath, data, 0644); err != nil {
			return copied, fmt.Errorf("write %s: %w", dstPath, err)
		}
		copied = append(copied, dstPath)
	}

	return copied, nil
}

// copyBrainFilesRecursive copies all files from src to dst, preserving subdirectory structure.
// Used for skills which have subdirectories (e.g., skills/🧠-name/SKILL.md).
func copyBrainFilesRecursive(src, dst string) ([]string, error) {
	var copied []string
	err := filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Name() == ".DS_Store" || info.Name() == ".gitkeep" {
			return nil
		}

		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		dstPath := filepath.Join(dst, rel)

		if info.IsDir() {
			return os.MkdirAll(dstPath, 0755)
		}

		data, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("read %s: %w", path, err)
		}
		if err := os.WriteFile(dstPath, data, 0644); err != nil {
			return fmt.Errorf("write %s: %w", dstPath, err)
		}
		copied = append(copied, dstPath)
		return nil
	})
	return copied, err
}

// jsonMerge reads a merge payload and additively merges it into the target JSON file.
// Returns the list of managed key paths that were merged.
func jsonMerge(mergePayloadPath, targetPath string) ([]string, error) {
	payloadData, err := os.ReadFile(mergePayloadPath)
	if err != nil {
		return nil, fmt.Errorf("read merge payload: %w", err)
	}

	var payload struct {
		ManagedKeys []string       `json:"managedKeys"`
		Content     map[string]any `json:"content"`
	}
	if err := json.Unmarshal(payloadData, &payload); err != nil {
		return nil, fmt.Errorf("parse merge payload: %w", err)
	}

	// Read existing target (or start empty)
	existing := map[string]any{}
	if raw, err := os.ReadFile(targetPath); err == nil {
		json.Unmarshal(raw, &existing)
	}

	// Additive merge: for each top-level key in content, merge into existing
	for k, v := range payload.Content {
		existingSection, ok := existing[k]
		if !ok {
			existing[k] = v
			continue
		}
		// If both are maps, merge the inner keys
		existingMap, eOk := existingSection.(map[string]any)
		newMap, nOk := v.(map[string]any)
		if eOk && nOk {
			for ik, iv := range newMap {
				existingMap[ik] = iv
			}
			existing[k] = existingMap
		} else {
			existing[k] = v
		}
	}

	out, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal merged config: %w", err)
	}
	out = append(out, '\n')

	dir := filepath.Dir(targetPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create dir for %s: %w", targetPath, err)
	}
	if err := os.WriteFile(targetPath, out, 0644); err != nil {
		return nil, fmt.Errorf("write merged config: %w", err)
	}

	return payload.ManagedKeys, nil
}

// removeEmptyDirChain removes a directory if empty (ignoring .DS_Store),
// then walks up removing empty parents until hitting stopAt or a non-empty directory.
func removeEmptyDirChain(dir, stopAt string) {
	for dir != stopAt && dir != "/" && len(dir) > len(stopAt) {
		entries, err := os.ReadDir(dir)
		if err != nil {
			break
		}
		// Count only meaningful entries (ignore .DS_Store)
		meaningful := 0
		for _, e := range entries {
			if e.Name() != ".DS_Store" {
				meaningful++
			}
		}
		if meaningful > 0 {
			break
		}
		// Remove .DS_Store if it's the only thing left
		dsStore := filepath.Join(dir, ".DS_Store")
		os.Remove(dsStore)
		os.Remove(dir)
		fmt.Printf("  Removed empty directory: %s\n", dir)
		dir = filepath.Dir(dir)
	}
}

// jsonRemoveKeys removes specific dotted keys from a JSON config file.
// Keys like "hooks.beforeSubmitPrompt" remove data["hooks"]["beforeSubmitPrompt"].
// Keys like "mcpServers.brain" remove data["mcpServers"]["brain"].
// If removing the last nested key empties the parent, removes the parent too.
// If the file becomes effectively empty, deletes it entirely.
func jsonRemoveKeys(targetPath string, keys []string) error {
	raw, err := os.ReadFile(targetPath)
	if err != nil {
		return nil // File doesn't exist, nothing to clean
	}

	data := map[string]any{}
	if err := json.Unmarshal(raw, &data); err != nil {
		return err
	}

	for _, key := range keys {
		parts := strings.SplitN(key, ".", 2)
		if len(parts) == 2 {
			// Nested key: remove from sub-map
			if section, ok := data[parts[0]].(map[string]any); ok {
				delete(section, parts[1])
				// If section is now empty, remove the parent key
				if len(section) == 0 {
					delete(data, parts[0])
				}
			}
		} else {
			// Top-level key
			delete(data, key)
		}
	}

	// If only metadata keys remain (version, $schema) or empty, delete the file
	meaningful := 0
	for k := range data {
		if k != "version" && k != "$schema" {
			meaningful++
		}
	}
	if meaningful == 0 {
		os.Remove(targetPath)
		fmt.Printf("  Removed: %s (empty after cleanup)\n", targetPath)
		return nil
	}

	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')
	return os.WriteFile(targetPath, out, 0644)
}

// ─── Install Detection ──────────────────────────────────────────────────────

// isBrainInstalledClaude checks if Brain is already installed for Claude Code.
func isBrainInstalledClaude() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}

	// Check for plugin marketplace directory
	marketplaceDir := filepath.Join(home, ".claude", "plugins", "marketplaces", "brain")
	if _, err := os.Stat(marketplaceDir); err == nil {
		return true
	}

	// Check for Brain manifest
	if _, err := readManifest("claude-code"); err == nil {
		return true
	}

	// Check for Brain rules files (🧠-*.md)
	rulesDir := filepath.Join(home, ".claude", "rules")
	if hasBrainPrefixedFiles(rulesDir, ".md") {
		return true
	}

	return false
}

// isBrainInstalledCursor checks if Brain is already installed for Cursor.
func isBrainInstalledCursor() bool {
	home, err := os.UserHomeDir()
	if err != nil {
		return false
	}

	// Check for Brain manifest
	if _, err := readManifest("cursor"); err == nil {
		return true
	}

	// Check for Brain agent files (🧠-*.md)
	agentsDir := filepath.Join(home, ".cursor", "agents")
	if hasBrainPrefixedFiles(agentsDir, ".md") {
		return true
	}

	// Check for Brain rules files (🧠-*.mdc)
	rulesDir := filepath.Join(home, ".cursor", "rules")
	if hasBrainPrefixedFiles(rulesDir, ".mdc") {
		return true
	}

	return false
}

// hasBrainPrefixedFiles checks if a directory contains files with the Brain emoji prefix.
func hasBrainPrefixedFiles(dir, ext string) bool {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return false
	}

	prefix := "\xf0\x9f\xa7\xa0-" // 🧠-
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if strings.HasPrefix(name, prefix) && strings.HasSuffix(name, ext) {
			return true
		}
	}

	return false
}

// isBrainInstalled checks if Brain is already installed for a given tool.
func isBrainInstalled(tool string) bool {
	switch tool {
	case "claude-code":
		return isBrainInstalledClaude()
	case "cursor":
		return isBrainInstalledCursor()
	default:
		return false
	}
}

// toolDisplayName converts a tool slug to a display name.
func toolDisplayName(tool string) string {
	switch tool {
	case "claude-code":
		return "Claude Code"
	case "cursor":
		return "Cursor"
	default:
		return tool
	}
}

// ─── Dependency Management ───────────────────────────────────────────────────

type dependency struct {
	Name       string
	Binary     string
	CheckArgs  []string // args to verify it works (e.g., "--version")
	InstallCmd string   // shell command to install
	InstallMsg string   // human-readable install instruction
}

var requiredDeps = []dependency{
	{
		Name:       "bun",
		Binary:     "bun",
		CheckArgs:  []string{"--version"},
		InstallCmd: "curl -fsSL https://bun.sh/install | bash",
		InstallMsg: "Required for MCP server and hook scripts",
	},
	{
		Name:       "uv",
		Binary:     "uv",
		CheckArgs:  []string{"--version"},
		InstallCmd: "curl -LsSf https://astral.sh/uv/install.sh | sh",
		InstallMsg: "Required to install basic-memory",
	},
	{
		Name:       "basic-memory",
		Binary:     "basic-memory",
		CheckArgs:  []string{"version"},
		InstallCmd: "uv tool install basic-memory",
		InstallMsg: "Knowledge graph backend for Brain",
	},
}

// checkDependencies returns a list of missing dependencies.
func checkDependencies() []dependency {
	var missing []dependency
	for _, dep := range requiredDeps {
		if _, err := exec.LookPath(dep.Binary); err != nil {
			missing = append(missing, dep)
		}
	}
	return missing
}

// refreshPATH adds common install locations to PATH so newly installed
// binaries are immediately available without restarting the shell.
func refreshPATH() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	extraPaths := []string{
		filepath.Join(home, ".bun", "bin"),
		filepath.Join(home, ".local", "bin"),
		filepath.Join(home, ".cargo", "bin"),
	}

	current := os.Getenv("PATH")
	for _, p := range extraPaths {
		if !strings.Contains(current, p) {
			current = p + ":" + current
		}
	}
	os.Setenv("PATH", current)
}

// installDependency runs the install command for a dependency.
func installDependency(dep dependency) error {
	fmt.Printf("  Installing %s...\n", dep.Name)
	cmd := exec.Command("sh", "-c", dep.InstallCmd)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}
	// Refresh PATH so the next dep can find this one
	refreshPATH()
	return nil
}

// brainRequiredSettings defines basic-memory config values that Brain requires.
// Only includes settings where Brain needs a specific non-default value.
var brainRequiredSettings = map[string]any{
	"env": "user", // basic-memory defaults to "dev"
}

// configureBasicMemory ensures basic-memory config has Brain-required settings.
// For fresh installs, writes the full recommended config.
// For existing installs, checks for conflicts and asks before changing.
func configureBasicMemory(freshInstall bool) {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	configDir := filepath.Join(home, ".basic-memory")
	configPath := filepath.Join(configDir, "config.json")

	if freshInstall {
		// Fresh install: write full config
		if err := os.MkdirAll(configDir, 0755); err != nil {
			fmt.Printf("  Warning: could not create config dir: %v\n", err)
			return
		}
		config := map[string]any{
			"env":                           "user",
			"default_project_mode":          false,
			"log_level":                     "info",
			"database_backend":              "sqlite",
			"database_url":                  nil,
			"db_pool_size":                  20,
			"db_pool_overflow":              40,
			"db_pool_recycle":               180,
			"sync_delay":                    500,
			"watch_project_reload_interval": 30,
			"update_permalinks_on_move":     true,
			"sync_changes":                  true,
			"sync_thread_pool_size":         4,
			"sync_max_concurrent_files":     10,
			"kebab_filenames":               false,
			"disable_permalinks":            false,
			"skip_initialization_sync":      false,
			"format_on_save":                false,
			"formatter_command":             nil,
			"formatters":                    map[string]any{},
			"formatter_timeout":             5,
			"project_root":                  nil,
			"cloud_mode":                    false,
		}
		data, err := json.MarshalIndent(config, "", "  ")
		if err != nil {
			fmt.Printf("  Warning: could not marshal config: %v\n", err)
			return
		}
		data = append(data, '\n')
		if err := os.WriteFile(configPath, data, 0644); err != nil {
			fmt.Printf("  Warning: could not write config: %v\n", err)
			return
		}
		fmt.Println("  [COMPLETE] basic-memory configured")
		return
	}

	// Existing install: read config and check for conflicts
	raw, err := os.ReadFile(configPath)
	if err != nil {
		// No config file — nothing to conflict with, write defaults
		configureBasicMemory(true)
		return
	}

	var existing map[string]any
	if err := json.Unmarshal(raw, &existing); err != nil {
		fmt.Printf("  Warning: could not parse basic-memory config: %v\n", err)
		return
	}

	// Find settings that conflict with Brain's requirements
	var conflicts []string
	for key, required := range brainRequiredSettings {
		current, exists := existing[key]
		if !exists || fmt.Sprintf("%v", current) != fmt.Sprintf("%v", required) {
			conflicts = append(conflicts, fmt.Sprintf(
				"  %s: current=%v, required=%v", key, current, required,
			))
		}
	}

	if len(conflicts) == 0 {
		fmt.Println("  basic-memory config is compatible")
		return
	}

	fmt.Println("\n  basic-memory config has settings that need to change for Brain:")
	for _, c := range conflicts {
		fmt.Println(c)
	}
	fmt.Println()

	var autoFix bool
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Update these settings automatically?").
				Description("Your projects and other settings will not be modified.").
				Affirmative("Yes, update").
				Negative("No, I'll do it manually").
				Value(&autoFix),
		),
	)
	if err := form.Run(); err != nil {
		return
	}

	if !autoFix {
		fmt.Println("  Please update the settings above in ~/.basic-memory/config.json")
		return
	}

	// Apply only the required changes, preserving everything else
	for key, required := range brainRequiredSettings {
		existing[key] = required
	}

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		fmt.Printf("  Warning: could not marshal config: %v\n", err)
		return
	}
	data = append(data, '\n')
	if err := os.WriteFile(configPath, data, 0644); err != nil {
		fmt.Printf("  Warning: could not write config: %v\n", err)
		return
	}
	fmt.Println("  [COMPLETE] basic-memory config updated")
}

// ensureBrainConfig creates ~/.config/brain/config.json if it doesn't exist.
// The Brain MCP server manages this file at runtime, but we seed it on
// first install so the MCP server has a valid starting point.
func ensureBrainConfig() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	configDir := filepath.Join(home, ".config", "brain")
	configPath := filepath.Join(configDir, "config.json")

	if _, err := os.Stat(configPath); err == nil {
		return // already exists
	}

	if err := os.MkdirAll(configDir, 0700); err != nil {
		fmt.Printf("  Warning: could not create Brain config dir: %v\n", err)
		return
	}

	config := map[string]any{
		"$schema": "https://brain.dev/schemas/config-v2.json",
		"version": "2.0.0",
		"defaults": map[string]any{
			"memories_location": "~/memories",
			"memories_mode":     "DEFAULT",
		},
		"projects": map[string]any{},
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return
	}
	data = append(data, '\n')
	if err := os.WriteFile(configPath, data, 0600); err != nil {
		fmt.Printf("  Warning: could not write Brain config: %v\n", err)
		return
	}
	fmt.Println("  [COMPLETE] Brain config initialized")
}

// ensureDependencies checks for missing deps and offers to install them.
func ensureDependencies() error {
	missing := checkDependencies()
	if len(missing) == 0 {
		fmt.Println("All dependencies found.")
		fmt.Println()
		return nil
	}

	fmt.Println("The following dependencies will be installed:")
	fmt.Println()
	for _, dep := range missing {
		fmt.Printf("  %s — %s\n", dep.Name, dep.InstallMsg)
	}
	fmt.Println()

	proceed := true
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Continue with installation?").
				Affirmative("Yes").
				Negative("No").
				Value(&proceed),
		),
	)

	if err := form.Run(); err != nil {
		return err
	}

	if !proceed {
		return fmt.Errorf("installation cancelled")
	}

	installedBasicMemory := false
	var newlyInstalled []string
	for _, dep := range missing {
		if err := installDependency(dep); err != nil {
			fmt.Printf("  [FAIL] %s: %v\n", dep.Name, err)
			fmt.Printf("  Install manually: %s\n", dep.InstallCmd)
		} else {
			fmt.Printf("  [COMPLETE] %s installed\n", dep.Name)
			newlyInstalled = append(newlyInstalled, dep.Name)
			if dep.Name == "basic-memory" {
				installedBasicMemory = true
			}
		}
	}

	// Track which deps Brain installed (append to existing list)
	if len(newlyInstalled) > 0 {
		existing := readInstalledDeps()
		for _, dep := range newlyInstalled {
			found := false
			for _, e := range existing {
				if e == dep {
					found = true
					break
				}
			}
			if !found {
				existing = append(existing, dep)
			}
		}
		writeInstalledDeps(existing)
	}

	// Configure basic-memory (fresh install writes full config,
	// existing install checks for conflicts without touching projects/memories)
	if installedBasicMemory {
		configureBasicMemory(true)
	} else if _, err := exec.LookPath("basic-memory"); err == nil {
		// basic-memory was already installed, check config compatibility
		configureBasicMemory(false)
	}

	// Seed Brain config if it doesn't exist
	ensureBrainConfig()

	fmt.Println()
	return nil
}

// ─── Install Command ─────────────────────────────────────────────────────────

func runInstall(_ *cobra.Command, _ []string) error {
	// Check and install dependencies first
	if err := ensureDependencies(); err != nil {
		return err
	}

	tools := detectTools()

	// Build options for multiselect
	var options []huh.Option[string]
	for _, t := range tools {
		status := ""
		if !t.Installed {
			status = " (not detected)"
		}
		options = append(options, huh.NewOption(t.Name+status, strings.ToLower(strings.ReplaceAll(t.Name, " ", "-"))))
	}

	var selected []string
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("Select tools to install Brain for").
				Options(options...).
				Value(&selected),
		),
	)

	if err := form.Run(); err != nil {
		return err
	}

	if len(selected) == 0 {
		fmt.Println("No tools selected.")
		return nil
	}

	// Check for existing installations and prompt for update
	var confirmed []string
	for _, tool := range selected {
		if isBrainInstalled(tool) {
			var update bool
			updateForm := huh.NewForm(
				huh.NewGroup(
					huh.NewConfirm().
						Title(fmt.Sprintf("Brain is already installed for %s. Update?", toolDisplayName(tool))).
						Affirmative("Yes").
						Negative("No").
						Value(&update),
				),
			)
			if err := updateForm.Run(); err != nil {
				return err
			}
			if update {
				confirmed = append(confirmed, tool)
			} else {
				fmt.Printf("Skipping %s.\n", toolDisplayName(tool))
			}
		} else {
			confirmed = append(confirmed, tool)
		}
	}

	if len(confirmed) == 0 {
		fmt.Println("Nothing to install.")
		return nil
	}

	// Confirmation for new installations
	var hasNew bool
	for _, tool := range confirmed {
		if !isBrainInstalled(tool) {
			hasNew = true
			break
		}
	}

	if hasNew {
		confirm := true
		confirmForm := huh.NewForm(
			huh.NewGroup(
				huh.NewConfirm().
					Title(fmt.Sprintf("Install Brain for: %s?", strings.Join(confirmed, ", "))).
					Affirmative("Yes").
					Negative("No").
					Value(&confirm),
			),
		)

		if err := confirmForm.Run(); err != nil {
			return err
		}
		if !confirm {
			fmt.Println("Cancelled.")
			return nil
		}
	}

	src := resolveTemplateSource()
	if src.IsEmbedded() {
		fmt.Println("Using embedded templates (no project root found)")
	} else {
		fmt.Printf("Project: %s\n\n", src.ProjectRoot())
	}

	// Install each confirmed tool
	for _, tool := range confirmed {
		fmt.Printf("Installing for %s...\n", tool)
		switch tool {
		case "claude-code":
			if err := installClaudeCode(src); err != nil {
				fmt.Printf("  [FAIL] %v\n", err)
			}
		case "cursor":
			if err := installCursor(src); err != nil {
				fmt.Printf("  [FAIL] %v\n", err)
			}
		default:
			fmt.Printf("  [FAIL] %s not yet supported\n", tool)
		}
		fmt.Println()
	}

	fmt.Println("Done. Restart your tools to load Brain.")
	return nil
}

// ─── Uninstall Command ───────────────────────────────────────────────────────

// uninstallDependencies removes only dependencies that were installed by brain install.
// Dependencies that existed before Brain was installed are left untouched.
func uninstallDependencies() {
	brainInstalled := readInstalledDeps()
	if len(brainInstalled) == 0 {
		fmt.Println("  No dependencies were installed by Brain")
		return
	}

	uninstallCmds := map[string]string{
		"basic-memory": "uv tool uninstall basic-memory",
		"uv":           "rm -rf ~/.local/bin/uv ~/.local/bin/uvx",
		"bun":          "rm -rf ~/.bun",
	}

	// Uninstall in reverse order (basic-memory before uv, since uv manages it)
	order := []string{"basic-memory", "uv", "bun"}
	for _, name := range order {
		found := false
		for _, installed := range brainInstalled {
			if installed == name {
				found = true
				break
			}
		}
		if !found {
			continue // Brain didn't install this, leave it alone
		}

		cmd, ok := uninstallCmds[name]
		if !ok {
			continue
		}

		fmt.Printf("  Removing %s (installed by Brain)...\n", name)
		c := exec.Command("sh", "-c", cmd)
		c.Stdout = os.Stdout
		c.Stderr = os.Stderr
		if err := c.Run(); err != nil {
			fmt.Printf("  Warning: failed to remove %s: %v\n", name, err)
		} else {
			fmt.Printf("  [COMPLETE] %s removed\n", name)
		}
	}

	// Clean up the deps manifest
	os.Remove(depsManifestPath())
}

// uninstallBrainConfig removes Brain's own config files.
func uninstallBrainConfig() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	// Remove Brain config
	brainConfigDir := filepath.Join(home, ".config", "brain")
	if err := os.RemoveAll(brainConfigDir); err == nil {
		fmt.Println("  Removed ~/.config/brain/")
	}

	// Remove Brain cache
	brainCacheDir := filepath.Join(home, ".cache", "brain")
	if err := os.RemoveAll(brainCacheDir); err == nil {
		fmt.Println("  Removed ~/.cache/brain/")
	}
}

func runUninstall(_ *cobra.Command, _ []string) error {
	// Detect what is installed via manifests
	var installed []string
	for _, tool := range []string{"claude-code", "cursor"} {
		if _, err := readManifest(tool); err == nil {
			installed = append(installed, tool)
		}
	}

	if len(installed) == 0 {
		fmt.Println("Brain is not installed for any tools.")
		return nil
	}

	// First choice: selective or full uninstall
	var mode string
	modeForm := huh.NewForm(
		huh.NewGroup(
			huh.NewSelect[string]().
				Title("How would you like to uninstall Brain?").
				Options(
					huh.NewOption("Remove from specific tools", "selective"),
					huh.NewOption("Full uninstall (all tools + dependencies)", "full"),
				).
				Value(&mode),
		),
	)

	if err := modeForm.Run(); err != nil {
		return err
	}

	if mode == "full" {
		return runFullUninstall(installed)
	}

	return runSelectiveUninstall(installed)
}

func runSelectiveUninstall(installed []string) error {
	var options []huh.Option[string]
	for _, t := range installed {
		options = append(options, huh.NewOption(toolDisplayName(t), t))
	}

	var selected []string
	form := huh.NewForm(
		huh.NewGroup(
			huh.NewMultiSelect[string]().
				Title("Select tools to uninstall Brain from").
				Options(options...).
				Value(&selected),
		),
	)

	if err := form.Run(); err != nil {
		return err
	}

	if len(selected) == 0 {
		fmt.Println("No tools selected.")
		return nil
	}

	var confirm bool
	confirmForm := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title(fmt.Sprintf("Uninstall Brain from: %s?", strings.Join(selected, ", "))).
				Affirmative("Yes").
				Negative("No").
				Value(&confirm),
		),
	)

	if err := confirmForm.Run(); err != nil {
		return err
	}
	if !confirm {
		fmt.Println("Cancelled.")
		return nil
	}

	for _, tool := range selected {
		fmt.Printf("Uninstalling from %s...\n", toolDisplayName(tool))
		uninstallTool(tool)
		fmt.Println()
	}

	fmt.Println("Done. Restart your tools to take effect.")
	return nil
}

func runFullUninstall(installed []string) error {
	brainDeps := readInstalledDeps()

	fmt.Println("\nThis will remove Brain from all tools.")
	fmt.Println()
	fmt.Println("Tools to remove from:")
	for _, t := range installed {
		fmt.Printf("  - %s\n", toolDisplayName(t))
	}
	if len(brainDeps) > 0 {
		fmt.Println()
		fmt.Println("Dependencies to remove (installed by Brain):")
		for _, dep := range brainDeps {
			fmt.Printf("  - %s\n", dep)
		}
	}
	fmt.Println()

	var confirm bool
	confirmForm := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title("Proceed with full uninstall?").
				Affirmative("Yes, remove everything").
				Negative("No").
				Value(&confirm),
		),
	)

	if err := confirmForm.Run(); err != nil {
		return err
	}
	if !confirm {
		fmt.Println("Cancelled.")
		return nil
	}

	// Uninstall from all tools
	for _, tool := range installed {
		fmt.Printf("Uninstalling from %s...\n", toolDisplayName(tool))
		uninstallTool(tool)
		fmt.Println()
	}

	// Remove dependencies
	fmt.Println("Removing dependencies...")
	uninstallDependencies()
	fmt.Println()

	// Remove Brain config and cache
	fmt.Println("Removing Brain config...")
	uninstallBrainConfig()
	fmt.Println()

	fmt.Println("Done. Brain has been fully uninstalled.")
	return nil
}

func uninstallTool(tool string) {
	switch tool {
	case "claude-code":
		if err := uninstallClaudeCode(); err != nil {
			fmt.Printf("  [FAIL] %v\n", err)
		}
	case "cursor":
		if err := uninstallCursor(); err != nil {
			fmt.Printf("  [FAIL] %v\n", err)
		}
	default:
		fmt.Printf("  [FAIL] %s not yet supported\n", tool)
	}
}
