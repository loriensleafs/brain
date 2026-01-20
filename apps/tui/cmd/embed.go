package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/peterkloss/brain/packages/validation"
	"github.com/spf13/cobra"
)

var (
	embedForce   bool
	embedLimit   int
	embedProject string
)

// EmbedResult represents the result of batch embedding generation.
type EmbedResult struct {
	Success   bool     `json:"success"`
	Processed int      `json:"processed"`
	Failed    int      `json:"failed"`
	Skipped   int      `json:"skipped"`
	Total     int      `json:"total"`
	Errors    []string `json:"errors,omitempty"`
}

var embedCmd = &cobra.Command{
	Use:   "embed",
	Short: "Generate embeddings for notes",
	Long: `Generate embeddings for notes to enable semantic search.

Uses Ollama with nomic-embed-text model to generate 768-dimension embeddings.
By default, only generates embeddings for notes that don't have them yet.

Examples:
  brain embed                    # Generate missing embeddings (up to 100)
  brain embed --limit 0          # Generate all missing embeddings
  brain embed --force            # Regenerate all embeddings
  brain embed --limit 500        # Process up to 500 notes
  brain embed --project brain    # Generate for specific project

Project Resolution:
  If --project is not specified, the project is auto-resolved from:
  1. BM_PROJECT environment variable
  2. BM_ACTIVE_PROJECT environment variable (legacy)
  3. BRAIN_PROJECT environment variable
  4. Current working directory match against configured code_paths

Requirements:
  - Ollama must be running with nomic-embed-text model available
  - Brain MCP server must be running`,
	RunE: runEmbed,
}

func init() {
	rootCmd.AddCommand(embedCmd)
	embedCmd.Flags().BoolVarP(&embedForce, "force", "f", false, "Regenerate all embeddings (not just missing)")
	embedCmd.Flags().IntVarP(&embedLimit, "limit", "l", 100, "Max notes to process (0 for all)")
	embedCmd.Flags().StringVarP(&embedProject, "project", "p", "", "Project to embed (auto-resolved from CWD if not specified)")
}

func runEmbed(cmd *cobra.Command, args []string) error {
	// Resolve project using hierarchy: explicit flag > env vars > CWD match
	project := validation.ResolveProject(embedProject, "")
	if project == "" {
		fmt.Fprintf(os.Stderr, "Error: No project specified and none could be resolved from CWD.\n")
		fmt.Fprintf(os.Stderr, "Use --project flag or run from a configured project directory.\n")
		os.Exit(1)
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		return fmt.Errorf("failed to connect to Brain MCP: %w", err)
	}

	fmt.Printf("Generating embeddings for project: %s\n", project)
	if embedForce {
		fmt.Println("   Mode: regenerate all")
	} else {
		fmt.Println("   Mode: missing only")
	}
	if embedLimit > 0 {
		fmt.Printf("   Limit: %d notes\n", embedLimit)
	} else {
		fmt.Println("   Limit: unlimited")
	}
	fmt.Println()

	// Build tool arguments
	toolArgs := map[string]any{
		"force": embedForce,
		"limit": embedLimit,
	}
	// Only include project if explicitly set or auto-resolved
	if project != "" {
		toolArgs["project"] = project
	}

	// Call the generate_embeddings tool
	result, err := brainClient.CallTool("generate_embeddings", toolArgs)
	if err != nil {
		return fmt.Errorf("embedding generation failed: %w", err)
	}

	text := result.GetText()

	// Unwrap MCP content format if present
	var mcpContent []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
	if err := json.Unmarshal([]byte(text), &mcpContent); err == nil && len(mcpContent) > 0 {
		text = mcpContent[0].Text
	}

	// Parse result
	var embedResult EmbedResult
	if err := json.Unmarshal([]byte(text), &embedResult); err != nil {
		// If parsing fails, just print the raw text
		fmt.Println(text)
		return nil
	}

	// Display results
	fmt.Printf("✅ Embedding generation complete\n\n")
	fmt.Printf("   Processed: %d\n", embedResult.Processed)
	fmt.Printf("   Failed:    %d\n", embedResult.Failed)
	fmt.Printf("   Skipped:   %d (already had embeddings)\n", embedResult.Skipped)
	fmt.Printf("   Total:     %d notes in project\n", embedResult.Total)

	if len(embedResult.Errors) > 0 {
		fmt.Printf("\n⚠️  Errors:\n")
		for _, e := range embedResult.Errors {
			fmt.Printf("   - %s\n", e)
		}
	}

	if !embedResult.Success {
		os.Exit(1)
	}

	return nil
}
