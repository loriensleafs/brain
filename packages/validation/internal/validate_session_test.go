package internal_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for ValidateSession (original functionality)

// Tests for ValidateStopReadiness

func TestValidateStopReadiness_NilState(t *testing.T) {
	result := internal.ValidateStopReadiness(nil)

	// Must ALWAYS return Valid: true (never block)
	if !result.Valid {
		t.Error("Expected ValidateStopReadiness to ALWAYS return Valid=true, even with nil state")
	}

	if result.Message != "Session can be paused safely" {
		t.Errorf("Expected 'Session can be paused safely', got '%s'", result.Message)
	}

	// Should have state_available check that fails
	var stateCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "state_available" {
			stateCheck = &result.Checks[i]
			break
		}
	}
	if stateCheck == nil {
		t.Error("Expected state_available check to be present")
	} else if stateCheck.Passed {
		t.Error("Expected state_available check to fail for nil state")
	}
}

func TestValidateStopReadiness_ValidState(t *testing.T) {
	state := &internal.WorkflowState{
		Mode: "analysis",
	}

	result := internal.ValidateStopReadiness(state)

	// Must ALWAYS return Valid: true
	if !result.Valid {
		t.Error("Expected ValidateStopReadiness to ALWAYS return Valid=true")
	}

	// Check state_available passed
	var stateCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "state_available" {
			stateCheck = &result.Checks[i]
			break
		}
	}
	if stateCheck == nil {
		t.Error("Expected state_available check to be present")
	} else if !stateCheck.Passed {
		t.Error("Expected state_available check to pass for valid state")
	}

	// Message should include mode
	if stateCheck != nil && stateCheck.Message != "Workflow state available: mode=analysis" {
		t.Errorf("Expected message with mode, got '%s'", stateCheck.Message)
	}
}

func TestValidateStopReadiness_AnalysisModeNoUpdatedAt_StillValid(t *testing.T) {
	// This is the key test: ValidateSession would FAIL this scenario,
	// but ValidateStopReadiness must ALWAYS return Valid=true
	state := &internal.WorkflowState{
		Mode: "analysis",
		// No UpdatedAt - this would fail ValidateSession
	}

	result := internal.ValidateStopReadiness(state)

	// Critical assertion: stop readiness must NEVER block
	if !result.Valid {
		t.Error("ValidateStopReadiness must NEVER block - should return Valid=true even for analysis mode without UpdatedAt")
	}
}

func TestValidateStopReadiness_PlanningModeNoUpdatedAt_StillValid(t *testing.T) {
	// Another key test: planning mode without UpdatedAt fails ValidateSession
	state := &internal.WorkflowState{
		Mode: "planning",
		// No UpdatedAt
	}

	result := internal.ValidateStopReadiness(state)

	// Critical assertion: stop readiness must NEVER block
	if !result.Valid {
		t.Error("ValidateStopReadiness must NEVER block - should return Valid=true even for planning mode without UpdatedAt")
	}
}

func TestValidateStopReadiness_NoBlockingOpsCheck(t *testing.T) {
	state := &internal.WorkflowState{
		Mode: "implementation",
	}

	result := internal.ValidateStopReadiness(state)

	// Should have no_blocking_ops check that passes
	var blockCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "no_blocking_ops" {
			blockCheck = &result.Checks[i]
			break
		}
	}
	if blockCheck == nil {
		t.Error("Expected no_blocking_ops check to be present")
	} else if !blockCheck.Passed {
		t.Error("Expected no_blocking_ops check to pass")
	}
}

func TestValidateStopReadiness_EmptyMode(t *testing.T) {
	state := &internal.WorkflowState{
		Mode: "",
	}

	result := internal.ValidateStopReadiness(state)

	if !result.Valid {
		t.Error("Expected Valid=true even with empty mode")
	}

	// Message should not include mode if empty
	var stateCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "state_available" {
			stateCheck = &result.Checks[i]
			break
		}
	}
	if stateCheck != nil && stateCheck.Message != "Workflow state available" {
		t.Errorf("Expected 'Workflow state available' for empty mode, got '%s'", stateCheck.Message)
	}
}

// Tests for ValidateSession (original functionality)

func TestValidateSession_NilState(t *testing.T) {
	result := internal.ValidateSession(nil)

	if !result.Valid {
		t.Error("Expected validation to pass with nil state")
	}

	if result.Message != "Session ready to end" {
		t.Errorf("Expected 'Session ready to end', got '%s'", result.Message)
	}
}

func TestValidateSession_WithMode(t *testing.T) {
	state := &internal.WorkflowState{
		Mode:      "analysis",
		UpdatedAt: "2024-01-01T10:00:00Z",
	}

	result := internal.ValidateSession(state)

	if !result.Valid {
		t.Error("Expected validation to pass with valid state")
	}

	// Check workflow_state check passed
	var found bool
	for _, check := range result.Checks {
		if check.Name == "workflow_state" && check.Passed {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected workflow_state check to pass")
	}
}

func TestValidateSession_AnalysisModeNoActivity(t *testing.T) {
	state := &internal.WorkflowState{
		Mode: "analysis",
		// No UpdatedAt
	}

	result := internal.ValidateSession(state)

	if result.Valid {
		t.Error("Expected validation to fail for analysis mode without recent activity")
	}
}

// Tests for QA Skip Eligibility

func TestCheckQASkipEligibility_NoFiles(t *testing.T) {
	result := internal.CheckQASkipEligibility([]string{})

	if !result.Eligible {
		t.Error("Expected QA skip to be eligible for empty file list")
	}

	if result.SkipType != internal.QASkipDocsOnly {
		t.Errorf("Expected skip type 'docs-only', got '%s'", result.SkipType)
	}
}

func TestCheckQASkipEligibility_DocsOnly(t *testing.T) {
	files := []string{
		"docs/README.md",
		".agents/architecture/ADR-001.md",
		"CHANGELOG.md",
	}

	result := internal.CheckQASkipEligibility(files)

	if !result.Eligible {
		t.Error("Expected QA skip to be eligible for docs-only files")
	}

	if result.SkipType != internal.QASkipDocsOnly {
		t.Errorf("Expected skip type 'docs-only', got '%s'", result.SkipType)
	}
}

func TestCheckQASkipEligibility_InvestigationOnly(t *testing.T) {
	// Use paths that are:
	// 1. In InvestigationAllowlist but NOT in AuditArtifacts
	// 2. Have non-.md extension to avoid docs-only classification
	// .agents/retrospective/ and .agents/security/ are in InvestigationAllowlist but not AuditArtifacts
	files := []string{
		".agents/retrospective/retro.json",
		".agents/security/scan.json",
	}

	result := internal.CheckQASkipEligibility(files)

	if !result.Eligible {
		t.Error("Expected QA skip to be eligible for investigation-only files")
	}

	if result.SkipType != internal.QASkipInvestigationOnly {
		t.Errorf("Expected skip type 'investigation-only', got '%s'", result.SkipType)
	}
}

func TestCheckQASkipEligibility_ImplementationChanges(t *testing.T) {
	files := []string{
		"src/main.go",
		".agents/sessions/2024-01-01-session-01.md",
	}

	result := internal.CheckQASkipEligibility(files)

	if result.Eligible {
		t.Error("Expected QA skip to NOT be eligible for implementation changes")
	}

	if len(result.ImplementationFiles) == 0 {
		t.Error("Expected implementation files to be listed")
	}
}

func TestCheckQASkipEligibility_MixedDocsAndCode(t *testing.T) {
	files := []string{
		"docs/README.md",
		"src/app.go",
		"tests/app_test.go",
	}

	result := internal.CheckQASkipEligibility(files)

	if result.Eligible {
		t.Error("Expected QA skip to NOT be eligible for mixed docs and code")
	}
}

// Tests for IsDocsOnly

func TestIsDocsOnly_Empty(t *testing.T) {
	if !internal.IsDocsOnly([]string{}) {
		t.Error("Expected empty list to be docs-only")
	}
}

func TestIsDocsOnly_AllMarkdown(t *testing.T) {
	files := []string{"README.md", "docs/guide.md", "CHANGELOG.MD"}
	if !internal.IsDocsOnly(files) {
		t.Error("Expected all .md files to be docs-only")
	}
}

func TestIsDocsOnly_MixedExtensions(t *testing.T) {
	files := []string{"README.md", "main.go"}
	if internal.IsDocsOnly(files) {
		t.Error("Expected mixed extensions to NOT be docs-only")
	}
}

// Tests for GetImplementationFiles

func TestGetImplementationFiles_FiltersAuditArtifacts(t *testing.T) {
	files := []string{
		".agents/sessions/session.md",
		".agents/analysis/report.md",
		".serena/memories/context.md",
		"src/main.go",
		"tests/main_test.go",
	}

	result := internal.GetImplementationFiles(files)

	if len(result) != 2 {
		t.Errorf("Expected 2 implementation files, got %d", len(result))
	}

	// Verify audit artifacts are filtered out
	for _, f := range result {
		if f == ".agents/sessions/session.md" ||
			f == ".agents/analysis/report.md" ||
			f == ".serena/memories/context.md" {
			t.Errorf("Audit artifact should have been filtered: %s", f)
		}
	}
}

func TestGetImplementationFiles_Empty(t *testing.T) {
	result := internal.GetImplementationFiles([]string{})
	if len(result) != 0 {
		t.Error("Expected empty result for empty input")
	}
}

// Tests for Memory Evidence Validation

func TestValidateMemoryEvidence_ValidEvidence(t *testing.T) {
	tests := []struct {
		name     string
		evidence string
		expected []string
	}{
		{
			name:     "Single memory",
			evidence: "memory-index loaded",
			expected: []string{"memory-index"},
		},
		{
			name:     "Multiple memories",
			evidence: "memory-index, skills-pr-review-index, session-context",
			expected: []string{"memory-index", "skills-pr-review-index", "session-context"},
		},
		{
			name:     "Complex evidence",
			evidence: "Read memory-index and skills-build-001 from Brain MCP",
			expected: []string{"memory-index", "skills-build-001"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateMemoryEvidence(tt.evidence)

			if !result.Valid {
				t.Errorf("Expected valid evidence, got error: %s", result.ErrorMessage)
			}

			if len(result.MemoriesFound) != len(tt.expected) {
				t.Errorf("Expected %d memories, got %d", len(tt.expected), len(result.MemoriesFound))
			}
		})
	}
}

func TestValidateMemoryEvidence_InvalidEvidence(t *testing.T) {
	tests := []struct {
		name     string
		evidence string
	}{
		{
			name:     "Empty",
			evidence: "",
		},
		{
			name:     "Whitespace only",
			evidence: "   ",
		},
		{
			name:     "Placeholder text",
			evidence: "List memories loaded",
		},
		{
			name:     "Bracketed placeholder",
			evidence: "[memories]",
		},
		{
			name:     "Dashes only",
			evidence: "---",
		},
		{
			name:     "No kebab-case names",
			evidence: "Done",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateMemoryEvidence(tt.evidence)

			if result.Valid {
				t.Errorf("Expected invalid evidence for '%s'", tt.evidence)
			}

			if result.ErrorMessage == "" {
				t.Error("Expected error message for invalid evidence")
			}
		})
	}
}

// Tests for Template Drift Detection

func TestParseChecklistTable(t *testing.T) {
	tableLines := []string{
		"| Req | Step | Status | Evidence |",
		"|-----|------|--------|----------|",
		"| MUST | Initialize Brain | [x] | Done |",
		"| SHOULD | Import notes | [ ] | Pending |",
		"| **MUST** | Verify branch | [X] | main |",
	}

	rows := internal.ParseChecklistTable(tableLines)

	if len(rows) != 3 {
		t.Errorf("Expected 3 rows, got %d", len(rows))
	}

	// Check first row
	if rows[0].Requirement != "MUST" {
		t.Errorf("Expected MUST, got %s", rows[0].Requirement)
	}
	if rows[0].Step != "Initialize Brain" {
		t.Errorf("Expected 'Initialize Brain', got '%s'", rows[0].Step)
	}
	if rows[0].Status != "[x]" {
		t.Errorf("Expected '[x]', got '%s'", rows[0].Status)
	}
}

func TestDetectTemplateDrift_NoDrift(t *testing.T) {
	protocolRows := []internal.ChecklistRow{
		{Requirement: "MUST", Step: "Initialize Brain"},
		{Requirement: "MUST", Step: "Load context"},
	}

	sessionRows := []internal.ChecklistRow{
		{Requirement: "MUST", Step: "Initialize Brain"},
		{Requirement: "MUST", Step: "Load context"},
	}

	result := internal.DetectTemplateDrift(sessionRows, protocolRows)

	if result.HasDrift {
		t.Errorf("Expected no drift, got drift: %v", result.DriftDetails)
	}
}

func TestDetectTemplateDrift_RowCountMismatch(t *testing.T) {
	protocolRows := []internal.ChecklistRow{
		{Requirement: "MUST", Step: "Initialize Brain"},
		{Requirement: "MUST", Step: "Load context"},
	}

	sessionRows := []internal.ChecklistRow{
		{Requirement: "MUST", Step: "Initialize Brain"},
	}

	result := internal.DetectTemplateDrift(sessionRows, protocolRows)

	if !result.HasDrift {
		t.Error("Expected drift due to row count mismatch")
	}

	if result.RowCountDiff != -1 {
		t.Errorf("Expected row count diff of -1, got %d", result.RowCountDiff)
	}
}

func TestDetectTemplateDrift_ContentMismatch(t *testing.T) {
	protocolRows := []internal.ChecklistRow{
		{Requirement: "MUST", Step: "Initialize Brain"},
	}

	sessionRows := []internal.ChecklistRow{
		{Requirement: "SHOULD", Step: "Initialize Brain"},
	}

	result := internal.DetectTemplateDrift(sessionRows, protocolRows)

	if !result.HasDrift {
		t.Error("Expected drift due to requirement level mismatch")
	}
}

func TestNormalizeStep(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Initialize Brain", "Initialize Brain"},
		{"**Initialize** Brain", "Initialize Brain"},
		{"  Extra   spaces  ", "Extra spaces"},
		{"No change", "No change"},
	}

	for _, tt := range tests {
		result := internal.NormalizeStep(tt.input)
		if result != tt.expected {
			t.Errorf("NormalizeStep(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

// Tests for Path Escape Validation

func TestValidateSessionLogPath_Valid(t *testing.T) {
	tmpDir := t.TempDir()
	sessionsDir := filepath.Join(tmpDir, ".agents", "sessions")
	if err := os.MkdirAll(sessionsDir, 0755); err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}

	sessionPath := filepath.Join(sessionsDir, "2024-01-01-session-01.md")
	if err := os.WriteFile(sessionPath, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSessionLogPath(sessionPath, tmpDir)

	if !result.Valid {
		t.Errorf("Expected valid path, got error: %s", result.ErrorMessage)
	}
}

func TestValidateSessionLogPath_PathTraversal(t *testing.T) {
	tmpDir := t.TempDir()

	// Try path traversal
	sessionPath := filepath.Join(tmpDir, ".agents", "sessions", "..", "..", "evil.md")

	result := internal.ValidateSessionLogPath(sessionPath, tmpDir)

	if result.Valid {
		t.Error("Expected path traversal to be rejected")
	}
}

func TestValidateSessionLogPath_WrongDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	wrongDir := filepath.Join(tmpDir, ".agents", "sessions-evil")
	if err := os.MkdirAll(wrongDir, 0755); err != nil {
		t.Fatalf("Failed to create test directory: %v", err)
	}

	sessionPath := filepath.Join(wrongDir, "2024-01-01-session-01.md")
	if err := os.WriteFile(sessionPath, []byte("test"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSessionLogPath(sessionPath, tmpDir)

	if result.Valid {
		t.Error("Expected wrong directory to be rejected")
	}
}

// Tests for Starting Commit Extraction

func TestExtractStartingCommit_BoldFormat(t *testing.T) {
	content := `# Session Log

- **Date**: 2024-01-01
- **Starting Commit**: ` + "`abc1234`" + `
- **Branch**: main
`

	result := internal.ExtractStartingCommit(content)

	if !result.Found {
		t.Error("Expected starting commit to be found")
	}

	if result.SHA != "abc1234" {
		t.Errorf("Expected SHA 'abc1234', got '%s'", result.SHA)
	}

	if result.Source != "bold format" {
		t.Errorf("Expected source 'bold format', got '%s'", result.Source)
	}
}

func TestExtractStartingCommit_PlainFormat(t *testing.T) {
	content := `# Session Log

Starting Commit: def5678901234567890123456789012345678901
`

	result := internal.ExtractStartingCommit(content)

	if !result.Found {
		t.Error("Expected starting commit to be found")
	}

	if result.SHA != "def5678901234567890123456789012345678901" {
		t.Errorf("Expected full SHA, got '%s'", result.SHA)
	}

	if result.Source != "plain format" {
		t.Errorf("Expected source 'plain format', got '%s'", result.Source)
	}
}

func TestExtractStartingCommit_NotFound(t *testing.T) {
	content := `# Session Log

- **Date**: 2024-01-01
- **Branch**: main
`

	result := internal.ExtractStartingCommit(content)

	if result.Found {
		t.Error("Expected starting commit to NOT be found")
	}
}

// Tests for QA Row Validation

func TestValidateQARow_SkipInvestigationOnly(t *testing.T) {
	row := internal.ChecklistRow{
		Requirement: "MUST",
		Step:        "Route to qa agent",
		Status:      "[x]",
		Evidence:    "SKIPPED: investigation-only",
	}

	eligibility := internal.QASkipResult{
		Eligible: true,
		SkipType: internal.QASkipInvestigationOnly,
	}

	result := internal.ValidateQARow(row, eligibility)

	if !result.Valid {
		t.Errorf("Expected valid QA row, got error: %s", result.ErrorMessage)
	}

	if !result.IsSkipped {
		t.Error("Expected IsSkipped to be true")
	}

	if result.SkipType != internal.QASkipInvestigationOnly {
		t.Errorf("Expected skip type 'investigation-only', got '%s'", result.SkipType)
	}
}

func TestValidateQARow_InvalidInvestigationClaim(t *testing.T) {
	row := internal.ChecklistRow{
		Requirement: "MUST",
		Step:        "Route to qa agent",
		Status:      "[x]",
		Evidence:    "SKIPPED: investigation-only",
	}

	// Not eligible for investigation skip
	eligibility := internal.QASkipResult{
		Eligible:            false,
		ImplementationFiles: []string{"src/main.go"},
	}

	result := internal.ValidateQARow(row, eligibility)

	if result.Valid {
		t.Error("Expected invalid QA row due to false investigation claim")
	}
}

func TestValidateQARow_RequiresQAReport(t *testing.T) {
	row := internal.ChecklistRow{
		Requirement: "MUST",
		Step:        "Route to qa agent",
		Status:      "[x]",
		Evidence:    ".agents/qa/test-report.md",
	}

	eligibility := internal.QASkipResult{
		Eligible: false,
	}

	result := internal.ValidateQARow(row, eligibility)

	if !result.Valid {
		t.Errorf("Expected valid QA row with report path, got error: %s", result.ErrorMessage)
	}

	if result.QAReportPath != ".agents/qa/test-report.md" {
		t.Errorf("Expected QA report path, got '%s'", result.QAReportPath)
	}
}

func TestValidateQARow_MissingQAReport(t *testing.T) {
	row := internal.ChecklistRow{
		Requirement: "MUST",
		Step:        "Route to qa agent",
		Status:      "[x]",
		Evidence:    "Done",
	}

	eligibility := internal.QASkipResult{
		Eligible: false,
	}

	result := internal.ValidateQARow(row, eligibility)

	if result.Valid {
		t.Error("Expected invalid QA row due to missing report path")
	}
}

func TestValidateQARow_SkipDocsOnly(t *testing.T) {
	row := internal.ChecklistRow{
		Requirement: "MUST",
		Step:        "Route to qa agent",
		Status:      "[x]",
		Evidence:    "SKIPPED: docs-only",
	}

	eligibility := internal.QASkipResult{
		Eligible: true,
		SkipType: internal.QASkipDocsOnly,
	}

	result := internal.ValidateQARow(row, eligibility)

	if !result.Valid {
		t.Errorf("Expected valid QA row for docs-only skip, got error: %s", result.ErrorMessage)
	}

	if result.SkipType != internal.QASkipDocsOnly {
		t.Errorf("Expected skip type 'docs-only', got '%s'", result.SkipType)
	}
}

// Tests for Commit SHA Evidence Validation

func TestValidateCommitSHAEvidence_Valid(t *testing.T) {
	tests := []struct {
		name     string
		evidence string
		expected string
	}{
		{
			name:     "Standard format",
			evidence: "Commit SHA: abc1234",
			expected: "abc1234",
		},
		{
			name:     "With backticks",
			evidence: "Commit SHA: `def5678`",
			expected: "def5678",
		},
		{
			name:     "Full SHA",
			evidence: "Commit SHA: 1234567890abcdef1234567890abcdef12345678",
			expected: "1234567890abcdef1234567890abcdef12345678",
		},
		{
			name:     "Case insensitive label",
			evidence: "commit sha: abc1234",
			expected: "abc1234",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateCommitSHAEvidence(tt.evidence)

			if !result.Valid {
				t.Errorf("Expected valid commit SHA, got error: %s", result.Message)
			}

			if result.SHA != tt.expected {
				t.Errorf("Expected SHA '%s', got '%s'", tt.expected, result.SHA)
			}
		})
	}
}

func TestValidateCommitSHAEvidence_Invalid(t *testing.T) {
	tests := []struct {
		name     string
		evidence string
	}{
		{
			name:     "Missing SHA",
			evidence: "Commit SHA:",
		},
		{
			name:     "No commit info",
			evidence: "Done",
		},
		{
			name:     "Placeholder",
			evidence: "Commit SHA: _______",
		},
		{
			name:     "Too short",
			evidence: "Commit SHA: abc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateCommitSHAEvidence(tt.evidence)

			if result.Valid {
				t.Errorf("Expected invalid commit SHA for '%s'", tt.evidence)
			}
		})
	}
}

// Tests for CheckInvestigationOnlyEligibility

func TestCheckInvestigationOnlyEligibility_AllAllowed(t *testing.T) {
	files := []string{
		".agents/sessions/session.md",
		".agents/analysis/report.md",
		".agents/retrospective/retro.md",
		".agents/security/scan.md",
	}

	result := internal.CheckInvestigationOnlyEligibility(files)

	if !result.Eligible {
		t.Error("Expected all files to be allowed for investigation-only")
	}

	if len(result.ImplementationFiles) != 0 {
		t.Errorf("Expected no implementation files, got %v", result.ImplementationFiles)
	}
}

func TestCheckInvestigationOnlyEligibility_MixedFiles(t *testing.T) {
	files := []string{
		".agents/sessions/session.md",
		"src/main.go",
	}

	result := internal.CheckInvestigationOnlyEligibility(files)

	if result.Eligible {
		t.Error("Expected mixed files to NOT be eligible for investigation-only")
	}

	if len(result.ImplementationFiles) != 1 {
		t.Errorf("Expected 1 implementation file, got %d", len(result.ImplementationFiles))
	}

	if result.ImplementationFiles[0] != "src/main.go" {
		t.Errorf("Expected 'src/main.go', got '%s'", result.ImplementationFiles[0])
	}
}

func TestCheckInvestigationOnlyEligibility_WindowsPaths(t *testing.T) {
	files := []string{
		".agents\\sessions\\session.md",
		".agents\\analysis\\report.md",
	}

	result := internal.CheckInvestigationOnlyEligibility(files)

	if !result.Eligible {
		t.Error("Expected Windows paths to be normalized and allowed")
	}
}
