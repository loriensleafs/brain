package main

import (
	"encoding/json"
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "Usage: brain-skills <command>")
		fmt.Fprintln(os.Stderr, "Commands:")
		fmt.Fprintln(os.Stderr, "  incoherence       Step-based incoherence detection workflow (22 steps)")
		fmt.Fprintln(os.Stderr, "  decision-critic   Structured decision criticism workflow (7 steps)")
		fmt.Fprintln(os.Stderr, "  fix-fences        Fix malformed markdown code fence closings")
		os.Exit(1)
	}

	var err error
	switch os.Args[1] {
	case "incoherence":
		err = runIncoherence()
	case "decision-critic":
		err = runDecisionCritic()
	case "fix-fences":
		err = runFixFences()
	default:
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n", os.Args[1])
		os.Exit(1)
	}

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

// outputJSON writes JSON output to stdout with 2-space indentation
func outputJSON(v any) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(v); err != nil {
		return fmt.Errorf("failed to encode output: %w", err)
	}
	return nil
}
