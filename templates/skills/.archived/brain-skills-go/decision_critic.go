package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// DecisionCriticInput represents the input for decision-critic command
type DecisionCriticInput struct {
	StepNumber int    `json:"stepNumber"`
	TotalSteps int    `json:"totalSteps"`
	Decision   string `json:"decision,omitempty"`
	Context    string `json:"context,omitempty"`
	Thoughts   string `json:"thoughts"`
}

// DecisionCriticOutput represents the output for decision-critic command
type DecisionCriticOutput struct {
	Phase        string   `json:"phase"`
	StepTitle    string   `json:"stepTitle"`
	Actions      []string `json:"actions"`
	Next         string   `json:"next,omitempty"`
	AcademicNote string   `json:"academicNote,omitempty"`
	Decision     string   `json:"decision,omitempty"`
	Context      string   `json:"context,omitempty"`
}

func runDecisionCritic() error {
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	var criticInput DecisionCriticInput
	if len(input) > 0 {
		if err := json.Unmarshal(input, &criticInput); err != nil {
			return fmt.Errorf("failed to parse input: %w", err)
		}
	}

	if criticInput.StepNumber < 1 || criticInput.StepNumber > 7 {
		return fmt.Errorf("stepNumber must be between 1 and 7")
	}
	if criticInput.TotalSteps != 7 {
		return fmt.Errorf("totalSteps must be 7")
	}
	if criticInput.StepNumber == 1 && criticInput.Decision == "" {
		return fmt.Errorf("decision is required for step 1")
	}

	guidance := getDecisionCriticGuidance(criticInput.StepNumber)

	output := DecisionCriticOutput{
		Phase:        guidance.phase,
		StepTitle:    guidance.stepTitle,
		Actions:      guidance.actions,
		Next:         guidance.next,
		AcademicNote: guidance.academicNote,
	}

	if criticInput.StepNumber == 1 {
		output.Decision = criticInput.Decision
		output.Context = criticInput.Context
	}

	return outputJSON(output)
}

type decisionCriticGuidance struct {
	phase        string
	stepTitle    string
	actions      []string
	next         string
	academicNote string
}

func getPhaseName(step int) string {
	switch {
	case step <= 2:
		return "DECOMPOSITION"
	case step <= 4:
		return "VERIFICATION"
	case step <= 6:
		return "CHALLENGE"
	default:
		return "SYNTHESIS"
	}
}

func getDecisionCriticGuidance(step int) decisionCriticGuidance {
	phase := getPhaseName(step)

	switch step {
	case 1:
		return decisionCriticGuidance{
			phase:     phase,
			stepTitle: "Extract Structure",
			actions: []string{
				"Extract and assign stable IDs:",
				"CLAIMS [C1, C2, ...] - Factual assertions (3-7 items)",
				"ASSUMPTIONS [A1, A2, ...] - Unstated beliefs (2-5 items)",
				"CONSTRAINTS [K1, K2, ...] - Hard boundaries (1-4 items)",
				"JUDGMENTS [J1, J2, ...] - Subjective tradeoffs (1-3 items)",
			},
			next: "Step 2: Classify each item's verifiability.",
		}
	case 2:
		return decisionCriticGuidance{
			phase:     phase,
			stepTitle: "Classify Verifiability",
			actions: []string{
				"Classify each item from Step 1:",
				"[V] VERIFIABLE - Can be checked against evidence",
				"[J] JUDGMENT - Subjective tradeoff",
				"[C] CONSTRAINT - Given condition, accepted as fixed",
			},
			next: "Step 3: Generate verification questions for [V] items.",
		}
	case 3:
		return decisionCriticGuidance{
			phase:        phase,
			stepTitle:    "Generate Verification Questions",
			actions:      []string{"For each [V] item, generate 1-3 verification questions."},
			next:         "Step 4: Answer questions with factored verification.",
			academicNote: "Chain-of-Verification (Dhuliawala et al., 2023)",
		}
	case 4:
		return decisionCriticGuidance{
			phase:        phase,
			stepTitle:    "Factored Verification",
			actions:      []string{"Answer each question INDEPENDENTLY. Mark: VERIFIED | FAILED | UNCERTAIN"},
			next:         "Step 5: Begin challenge phase.",
			academicNote: "Factored verification prevents confirmation bias.",
		}
	case 5:
		return decisionCriticGuidance{
			phase:        phase,
			stepTitle:    "Contrarian Perspective",
			actions:      []string{"Generate the STRONGEST possible argument AGAINST the decision."},
			next:         "Step 6: Explore alternative problem framing.",
			academicNote: "Multi-Expert Prompting (Wang et al., 2024)",
		}
	case 6:
		return decisionCriticGuidance{
			phase:     phase,
			stepTitle: "Alternative Framing",
			actions:   []string{"Challenge the PROBLEM STATEMENT itself."},
			next:      "Step 7: Synthesize findings into verdict.",
		}
	case 7:
		return decisionCriticGuidance{
			phase:        phase,
			stepTitle:    "Synthesis and Verdict",
			actions:      []string{"VERDICT: [STAND | REVISE | ESCALATE]"},
			academicNote: "Self-Consistency (Wang et al., 2023)",
		}
	}

	return decisionCriticGuidance{phase: "UNKNOWN", stepTitle: "Unknown Step"}
}
