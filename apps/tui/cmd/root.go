// Package cmd provides CLI commands using Cobra framework.
package cmd

import (
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/peterkloss/brain-tui/internal/tui"
	"github.com/spf13/cobra"
)

// Version is set at build time or defaults to development version.
var Version = "1.0.0"

var rootCmd = &cobra.Command{
	Use:   "brain",
	Short: "Brain - Knowledge Graph TUI",
	Long: `Brain - Knowledge Graph TUI

A terminal user interface for managing your knowledge graph.
Launch without arguments to start the interactive TUI.`,
	// Run is called when no subcommand is specified - launch TUI
	Run: func(cmd *cobra.Command, args []string) {
		project := ""
		if len(args) > 0 {
			project = args[0]
		}
		launchTUI(project)
	},
	Version: Version,
}

func init() {
	// Set custom version template
	rootCmd.SetVersionTemplate("Brain v{{.Version}}\n")
}

// Execute runs the root command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func launchTUI(project string) {
	// Initialize Brain MCP client (ensures server is running)
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Printf("Failed to connect to Brain MCP: %v\n", err)
		fmt.Println("Make sure Brain MCP server can be started.")
		os.Exit(1)
	}

	if err := tui.LaunchTUI(project, brainClient); err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}
