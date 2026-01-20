package cmd

import (
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var (
	bootstrapProject     string
	bootstrapTimeframe   string
	bootstrapFullContent bool
)

var bootstrapCmd = &cobra.Command{
	Use:   "bootstrap",
	Short: "Bootstrap semantic context for session initialization",
	Long: `Retrieves semantic context from Brain memory including:
- Active features with phases and tasks
- Recent decisions
- Open bugs
- Referenced notes

By default, returns compact references (wikilinks). Use --full-content to
expand full note content for richer context at higher token cost.

Used by SessionStart hook to initialize session context.`,
	RunE: runBootstrap,
}

func init() {
	rootCmd.AddCommand(bootstrapCmd)
	bootstrapCmd.Flags().StringVarP(&bootstrapProject, "project", "p", "", "Project name (auto-detected if not specified)")
	bootstrapCmd.Flags().StringVarP(&bootstrapTimeframe, "timeframe", "t", "5d", "Timeframe for recent activity")
	bootstrapCmd.Flags().BoolVar(&bootstrapFullContent, "full-content", false, "Include full note content (default: compact references only)")
}

func runBootstrap(cmd *cobra.Command, args []string) error {
	// Create client and ensure server is running
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Build args for bootstrap_context tool
	toolArgs := map[string]interface{}{
		"timeframe":          bootstrapTimeframe,
		"include_referenced": true,
	}
	if bootstrapProject != "" {
		toolArgs["project"] = bootstrapProject
	}
	if bootstrapFullContent {
		toolArgs["full_context"] = true
	}

	// Call the tool
	result, err := brainClient.CallTool("bootstrap_context", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Output result to stdout for hook consumption
	fmt.Println(result.GetText())
	return nil
}
