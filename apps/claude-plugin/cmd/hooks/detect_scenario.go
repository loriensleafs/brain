package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/peterkloss/brain/packages/validation"
)

// DetectScenarioInput represents the input for detect-scenario command
type DetectScenarioInput struct {
	Prompt string `json:"prompt"`
}

// DetectScenarioOutput represents the output for detect-scenario command
type DetectScenarioOutput struct {
	Detected    bool     `json:"detected"`
	Scenario    string   `json:"scenario,omitempty"`
	Triggers    []string `json:"triggers,omitempty"`
	Recommended string   `json:"recommended,omitempty"`
	Directory   string   `json:"directory,omitempty"`
	NoteType    string   `json:"noteType,omitempty"`
}

// RunDetectScenario handles the detect-scenario command
// It reads a prompt and returns scenario detection results
func RunDetectScenario() error {
	// Read input from stdin
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	var detectInput DetectScenarioInput

	// Try to parse as JSON first
	if err := json.Unmarshal(input, &detectInput); err != nil {
		// If not JSON, treat entire input as the prompt
		detectInput.Prompt = strings.TrimSpace(string(input))
	}

	// Detect scenario using shared validation package
	result := validation.DetectScenario(detectInput.Prompt)

	// Map validation.ScenarioResult to DetectScenarioOutput
	output := DetectScenarioOutput{
		Detected:    result.Detected,
		Scenario:    result.Scenario,
		Triggers:    result.Keywords,
		Recommended: result.Recommended,
		Directory:   result.Directory,
		NoteType:    result.NoteType,
	}

	// Output JSON to stdout
	return outputJSON(output)
}
