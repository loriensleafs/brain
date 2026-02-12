package cmd

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/huh"
	"github.com/peterkloss/brain-tui/internal/deps"
	"github.com/peterkloss/brain-tui/internal/installer"
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

// ─── Path Resolution ────────────────────────────────────────────────────────

// resolveTemplateSource returns a TemplateSource by walking up from cwd
// looking for brain.config.json, then falling back to ~/Dev/brain, then
// to the XDG data directory.
func resolveTemplateSource() *installer.TemplateSource {
	// Walk up from cwd looking for brain.config.json
	dir, err := os.Getwd()
	if err == nil {
		for {
			if _, err := os.Stat(filepath.Join(dir, "brain.config.json")); err == nil {
				return installer.NewFilesystemSource(dir)
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	// Fallback: ~/Dev/brain
	home, _ := os.UserHomeDir()
	fallback := filepath.Join(home, "Dev", "brain")
	if _, err := os.Stat(filepath.Join(fallback, "brain.config.json")); err == nil {
		return installer.NewFilesystemSource(fallback)
	}

	// Last resort: XDG data directory
	return installer.NewFilesystemSource(installer.DataDir())
}

// resolveToolConfigPath returns the path to tools.config.yaml,
// preferring the project root and falling back to the XDG data directory.
func resolveToolConfigPath(src *installer.TemplateSource) string {
	p := filepath.Join(src.ProjectRoot(), "tools.config.yaml")
	if _, err := os.Stat(p); err == nil {
		return p
	}
	return filepath.Join(installer.DataDir(), "tools.config.yaml")
}

// ─── Install Command ────────────────────────────────────────────────────────

func runInstall(_ *cobra.Command, _ []string) error {
	if err := promptDependencies(); err != nil {
		return err
	}

	src := resolveTemplateSource()
	if err := installer.RegisterFromConfig(resolveToolConfigPath(src)); err != nil {
		return fmt.Errorf("load tool configs: %w", err)
	}

	allTools := installer.All()
	if len(allTools) == 0 {
		fmt.Println("No tools configured in tools.config.yaml.")
		return nil
	}

	// Build TUI multiselect from registry
	var options []huh.Option[string]
	for _, t := range allTools {
		label := t.DisplayName()
		if !t.IsToolInstalled() {
			label += " (not detected)"
		}
		options = append(options, huh.NewOption(label, t.Name()))
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
	for _, name := range selected {
		t, ok := installer.Get(name)
		if !ok {
			continue
		}
		if t.IsBrainInstalled() {
			var update bool
			updateForm := huh.NewForm(
				huh.NewGroup(
					huh.NewConfirm().
						Title(fmt.Sprintf("Brain is already installed for %s. Update?", t.DisplayName())).
						Affirmative("Yes").
						Negative("No").
						Value(&update),
				),
			)
			if err := updateForm.Run(); err != nil {
				return err
			}
			if update {
				confirmed = append(confirmed, name)
			} else {
				fmt.Printf("Skipping %s.\n", t.DisplayName())
			}
		} else {
			confirmed = append(confirmed, name)
		}
	}

	if len(confirmed) == 0 {
		fmt.Println("Nothing to install.")
		return nil
	}

	// Confirmation for new installations
	if hasNewInstalls(confirmed) {
		confirm := true
		var labels []string
		for _, name := range confirmed {
			if t, ok := installer.Get(name); ok {
				labels = append(labels, t.DisplayName())
			}
		}
		confirmForm := huh.NewForm(
			huh.NewGroup(
				huh.NewConfirm().
					Title(fmt.Sprintf("Install Brain for: %s?", strings.Join(labels, ", "))).
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

	fmt.Printf("Project: %s\n\n", src.ProjectRoot())

	// Collect tools to install
	var toInstall []installer.Tool
	for _, name := range confirmed {
		if t, ok := installer.Get(name); ok {
			toInstall = append(toInstall, t)
		}
	}

	// Install via installer package
	results := installer.InstallAll(context.Background(), toInstall, src)
	for _, r := range results {
		if r.Err != nil {
			fmt.Printf("  [FAIL] %s: %v\n", r.Name, r.Err)
		} else {
			fmt.Printf("  [COMPLETE] %s installed\n", r.Name)
		}
	}

	fmt.Println()
	fmt.Println("Done. Restart your tools to load Brain.")
	return nil
}

// hasNewInstalls returns true if any confirmed tool doesn't already have Brain installed.
func hasNewInstalls(confirmed []string) bool {
	for _, name := range confirmed {
		if t, ok := installer.Get(name); ok {
			if !t.IsBrainInstalled() {
				return true
			}
		}
	}
	return false
}

// ─── Uninstall Command ──────────────────────────────────────────────────────

func runUninstall(_ *cobra.Command, _ []string) error {
	src := resolveTemplateSource()
	_ = installer.RegisterFromConfig(resolveToolConfigPath(src))

	// Find tools with manifests
	var installed []installer.Tool
	for _, t := range installer.All() {
		if _, err := installer.ReadManifest(t.Name()); err == nil {
			installed = append(installed, t)
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

func runSelectiveUninstall(installed []installer.Tool) error {
	var options []huh.Option[string]
	for _, t := range installed {
		options = append(options, huh.NewOption(t.DisplayName(), t.Name()))
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

	var labels []string
	for _, name := range selected {
		if t, ok := installer.Get(name); ok {
			labels = append(labels, t.DisplayName())
		}
	}

	var confirm bool
	confirmForm := huh.NewForm(
		huh.NewGroup(
			huh.NewConfirm().
				Title(fmt.Sprintf("Uninstall Brain from: %s?", strings.Join(labels, ", "))).
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

	ctx := context.Background()
	for _, name := range selected {
		t, ok := installer.Get(name)
		if !ok {
			continue
		}
		fmt.Printf("Uninstalling from %s...\n", t.DisplayName())
		if err := t.Uninstall(ctx); err != nil {
			fmt.Printf("  [FAIL] %v\n", err)
		} else {
			fmt.Printf("  [COMPLETE] %s uninstalled\n", t.DisplayName())
		}
		fmt.Println()
	}

	fmt.Println("Done. Restart your tools to take effect.")
	return nil
}

func runFullUninstall(installed []installer.Tool) error {
	brainDeps := deps.ReadInstalled()

	fmt.Println("\nThis will remove Brain from all tools.")
	fmt.Println()
	fmt.Println("Tools to remove from:")
	for _, t := range installed {
		fmt.Printf("  - %s\n", t.DisplayName())
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
	ctx := context.Background()
	for _, t := range installed {
		fmt.Printf("Uninstalling from %s...\n", t.DisplayName())
		if err := t.Uninstall(ctx); err != nil {
			fmt.Printf("  [FAIL] %v\n", err)
		} else {
			fmt.Printf("  [COMPLETE] %s uninstalled\n", t.DisplayName())
		}
		fmt.Println()
	}

	// Remove dependencies
	fmt.Println("Removing dependencies...")
	deps.Uninstall()
	fmt.Println()

	// Remove Brain config and cache
	fmt.Println("Removing Brain config...")
	deps.UninstallConfig()
	fmt.Println()

	fmt.Println("Done. Brain has been fully uninstalled.")
	return nil
}

// ─── Dependency Flow ────────────────────────────────────────────────────────

// promptDependencies checks for missing deps and offers to install them.
func promptDependencies() error {
	missing := deps.Missing()
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
		fmt.Printf("  Installing %s...\n", dep.Name)
		if err := deps.Install(dep); err != nil {
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

	if len(newlyInstalled) > 0 {
		deps.TrackInstalled(newlyInstalled)
	}

	// Configure basic-memory
	if installedBasicMemory {
		deps.ConfigureBasicMemoryFresh()
	} else if deps.IsInstalled("basic-memory") {
		promptBasicMemoryConfig()
	}

	// Seed Brain config if it doesn't exist
	deps.EnsureBrainConfig()

	fmt.Println()
	return nil
}

// promptBasicMemoryConfig checks for conflicts and offers to fix them.
func promptBasicMemoryConfig() {
	conflicts := deps.BasicMemoryConflicts()
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

	deps.ApplyBasicMemoryFixes()
}
