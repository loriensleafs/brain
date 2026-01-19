package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var (
	embedForce bool
	embedLimit int
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

Requirements:
  - Ollama must be running with nomic-embed-text model available
  - Brain MCP server must be running`,
	RunE: runEmbed,
}

func init() {
	rootCmd.AddCommand(embedCmd)
	embedCmd.Flags().BoolVarP(&embedForce, "force", "f", false, "Regenerate all embeddings (not just missing)")
	embedCmd.Flags().IntVarP(&embedLimit, "limit", "l", 100, "Max notes to process (0 for all)")
}

func runEmbed(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		return fmt.Errorf("failed to connect to Brain MCP: %w", err)
	}

	fmt.Println("🧠 Generating embeddings...")
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
