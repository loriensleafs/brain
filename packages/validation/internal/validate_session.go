package internal

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// SessionValidationConfig holds schema-driven configuration for session validation.
// This replaces hardcoded values with schema-defined patterns.
type SessionValidationConfig struct {
	InvestigationAllowlistPatterns []string `json:"investigationAllowlistPatterns"`
	AuditArtifactPatterns          []string `json:"auditArtifactPatterns"`
	MemoryPlaceholderPatterns      []string `json:"memoryPlaceholderPatterns"`
	MemoryNamePattern              string   `json:"memoryNamePattern"`
	CommitSHAPattern               string   `json:"commitShaPattern"`
	DocsExtension                  string   `json:"docsExtension"`
	ExpectedSessionDirectory       string   `json:"expectedSessionDirectory"`
}

// DefaultSessionValidationConfig returns the default configuration values.
// These match the schema defaults in session-validation.schema.json.
var DefaultSessionValidationConfig = SessionValidationConfig{
	InvestigationAllowlistPatterns: []string{
		`^\.agents/sessions/`,
		`^\.agents/analysis/`,
		`^\.agents/retrospective/`,
		`^\.serena/memories($|/)`,
		`^\.agents/security/`,
	},
	AuditArtifactPatterns: []string{
		`^\.agents/sessions/`,
		`^\.agents/analysis/`,
		`^\.serena/memories($|/)`,
	},
	MemoryPlaceholderPatterns: []string{
		`^\s*$`,
		`^List memories loaded$`,
		`^\[.*\]$`,
		`^-+$`,
	},
	MemoryNamePattern:        `[a-z][a-z0-9]*(?:-[a-z0-9]+)+`,
	CommitSHAPattern:         `[0-9a-f]{7,40}`,
	DocsExtension:            ".md",
	ExpectedSessionDirectory: ".agents/sessions",
}

var (
	sessionValidationSchemaOnce     sync.Once
	sessionValidationSchemaCompiled *jsonschema.Schema
	sessionValidationSchemaErr      error
	sessionValidationSchemaData     []byte
)

// SetSessionValidationSchemaData sets the schema data for session validation.
// This must be called before any schema-based validation functions are used.
// The data is typically embedded by the parent package.
func SetSessionValidationSchemaData(data []byte) {
	sessionValidationSchemaData = data
}

// getSessionValidationSchema returns the compiled session validation schema, loading it once.
func getSessionValidationSchema() (*jsonschema.Schema, error) {
	sessionValidationSchemaOnce.Do(func() {
		if sessionValidationSchemaData == nil {
			sessionValidationSchemaErr = fmt.Errorf("session validation schema data not set; call SetSessionValidationSchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(sessionValidationSchemaData, &schemaDoc); err != nil {
			sessionValidationSchemaErr = fmt.Errorf("failed to parse session validation schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("session-validation.schema.json", schemaDoc); err != nil {
			sessionValidationSchemaErr = fmt.Errorf("failed to add session validation schema resource: %w", err)
			return
		}

		sessionValidationSchemaCompiled, sessionValidationSchemaErr = c.Compile("session-validation.schema.json")
	})
	return sessionValidationSchemaCompiled, sessionValidationSchemaErr
}

// ValidateSessionValidationInput validates input data against the session validation schema.
// Returns true if valid, false otherwise.
func ValidateSessionValidationInput(data any) bool {
	schema, err := getSessionValidationSchema()
	if err != nil {
		return false
	}

	err = schema.Validate(data)
	return err == nil
}

// GetSessionValidationErrors returns structured validation errors for input data.
// Returns empty slice if valid.
func GetSessionValidationErrors(data any) []ValidationError {
	schema, err := getSessionValidationSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(data)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// ValidateStopReadiness validates that it's safe to pause/stop the session.
// This is called by stop hooks during interruptions (Ctrl+C, context switches).
// It performs minimal checks, NOT full session end protocol validation.
// Key design: Stop readiness should NEVER block. It's informational only.
func ValidateStopReadiness(state *WorkflowState) ValidationResult {
	var checks []Check

	// Check 1: No blocking operations (always pass for now - future enhancement)
	checks = append(checks, Check{
		Name:    "no_blocking_ops",
		Passed:  true,
		Message: "No blocking operations detected",
	})

	// Check 2: State is readable (verify we have state)
	if state == nil {
		checks = append(checks, Check{
			Name:    "state_available",
			Passed:  false,
			Message: "Workflow state unavailable",
		})
	} else {
		modeMsg := "Workflow state available"
		if state.Mode != "" {
			modeMsg = "Workflow state available: mode=" + state.Mode
		}
		checks = append(checks, Check{
			Name:    "state_available",
			Passed:  true,
			Message: modeMsg,
		})
	}

	// Return non-blocking result (Valid: true even if checks fail)
	// Stop hook should WARN, not BLOCK
	return ValidationResult{
		Valid:       true, // Always allow stop
		Checks:      checks,
		Message:     "Session can be paused safely",
		Remediation: "",
	}
}

// ValidateSessionState validates full SessionState from Brain CLI for completeness.
// This accepts the complete SessionState structure from `brain session -p <project>`.
// Provides richer validation using protocol completion status and evidence.
func ValidateSessionState(state *SessionState) ValidationResult {
	var checks []Check
	allPassed := true

	// Check 1: Session state available
	if state == nil {
		return ValidationResult{
			Valid:       false,
			Checks:      []Check{{Name: "state_available", Passed: false, Message: "Session state unavailable"}},
			Message:     "Session validation failed: no state provided",
			Remediation: "Ensure Brain MCP is running and session exists",
		}
	}

	// Check 2: Workflow mode persisted
	if state.CurrentMode != "" {
		checks = append(checks, Check{
			Name:    "workflow_mode",
			Passed:  true,
			Message: "Workflow mode persisted: " + state.CurrentMode,
		})
	} else {
		checks = append(checks, Check{
			Name:    "workflow_mode",
			Passed:  false,
			Message: "No workflow mode set",
		})
		allPassed = false
	}

	// Check 3: Protocol start complete
	if state.ProtocolStartComplete {
		checks = append(checks, Check{
			Name:    "protocol_start",
			Passed:  true,
			Message: "Session start protocol completed",
		})
	} else {
		checks = append(checks, Check{
			Name:    "protocol_start",
			Passed:  false,
			Message: "Session start protocol incomplete",
		})
		allPassed = false
	}

	// Check 4: Protocol start evidence
	if len(state.ProtocolStartEvidence) > 0 {
		evidenceKeys := make([]string, 0, len(state.ProtocolStartEvidence))
		for k := range state.ProtocolStartEvidence {
			evidenceKeys = append(evidenceKeys, k)
		}
		checks = append(checks, Check{
			Name:    "start_evidence",
			Passed:  true,
			Message: "Start evidence captured: " + strings.Join(evidenceKeys, ", "),
		})
	} else {
		checks = append(checks, Check{
			Name:    "start_evidence",
			Passed:  false,
			Message: "No start evidence captured",
		})
		// Not a hard fail - evidence can be empty for new sessions
	}

	// Check 5: Version tracking
	if state.Version > 0 {
		checks = append(checks, Check{
			Name:    "version_tracking",
			Passed:  true,
			Message: "Session version tracked",
		})
	}

	// Check 6: Active task status (informational)
	if state.ActiveTask != "" {
		checks = append(checks, Check{
			Name:    "active_task",
			Passed:  true,
			Message: "Active task: " + state.ActiveTask,
		})
	} else {
		checks = append(checks, Check{
			Name:    "active_task",
			Passed:  true,
			Message: "No active task",
		})
	}

	// Check 7: Active feature status (informational)
	if state.ActiveFeature != "" {
		checks = append(checks, Check{
			Name:    "active_feature",
			Passed:  true,
			Message: "Active feature: " + state.ActiveFeature,
		})
	}

	result := ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Session ready to end"
	} else {
		result.Message = "Session validation failed"
		result.Remediation = "Complete session start protocol before ending session"
	}

	return result
}

// ValidateSession validates session state for completeness before ending.
// Pass the state from `brain session` command output.
// Deprecated: Use ValidateSessionState for full SessionState validation.
func ValidateSession(state *WorkflowState) ValidationResult {
	var checks []Check
	allPassed := true

	// Check 1: Workflow state persisted
	if state != nil && state.Mode != "" {
		checks = append(checks, Check{
			Name:    "workflow_state",
			Passed:  true,
			Message: "Workflow state persisted with mode: " + state.Mode,
		})
	} else {
		checks = append(checks, Check{
			Name:    "workflow_state",
			Passed:  true,
			Message: "No active workflow state",
		})
	}

	// Check 2: Recent activity (derived from UpdatedAt)
	if state != nil && state.UpdatedAt != "" {
		checks = append(checks, Check{
			Name:    "recent_activity",
			Passed:  true,
			Message: "Recent activity at: " + state.UpdatedAt,
		})
	} else {
		shouldFail := state != nil &&
			(state.Mode == "analysis" || state.Mode == "planning")
		checks = append(checks, Check{
			Name:    "recent_activity",
			Passed:  !shouldFail,
			Message: "No recent activity captured",
		})
		if shouldFail {
			allPassed = false
		}
	}

	// Check 3: Task status (derived from Task field)
	if state == nil || state.Task == "" {
		checks = append(checks, Check{
			Name:    "task_status",
			Passed:  true,
			Message: "No active task",
		})
	} else {
		checks = append(checks, Check{
			Name:    "task_status",
			Passed:  true,
			Message: "Active task: " + state.Task,
		})
	}

	result := ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Session ready to end"
	} else {
		result.Message = "Session validation failed"
		result.Remediation = "Capture observations before ending session"
	}

	return result
}

// QASkipType represents the type of QA skip allowed for a session.
type QASkipType string

const (
	QASkipNone              QASkipType = ""
	QASkipDocsOnly          QASkipType = "docs-only"
	QASkipInvestigationOnly QASkipType = "investigation-only"
)

// QASkipResult represents the result of QA skip eligibility check.
type QASkipResult struct {
	Eligible            bool       `json:"eligible"`
	SkipType            QASkipType `json:"skipType,omitempty"`
	ImplementationFiles []string   `json:"implementationFiles,omitempty"`
	Reason              string     `json:"reason,omitempty"`
}

// InvestigationAllowlist defines paths that qualify for investigation-only QA skip.
// Sessions that only modify these paths can skip QA with "SKIPPED: investigation-only".
// Deprecated: Use DefaultSessionValidationConfig.InvestigationAllowlistPatterns for schema-driven configuration.
var InvestigationAllowlist = DefaultSessionValidationConfig.InvestigationAllowlistPatterns

// AuditArtifacts defines paths that are exempt from QA validation.
// These are audit trail files, not implementation.
// Deprecated: Use DefaultSessionValidationConfig.AuditArtifactPatterns for schema-driven configuration.
var AuditArtifacts = DefaultSessionValidationConfig.AuditArtifactPatterns

// CheckQASkipEligibility determines if a session can skip QA validation.
// It analyzes the changed files to determine if the session is docs-only
// or investigation-only.
func CheckQASkipEligibility(changedFiles []string) QASkipResult {
	if len(changedFiles) == 0 {
		return QASkipResult{
			Eligible: true,
			SkipType: QASkipDocsOnly,
			Reason:   "No files changed",
		}
	}

	// Filter out audit artifacts to get implementation files
	implFiles := GetImplementationFiles(changedFiles)

	// Check if all implementation files are docs-only (.md)
	if IsDocsOnly(implFiles) {
		return QASkipResult{
			Eligible: true,
			SkipType: QASkipDocsOnly,
			Reason:   "All changes are documentation-only",
		}
	}

	// Check if all files match investigation allowlist
	investigationResult := CheckInvestigationOnlyEligibility(changedFiles)
	if investigationResult.Eligible {
		return QASkipResult{
			Eligible: true,
			SkipType: QASkipInvestigationOnly,
			Reason:   "All changes are investigation artifacts",
		}
	}

	return QASkipResult{
		Eligible:            false,
		SkipType:            QASkipNone,
		ImplementationFiles: investigationResult.ImplementationFiles,
		Reason:              "Session contains implementation changes requiring QA",
	}
}

// IsDocsOnly returns true if all files are markdown documentation.
// Uses the default docs extension from DefaultSessionValidationConfig.
func IsDocsOnly(files []string) bool {
	return IsDocsOnlyWithConfig(files, DefaultSessionValidationConfig)
}

// IsDocsOnlyWithConfig returns true if all files match the docs extension in the config.
func IsDocsOnlyWithConfig(files []string, config SessionValidationConfig) bool {
	if len(files) == 0 {
		return true
	}

	for _, f := range files {
		ext := strings.ToLower(filepath.Ext(f))
		if ext != config.DocsExtension {
			return false
		}
	}
	return true
}

// CheckInvestigationOnlyEligibility tests if all files are in the investigation allowlist.
// Uses schema-driven patterns from DefaultSessionValidationConfig.
func CheckInvestigationOnlyEligibility(files []string) QASkipResult {
	return CheckInvestigationOnlyEligibilityWithConfig(files, DefaultSessionValidationConfig)
}

// CheckInvestigationOnlyEligibilityWithConfig tests if all files are in the investigation allowlist
// using the provided configuration patterns.
func CheckInvestigationOnlyEligibilityWithConfig(files []string, config SessionValidationConfig) QASkipResult {
	result := QASkipResult{
		Eligible:            true,
		ImplementationFiles: []string{},
	}

	if len(files) == 0 {
		return result
	}

	var implementationFiles []string

	for _, file := range files {
		// Normalize path separators
		normalizedFile := strings.ReplaceAll(file, "\\", "/")

		isAllowed := false
		for _, pattern := range config.InvestigationAllowlistPatterns {
			matched, err := regexp.MatchString(pattern, normalizedFile)
			if err == nil && matched {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			implementationFiles = append(implementationFiles, file)
		}
	}

	if len(implementationFiles) > 0 {
		result.Eligible = false
		result.ImplementationFiles = implementationFiles
	}

	return result
}

// GetImplementationFiles filters out audit artifacts from a file list.
// Returns only files that are implementation (code, ADRs, config, tests).
// Uses schema-driven patterns from DefaultSessionValidationConfig.
func GetImplementationFiles(files []string) []string {
	return GetImplementationFilesWithConfig(files, DefaultSessionValidationConfig)
}

// GetImplementationFilesWithConfig filters out audit artifacts using the provided configuration.
func GetImplementationFilesWithConfig(files []string, config SessionValidationConfig) []string {
	if len(files) == 0 {
		return []string{}
	}

	var implementationFiles []string

	for _, file := range files {
		normalizedFile := strings.ReplaceAll(file, "\\", "/")

		isAuditArtifact := false
		for _, pattern := range config.AuditArtifactPatterns {
			matched, err := regexp.MatchString(pattern, normalizedFile)
			if err == nil && matched {
				isAuditArtifact = true
				break
			}
		}

		if !isAuditArtifact {
			implementationFiles = append(implementationFiles, file)
		}
	}

	return implementationFiles
}

// MemoryEvidenceResult represents the result of memory evidence validation.
type MemoryEvidenceResult struct {
	Valid           bool     `json:"valid"`
	MemoriesFound   []string `json:"memoriesFound,omitempty"`
	MissingMemories []string `json:"missingMemories,omitempty"`
	ErrorMessage    string   `json:"errorMessage,omitempty"`
}

// ValidateMemoryEvidence validates that memory-related checklist rows have valid evidence.
// It extracts memory names from the evidence column and optionally validates they exist.
// Uses schema-driven configuration from DefaultSessionValidationConfig.
func ValidateMemoryEvidence(evidence string) MemoryEvidenceResult {
	return ValidateMemoryEvidenceWithConfig(evidence, DefaultSessionValidationConfig)
}

// ValidateMemoryEvidenceWithConfig validates memory evidence using the provided configuration.
// This allows schema-driven configuration of validation patterns.
func ValidateMemoryEvidenceWithConfig(evidence string, config SessionValidationConfig) MemoryEvidenceResult {
	result := MemoryEvidenceResult{
		Valid:         true,
		MemoriesFound: []string{},
	}

	// Check for empty or placeholder evidence using schema-defined patterns
	for _, pattern := range config.MemoryPlaceholderPatterns {
		matched, err := regexp.MatchString(pattern, evidence)
		if err == nil && matched {
			result.Valid = false
			result.ErrorMessage = "Memory evidence contains placeholder text: '" + evidence +
				"'. List actual memory names read (e.g., 'memory-index, skills-pr-review-index')."
			return result
		}
	}

	// Extract memory names using schema-defined pattern
	memoryPattern := regexp.MustCompile(config.MemoryNamePattern)
	matches := memoryPattern.FindAllString(strings.ToLower(evidence), -1)

	// Deduplicate
	seen := make(map[string]bool)
	for _, m := range matches {
		if !seen[m] {
			seen[m] = true
			result.MemoriesFound = append(result.MemoriesFound, m)
		}
	}

	if len(result.MemoriesFound) == 0 {
		result.Valid = false
		result.ErrorMessage = "Memory evidence doesn't contain valid memory names: '" + evidence +
			"'. Expected format: 'memory-index, skills-pr-review-index, ...' (kebab-case names)."
	}

	return result
}

// TemplateDriftResult represents the result of template drift detection.
type TemplateDriftResult struct {
	HasDrift     bool     `json:"hasDrift"`
	DriftDetails []string `json:"driftDetails,omitempty"`
	RowCountDiff int      `json:"rowCountDiff,omitempty"`
}

// ChecklistRow represents a parsed checklist row.
type ChecklistRow struct {
	Requirement string `json:"requirement"`
	Step        string `json:"step"`
	Status      string `json:"status"`
	Evidence    string `json:"evidence"`
	RawLine     string `json:"rawLine,omitempty"`
}

// ParseChecklistTable parses a markdown checklist table into rows.
// Expected format: | Req | Step | Status | Evidence |
func ParseChecklistTable(tableLines []string) []ChecklistRow {
	var rows []ChecklistRow

	for _, line := range tableLines {
		// Skip separator rows
		if strings.Contains(line, "---") {
			continue
		}
		// Skip header row
		if strings.Contains(strings.ToLower(line), "| req |") ||
			strings.Contains(strings.ToLower(line), "|req|") {
			continue
		}

		if !strings.HasPrefix(strings.TrimSpace(line), "|") {
			continue
		}

		// Split into cells
		trimmed := strings.Trim(strings.TrimSpace(line), "|")
		parts := strings.Split(trimmed, "|")
		if len(parts) < 4 {
			continue
		}

		req := strings.TrimSpace(parts[0])
		req = strings.ReplaceAll(req, "*", "")
		req = strings.ToUpper(strings.TrimSpace(req))

		step := strings.TrimSpace(parts[1])
		status := strings.TrimSpace(parts[2])
		evidence := strings.TrimSpace(parts[3])

		rows = append(rows, ChecklistRow{
			Requirement: req,
			Step:        step,
			Status:      status,
			Evidence:    evidence,
			RawLine:     line,
		})
	}

	return rows
}

// NormalizeStep normalizes a step description for comparison.
func NormalizeStep(step string) string {
	// Remove extra whitespace and asterisks
	normalized := strings.Join(strings.Fields(step), " ")
	normalized = strings.ReplaceAll(normalized, "*", "")
	return strings.TrimSpace(normalized)
}

// DetectTemplateDrift compares session checklist against canonical protocol checklist.
func DetectTemplateDrift(sessionRows, protocolRows []ChecklistRow) TemplateDriftResult {
	result := TemplateDriftResult{
		HasDrift:     false,
		DriftDetails: []string{},
	}

	if len(sessionRows) != len(protocolRows) {
		result.HasDrift = true
		result.RowCountDiff = len(sessionRows) - len(protocolRows)
		result.DriftDetails = append(result.DriftDetails,
			"Row count mismatch: session has "+
				string(rune('0'+len(sessionRows)))+", protocol has "+
				string(rune('0'+len(protocolRows))))
		return result
	}

	for i := 0; i < len(protocolRows); i++ {
		protoKey := protocolRows[i].Requirement + "|" + NormalizeStep(protocolRows[i].Step)
		sessKey := sessionRows[i].Requirement + "|" + NormalizeStep(sessionRows[i].Step)

		if protoKey != sessKey {
			result.HasDrift = true
			result.DriftDetails = append(result.DriftDetails,
				"Row "+(string(rune('0'+i+1)))+": expected '"+protoKey+"', got '"+sessKey+"'")
		}
	}

	return result
}

// PathEscapeResult represents the result of path escape validation.
type PathEscapeResult struct {
	Valid        bool   `json:"valid"`
	ErrorMessage string `json:"errorMessage,omitempty"`
}

// ValidateSessionLogPath validates that a session log path is under the expected directory.
// This provides CWE-22 (path traversal) protection.
// Uses the default expected directory from DefaultSessionValidationConfig.
func ValidateSessionLogPath(sessionLogPath, repoRoot string) PathEscapeResult {
	return ValidateSessionLogPathWithConfig(sessionLogPath, repoRoot, DefaultSessionValidationConfig)
}

// ValidateSessionLogPathWithConfig validates that a session log path is under the expected directory
// using the provided configuration.
func ValidateSessionLogPathWithConfig(sessionLogPath, repoRoot string, config SessionValidationConfig) PathEscapeResult {
	result := PathEscapeResult{Valid: true}

	// Normalize paths
	sessionAbs, err := filepath.Abs(sessionLogPath)
	if err != nil {
		result.Valid = false
		result.ErrorMessage = "Could not resolve session log path: " + err.Error()
		return result
	}

	repoAbs, err := filepath.Abs(repoRoot)
	if err != nil {
		result.Valid = false
		result.ErrorMessage = "Could not resolve repo root path: " + err.Error()
		return result
	}

	// Expected directory from config (e.g., ".agents/sessions")
	expectedDirParts := strings.Split(config.ExpectedSessionDirectory, "/")
	expectedDir := filepath.Join(append([]string{repoAbs}, expectedDirParts...)...)

	// Ensure session path is under expected directory
	// Add separator to prevent prefix bypass (e.g., .agents/sessions-evil)
	expectedDirWithSep := expectedDir + string(filepath.Separator)
	sessionNormalized := filepath.Clean(sessionAbs)

	if !strings.HasPrefix(sessionNormalized+string(filepath.Separator), expectedDirWithSep) &&
		sessionNormalized != expectedDir {
		result.Valid = false
		result.ErrorMessage = "Session log must be under " + config.ExpectedSessionDirectory + "/: " + sessionLogPath
		return result
	}

	return result
}

// StartingCommitResult represents parsed starting commit information.
type StartingCommitResult struct {
	Found  bool   `json:"found"`
	SHA    string `json:"sha,omitempty"`
	Source string `json:"source,omitempty"`
}

// ExtractStartingCommit extracts the starting commit SHA from session log content.
// Uses the default commit SHA pattern from DefaultSessionValidationConfig.
func ExtractStartingCommit(content string) StartingCommitResult {
	return ExtractStartingCommitWithConfig(content, DefaultSessionValidationConfig)
}

// ExtractStartingCommitWithConfig extracts the starting commit SHA using the provided configuration.
func ExtractStartingCommitWithConfig(content string, config SessionValidationConfig) StartingCommitResult {
	result := StartingCommitResult{Found: false}

	shaPattern := config.CommitSHAPattern

	// Pattern 1: - **Starting Commit**: `sha` or without backticks
	pattern1 := regexp.MustCompile(`(?m)^\s*-\s*\*\*Starting Commit\*\*\s*:\s*` + "`?" + `(` + shaPattern + `)` + "`?" + `\s*$`)
	if matches := pattern1.FindStringSubmatch(content); matches != nil {
		result.Found = true
		result.SHA = matches[1]
		result.Source = "bold format"
		return result
	}

	// Pattern 2: Starting Commit: sha (plain format)
	pattern2 := regexp.MustCompile(`(?m)^\s*Starting Commit\s*:\s*(` + shaPattern + `)\s*$`)
	if matches := pattern2.FindStringSubmatch(content); matches != nil {
		result.Found = true
		result.SHA = matches[1]
		result.Source = "plain format"
		return result
	}

	return result
}

// QARowValidationResult represents the result of QA row validation.
type QARowValidationResult struct {
	Valid        bool       `json:"valid"`
	IsSkipped    bool       `json:"isSkipped"`
	SkipType     QASkipType `json:"skipType,omitempty"`
	QAReportPath string     `json:"qaReportPath,omitempty"`
	ErrorMessage string     `json:"errorMessage,omitempty"`
}

// ValidateQARow validates the QA checklist row based on session type.
func ValidateQARow(row ChecklistRow, qaSkipEligibility QASkipResult) QARowValidationResult {
	result := QARowValidationResult{Valid: true}

	// Check if row is marked complete
	isComplete := strings.Contains(row.Status, "[x]") || strings.Contains(row.Status, "[X]")

	// Check if evidence claims investigation-only skip
	claimsInvestigationOnly := regexp.MustCompile(`(?i)SKIPPED:\s*investigation-only`).
		MatchString(row.Evidence)

	// Check if evidence claims docs-only skip
	claimsDocsOnly := regexp.MustCompile(`(?i)SKIPPED:\s*docs-only`).
		MatchString(row.Evidence)

	if claimsInvestigationOnly {
		if !isComplete {
			result.Valid = false
			result.ErrorMessage = "Investigation-only session: QA may be skipped, but you MUST mark the QA row complete."
			return result
		}

		if !qaSkipEligibility.Eligible || qaSkipEligibility.SkipType != QASkipInvestigationOnly {
			result.Valid = false
			result.ErrorMessage = "Investigation-only QA skip claimed but staged files include implementation: " +
				strings.Join(qaSkipEligibility.ImplementationFiles, ", ")
			return result
		}

		result.IsSkipped = true
		result.SkipType = QASkipInvestigationOnly
		return result
	}

	if claimsDocsOnly {
		if !isComplete {
			result.Valid = false
			result.ErrorMessage = "Docs-only session: QA may be skipped, but you MUST mark the QA row complete."
			return result
		}

		if !qaSkipEligibility.Eligible {
			result.Valid = false
			result.ErrorMessage = "Docs-only QA skip claimed but session contains non-doc changes."
			return result
		}

		result.IsSkipped = true
		result.SkipType = QASkipDocsOnly
		return result
	}

	// No skip claimed - QA is required
	if !qaSkipEligibility.Eligible {
		if !isComplete {
			result.Valid = false
			result.ErrorMessage = "QA is required (non-doc changes detected). Check the QA row and include QA report path in Evidence."
			return result
		}

		// Check for QA report path in evidence
		qaPathPattern := regexp.MustCompile(`\.agents/qa/[^\s\)\]]+\.md`)
		if !qaPathPattern.MatchString(row.Evidence) {
			result.Valid = false
			result.ErrorMessage = "QA row checked but Evidence missing QA report path under .agents/qa/."
			return result
		}

		matches := qaPathPattern.FindString(row.Evidence)
		result.QAReportPath = matches
	} else {
		// QA skip eligible but not claimed - require explicit skip
		if qaSkipEligibility.SkipType == QASkipDocsOnly {
			if !isComplete {
				result.Valid = false
				result.ErrorMessage = "Docs-only session: QA may be skipped, but you MUST mark the QA row complete and set Evidence to 'SKIPPED: docs-only'."
				return result
			}
			if !claimsDocsOnly {
				result.Valid = false
				result.ErrorMessage = "Docs-only QA skip must be explicit. Evidence should include 'SKIPPED: docs-only'."
				return result
			}
		}
	}

	return result
}

// CommitEvidenceResult represents the result of commit SHA evidence validation.
type CommitEvidenceResult struct {
	Valid   bool   `json:"valid"`
	SHA     string `json:"sha,omitempty"`
	Message string `json:"message,omitempty"`
}

// ValidateCommitSHAEvidence validates the commit SHA in the evidence column.
// Uses the default commit SHA pattern from DefaultSessionValidationConfig.
func ValidateCommitSHAEvidence(evidence string) CommitEvidenceResult {
	return ValidateCommitSHAEvidenceWithConfig(evidence, DefaultSessionValidationConfig)
}

// ValidateCommitSHAEvidenceWithConfig validates commit SHA evidence using the provided configuration.
func ValidateCommitSHAEvidenceWithConfig(evidence string, config SessionValidationConfig) CommitEvidenceResult {
	result := CommitEvidenceResult{Valid: false}

	// Pattern: Commit SHA: `sha` or Commit SHA: sha
	shaPattern := config.CommitSHAPattern
	pattern := regexp.MustCompile(`(?i)Commit\s+SHA:\s*` + "`?" + `(` + shaPattern + `)` + "`?")
	matches := pattern.FindStringSubmatch(evidence)

	if matches != nil && len(matches) > 1 {
		result.Valid = true
		result.SHA = matches[1]
		result.Message = "Commit SHA found: " + matches[1]
		return result
	}

	result.Message = "Commit row checked but Evidence missing 'Commit SHA: <sha>'."
	return result
}
