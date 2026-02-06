package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"

	"github.com/spf13/cobra"
)

var claudeCmd = &cobra.Command{
	Use:                "claude",
	Short:              "Launch Claude Code with the Brain plugin loaded",
	Long:               `Wraps 'claude --plugin-dir <path>' so the 🧠 plugin is always available.`,
	DisableFlagParsing: true, // pass all args through to claude
	RunE:               runClaude,
}

func init() {
	rootCmd.AddCommand(claudeCmd)
}

func runClaude(_ *cobra.Command, args []string) error {
	pluginDir, err := findPluginSource()
	if err != nil {
		return fmt.Errorf("cannot find plugin source: %w", err)
	}

	claudeBin, err := exec.LookPath("claude")
	if err != nil {
		return fmt.Errorf("claude not found in PATH: %w", err)
	}

	// Resolve symlinks to get the real binary
	claudeBin, err = filepath.EvalSymlinks(claudeBin)
	if err != nil {
		return fmt.Errorf("cannot resolve claude path: %w", err)
	}

	// Build args: claude --plugin-dir <path> [user args...]
	execArgs := []string{"claude", "--plugin-dir", pluginDir}
	execArgs = append(execArgs, args...)

	// Replace this process with claude (exec, not fork)
	return syscall.Exec(claudeBin, execArgs, os.Environ())
}
