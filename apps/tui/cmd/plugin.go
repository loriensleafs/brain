package cmd

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// pluginDirs lists directories Claude Code reads from a plugin.
var pluginDirs = []string{".claude-plugin", "commands", "skills", "agents", "hooks", "rules"}

// symlinkPluginContent creates a directory tree at target with symlinks back to source files.
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
			return err
		}
	}

	mcpSrc := filepath.Join(source, ".mcp.json")
	if _, err := os.Stat(mcpSrc); err == nil {
		if err := os.Symlink(mcpSrc, filepath.Join(target, ".mcp.json")); err != nil {
			return err
		}
	}

	return nil
}

// symlinkDir mirrors the directory structure from src into dst,
// creating symlinks for files.
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
		// Skip gitkeep files
		if strings.HasSuffix(d.Name(), ".gitkeep") {
			return nil
		}
		return os.Symlink(path, target)
	})
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
