// Package deps manages Brain's system dependencies (bun, uv, basic-memory)
// and their associated configuration files.
package deps

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// ─── Dependencies ────────────────────────────────────────────────────────────

// Dependency represents a required system dependency.
type Dependency struct {
	Name       string
	Binary     string
	CheckArgs  []string
	InstallCmd string
	InstallMsg string
}

// Required returns all dependencies Brain needs.
func Required() []Dependency {
	return []Dependency{
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
}

// Missing returns dependencies not found in PATH.
func Missing() []Dependency {
	var missing []Dependency
	for _, dep := range Required() {
		if _, err := exec.LookPath(dep.Binary); err != nil {
			missing = append(missing, dep)
		}
	}
	return missing
}

// Install runs the install command for a dependency and refreshes PATH.
func Install(dep Dependency) error {
	cmd := exec.Command("sh", "-c", dep.InstallCmd)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}
	RefreshPATH()
	return nil
}

// IsInstalled checks if a binary is available in PATH.
func IsInstalled(binary string) bool {
	_, err := exec.LookPath(binary)
	return err == nil
}

// RefreshPATH adds common install locations to PATH so newly installed
// binaries are immediately available without restarting the shell.
func RefreshPATH() {
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

// ─── Tracking ────────────────────────────────────────────────────────────────

func manifestPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cache", "brain", "installed-deps.json")
}

// TrackInstalled appends newly installed dep names to the tracking manifest.
func TrackInstalled(names []string) {
	existing := ReadInstalled()
	for _, name := range names {
		found := false
		for _, e := range existing {
			if e == name {
				found = true
				break
			}
		}
		if !found {
			existing = append(existing, name)
		}
	}
	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return
	}
	data = append(data, '\n')
	dir := filepath.Dir(manifestPath())
	os.MkdirAll(dir, 0755)
	os.WriteFile(manifestPath(), data, 0644)
}

// ReadInstalled returns deps previously installed by Brain.
func ReadInstalled() []string {
	data, err := os.ReadFile(manifestPath())
	if err != nil {
		return nil
	}
	var d []string
	json.Unmarshal(data, &d)
	return d
}

// Uninstall removes dependencies that were installed by Brain, in reverse order.
func Uninstall() {
	installed := ReadInstalled()
	if len(installed) == 0 {
		fmt.Println("  No dependencies were installed by Brain")
		return
	}

	cmds := map[string]string{
		"basic-memory": "uv tool uninstall basic-memory",
		"uv":           "rm -rf ~/.local/bin/uv ~/.local/bin/uvx",
		"bun":          "rm -rf ~/.bun",
	}

	// Uninstall in reverse order (basic-memory before uv, since uv manages it)
	order := []string{"basic-memory", "uv", "bun"}
	for _, name := range order {
		found := false
		for _, inst := range installed {
			if inst == name {
				found = true
				break
			}
		}
		if !found {
			continue
		}

		cmd, ok := cmds[name]
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

	os.Remove(manifestPath())
}

// ─── Basic Memory Config ─────────────────────────────────────────────────────

var requiredSettings = map[string]any{
	"env": "user", // basic-memory defaults to "dev"
}

// BasicMemoryConflicts checks if the existing basic-memory config conflicts
// with Brain's requirements. Returns conflict descriptions, or nil if compatible.
func BasicMemoryConflicts() []string {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}

	configPath := filepath.Join(home, ".basic-memory", "config.json")
	raw, err := os.ReadFile(configPath)
	if err != nil {
		return nil // no config = no conflicts
	}

	var existing map[string]any
	if err := json.Unmarshal(raw, &existing); err != nil {
		return nil
	}

	var conflicts []string
	for key, required := range requiredSettings {
		current, exists := existing[key]
		if !exists || fmt.Sprintf("%v", current) != fmt.Sprintf("%v", required) {
			conflicts = append(conflicts, fmt.Sprintf(
				"  %s: current=%v, required=%v", key, current, required,
			))
		}
	}
	return conflicts
}

// ConfigureBasicMemoryFresh writes the full recommended config for a fresh install.
func ConfigureBasicMemoryFresh() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	configDir := filepath.Join(home, ".basic-memory")
	configPath := filepath.Join(configDir, "config.json")

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
}

// ApplyBasicMemoryFixes updates only the required settings, preserving everything else.
func ApplyBasicMemoryFixes() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	configPath := filepath.Join(home, ".basic-memory", "config.json")
	raw, err := os.ReadFile(configPath)
	if err != nil {
		ConfigureBasicMemoryFresh()
		return
	}

	var existing map[string]any
	if err := json.Unmarshal(raw, &existing); err != nil {
		fmt.Printf("  Warning: could not parse basic-memory config: %v\n", err)
		return
	}

	for key, required := range requiredSettings {
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

// ─── Brain Config ────────────────────────────────────────────────────────────

// EnsureBrainConfig creates ~/.config/brain/config.json if it doesn't exist.
func EnsureBrainConfig() {
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

// UninstallConfig removes Brain's config and cache directories.
func UninstallConfig() {
	home, err := os.UserHomeDir()
	if err != nil {
		return
	}

	brainConfigDir := filepath.Join(home, ".config", "brain")
	if err := os.RemoveAll(brainConfigDir); err == nil {
		fmt.Println("  Removed ~/.config/brain/")
	}

	brainCacheDir := filepath.Join(home, ".cache", "brain")
	if err := os.RemoveAll(brainCacheDir); err == nil {
		fmt.Println("  Removed ~/.cache/brain/")
	}
}
