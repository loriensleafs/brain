// Package cmd provides CLI commands for Brain TUI including migration operations.
//
// The migrate commands provide tools for migrating configuration and .agents/ content
// to the new Brain memory system architecture (ADR-020).
//
// Usage:
//
//	brain migrate [--dry-run] [--cleanup]           # Migrate config from old format
//	brain migrate-agents [--project <name>] [--dry-run]   # Migrate .agents/ content
//	brain migrate-agents --verify-only             # Verify indexing only
//	brain rollback [--target lastKnownGood|previous]      # Rollback configuration
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var (
	migrateDryRun        bool
	migrateCleanup       bool
	migrateAgentsProject string
	migrateVerifyOnly    bool
	rollbackTarget       string
)

// ============================================================================
// Migrate Config Command
// ============================================================================

var migrateCmd = &cobra.Command{
	Use:   "migrate",
	Short: "Migrate configuration to new format",
	Long: `Migrate Brain configuration from old format to new format.

This command migrates configuration from the old location
(~/.basic-memory/brain-config.json) to the new XDG-compliant location
(~/.config/brain/config.json) with the updated schema.

Flags:
  --dry-run    Show what would be migrated without making changes
  --cleanup    Remove deprecated files after successful migration

Migration includes:
  - Converting old config format to new schema (v2.0.0)
  - Creating ~/.config/brain/ directory with proper permissions (0700)
  - Writing config with proper permissions (0600)
  - Syncing to basic-memory config via translation layer

Deprecated files removed with --cleanup:
  - ~/.basic-memory/brain-config.json
  - ~/.brain/projects.json
  - ~/.brain/ directory (if empty)

Examples:
  brain migrate --dry-run      Preview migration
  brain migrate                Execute migration
  brain migrate --cleanup      Execute migration and remove old files`,
	RunE: runMigrate,
}

// ============================================================================
// Migrate Agents Command
// ============================================================================

var migrateAgentsCmd = &cobra.Command{
	Use:   "migrate-agents",
	Short: "Migrate .agents/ content to Brain memory",
	Long: `Migrate .agents/ directory content to Brain's searchable memory system.

This command migrates all files from the .agents/ directory into Brain's
memory system, making them searchable and organized by category.

Flags:
  --project <name>   Project to migrate (default: current project)
  --dry-run          Show what would be migrated without making changes
  --verify-only      Verify existing migrations are properly indexed

Category mapping:
  .agents/sessions/     -> sessions
  .agents/analysis/     -> analysis
  .agents/architecture/ -> architecture
  .agents/planning/     -> planning
  .agents/critique/     -> critique
  .agents/qa/           -> qa
  .agents/specs/        -> specs
  .agents/roadmap/      -> roadmap
  .agents/retrospective/ -> retrospective
  .agents/skills/       -> skills
  .agents/governance/   -> governance

Migration process:
  1. Acquire lock (project or global)
  2. Create manifest tracking all source files
  3. Scan .agents/ directory
  4. Categorize each file
  5. Transform filename to memory title
  6. Write to Brain memory via write_note
  7. Verify indexing via search
  8. Remove source files (only after verification)
  9. Clean up .agents/ directory if empty
  10. Release lock

Safety features:
  - Transactional with rollback on failure
  - CopyManifest tracks partial progress
  - Indexing verification before source removal
  - Lock prevents concurrent migrations

Examples:
  brain migrate-agents --dry-run              Preview migration
  brain migrate-agents                        Execute migration
  brain migrate-agents --project myproject    Migrate specific project
  brain migrate-agents --verify-only          Check indexing status`,
	RunE: runMigrateAgents,
}

// ============================================================================
// Rollback Command
// ============================================================================

var rollbackCmd = &cobra.Command{
	Use:   "rollback",
	Short: "Rollback configuration to previous state",
	Long: `Rollback Brain configuration to a previous known-good state.

This command restores configuration from a snapshot created before
a migration or manual edit that caused issues.

Flags:
  --target <target>   Rollback target: lastKnownGood or previous
                      - lastKnownGood: Baseline config from server startup
                      - previous: Most recent snapshot before current

The rollback process:
  1. Load snapshot from rollback history
  2. Validate snapshot config via schema
  3. Write restored config atomically
  4. Sync to basic-memory config
  5. Trigger reconfiguration for affected projects

Rollback history stores up to 10 snapshots (FIFO).

Examples:
  brain rollback --target lastKnownGood    Restore baseline config
  brain rollback --target previous         Restore previous snapshot
  brain rollback                           Same as --target lastKnownGood`,
	RunE: runRollback,
}

func init() {
	rootCmd.AddCommand(migrateCmd)
	rootCmd.AddCommand(migrateAgentsCmd)
	rootCmd.AddCommand(rollbackCmd)

	// Flags for migrate command
	migrateCmd.Flags().BoolVar(&migrateDryRun, "dry-run", false, "Preview migration without making changes")
	migrateCmd.Flags().BoolVar(&migrateCleanup, "cleanup", false, "Remove deprecated files after migration")

	// Flags for migrate-agents command
	migrateAgentsCmd.Flags().StringVar(&migrateAgentsProject, "project", "", "Project to migrate (default: current project)")
	migrateAgentsCmd.Flags().BoolVar(&migrateDryRun, "dry-run", false, "Preview migration without making changes")
	migrateAgentsCmd.Flags().BoolVar(&migrateVerifyOnly, "verify-only", false, "Verify indexing without migrating")

	// Flags for rollback command
	rollbackCmd.Flags().StringVar(&rollbackTarget, "target", "lastKnownGood", "Rollback target: lastKnownGood or previous")
}

// runMigrate handles 'brain migrate'
func runMigrate(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	toolArgs := map[string]any{
		"dry_run": migrateDryRun,
		"cleanup": migrateCleanup,
	}

	result, err := brainClient.CallTool("migrate_config", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	if isConfigMigrationError(text) {
		return handleConfigMigrationError(text)
	}

	// Parse and display results
	return displayConfigMigrationResult(text, migrateDryRun)
}

// runMigrateAgents handles 'brain migrate-agents'
func runMigrateAgents(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Determine which tool to call based on flags
	if migrateVerifyOnly {
		return runVerifyAgentsIndexing(brainClient)
	}

	toolArgs := map[string]any{
		"dry_run": migrateDryRun,
	}

	if migrateAgentsProject != "" {
		toolArgs["project"] = migrateAgentsProject
	}

	result, err := brainClient.CallTool("migrate_agents_content", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	if isAgentsMigrationError(text) {
		return handleAgentsMigrationError(text)
	}

	// Parse and display results
	return displayAgentsMigrationResult(text, migrateDryRun)
}

// runVerifyAgentsIndexing handles 'brain migrate-agents --verify-only'
func runVerifyAgentsIndexing(brainClient *client.BrainClient) error {
	toolArgs := map[string]any{}

	if migrateAgentsProject != "" {
		toolArgs["project"] = migrateAgentsProject
	}

	result, err := brainClient.CallTool("verify_agents_indexing", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Parse and display verification results
	var response struct {
		Project      string `json:"project"`
		TotalFiles   int    `json:"total_files"`
		Indexed      int    `json:"indexed"`
		Missing      int    `json:"missing"`
		MissingFiles []struct {
			Path  string `json:"path"`
			Title string `json:"title"`
		} `json:"missing_files,omitempty"`
	}

	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	fmt.Println("Indexing Verification")
	fmt.Println("=====================")
	if response.Project != "" {
		fmt.Printf("Project:     %s\n", response.Project)
	}
	fmt.Printf("Total Files: %d\n", response.TotalFiles)
	fmt.Printf("Indexed:     %d\n", response.Indexed)
	fmt.Printf("Missing:     %d\n", response.Missing)
	fmt.Println()

	if response.Missing > 0 {
		fmt.Println("[WARNING] Missing from index:")
		for _, f := range response.MissingFiles {
			fmt.Printf("  - %s (title: %s)\n", f.Path, f.Title)
		}
		fmt.Println()
		fmt.Println("Run 'brain migrate-agents' to migrate missing files.")
		return nil
	}

	fmt.Println("[PASS] All files indexed successfully")
	return nil
}

// runRollback handles 'brain rollback'
func runRollback(cmd *cobra.Command, args []string) error {
	// Validate target
	validTargets := map[string]bool{"lastKnownGood": true, "previous": true}
	if !validTargets[rollbackTarget] {
		fmt.Fprintf(os.Stderr, "Error: invalid rollback target '%s'\n", rollbackTarget)
		fmt.Fprintf(os.Stderr, "Valid targets: lastKnownGood, previous\n")
		return fmt.Errorf("invalid rollback target")
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	result, err := brainClient.CallTool("config_rollback", map[string]any{
		"target": rollbackTarget,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	var errorResp struct {
		Error   string `json:"error"`
		Details string `json:"details,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &errorResp); err == nil && errorResp.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", errorResp.Error)
		if errorResp.Details != "" {
			fmt.Fprintf(os.Stderr, "Details: %s\n", errorResp.Details)
		}
		return fmt.Errorf(errorResp.Error)
	}

	// Parse success response
	var response struct {
		Success           bool   `json:"success"`
		Target            string `json:"target"`
		RestoredFrom      string `json:"restored_from"`
		SyncedToBasic     bool   `json:"synced_to_basic_memory"`
		ReconfigTriggered bool   `json:"reconfiguration_triggered"`
	}
	if err := json.Unmarshal([]byte(text), &response); err == nil && response.Success {
		fmt.Printf("[PASS] Rollback to %s complete\n", response.Target)
		if response.RestoredFrom != "" {
			fmt.Printf("       Restored from: %s\n", response.RestoredFrom)
		}
		if response.SyncedToBasic {
			fmt.Println("       Synced to basic-memory config")
		}
		if response.ReconfigTriggered {
			fmt.Println("       Reconfiguration triggered")
		}
		return nil
	}

	// Fallback: output raw text
	fmt.Println(text)
	return nil
}

// ============================================================================
// Helper Functions
// ============================================================================

// isConfigMigrationError checks if the response contains a config migration error
func isConfigMigrationError(text string) bool {
	var resp struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(text), &resp); err == nil {
		return resp.Error != ""
	}
	return false
}

// handleConfigMigrationError displays config migration error details
func handleConfigMigrationError(text string) error {
	var resp struct {
		Error       string `json:"error"`
		Details     string `json:"details,omitempty"`
		OldLocation string `json:"old_location,omitempty"`
		NewLocation string `json:"new_location,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &resp); err == nil && resp.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Error)
		if resp.Details != "" {
			fmt.Fprintf(os.Stderr, "Details: %s\n", resp.Details)
		}
		if resp.OldLocation != "" {
			fmt.Fprintf(os.Stderr, "Old location: %s\n", resp.OldLocation)
		}
		if resp.NewLocation != "" {
			fmt.Fprintf(os.Stderr, "New location: %s\n", resp.NewLocation)
		}
		return fmt.Errorf(resp.Error)
	}
	return fmt.Errorf("unknown error")
}

// displayConfigMigrationResult formats and displays config migration results
func displayConfigMigrationResult(text string, dryRun bool) error {
	var response struct {
		Success        bool     `json:"success"`
		DryRun         bool     `json:"dry_run"`
		OldConfigFound bool     `json:"old_config_found"`
		NewConfigPath  string   `json:"new_config_path"`
		Migrated       bool     `json:"migrated"`
		CleanedUp      []string `json:"cleaned_up,omitempty"`
		Skipped        string   `json:"skipped,omitempty"`
	}

	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	if dryRun {
		fmt.Println("Config Migration (Dry Run)")
		fmt.Println("==========================")
	} else {
		fmt.Println("Config Migration")
		fmt.Println("================")
	}

	if !response.OldConfigFound {
		fmt.Println("[PASS] No old config found - migration not needed")
		return nil
	}

	if response.Skipped != "" {
		fmt.Printf("[PASS] Skipped: %s\n", response.Skipped)
		return nil
	}

	if dryRun {
		fmt.Println("Would migrate:")
		fmt.Printf("  New config path: %s\n", response.NewConfigPath)
		if len(response.CleanedUp) > 0 {
			fmt.Println("Would clean up:")
			for _, f := range response.CleanedUp {
				fmt.Printf("  - %s\n", f)
			}
		}
		return nil
	}

	if response.Migrated {
		fmt.Printf("[PASS] Config migrated to: %s\n", response.NewConfigPath)
	}

	if len(response.CleanedUp) > 0 {
		fmt.Println("       Cleaned up deprecated files:")
		for _, f := range response.CleanedUp {
			fmt.Printf("       - %s\n", f)
		}
	}

	return nil
}

// isAgentsMigrationError checks if the response contains an agents migration error
func isAgentsMigrationError(text string) bool {
	var resp struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(text), &resp); err == nil {
		return resp.Error != ""
	}
	return false
}

// handleAgentsMigrationError displays agents migration error details
func handleAgentsMigrationError(text string) error {
	var resp struct {
		Error          string   `json:"error"`
		Details        string   `json:"details,omitempty"`
		FailedFiles    []string `json:"failed_files,omitempty"`
		RollbackStatus string   `json:"rollback_status,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &resp); err == nil && resp.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Error)
		if resp.Details != "" {
			fmt.Fprintf(os.Stderr, "Details: %s\n", resp.Details)
		}
		if len(resp.FailedFiles) > 0 {
			fmt.Fprintf(os.Stderr, "Failed files:\n")
			for _, f := range resp.FailedFiles {
				fmt.Fprintf(os.Stderr, "  - %s\n", f)
			}
		}
		if resp.RollbackStatus != "" {
			fmt.Fprintf(os.Stderr, "Rollback status: %s\n", resp.RollbackStatus)
		}
		return fmt.Errorf(resp.Error)
	}
	return fmt.Errorf("unknown error")
}

// displayAgentsMigrationResult formats and displays agents migration results
func displayAgentsMigrationResult(text string, dryRun bool) error {
	var response struct {
		Success    bool           `json:"success"`
		DryRun     bool           `json:"dry_run"`
		Project    string         `json:"project"`
		TotalFiles int            `json:"total_files"`
		Migrated   int            `json:"migrated"`
		Skipped    int            `json:"skipped"`
		Categories map[string]int `json:"categories,omitempty"`
		Files      []struct {
			Source   string `json:"source"`
			Title    string `json:"title"`
			Category string `json:"category"`
			Status   string `json:"status"`
		} `json:"files,omitempty"`
		AgentsDirRemoved bool `json:"agents_dir_removed"`
	}

	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	if dryRun {
		fmt.Println(".agents/ Migration (Dry Run)")
		fmt.Println("============================")
	} else {
		fmt.Println(".agents/ Migration")
		fmt.Println("==================")
	}

	if response.Project != "" {
		fmt.Printf("Project: %s\n", response.Project)
	}

	fmt.Printf("Total Files: %d\n", response.TotalFiles)

	if response.TotalFiles == 0 {
		fmt.Println("[PASS] No .agents/ content found - migration not needed")
		return nil
	}

	if dryRun {
		fmt.Println("\nWould migrate:")
		if len(response.Categories) > 0 {
			for category, count := range response.Categories {
				fmt.Printf("  %s: %d files\n", category, count)
			}
		}
		if len(response.Files) > 0 {
			fmt.Println("\nFiles:")
			for _, f := range response.Files {
				fmt.Printf("  %s -> %s (%s)\n", f.Source, f.Title, f.Category)
			}
		}
		return nil
	}

	// Display migration results
	fmt.Printf("Migrated: %d\n", response.Migrated)
	if response.Skipped > 0 {
		fmt.Printf("Skipped:  %d\n", response.Skipped)
	}

	if len(response.Categories) > 0 {
		fmt.Println("\nBy Category:")
		for category, count := range response.Categories {
			fmt.Printf("  %s: %d files\n", category, count)
		}
	}

	// Show detailed file results if verbose
	if len(response.Files) > 0 && len(response.Files) <= 20 {
		fmt.Println("\nFiles:")
		for _, f := range response.Files {
			status := "[PASS]"
			if f.Status != "migrated" && f.Status != "success" {
				status = "[" + strings.ToUpper(f.Status) + "]"
			}
			fmt.Printf("  %s %s -> %s\n", status, f.Source, f.Title)
		}
	}

	if response.AgentsDirRemoved {
		fmt.Println("\n[PASS] .agents/ directory removed (empty)")
	}

	fmt.Println("\n[PASS] Migration complete")
	return nil
}
