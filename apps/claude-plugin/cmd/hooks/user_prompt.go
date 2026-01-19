package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/peterkloss/brain/packages/validation"
)

// UserPromptInput represents the input from Claude hook protocol
type UserPromptInput struct {
	Prompt    string `json:"prompt"`
	SessionID string `json:"sessionId,omitempty"`
}

// UserPromptOutput represents the output for user-prompt hook
type UserPromptOutput struct {
	Continue      bool                     `json:"continue"`
	Message       string                   `json:"message,omitempty"`
	Scenario      *ScenarioDetectionResult `json:"scenario,omitempty"`
	WorkflowState *WorkflowStateInfo       `json:"workflowState,omitempty"`
}

// ScenarioDetectionResult represents detected scenario information
type ScenarioDetectionResult struct {
	Detected    bool     `json:"detected"`
	Scenario    string   `json:"scenario,omitempty"`
	Triggers    []string `json:"triggers,omitempty"`
	Recommended string   `json:"recommended,omitempty"`
}

// planningKeywords are keywords that trigger workflow state injection
var planningKeywords = []string{
	"plan", "implement", "build", "feature",
	"create", "develop", "design", "architect",
	"phase", "task", "milestone", "epic",
	"spec", "specification", "requirement",
}

// RunUserPrompt handles the user-prompt hook
// It reads the prompt from stdin and detects scenarios
func RunUserPrompt() error {
	// Read input from stdin (Claude hook protocol)
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	var promptInput UserPromptInput

	// Try to parse as JSON first
	if err := json.Unmarshal(input, &promptInput); err != nil {
		// If not JSON, treat entire input as the prompt
		promptInput.Prompt = strings.TrimSpace(string(input))
	}

	output := UserPromptOutput{
		Continue: true,
	}

	// Detect scenario from prompt using shared validation package
	result := validation.DetectScenario(promptInput.Prompt)
	if result.Detected {
		output.Scenario = &ScenarioDetectionResult{
			Detected:    result.Detected,
			Scenario:    result.Scenario,
			Triggers:    result.Keywords,
			Recommended: result.Recommended,
		}
	}

	// Check for planning keywords and inject workflow state
	if containsAny(promptInput.Prompt, planningKeywords) {
		workflowState, err := loadWorkflowState()
		if err == nil && workflowState != nil {
			output.WorkflowState = workflowState
		}
	}

	// Output JSON to stdout
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(output)
}
