package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// IncoherenceInput represents the input for incoherence command
type IncoherenceInput struct {
	StepNumber int    `json:"stepNumber"`
	TotalSteps int    `json:"totalSteps"`
	Thoughts   string `json:"thoughts"`
}

// IncoherenceOutput represents the output for incoherence command
type IncoherenceOutput struct {
	Phase      string   `json:"phase"`
	AgentType  string   `json:"agentType"`
	StepNumber int      `json:"stepNumber"`
	TotalSteps int      `json:"totalSteps"`
	Actions    []string `json:"actions"`
	Next       string   `json:"next"`
	Thoughts   string   `json:"thoughts,omitempty"`
}

func runIncoherence() error {
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	var incoherenceInput IncoherenceInput
	if len(input) > 0 {
		if err := json.Unmarshal(input, &incoherenceInput); err != nil {
			return fmt.Errorf("failed to parse input: %w", err)
		}
	}

	if incoherenceInput.StepNumber < 1 {
		return fmt.Errorf("stepNumber must be >= 1")
	}
	if incoherenceInput.TotalSteps < 1 {
		incoherenceInput.TotalSteps = 22
	}

	guidance := getIncoherenceGuidance(incoherenceInput.StepNumber)

	output := IncoherenceOutput{
		Phase:      guidance.phase,
		AgentType:  guidance.agentType,
		StepNumber: incoherenceInput.StepNumber,
		TotalSteps: incoherenceInput.TotalSteps,
		Actions:    guidance.actions,
		Next:       guidance.next,
		Thoughts:   incoherenceInput.Thoughts,
	}

	return outputJSON(output)
}

type incoherenceGuidance struct {
	phase     string
	agentType string
	actions   []string
	next      string
}

func getIncoherenceGuidance(step int) incoherenceGuidance {
	switch step {
	case 1:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"CODEBASE SURVEY - Map project structure"},
			next:      "Step 2: DIMENSION SELECTION",
		}
	case 2:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"Select relevant dimensions (A-K) for exploration"},
			next:      "Step 3: EXPLORATION DISPATCH",
		}
	case 3:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"Dispatch exploration sub-agents"},
			next:      "Step 4: BROAD SWEEP",
		}
	case 4, 5, 6, 7:
		return incoherenceGuidance{
			phase:     "EXPLORATION",
			agentType: "subagent",
			actions:   []string{"Execute assigned dimension exploration"},
			next:      fmt.Sprintf("Step %d", step+1),
		}
	case 8:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"SYNTHESIS - Aggregate exploration findings"},
			next:      "Step 9: DEEP-DIVE DISPATCH",
		}
	case 9:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"Dispatch deep-dive sub-agents for critical issues"},
			next:      "Step 10: DEEP EXPLORATION",
		}
	case 10, 11:
		return incoherenceGuidance{
			phase:     "DEEP-DIVE",
			agentType: "subagent",
			actions:   []string{"Execute deep investigation of assigned issue"},
			next:      fmt.Sprintf("Step %d", step+1),
		}
	case 12:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"VERDICT ANALYSIS - Classify all findings"},
			next:      "Step 13: REPORT GENERATION",
		}
	case 13:
		return incoherenceGuidance{
			phase:     "DETECTION",
			agentType: "parent",
			actions:   []string{"Generate incoherence report with Resolution sections"},
			next:      "USER EDITS REPORT, then Step 14",
		}
	case 14:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"RECONCILE PARSE - Read user resolutions from report"},
			next:      "Step 15: RECONCILE ANALYZE",
		}
	case 15:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"Analyze each resolution for actionability"},
			next:      "Step 16: RECONCILE PLAN",
		}
	case 16:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"Plan code changes for each resolution"},
			next:      "Step 17: RECONCILE DISPATCH",
		}
	case 17:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"Dispatch sub-agents to apply resolutions"},
			next:      "Step 18: APPLY",
		}
	case 18, 19:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "subagent",
			actions:   []string{"Apply assigned resolution to codebase"},
			next:      fmt.Sprintf("Step %d", step+1),
		}
	case 20:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"RECONCILE COLLECT - Gather sub-agent results"},
			next:      "Step 21: RECONCILE UPDATE",
		}
	case 21:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"Update report with resolution status markers"},
			next:      "Step 22: RECONCILE COMPLETE",
		}
	case 22:
		return incoherenceGuidance{
			phase:     "RECONCILIATION",
			agentType: "parent",
			actions:   []string{"Final verification and completion"},
			next:      "COMPLETE",
		}
	}

	return incoherenceGuidance{
		phase:     "UNKNOWN",
		agentType: "unknown",
		actions:   []string{"Invalid step number"},
	}
}

