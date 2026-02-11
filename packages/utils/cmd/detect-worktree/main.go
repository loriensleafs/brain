// Package main provides a CLI tool for worktree detection.
// This tool is used for cross-language parity testing with TypeScript and Bun.
//
// Usage:
//
//	go run ./cmd/detect-worktree/main.go <cwd>
//
// Output: JSON with detection result
//
//	{"mainWorktreePath":"/path/to/main-repo","isLinkedWorktree":true}
//
// Or literal "null" when no linked worktree is detected.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain/packages/utils/internal"
)

type Result struct {
	MainWorktreePath string `json:"mainWorktreePath"`
	IsLinkedWorktree bool   `json:"isLinkedWorktree"`
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <cwd>\n", os.Args[0])
		os.Exit(1)
	}

	cwd := os.Args[1]

	detection, err := internal.DetectWorktreeMainPath(cwd)
	if err != nil {
		// Timeout or other error -- return null
		fmt.Println("null")
		return
	}

	if detection == nil {
		fmt.Println("null")
		return
	}

	result := Result{
		MainWorktreePath: detection.MainWorktreePath,
		IsLinkedWorktree: detection.IsLinkedWorktree,
	}

	output, err := json.Marshal(result)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal result: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}
