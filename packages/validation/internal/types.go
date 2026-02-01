// Package types provides core validation types shared across internal packages.
package internal

// ValidationResult represents the outcome of a validation check
type ValidationResult struct {
	Valid       bool    `json:"valid"`
	Checks      []Check `json:"checks"`
	Message     string  `json:"message"`
	Remediation string  `json:"remediation,omitempty"`
}

// Check represents a single validation check
type Check struct {
	Name    string `json:"name"`
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

// ValidationError represents a structured validation error.
// Matches the TypeScript ValidationError interface from validate.ts.
// Does not expose raw input values for security.
type ValidationError struct {
	Field      string `json:"field"`
	Constraint string `json:"constraint"`
	Message    string `json:"message"`
}

// WorkflowState represents the current workflow/mode state.
// This is a simplified view for basic validation. For full state, use SessionState.
type WorkflowState struct {
	Mode      string `json:"mode"`
	Task      string `json:"task,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
}

// ModeHistoryEntry tracks each mode transition with timestamp.
type ModeHistoryEntry struct {
	Mode      string `json:"mode"`
	Timestamp string `json:"timestamp"`
}

// OrchestratorWorkflow tracks the full state of an orchestrator-managed workflow.
type OrchestratorWorkflow struct {
	ActiveAgent     *string `json:"activeAgent"`
	WorkflowPhase   string  `json:"workflowPhase"`
	AgentHistory    []any   `json:"agentHistory"`
	Decisions       []any   `json:"decisions"`
	Verdicts        []any   `json:"verdicts"`
	PendingHandoffs []any   `json:"pendingHandoffs"`
	CompactionHist  []any   `json:"compactionHistory"`
	StartedAt       string  `json:"startedAt"`
	LastAgentChange string  `json:"lastAgentChange"`
}

// SessionState represents the full session state from Brain MCP.
// This matches the TypeScript SessionState interface from apps/mcp/src/services/session/ts.
// Use this structure when receiving output from `brain session -p <project>`.
type SessionState struct {
	// CurrentMode is the current workflow mode (analysis|planning|coding|disabled)
	CurrentMode string `json:"currentMode"`
	// ModeHistory tracks all mode transitions
	ModeHistory []ModeHistoryEntry `json:"modeHistory"`
	// ProtocolStartComplete indicates if session start protocol completed
	ProtocolStartComplete bool `json:"protocolStartComplete"`
	// ProtocolEndComplete indicates if session end protocol completed
	ProtocolEndComplete bool `json:"protocolEndComplete"`
	// ProtocolStartEvidence contains evidence of start protocol completion
	ProtocolStartEvidence map[string]string `json:"protocolStartEvidence"`
	// ProtocolEndEvidence contains evidence of end protocol completion
	ProtocolEndEvidence map[string]string `json:"protocolEndEvidence"`
	// OrchestratorWorkflow tracks orchestrator state (nil if no orchestrator active)
	OrchestratorWorkflow *OrchestratorWorkflow `json:"orchestratorWorkflow"`
	// ActiveFeature is the currently active feature slug/path
	ActiveFeature string `json:"activeFeature,omitempty"`
	// ActiveTask is the currently active task within the feature
	ActiveTask string `json:"activeTask,omitempty"`
	// Version is the optimistic locking version
	Version int `json:"version"`
	// CreatedAt is the ISO timestamp when session was created
	CreatedAt string `json:"createdAt"`
	// UpdatedAt is the ISO timestamp of last state update
	UpdatedAt string `json:"updatedAt"`
}

// ToWorkflowState converts SessionState to WorkflowState for backward compatibility.
func (s *SessionState) ToWorkflowState() *WorkflowState {
	if s == nil {
		return nil
	}
	return &WorkflowState{
		Mode:      s.CurrentMode,
		Task:      s.ActiveTask,
		UpdatedAt: s.UpdatedAt,
	}
}

// ScenarioResult represents the result of scenario detection
type ScenarioResult struct {
	Detected    bool     `json:"detected"`
	Scenario    string   `json:"scenario,omitempty"`
	Keywords    []string `json:"keywords,omitempty"`
	Recommended string   `json:"recommended,omitempty"`
	Directory   string   `json:"directory,omitempty"`
	NoteType    string   `json:"noteType,omitempty"`
}

// ChecklistValidation represents validation of a protocol checklist section.
type ChecklistValidation struct {
	TotalMustItems       int      `json:"totalMustItems"`
	CompletedMustItems   int      `json:"completedMustItems"`
	TotalShouldItems     int      `json:"totalShouldItems"`
	CompletedShouldItems int      `json:"completedShouldItems"`
	MissingMustItems     []string `json:"missingMustItems,omitempty"`
	MissingShouldItems   []string `json:"missingShouldItems,omitempty"`
}

// ChecklistItem represents a parsed checklist item from the session log.
type ChecklistItem struct {
	RequirementLevel string // MUST, SHOULD, MAY
	Description      string
	Completed        bool
	Evidence         string
}

// CrossCuttingConcernsResult represents validation of cross-cutting concerns.
type CrossCuttingConcernsResult struct {
	Passed              bool     `json:"passed"`
	Issues              []string `json:"issues,omitempty"`
	HardcodedValues     []string `json:"hardcodedValues,omitempty"`
	TodoComments        []string `json:"todoComments,omitempty"`
	DuplicateCode       []string `json:"duplicateCode,omitempty"`
	UndocumentedEnvVars []string `json:"undocumentedEnvVars,omitempty"`
}

// FailSafeDesignResult represents validation of fail-safe design patterns.
type FailSafeDesignResult struct {
	Passed                bool     `json:"passed"`
	Issues                []string `json:"issues,omitempty"`
	MissingExitCodeChecks []string `json:"missingExitCodeChecks,omitempty"`
	MissingErrorHandling  []string `json:"missingErrorHandling,omitempty"`
	InsecureDefaults      []string `json:"insecureDefaults,omitempty"`
	SilentFailures        []string `json:"silentFailures,omitempty"`
}

// TestImplementationResult represents validation of test-implementation alignment.
type TestImplementationResult struct {
	Passed              bool     `json:"passed"`
	Issues              []string `json:"issues,omitempty"`
	ParameterDrift      []string `json:"parameterDrift,omitempty"`
	MissingTestCoverage []string `json:"missingTestCoverage,omitempty"`
	MockDivergence      []string `json:"mockDivergence,omitempty"`
	CoveragePercent     float64  `json:"coveragePercent,omitempty"`
}

// CIEnvironmentResult represents validation of CI environment compatibility.
type CIEnvironmentResult struct {
	Passed           bool     `json:"passed"`
	Issues           []string `json:"issues,omitempty"`
	CIFlagsVerified  bool     `json:"ciFlagsVerified"`
	BuildVerified    bool     `json:"buildVerified"`
	ConfigDocumented bool     `json:"configDocumented"`
}

// EnvironmentVariablesResult represents validation of environment variable completeness.
type EnvironmentVariablesResult struct {
	Passed          bool     `json:"passed"`
	Issues          []string `json:"issues,omitempty"`
	DocumentedVars  []string `json:"documentedVars,omitempty"`
	MissingDefaults []string `json:"missingDefaults,omitempty"`
	MissingInCI     []string `json:"missingInCI,omitempty"`
}

// SkillFrontmatter represents the parsed frontmatter from a skill file.
type SkillFrontmatter struct {
	Name        string `json:"name,omitempty"`
	Description string `json:"description,omitempty"`
	RawYAML     string `json:"rawYaml,omitempty"`
}

// SkillFieldValidation represents validation results for individual frontmatter fields.
type SkillFieldValidation struct {
	NamePresent        bool   `json:"namePresent"`
	NameValid          bool   `json:"nameValid"`
	NameError          string `json:"nameError,omitempty"`
	DescriptionPresent bool   `json:"descriptionPresent"`
	DescriptionValid   bool   `json:"descriptionValid"`
	DescriptionError   string `json:"descriptionError,omitempty"`
	YAMLSyntaxValid    bool   `json:"yamlSyntaxValid"`
	YAMLSyntaxError    string `json:"yamlSyntaxError,omitempty"`
}

// SessionProtocolValidationResult extends ValidationResult with protocol-specific fields.
type SessionProtocolValidationResult struct {
	ValidationResult
	SessionLogPath   string              `json:"sessionLogPath,omitempty"`
	StartChecklist   ChecklistValidation `json:"startChecklist"`
	EndChecklist     ChecklistValidation `json:"endChecklist"`
	BrainInitialized bool                `json:"brainInitialized"`
	BrainUpdated     bool                `json:"brainUpdated"`
}

// PrePRValidationResult extends ValidationResult with pre-PR specific fields.
type PrePRValidationResult struct {
	ValidationResult
	Mode                 string                     `json:"mode"` // "quick" or "full"
	TotalDuration        float64                    `json:"totalDuration"`
	CrossCuttingConcerns CrossCuttingConcernsResult `json:"crossCuttingConcerns"`
	FailSafeDesign       FailSafeDesignResult       `json:"failSafeDesign"`
	TestImplementation   TestImplementationResult   `json:"testImplementation"`
	CIEnvironment        CIEnvironmentResult        `json:"ciEnvironment"`
	EnvironmentVariables EnvironmentVariablesResult `json:"environmentVariables"`
}

// SkillFormatValidationResult extends ValidationResult with skill-specific fields.
type SkillFormatValidationResult struct {
	ValidationResult
	FilePath           string               `json:"filePath,omitempty"`
	FrontmatterPresent bool                 `json:"frontmatterPresent"`
	Frontmatter        SkillFrontmatter     `json:"frontmatter"`
	FieldValidation    SkillFieldValidation `json:"fieldValidation"`
	BundledSkills      []string             `json:"bundledSkills,omitempty"`
	PrefixViolation    bool                 `json:"prefixViolation"`
}
