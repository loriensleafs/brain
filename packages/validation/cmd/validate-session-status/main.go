// Package main provides a CLI tool for validating session status frontmatter.
// This tool is used for cross-language parity testing with TypeScript.
//
// Usage:
//
//	go run ./cmd/validate-session-status/main.go '<json_frontmatter>'
//
// Example:
//
//	go run ./cmd/validate-session-status/main.go '{"title":"SESSION-2026-02-04_01-test","type":"session","status":"IN_PROGRESS","date":"2026-02-04"}'
//
// Output: JSON with validation result
//
//	{
//	  "valid": true,
//	  "status": "IN_PROGRESS",
//	  "errors": []
//	}
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/peterkloss/brain/packages/validation/internal"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s '<json_frontmatter>'\n", os.Args[0])
		os.Exit(1)
	}

	input := os.Args[1]

	// Parse JSON input
	var frontmatter interface{}
	if err := json.Unmarshal([]byte(input), &frontmatter); err != nil {
		// If JSON parsing fails, treat as invalid frontmatter
		result := internal.SessionStatusValidation{
			Valid: false,
			Errors: []internal.ValidationError{{
				Field:      "",
				Constraint: "frontmatter_required",
				Message:    "Frontmatter must be valid JSON",
			}},
		}
		output, _ := json.Marshal(result)
		fmt.Println(string(output))
		return
	}

	// Validate using the internal package
	result := internal.ValidateSessionStatusFromAny(frontmatter)

	output, err := json.Marshal(result)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to marshal result: %v\n", err)
		os.Exit(1)
	}

	fmt.Println(string(output))
}
