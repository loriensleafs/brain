package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"github.com/spf13/cobra"
)

var cursorCmd = &cobra.Command{
	Use:   "cursor",
	Short: "Launch Cursor with Brain rules and MCP loaded",
	Long: `Stages Brain content for Cursor and launches the editor.

Uses Go adapters to generate fresh .mdc rules and JSON merge payloads,
then file-copies rules to .cursor/rules/ and additively merges
hooks.json and mcp.json.

All extra arguments are passed through to the cursor binary.`,
	DisableFlagParsing: true,
	RunE:               runCursor,
}

func init() {
	rootCmd.AddCommand(cursorCmd)
}

func runCursor(_ *cobra.Command, args []string) error {
	projectRoot, err := findProjectRoot()
	if err != nil {
		return fmt.Errorf("cannot find project root: %w", err)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home dir: %w", err)
	}

	// Fresh adapter staging
	stagingDir := filepath.Join(home, ".cache", "brain", "staging", "cursor")
	if err := os.RemoveAll(stagingDir); err != nil {
		return fmt.Errorf("clean staging: %w", err)
	}
	if err := runAdapterStage(projectRoot, "cursor", stagingDir); err != nil {
		return fmt.Errorf("staging via adapter: %w", err)
	}

	cursorDir := filepath.Join(home, ".cursor")

	// Copy .mdc rules to .cursor/rules/
	rulesDir := filepath.Join(stagingDir, "rules")
	if _, err := os.Stat(rulesDir); err == nil {
		targetRulesDir := filepath.Join(cursorDir, "rules")
		if err := os.MkdirAll(targetRulesDir, 0755); err != nil {
			return fmt.Errorf("create rules dir: %w", err)
		}
		if _, err := copyBrainFiles(rulesDir, targetRulesDir); err != nil {
			return fmt.Errorf("copy rules: %w", err)
		}
	}

	// JSON merge hooks
	hooksMergePath := filepath.Join(stagingDir, "hooks", "hooks.merge.json")
	if _, err := os.Stat(hooksMergePath); err == nil {
		hooksTarget := filepath.Join(cursorDir, "hooks.json")
		if _, err := jsonMerge(hooksMergePath, hooksTarget); err != nil {
			fmt.Printf("Warning: hooks merge failed: %v\n", err)
		}
	}

	// JSON merge MCP
	mcpMergePath := filepath.Join(stagingDir, "mcp", "mcp.merge.json")
	if _, err := os.Stat(mcpMergePath); err == nil {
		mcpTarget := filepath.Join(cursorDir, "mcp.json")
		if _, err := jsonMerge(mcpMergePath, mcpTarget); err != nil {
			fmt.Printf("Warning: MCP merge failed: %v\n", err)
		}
	}

	// Find and launch cursor
	cursorBin, err := exec.LookPath("cursor")
	if err != nil {
		return fmt.Errorf("cursor not found in PATH: %w", err)
	}
	cursorBin, err = filepath.EvalSymlinks(cursorBin)
	if err != nil {
		return fmt.Errorf("cannot resolve cursor path: %w", err)
	}

	execArgs := []string{"cursor"}
	execArgs = append(execArgs, args...)
	return syscall.Exec(cursorBin, execArgs, os.Environ())
}
