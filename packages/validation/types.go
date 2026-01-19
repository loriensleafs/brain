package validation

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

// WorkflowState represents the current workflow/mode state
type WorkflowState struct {
	Mode      string `json:"mode"`
	Task      string `json:"task,omitempty"`
	SessionID string `json:"sessionId,omitempty"`
	UpdatedAt string `json:"updatedAt,omitempty"`
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
