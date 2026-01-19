package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// AnalyzeInput represents the input for analyze command
type AnalyzeInput struct {
	StepNumber int    `json:"stepNumber"`
	TotalSteps int    `json:"totalSteps"`
	Thoughts   string `json:"thoughts,omitempty"`
	StateFile  string `json:"stateFile,omitempty"` // File-based state (preferred)
}

// AnalyzeOutput represents the output for analyze command
type AnalyzeOutput struct {
	Phase       string   `json:"phase"`
	StepTitle   string   `json:"stepTitle"`
	Status      string   `json:"status"`
	Actions     []string `json:"actions"`
	Next        string   `json:"next,omitempty"`
	StateFile   string   `json:"stateFile,omitempty"`
	StateSummary string  `json:"stateSummary,omitempty"`
}

// AnalyzeState represents the accumulated analysis state (stored in file)
type AnalyzeState struct {
	StepNumber    int                    `json:"stepNumber"`
	TotalSteps    int                    `json:"totalSteps"`
	Phase         string                 `json:"phase"`
	StartedAt     string                 `json:"startedAt"`
	UpdatedAt     string                 `json:"updatedAt"`
	FocusAreas    []FocusArea            `json:"focusAreas,omitempty"`
	Investigations []Investigation       `json:"investigations,omitempty"`
	Findings      []Finding              `json:"findings,omitempty"`
	Patterns      []string               `json:"patterns,omitempty"`
	OpenQuestions []string               `json:"openQuestions,omitempty"`
	ExplorationSummary string            `json:"explorationSummary,omitempty"`
	RawThoughts   string                 `json:"rawThoughts,omitempty"` // Legacy support
}

// FocusArea represents an investigation focus area
type FocusArea struct {
	Name     string `json:"name"`
	Priority string `json:"priority"` // P1, P2, P3
	Reason   string `json:"reason"`
}

// Investigation represents a planned investigation
type Investigation struct {
	FocusArea  string   `json:"focusArea"`
	Files      []string `json:"files"`
	Questions  []string `json:"questions"`
	Hypotheses []string `json:"hypotheses"`
	Status     string   `json:"status"` // pending, in_progress, complete
}

// Finding represents a discovered issue
type Finding struct {
	Severity    string `json:"severity"` // CRITICAL, HIGH, MEDIUM, LOW
	Description string `json:"description"`
	File        string `json:"file,omitempty"`
	Line        int    `json:"line,omitempty"`
	Code        string `json:"code,omitempty"`
	Impact      string `json:"impact,omitempty"`
	Fix         string `json:"fix,omitempty"`
}

// RunAnalyze handles the analyze command
func RunAnalyze() error {
	// Read input from stdin
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return fmt.Errorf("failed to read stdin: %w", err)
	}

	var analyzeInput AnalyzeInput

	// Parse JSON input
	if len(input) > 0 {
		if err := json.Unmarshal(input, &analyzeInput); err != nil {
			return fmt.Errorf("failed to parse input: %w", err)
		}
	}

	// Validate input
	if analyzeInput.StepNumber < 1 {
		return fmt.Errorf("stepNumber must be >= 1")
	}
	if analyzeInput.TotalSteps < 6 {
		return fmt.Errorf("totalSteps must be >= 6 (minimum workflow)")
	}
	if analyzeInput.TotalSteps < analyzeInput.StepNumber {
		return fmt.Errorf("totalSteps must be >= stepNumber")
	}

	// Load or create state
	state, stateFile := loadOrCreateState(analyzeInput)

	// Update state with current step
	state.StepNumber = analyzeInput.StepNumber
	state.TotalSteps = analyzeInput.TotalSteps
	state.Phase = getPhaseName(analyzeInput.StepNumber, analyzeInput.TotalSteps)
	state.UpdatedAt = time.Now().Format(time.RFC3339)

	// If thoughts provided, append to raw thoughts (legacy support)
	if analyzeInput.Thoughts != "" && analyzeInput.Thoughts != state.RawThoughts {
		if state.RawThoughts != "" {
			state.RawThoughts += "\n---\n"
		}
		state.RawThoughts += analyzeInput.Thoughts
	}

	// Save state
	if err := saveState(stateFile, state); err != nil {
		return fmt.Errorf("failed to save state: %w", err)
	}

	// Generate guidance
	guidance := getStepGuidance(analyzeInput.StepNumber, analyzeInput.TotalSteps)

	// Build output
	output := AnalyzeOutput{
		Phase:     guidance.phase,
		StepTitle: guidance.stepTitle,
		Status:    getStatus(analyzeInput.StepNumber, analyzeInput.TotalSteps),
		Actions:   guidance.actions,
		Next:      guidance.next,
		StateFile: stateFile,
		StateSummary: getStateSummary(state),
	}

	return outputJSON(output)
}

// loadOrCreateState loads existing state or creates new
func loadOrCreateState(input AnalyzeInput) (*AnalyzeState, string) {
	var stateFile string

	// Use provided state file or create default
	if input.StateFile != "" {
		stateFile = input.StateFile
	} else {
		stateFile = getDefaultStateFile()
	}

	// Try to load existing state
	if data, err := os.ReadFile(stateFile); err == nil {
		var state AnalyzeState
		if err := json.Unmarshal(data, &state); err == nil {
			return &state, stateFile
		}
	}

	// Create new state
	return &AnalyzeState{
		StepNumber: input.StepNumber,
		TotalSteps: input.TotalSteps,
		StartedAt:  time.Now().Format(time.RFC3339),
		UpdatedAt:  time.Now().Format(time.RFC3339),
	}, stateFile
}

// getDefaultStateFile returns the default state file path
func getDefaultStateFile() string {
	// Use temp directory with timestamp
	tmpDir := os.TempDir()
	// Create brain subdirectory
	brainDir := filepath.Join(tmpDir, "brain-analyze")
	os.MkdirAll(brainDir, 0755)

	// Use date-based filename for easy identification
	date := time.Now().Format("2006-01-02")
	return filepath.Join(brainDir, fmt.Sprintf("analyze-state-%s.json", date))
}

// saveState saves the analysis state to file
func saveState(path string, state *AnalyzeState) error {
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// getStateSummary returns a brief summary of the current state
func getStateSummary(state *AnalyzeState) string {
	var parts []string

	if len(state.FocusAreas) > 0 {
		parts = append(parts, fmt.Sprintf("%d focus areas", len(state.FocusAreas)))
	}
	if len(state.Findings) > 0 {
		critical := 0
		high := 0
		for _, f := range state.Findings {
			switch f.Severity {
			case "CRITICAL":
				critical++
			case "HIGH":
				high++
			}
		}
		parts = append(parts, fmt.Sprintf("%d findings (%d critical, %d high)", len(state.Findings), critical, high))
	}
	if len(state.OpenQuestions) > 0 {
		parts = append(parts, fmt.Sprintf("%d open questions", len(state.OpenQuestions)))
	}

	if len(parts) == 0 {
		return "No accumulated state yet"
	}
	return strings.Join(parts, ", ")
}

// getPhaseName returns the phase name for a given step
func getPhaseName(step, totalSteps int) string {
	switch {
	case step == 1:
		return "EXPLORATION"
	case step == 2:
		return "FOCUS SELECTION"
	case step == 3:
		return "INVESTIGATION PLANNING"
	case step == totalSteps-1:
		return "VERIFICATION"
	case step == totalSteps:
		return "SYNTHESIS"
	default:
		return "DEEP ANALYSIS"
	}
}

// getStatus returns the status for a given step
func getStatus(step, totalSteps int) string {
	switch {
	case step >= totalSteps:
		return "analysis_complete"
	case step == totalSteps-1:
		return "verification_required"
	default:
		return "in_progress"
	}
}

// stepGuidance holds the guidance for a step
type stepGuidance struct {
	phase     string
	stepTitle string
	actions   []string
	next      string
}

// getStepGuidance returns guidance for a specific step
func getStepGuidance(step, totalSteps int) stepGuidance {
	nextStep := step + 1
	if step >= totalSteps {
		nextStep = 0
	}

	phase := getPhaseName(step, totalSteps)

	// Phase 1: Exploration
	if step == 1 {
		return stepGuidance{
			phase:     phase,
			stepTitle: "Process Exploration Results",
			actions: []string{
				"STOP. Before proceeding, verify you have Explore agent results.",
				"",
				"If you do NOT have exploration data, delegate to Explore agent:",
				"  - Use Task tool with subagent_type='Explore'",
				"  - For large codebases, launch MULTIPLE Explore agents in parallel",
				"",
				"Once you have exploration results, extract:",
				"  - Directory structure and purposes",
				"  - Tech stack (languages, frameworks, dependencies)",
				"  - Entry points and data flow",
				"  - Initial observations and areas of concern",
			},
			next: fmt.Sprintf("Invoke step %d with exploration summary. Update state file with findings.", nextStep),
		}
	}

	// Phase 2: Focus Selection
	if step == 2 {
		return stepGuidance{
			phase:     phase,
			stepTitle: "Classify Investigation Areas",
			actions: []string{
				"Evaluate codebase against each dimension:",
				"",
				"ARCHITECTURE: Component relationships, dependencies, boundaries",
				"PERFORMANCE: Hot paths, queries, memory, concurrency",
				"SECURITY: Input validation, auth, data handling",
				"QUALITY: Duplication, complexity, error handling, tests",
				"",
				"Assign priorities (P1 = most critical):",
				"  P1: [area] - [why most critical]",
				"  P2: [area] - [why second]",
				"  P3: [area] - [if applicable]",
				"",
				"Update state file with focusAreas array.",
			},
			next: fmt.Sprintf("Invoke step %d. Update state file with focus areas.", nextStep),
		}
	}

	// Phase 3: Investigation Planning
	if step == 3 {
		return stepGuidance{
			phase:     phase,
			stepTitle: "Create Investigation Plan",
			actions: []string{
				"For each focus area, specify:",
				"",
				"  Files to examine:",
				"    - path/to/file.py",
				"      Question: [specific question]",
				"      Hypothesis: [expected finding]",
				"",
				"This is a CONTRACT. You MUST:",
				"  1. Read every file listed",
				"  2. Answer every question",
				"  3. Document evidence with file:line references",
				"",
				"Update state file with investigations array.",
			},
			next: fmt.Sprintf("Invoke step %d. Begin with highest priority focus area.", nextStep),
		}
	}

	// Phase N-1: Verification
	if step == totalSteps-1 {
		return stepGuidance{
			phase:     phase,
			stepTitle: "Verify Investigation Completeness",
			actions: []string{
				"Review your investigation commitments from Step 3.",
				"",
				"For each file committed:",
				"  [ ] File was actually read?",
				"  [ ] Question answered with evidence?",
				"  [ ] Finding has file:line reference?",
				"",
				"Identify gaps:",
				"  - Files not examined?",
				"  - Questions unanswered?",
				"  - Evidence missing?",
				"",
				"If gaps exist: increase totalSteps, return to DEEP ANALYSIS",
				"If complete: proceed to SYNTHESIS",
			},
			next: fmt.Sprintf("If gaps: fill them first. If complete: invoke step %d for synthesis.", nextStep),
		}
	}

	// Phase N: Synthesis
	if step >= totalSteps {
		return stepGuidance{
			phase:     phase,
			stepTitle: "Consolidate and Recommend",
			actions: []string{
				"Organize all VERIFIED findings by severity:",
				"",
				"CRITICAL: [must address immediately]",
				"  - file:line, quoted code, impact, fix",
				"",
				"HIGH: [should address soon]",
				"  - file:line, description, fix",
				"",
				"MEDIUM/LOW: [consider addressing]",
				"  - description, guidance",
				"",
				"Provide prioritized action plan:",
				"  IMMEDIATE: security risks, blockers",
				"  SHORT-TERM: current sprint items",
				"  LONG-TERM: strategic improvements",
			},
			next: "",
		}
	}

	// Phase 4+: Deep Analysis
	deepStep := step - 3
	remaining := totalSteps - 1 - step

	var stepTitle string
	var focusInstructions []string

	switch deepStep {
	case 1:
		stepTitle = "Initial Investigation"
		focusInstructions = []string{
			"Execute your investigation plan from Step 3.",
			"",
			"For each file in P1 focus area:",
			"  1. READ the file",
			"  2. ANSWER the committed question",
			"  3. DOCUMENT with evidence:",
			"",
			"     [SEVERITY] Description (file.py:line)",
			"     > quoted code (2-5 lines)",
			"     Explanation: why this is an issue",
			"",
			"Update state file: add to findings array.",
		}
	case 2:
		stepTitle = "Deepen Investigation"
		focusInstructions = []string{
			"Review previous findings. Go deeper:",
			"",
			"  1. TRACE issues to root cause",
			"  2. EXAMINE related files (callers, callees)",
			"  3. LOOK for patterns across codebase",
			"  4. MOVE to P2 focus area if P1 complete",
			"",
			"Update state file with new findings.",
		}
	default:
		stepTitle = fmt.Sprintf("Extended Investigation (Pass %d)", deepStep)
		focusInstructions = []string{
			"Address remaining gaps:",
			"",
			"  - Files not yet examined",
			"  - Questions not yet answered",
			"  - Patterns not yet validated",
			"  - Evidence not yet collected",
			"",
			"If investigation complete: reduce totalSteps to reach verification.",
		}
	}

	actions := append(focusInstructions,
		"",
		fmt.Sprintf("Remaining steps before verification: %d", remaining),
		"  - More complexity? INCREASE totalSteps",
		"  - Scope smaller? DECREASE totalSteps",
	)

	return stepGuidance{
		phase:     phase,
		stepTitle: stepTitle,
		actions:   actions,
		next:      fmt.Sprintf("Invoke step %d. %d step(s) before verification.", nextStep, remaining),
	}
}
