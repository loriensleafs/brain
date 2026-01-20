package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/peterkloss/brain-tui/client"
	"github.com/peterkloss/brain/packages/validation"
	"github.com/spf13/cobra"
)

var (
	searchLimit       int
	searchThreshold   float64
	searchMode        string
	searchDepth       int
	searchProject     string
	searchFullContent bool
)

// SearchResult represents a single search result.
type SearchResult struct {
	ID              string  `json:"id"`
	Permalink       string  `json:"permalink"`
	Title           string  `json:"title"`
	URL             string  `json:"url"`
	SimilarityScore float64 `json:"similarity_score,omitempty"`
	Snippet         string  `json:"snippet,omitempty"`
	FullContent     string  `json:"fullContent,omitempty"`
	Source          string  `json:"source,omitempty"`
	Depth           int     `json:"depth,omitempty"` // 0 = direct match, 1+ = related via wikilinks
}

// SearchResponse represents the search response from Brain MCP.
type SearchResponse struct {
	Results    []SearchResult `json:"results,omitempty"`
	TotalCount int            `json:"total_count,omitempty"`
	Query      string         `json:"query,omitempty"`
}

// MCPContent represents the MCP content wrapper format.
type MCPContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

var searchCmd = &cobra.Command{
	Use:   "search [query]",
	Short: "Search the knowledge base",
	Long: `Search the Brain knowledge base with semantic or keyword search.

Examples:
  brain search "authentication patterns"
  brain search "git hooks" --limit 5
  brain search "session protocol" --mode semantic --threshold 0.8
  brain search "OAuth" --depth 1           # Include related notes
  brain search "patterns" --project brain  # Search specific project
  brain search "patterns" --full-content   # Include full note content

Search Modes:
  auto     - Tries semantic search first, falls back to keyword (default)
  semantic - Vector similarity search only
  keyword  - Text-based search only
  hybrid   - Combines semantic and keyword results with score fusion

Depth:
  0 - Direct matches only (default)
  1 - Include notes linked from matches
  2 - Include notes 2 levels deep
  3 - Maximum depth (3 levels)

Full Content:
  When --full-content is specified, results include complete note content
  instead of compact snippets. Useful for detailed review of matches.

Project Resolution:
  If --project is not specified, the project is auto-resolved from:
  1. BM_PROJECT environment variable
  2. BM_ACTIVE_PROJECT environment variable (legacy)
  3. BRAIN_PROJECT environment variable
  4. Current working directory match against configured code_paths`,
	Args: cobra.MinimumNArgs(1),
	RunE: runSearch,
}

func init() {
	rootCmd.AddCommand(searchCmd)
	searchCmd.Flags().IntVarP(&searchLimit, "limit", "l", 10, "Maximum number of results (1-100)")
	searchCmd.Flags().Float64VarP(&searchThreshold, "threshold", "t", 0.7, "Similarity threshold for semantic search (0-1)")
	searchCmd.Flags().StringVarP(&searchMode, "mode", "m", "auto", "Search mode: auto, semantic, keyword, hybrid")
	searchCmd.Flags().IntVarP(&searchDepth, "depth", "d", 0, "Relation depth: follow wikilinks N levels (0-3)")
	searchCmd.Flags().StringVarP(&searchProject, "project", "p", "", "Project to search (auto-resolved from CWD if not specified)")
	searchCmd.Flags().BoolVar(&searchFullContent, "full-content", false, "Include full note content instead of snippets")
}

func runSearch(cmd *cobra.Command, args []string) error {
	query := strings.Join(args, " ")

	// Resolve project using hierarchy: explicit flag > env vars > CWD match
	project := validation.ResolveProject(searchProject, "")
	if project == "" {
		fmt.Fprintf(os.Stderr, "Error: No project specified and none could be resolved from CWD.\n")
		fmt.Fprintf(os.Stderr, "Use --project flag or run from a configured project directory.\n")
		os.Exit(1)
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Build tool arguments
	toolArgs := map[string]any{
		"query":   query,
		"project": project,
	}

	if searchLimit != 10 {
		toolArgs["limit"] = searchLimit
	}
	if searchThreshold != 0.7 {
		toolArgs["threshold"] = searchThreshold
	}
	if searchMode != "auto" {
		toolArgs["mode"] = searchMode
	}
	if searchDepth > 0 {
		toolArgs["depth"] = searchDepth
	}
	if searchFullContent {
		toolArgs["fullContent"] = true
	}

	// Call the search tool
	result, err := brainClient.CallTool("search", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Debug: show raw response
	if os.Getenv("DEBUG") != "" {
		fmt.Fprintf(os.Stderr, "DEBUG raw response: %s\n", text)
	}

	// Unwrap MCP content format if present: [{"type":"text","text":"..."}]
	var mcpContent []MCPContent
	if err := json.Unmarshal([]byte(text), &mcpContent); err == nil && len(mcpContent) > 0 {
		text = mcpContent[0].Text
	}

	// Try to parse as SearchResponse
	var response SearchResponse
	if err := json.Unmarshal([]byte(text), &response); err == nil && len(response.Results) > 0 {
		printSearchResults(response.Results)
	} else {
		// Try parsing as array directly
		var results []SearchResult
		if err := json.Unmarshal([]byte(text), &results); err == nil && len(results) > 0 {
			printSearchResults(results)
		} else {
			// Output raw text if not JSON
			fmt.Println(text)
		}
	}

	return nil
}

func printSearchResults(results []SearchResult) {
	for i, r := range results {
		// Show depth indicator for related notes
		depthPrefix := ""
		if r.Depth > 0 {
			depthPrefix = fmt.Sprintf("[depth %d] ", r.Depth)
		}
		fmt.Printf("%d. %s%s\n", i+1, depthPrefix, r.Title)

		// Use URL if permalink is empty
		path := r.Permalink
		if path == "" {
			path = r.URL
		}
		if path == "" {
			path = r.ID
		}
		if path != "" {
			fmt.Printf("   %s\n", path)
		}
		if r.SimilarityScore > 0 || r.Source != "" {
			fmt.Print("   ")
			if r.SimilarityScore > 0 {
				fmt.Printf("Score: %.2f", r.SimilarityScore)
			}
			if r.Source != "" {
				if r.SimilarityScore > 0 {
					fmt.Printf(" (%s)", r.Source)
				} else {
					fmt.Printf("(%s)", r.Source)
				}
			}
			fmt.Println()
		}

		// Show full content if available, otherwise show snippet
		if r.FullContent != "" {
			content := r.FullContent
			if len(content) > 2000 {
				content = content[:2000] + "..."
			}
			fmt.Printf("\n%s\n", content)
		} else if r.Snippet != "" {
			snippet := r.Snippet
			if len(snippet) > 100 {
				snippet = snippet[:100] + "..."
			}
			fmt.Printf("   %s\n", snippet)
		}
		fmt.Println()
	}
}
