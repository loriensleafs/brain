package cmd

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var pluginSource string

var pluginCmd = &cobra.Command{
	Use:   "plugin",
	Short: "Manage the Brain Claude Code plugin",
	Long: `Install or uninstall the Brain plugin for Claude Code.

Examples:
  brain plugin install              # Install (auto-detects source)
  brain plugin install --source ~/Dev/brain/apps/claude-plugin
  brain plugin uninstall`,
}

var pluginInstallCmd = &cobra.Command{
	Use:   "install",
	Short: "Install the Brain plugin to Claude Code",
	Long: `Installs the Brain Claude Code plugin by copying content
into the cache path Claude Code expects.

Claude Code mangles the emoji name (🧠) into cache/brain/--/unknown/
when installing from the Discover tab. This command populates that
path with real file copies so Claude Code loads the plugin.

Re-run after making changes to the plugin source.`,
	RunE: runPluginInstall,
}

var pluginUninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Uninstall the Brain plugin from Claude Code",
	RunE:  runPluginUninstall,
}

func init() {
	rootCmd.AddCommand(pluginCmd)
	pluginCmd.AddCommand(pluginInstallCmd)
	pluginCmd.AddCommand(pluginUninstallCmd)
	pluginInstallCmd.Flags().StringVar(&pluginSource, "source", "", "Path to plugin source (auto-detected if not specified)")
}

func findPluginSource() (string, error) {
	if pluginSource != "" {
		abs, err := filepath.Abs(pluginSource)
		if err != nil {
			return "", err
		}
		if _, err := os.Stat(filepath.Join(abs, ".claude-plugin", "plugin.json")); err != nil {
			return "", fmt.Errorf("no .claude-plugin/plugin.json found at %s", abs)
		}
		return abs, nil
	}

	// Walk up from cwd
	dir, err := os.Getwd()
	if err == nil {
		for {
			candidate := filepath.Join(dir, "apps", "claude-plugin")
			if _, err := os.Stat(filepath.Join(candidate, ".claude-plugin", "plugin.json")); err == nil {
				return candidate, nil
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	// Fallback: ~/Dev/brain/apps/claude-plugin
	home, _ := os.UserHomeDir()
	fallback := filepath.Join(home, "Dev", "brain", "apps", "claude-plugin")
	if _, err := os.Stat(filepath.Join(fallback, ".claude-plugin", "plugin.json")); err == nil {
		return fallback, nil
	}

	return "", fmt.Errorf("could not find plugin source; use --source")
}

func claudeDir() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".claude")
}

// pluginDirs lists directories Claude Code reads from a plugin.
var pluginDirs = []string{".claude-plugin", "commands", "skills", "agents", "hooks", "instructions"}

// symlinkPluginContent creates a directory tree at target with symlinks back to source files.
// Files containing "-agent-teams" in their name are skipped — they are variant files
// swapped in by "brain claude --agent-teams".
func symlinkPluginContent(source, target string) error {
	os.RemoveAll(target)
	if err := os.MkdirAll(target, 0755); err != nil {
		return err
	}

	for _, name := range pluginDirs {
		src := filepath.Join(source, name)
		if _, err := os.Stat(src); os.IsNotExist(err) {
			continue
		}
		if err := symlinkDir(src, filepath.Join(target, name)); err != nil {
			return fmt.Errorf("symlink %s: %w", name, err)
		}
	}

	mcpSrc := filepath.Join(source, ".mcp.json")
	if _, err := os.Stat(mcpSrc); err == nil {
		if err := os.Symlink(mcpSrc, filepath.Join(target, ".mcp.json")); err != nil {
			return fmt.Errorf("symlink .mcp.json: %w", err)
		}
	}

	return nil
}

// symlinkDir mirrors the directory structure from src into dst,
// creating symlinks for files. Skips *-agent-teams* variant files.
func symlinkDir(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() && (d.Name() == "node_modules" || d.Name() == ".git") {
			return fs.SkipDir
		}
		rel, _ := filepath.Rel(src, path)
		target := filepath.Join(dst, rel)

		info, err := os.Stat(path)
		if err != nil {
			return nil
		}
		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}
		// Skip agent-teams variant files
		if strings.Contains(d.Name(), "-agent-teams") {
			return nil
		}
		return os.Symlink(path, target)
	})
}

func runPluginInstall(_ *cobra.Command, _ []string) error {
	source, err := findPluginSource()
	if err != nil {
		return err
	}
	fmt.Printf("Source: %s\n", source)

	pluginsDir := filepath.Join(claudeDir(), "plugins")
	marketplaceDir := filepath.Join(pluginsDir, "marketplaces", "brain")
	// The mangled path Claude Code creates for the emoji name.
	cacheDir := filepath.Join(pluginsDir, "cache", "brain", "--", "unknown")

	// Symlink into marketplace dir (for Discover tab)
	if err := symlinkPluginContent(source, marketplaceDir); err != nil {
		return fmt.Errorf("marketplace: %w", err)
	}
	fmt.Println("  Symlinked: marketplaces/brain/")

	// Symlink into cache dir (for actual loading)
	if err := symlinkPluginContent(source, cacheDir); err != nil {
		return fmt.Errorf("cache: %w", err)
	}
	fmt.Println("  Symlinked: cache/brain/--/unknown/")

	// Register marketplace
	if err := registerMarketplace(pluginsDir, marketplaceDir); err != nil {
		return fmt.Errorf("marketplace registration: %w", err)
	}
	fmt.Println("  Registered marketplace: brain")

	fmt.Println("\n✅ Brain plugin installed. Restart Claude Code to load it.")
	return nil
}

func registerMarketplace(pluginsDir, marketplaceDir string) error {
	path := filepath.Join(pluginsDir, "known_marketplaces.json")
	data := map[string]any{}
	if raw, err := os.ReadFile(path); err == nil {
		json.Unmarshal(raw, &data)
	}

	data["brain"] = map[string]any{
		"source": map[string]any{
			"source": "directory",
			"path":   marketplaceDir,
		},
		"installLocation": marketplaceDir,
		"lastUpdated":     time.Now().UTC().Format(time.RFC3339Nano),
	}

	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, out, 0644)
}

func runPluginUninstall(_ *cobra.Command, _ []string) error {
	pluginsDir := filepath.Join(claudeDir(), "plugins")

	os.RemoveAll(filepath.Join(pluginsDir, "marketplaces", "brain"))
	fmt.Println("  Removed: marketplaces/brain/")

	os.RemoveAll(filepath.Join(pluginsDir, "cache", "brain"))
	fmt.Println("  Removed: cache/brain/")

	// Remove from known_marketplaces.json
	kmPath := filepath.Join(pluginsDir, "known_marketplaces.json")
	if raw, err := os.ReadFile(kmPath); err == nil {
		data := map[string]any{}
		json.Unmarshal(raw, &data)
		delete(data, "brain")
		out, _ := json.MarshalIndent(data, "", "  ")
		os.WriteFile(kmPath, out, 0644)
	}
	fmt.Println("  Removed from known_marketplaces.json")

	fmt.Println("\n✅ Brain plugin uninstalled. Restart Claude Code to take effect.")
	return nil
}
