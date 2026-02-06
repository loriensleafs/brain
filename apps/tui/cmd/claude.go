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
	Long:               `Wraps 'claude --plugin-dir <path>' so the 🧠 plugin is always available.
Use --agent-teams to swap in the agent-teams variant files.`,
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

// variantSwaps defines which symlinks to repoint for agent-teams mode.
var variantSwaps = []struct{ dir, standard, agentTeams string }{
	{"commands", "bootstrap.md", "bootstrap-agent-teams.md"},
	{"agents", "orchestrator.md", "orchestrator-agent-teams.md"},
	{"instructions", "AGENTS.md", "AGENTS-agent-teams.md"},
}

func runClaude(_ *cobra.Command, args []string) error {
	args, agentTeams := extractFlag(args, "--agent-teams")

	source, err := findPluginSource()
	if err != nil {
		return fmt.Errorf("cannot find plugin source: %w", err)
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("cannot find home dir: %w", err)
	}
	pluginDir := filepath.Join(home, ".cache", "brain", "claude-plugin")

	// Fresh symlink install every launch
	if err := symlinkPluginContent(source, pluginDir); err != nil {
		return fmt.Errorf("staging plugin: %w", err)
	}

	env := os.Environ()

	if agentTeams {
		// Repoint 3 symlinks to the agent-teams variants
		for _, v := range variantSwaps {
			link := filepath.Join(pluginDir, v.dir, v.standard)
			target := filepath.Join(source, v.dir, v.agentTeams)
			if _, err := os.Stat(target); err != nil {
				continue
			}
			os.Remove(link)
			if err := os.Symlink(target, link); err != nil {
				return fmt.Errorf("swap %s/%s: %w", v.dir, v.standard, err)
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
