package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// PreToolUseInput represents the input from Claude PreToolUse hook protocol
type PreToolUseInput struct {
	Tool      string         `json:"tool"`
	Input     map[string]any `json:"input,omitempty"`
	SessionID string         `json:"sessionId,omitempty"`
}

// PreToolUseOutput represents the output for PreToolUse hook
type PreToolUseOutput struct {
	Decision string `json:"decision"` // "allow", "block", or "ask"
	Message  string `json:"message,omitempty"`
	Mode     string `json:"mode,omitempty"`
}

// RunPreToolUse handles the pre-tool-use hook
// It reads the tool name from stdin and checks if it's allowed in the current mode
func RunPreToolUse() error {
	// Read input from stdin (Claude hook protocol)
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	var toolInput PreToolUseInput

	// Parse JSON input
	if err := json.Unmarshal(input, &toolInput); err != nil {
		return fmt.Errorf("failed to parse input: %w", err)
	}

	// Perform gate check
	result := performGateCheck(toolInput.Tool)

	// Build output
	output := PreToolUseOutput{
		Mode: result.Mode,
	}

	if result.Allowed {
		output.Decision = "allow"
	} else {
		output.Decision = "block"
		output.Message = result.Message
	}

	// Output JSON to stdout
	return outputJSON(output)
}
