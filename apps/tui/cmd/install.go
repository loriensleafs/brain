package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/spf13/cobra"
)

var installCmd = &cobra.Command{
	Use:   "install",
	Short: "Install Brain for AI coding tools",
	Long: `Installs Brain agents, skills, commands, and hooks for selected tools.

Currently supported: Claude Code.
Cursor support is planned for Phase 2.

For Claude Code, Brain installs as a plugin using symlinks.
Instructions are delivered via composable rules (never modifies CLAUDE.md).`,
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
	Tool  string   `json:"tool"`
	Files []string `json:"files"`
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

// ─── Adapter Invocation ──────────────────────────────────────────────────────

func runAdapterWrite(projectRoot, target, outputDir string) error {
	syncScript := filepath.Join(projectRoot, "adapters", "sync.ts")
	cmd := exec.Command("bun", syncScript, "--target", target, "--output", outputDir, "--project", projectRoot)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// ─── Claude Code Install ─────────────────────────────────────────────────────

func installClaudeCode(projectRoot string) error {
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
	if err := runAdapterWrite(projectRoot, "claude-code", stagingDir); err != nil {
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

// ─── Install Command ─────────────────────────────────────────────────────────

func runInstall(_ *cobra.Command, _ []string) error {
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

	// Confirmation
	var confirm bool
	confirmForm := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title(fmt.Sprintf("Install Brain for: %s?", strings.Join(selected, ", "))).
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

	projectRoot, err := findProjectRoot()
	if err != nil {
		return err
	}
	fmt.Printf("Project: %s\n\n", projectRoot)

	// Install each selected tool
	for _, tool := range selected {
		fmt.Printf("Installing for %s...\n", tool)
		switch tool {
		case "claude-code":
			if err := installClaudeCode(projectRoot); err != nil {
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

func runUninstall(_ *cobra.Command, _ []string) error {
	// Detect what is installed via manifests
	var installed []string
	for _, tool := range []string{"claude-code"} {
		if _, err := readManifest(tool); err == nil {
			installed = append(installed, tool)
		}
	}

	if len(installed) == 0 {
		fmt.Println("Brain is not installed for any tools.")
		return nil
	}

	var options []huh.Option[string]
	for _, t := range installed {
		options = append(options, huh.NewOption(t, t))
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
		fmt.Printf("Uninstalling from %s...\n", tool)
		switch tool {
		case "claude-code":
			if err := uninstallClaudeCode(); err != nil {
				fmt.Printf("  [FAIL] %v\n", err)
			}
		default:
			fmt.Printf("  [FAIL] %s not yet supported\n", tool)
		}
		fmt.Println()
	}

	fmt.Println("Done. Restart your tools to take effect.")
	return nil
}
