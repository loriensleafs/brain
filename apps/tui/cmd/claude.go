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
	Long: `Wraps 'claude --plugin-dir <path>' so the Brain plugin is always available.

Uses Go adapters to generate a fresh plugin staging directory on each
launch from canonical content + brain.config.json.

Use --agent-teams to swap in the Agent Teams orchestrator variant.`,
	DisableFlagParsing: true, // pass all args through to claude
	RunE:               runClaude,
}

func init() {
	rootCmd.AddCommand(claudeCmd)
}

// extractFlag removes a flag from args if present and returns whether it was found.
func extractFlag(args []string, flag string) ([]string, bool) {
	found := false
	filtered := make([]string, 0, len(args))
	for _, arg := range args {
		if arg == flag {
			found = true
		} else {
			filtered = append(filtered, arg)
		}
	}
	return filtered, found
}

func runClaude(_ *cobra.Command, args []string) error {
	args, agentTeams := extractFlag(args, "--agent-teams")

	src := resolveTemplateSource()

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home dir: %w", err)
	}
	pluginDir := filepath.Join(home, ".cache", "brain", "claude-plugin")

	// Fresh adapter-based staging every launch
	if err := os.RemoveAll(pluginDir); err != nil {
		return fmt.Errorf("clean staging: %w", err)
	}
	if err := runAdapterStageFromSource(src, "claude-code", pluginDir); err != nil {
		return fmt.Errorf("staging plugin via adapter: %w", err)
	}

	env := os.Environ()

	if agentTeams {
		// Swap to agent-teams orchestrator variant.
		standardOrch := filepath.Join(pluginDir, "agents", "\xf0\x9f\xa7\xa0-orchestrator-claude.md")

		// Try filesystem first for the teams variant
		if !src.IsEmbedded() {
			teamsOrch := filepath.Join(src.ProjectRoot(), "agents", "orchestrator-claude-teams.md")
			if _, err := os.Stat(teamsOrch); err == nil {
				os.Remove(standardOrch)
				if err := os.Symlink(teamsOrch, standardOrch); err != nil {
					return fmt.Errorf("swap orchestrator variant: %w", err)
				}
			}
		} else {
			// Read from embedded templates and write to staging
			data, err := src.ReadFile("agents/orchestrator-claude-teams.md")
			if err == nil {
				os.Remove(standardOrch)
				if writeErr := os.WriteFile(standardOrch, data, 0644); writeErr != nil {
					return fmt.Errorf("swap orchestrator variant: %w", writeErr)
				}
			}
		}

		env = append(env, "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1")
		fmt.Println("Agent Teams mode enabled")
	}

	claudeBin, err := exec.LookPath("claude")
	if err != nil {
		return fmt.Errorf("claude not found in PATH: %w", err)
	}
	claudeBin, err = filepath.EvalSymlinks(claudeBin)
	if err != nil {
		return fmt.Errorf("cannot resolve claude path: %w", err)
	}

	execArgs := []string{"claude", "--plugin-dir", pluginDir}
	execArgs = append(execArgs, args...)
	return syscall.Exec(claudeBin, execArgs, env)
}
