package tests

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/validation"
)

// Tests for ValidateNamingConvention

func TestValidateNamingConvention_Epic(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid epic", "EPIC-001-user-authentication.md", true},
		{"valid epic with dashes", "EPIC-123-multi-word-name.md", true},
		{"invalid epic lowercase", "epic-001-test.md", false},
		{"invalid epic no number", "EPIC-test.md", false},
		{"invalid epic wrong padding", "EPIC-1-test.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "epic")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'epic') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_ADR(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid adr", "ADR-001-database-selection.md", true},
		{"valid adr higher number", "ADR-999-something.md", true},
		{"invalid adr lowercase", "adr-001-test.md", false},
		{"invalid adr no number", "ADR-test.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "adr")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'adr') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_PRD(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid prd", "prd-user-authentication.md", true},
		{"valid prd simple", "prd-auth.md", true},
		{"invalid prd uppercase", "PRD-auth.md", false},
		{"invalid prd no prefix", "user-authentication-prd.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "prd")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'prd') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_Tasks(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid tasks", "tasks-user-authentication.md", true},
		{"valid tasks simple", "tasks-auth.md", true},
		{"invalid tasks uppercase", "TASKS-auth.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "tasks")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'tasks') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_Plan(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid numbered plan", "001-authentication-plan.md", true},
		{"valid implementation plan", "implementation-plan-auth.md", true},
		{"valid plan prefix", "plan-oauth.md", true},
		{"invalid plan no number", "authentication-plan.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "plan")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'plan') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_ThreatModel(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid tm", "TM-001-authentication-flow.md", true},
		{"valid tm higher", "TM-042-oauth.md", true},
		{"invalid tm lowercase", "tm-001-auth.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "tm")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'tm') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_REQ(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid req", "REQ-001-user-login.md", true},
		{"invalid req lowercase", "req-001-test.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "req")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'req') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_Session(t *testing.T) {
	tests := []struct {
		name     string
		filename string
		expected bool
	}{
		{"valid session", "2024-01-01-session-01.md", true},
		{"valid session higher", "2024-12-31-session-99.md", true},
		{"invalid session format", "session-2024-01-01.md", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validation.ValidateNamingConvention(tt.filename, "session")
			if result != tt.expected {
				t.Errorf("ValidateNamingConvention(%q, 'session') = %v, expected %v", tt.filename, result, tt.expected)
			}
		})
	}
}

func TestValidateNamingConvention_UnknownPattern(t *testing.T) {
	// Unknown patterns should return true (skip validation)
	result := validation.ValidateNamingConvention("any-file.md", "unknown-pattern")
	if !result {
		t.Error("Expected unknown pattern to return true")
	}
}

// Tests for GetAllFeatures

func TestGetAllFeatures(t *testing.T) {
	tmpDir := t.TempDir()
	planningDir := filepath.Join(tmpDir, ".agents", "planning")
	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}

	// Create test PRD files
	prdFiles := []string{
		"prd-user-auth.md",
		"prd-payment.md",
	}
	for _, f := range prdFiles {
		if err := os.WriteFile(filepath.Join(planningDir, f), []byte("# PRD"), 0644); err != nil {
			t.Fatalf("Failed to create file: %v", err)
		}
	}

	// Create a tasks file that doesn't have a PRD
	if err := os.WriteFile(filepath.Join(planningDir, "tasks-orphan.md"), []byte("# Tasks"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	features := validation.GetAllFeatures(tmpDir)

	if len(features) != 3 {
		t.Errorf("Expected 3 features, got %d: %v", len(features), features)
	}

	// Check features are found
	expected := map[string]bool{"user-auth": true, "payment": true, "orphan": true}
	for _, f := range features {
		if !expected[f] {
			t.Errorf("Unexpected feature: %s", f)
		}
	}
}

func TestGetAllFeatures_NoPlanningDir(t *testing.T) {
	tmpDir := t.TempDir()
	// Don't create .agents/planning

	features := validation.GetAllFeatures(tmpDir)

	if len(features) != 0 {
		t.Errorf("Expected 0 features, got %d", len(features))
	}
}

// Tests for FindFeatureArtifacts

func TestFindFeatureArtifacts(t *testing.T) {
	tmpDir := t.TempDir()
	planningDir := filepath.Join(tmpDir, ".agents", "planning")
	roadmapDir := filepath.Join(tmpDir, ".agents", "roadmap")

	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}
	if err := os.MkdirAll(roadmapDir, 0755); err != nil {
		t.Fatalf("Failed to create roadmap dir: %v", err)
	}

	// Create artifacts
	files := map[string]string{
		filepath.Join(roadmapDir, "EPIC-001-auth.md"):        "# Epic",
		filepath.Join(planningDir, "prd-auth.md"):           "# PRD",
		filepath.Join(planningDir, "tasks-auth.md"):         "# Tasks",
		filepath.Join(planningDir, "001-auth-plan.md"):      "# Plan",
	}
	for path, content := range files {
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", path, err)
		}
	}

	artifacts := validation.FindFeatureArtifacts("auth", tmpDir)

	if artifacts.Epic == "" {
		t.Error("Expected Epic to be found")
	}
	if artifacts.PRD == "" {
		t.Error("Expected PRD to be found")
	}
	if artifacts.Tasks == "" {
		t.Error("Expected Tasks to be found")
	}
	if artifacts.Plan == "" {
		t.Error("Expected Plan to be found")
	}
}

func TestFindFeatureArtifacts_PartialMatch(t *testing.T) {
	tmpDir := t.TempDir()
	planningDir := filepath.Join(tmpDir, ".agents", "planning")

	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}

	// Create only PRD
	if err := os.WriteFile(filepath.Join(planningDir, "prd-auth.md"), []byte("# PRD"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	artifacts := validation.FindFeatureArtifacts("auth", tmpDir)

	if artifacts.PRD == "" {
		t.Error("Expected PRD to be found")
	}
	if artifacts.Tasks != "" {
		t.Error("Expected Tasks to be empty")
	}
}

// Tests for ValidateScopeAlignment

func TestValidateScopeAlignment_NoEpic(t *testing.T) {
	result := validation.ValidateScopeAlignment("", "/path/to/prd.md")

	// No epic is not a failure, just noted
	if !result.Passed {
		t.Error("Expected validation to pass when epic is missing")
	}
	if len(result.Issues) != 1 || result.Issues[0] != "Epic file not found" {
		t.Errorf("Expected 'Epic file not found' issue, got %v", result.Issues)
	}
}

func TestValidateScopeAlignment_NoPRD(t *testing.T) {
	tmpDir := t.TempDir()
	epicPath := filepath.Join(tmpDir, "EPIC-001-test.md")
	if err := os.WriteFile(epicPath, []byte("# Epic"), 0644); err != nil {
		t.Fatalf("Failed to create epic: %v", err)
	}

	result := validation.ValidateScopeAlignment(epicPath, "")

	if result.Passed {
		t.Error("Expected validation to fail when PRD is missing")
	}
	if len(result.Issues) == 0 {
		t.Error("Expected issues when PRD is missing")
	}
}

func TestValidateScopeAlignment_PRDReferencesEpic(t *testing.T) {
	tmpDir := t.TempDir()
	epicPath := filepath.Join(tmpDir, "EPIC-001-test.md")
	prdPath := filepath.Join(tmpDir, "prd-test.md")

	epicContent := `# EPIC-001-test

### Success Criteria

- [ ] Users can log in
- [ ] Users can log out
`
	prdContent := `# PRD: Test Feature

References: EPIC-001

## Requirements

- [ ] Implement login
- [ ] Implement logout
`
	if err := os.WriteFile(epicPath, []byte(epicContent), 0644); err != nil {
		t.Fatalf("Failed to create epic: %v", err)
	}
	if err := os.WriteFile(prdPath, []byte(prdContent), 0644); err != nil {
		t.Fatalf("Failed to create prd: %v", err)
	}

	result := validation.ValidateScopeAlignment(epicPath, prdPath)

	if !result.Passed {
		t.Errorf("Expected validation to pass, got issues: %v", result.Issues)
	}
}

func TestValidateScopeAlignment_FewerRequirementsThanCriteria(t *testing.T) {
	tmpDir := t.TempDir()
	epicPath := filepath.Join(tmpDir, "EPIC-001-test.md")
	prdPath := filepath.Join(tmpDir, "prd-test.md")

	epicContent := `# EPIC-001-test

### Success Criteria

- [ ] Users can log in
- [ ] Users can log out
- [ ] Users can reset password
`
	prdContent := `# PRD: Test Feature

References: EPIC-001

## Requirements

- [ ] Implement login
`
	if err := os.WriteFile(epicPath, []byte(epicContent), 0644); err != nil {
		t.Fatalf("Failed to create epic: %v", err)
	}
	if err := os.WriteFile(prdPath, []byte(prdContent), 0644); err != nil {
		t.Fatalf("Failed to create prd: %v", err)
	}

	result := validation.ValidateScopeAlignment(epicPath, prdPath)

	if result.Passed {
		t.Error("Expected validation to fail when PRD has fewer requirements")
	}

	foundIssue := false
	for _, issue := range result.Issues {
		if issue == "PRD has fewer requirements (1) than Epic success criteria (3)" {
			foundIssue = true
			break
		}
	}
	if !foundIssue {
		t.Errorf("Expected specific issue about fewer requirements, got: %v", result.Issues)
	}
}

// Tests for ValidateRequirementCoverage

func TestValidateRequirementCoverage_NoPRD(t *testing.T) {
	result := validation.ValidateRequirementCoverage("", "/path/to/tasks.md")

	// No PRD means skip validation
	if !result.Passed {
		t.Error("Expected validation to pass when PRD is missing")
	}
}

func TestValidateRequirementCoverage_NoTasks(t *testing.T) {
	tmpDir := t.TempDir()
	prdPath := filepath.Join(tmpDir, "prd-test.md")
	if err := os.WriteFile(prdPath, []byte("# PRD"), 0644); err != nil {
		t.Fatalf("Failed to create prd: %v", err)
	}

	result := validation.ValidateRequirementCoverage(prdPath, "")

	if result.Passed {
		t.Error("Expected validation to fail when tasks file is missing")
	}
}

func TestValidateRequirementCoverage_SufficientTasks(t *testing.T) {
	tmpDir := t.TempDir()
	prdPath := filepath.Join(tmpDir, "prd-test.md")
	tasksPath := filepath.Join(tmpDir, "tasks-test.md")

	prdContent := `# PRD

## Requirements

- [ ] Requirement 1
- [ ] Requirement 2
`
	tasksContent := `# Tasks

### Task 1
- [ ] Implement requirement 1

### Task 2
- [ ] Implement requirement 2

### Task 3
- [ ] Extra task
`
	if err := os.WriteFile(prdPath, []byte(prdContent), 0644); err != nil {
		t.Fatalf("Failed to create prd: %v", err)
	}
	if err := os.WriteFile(tasksPath, []byte(tasksContent), 0644); err != nil {
		t.Fatalf("Failed to create tasks: %v", err)
	}

	result := validation.ValidateRequirementCoverage(prdPath, tasksPath)

	if !result.Passed {
		t.Errorf("Expected validation to pass, got issues: %v", result.Issues)
	}
	if result.RequirementCount != 2 {
		t.Errorf("Expected 2 requirements, got %d", result.RequirementCount)
	}
	if result.TaskCount < result.RequirementCount {
		t.Errorf("Expected tasks >= requirements, got tasks=%d, requirements=%d", result.TaskCount, result.RequirementCount)
	}
}

func TestValidateRequirementCoverage_InsufficientTasks(t *testing.T) {
	tmpDir := t.TempDir()
	prdPath := filepath.Join(tmpDir, "prd-test.md")
	tasksPath := filepath.Join(tmpDir, "tasks-test.md")

	prdContent := `# PRD

## Requirements

- [ ] Requirement 1
- [ ] Requirement 2
- [ ] Requirement 3
`
	tasksContent := `# Tasks

### Task 1
`
	if err := os.WriteFile(prdPath, []byte(prdContent), 0644); err != nil {
		t.Fatalf("Failed to create prd: %v", err)
	}
	if err := os.WriteFile(tasksPath, []byte(tasksContent), 0644); err != nil {
		t.Fatalf("Failed to create tasks: %v", err)
	}

	result := validation.ValidateRequirementCoverage(prdPath, tasksPath)

	if result.Passed {
		t.Error("Expected validation to fail when tasks < requirements")
	}
}

// Tests for ValidateNamingConventions

func TestValidateNamingConventions_AllValid(t *testing.T) {
	tmpDir := t.TempDir()

	// Create valid artifacts
	epicPath := filepath.Join(tmpDir, "EPIC-001-auth.md")
	prdPath := filepath.Join(tmpDir, "prd-auth.md")
	tasksPath := filepath.Join(tmpDir, "tasks-auth.md")
	planPath := filepath.Join(tmpDir, "001-auth-plan.md")

	for _, p := range []string{epicPath, prdPath, tasksPath, planPath} {
		if err := os.WriteFile(p, []byte("# Content"), 0644); err != nil {
			t.Fatalf("Failed to create file: %v", err)
		}
	}

	artifacts := validation.FeatureArtifacts{
		Epic:  epicPath,
		PRD:   prdPath,
		Tasks: tasksPath,
		Plan:  planPath,
	}

	result := validation.ValidateNamingConventions(artifacts)

	if !result.Passed {
		t.Errorf("Expected validation to pass, got issues: %v", result.Issues)
	}
}

func TestValidateNamingConventions_InvalidEpic(t *testing.T) {
	tmpDir := t.TempDir()

	// Create invalid epic name
	epicPath := filepath.Join(tmpDir, "epic-001-auth.md") // lowercase
	if err := os.WriteFile(epicPath, []byte("# Content"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	artifacts := validation.FeatureArtifacts{
		Epic: epicPath,
	}

	result := validation.ValidateNamingConventions(artifacts)

	if result.Passed {
		t.Error("Expected validation to fail for invalid epic name")
	}
	if len(result.Issues) != 1 {
		t.Errorf("Expected 1 issue, got %d: %v", len(result.Issues), result.Issues)
	}
}

// Tests for ValidateCrossReferences

func TestValidateCrossReferences_ValidLinks(t *testing.T) {
	tmpDir := t.TempDir()

	// Create files that reference each other
	file1 := filepath.Join(tmpDir, "prd-test.md")
	file2 := filepath.Join(tmpDir, "tasks-test.md")

	file1Content := `# PRD

See [tasks](tasks-test.md) for implementation details.
`
	file2Content := `# Tasks

Based on [PRD](prd-test.md).
`
	if err := os.WriteFile(file1, []byte(file1Content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}
	if err := os.WriteFile(file2, []byte(file2Content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	artifacts := validation.FeatureArtifacts{
		PRD:   file1,
		Tasks: file2,
	}

	result := validation.ValidateCrossReferences(artifacts, tmpDir)

	if !result.Passed {
		t.Errorf("Expected validation to pass, got issues: %v", result.Issues)
	}
	if len(result.References) != 2 {
		t.Errorf("Expected 2 references, got %d", len(result.References))
	}
}

func TestValidateCrossReferences_BrokenLink(t *testing.T) {
	tmpDir := t.TempDir()

	file1 := filepath.Join(tmpDir, "prd-test.md")
	file1Content := `# PRD

See [nonexistent](nonexistent.md) for more info.
`
	if err := os.WriteFile(file1, []byte(file1Content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	artifacts := validation.FeatureArtifacts{
		PRD: file1,
	}

	result := validation.ValidateCrossReferences(artifacts, tmpDir)

	if result.Passed {
		t.Error("Expected validation to fail for broken link")
	}
	if len(result.Issues) != 1 {
		t.Errorf("Expected 1 issue, got %d: %v", len(result.Issues), result.Issues)
	}
}

func TestValidateCrossReferences_SkipsURLs(t *testing.T) {
	tmpDir := t.TempDir()

	file1 := filepath.Join(tmpDir, "prd-test.md")
	file1Content := `# PRD

See [docs](https://example.com/docs) for more info.
See [section](#section-name) below.
`
	if err := os.WriteFile(file1, []byte(file1Content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	artifacts := validation.FeatureArtifacts{
		PRD: file1,
	}

	result := validation.ValidateCrossReferences(artifacts, tmpDir)

	if !result.Passed {
		t.Errorf("Expected validation to pass (URLs and anchors skipped), got issues: %v", result.Issues)
	}
}

// Tests for ValidateTaskCompletion

func TestValidateTaskCompletion_AllComplete(t *testing.T) {
	tmpDir := t.TempDir()
	tasksPath := filepath.Join(tmpDir, "tasks-test.md")

	content := `# Tasks

## P0 Tasks

- [x] Critical task 1
- [x] Critical task 2

## P1 Tasks

- [x] Important task
- [ ] Nice to have
`
	if err := os.WriteFile(tasksPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	result := validation.ValidateTaskCompletion(tasksPath)

	if !result.Passed {
		t.Errorf("Expected validation to pass, got issues: %v", result.Issues)
	}
	if result.Total != 4 {
		t.Errorf("Expected 4 total tasks, got %d", result.Total)
	}
	if result.Completed != 3 {
		t.Errorf("Expected 3 completed tasks, got %d", result.Completed)
	}
}

func TestValidateTaskCompletion_IncompleteP0(t *testing.T) {
	tmpDir := t.TempDir()
	tasksPath := filepath.Join(tmpDir, "tasks-test.md")

	content := `# Tasks

## P0 Tasks

- [x] Critical task 1
- [ ] Critical task 2 incomplete

## P1 Tasks

- [ ] Important task
`
	if err := os.WriteFile(tasksPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	result := validation.ValidateTaskCompletion(tasksPath)

	if result.Passed {
		t.Error("Expected validation to fail for incomplete P0 tasks")
	}
	if len(result.P0Incomplete) != 1 {
		t.Errorf("Expected 1 incomplete P0 task, got %d", len(result.P0Incomplete))
	}
	if len(result.P1Incomplete) != 1 {
		t.Errorf("Expected 1 incomplete P1 task, got %d", len(result.P1Incomplete))
	}
}

func TestValidateTaskCompletion_NoTasksFile(t *testing.T) {
	result := validation.ValidateTaskCompletion("")

	if !result.Passed {
		t.Error("Expected validation to pass when no tasks file")
	}
}

// Tests for ValidateConsistency (integration)

func TestValidateConsistency_FullFeature(t *testing.T) {
	tmpDir := t.TempDir()
	planningDir := filepath.Join(tmpDir, ".agents", "planning")
	roadmapDir := filepath.Join(tmpDir, ".agents", "roadmap")

	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}
	if err := os.MkdirAll(roadmapDir, 0755); err != nil {
		t.Fatalf("Failed to create roadmap dir: %v", err)
	}

	// Create full set of artifacts
	epicContent := `# EPIC-001-auth

### Success Criteria

- [ ] Users can log in
`
	prdContent := `# PRD: Auth

References: EPIC-001

## Requirements

- [ ] Implement login
`
	tasksContent := `# Tasks

## P0 Tasks

- [x] Implement login

## P1 Tasks

- [ ] Add tests
`
	planContent := `# Plan

See [PRD](prd-auth.md) for requirements.
`
	files := map[string]string{
		filepath.Join(roadmapDir, "EPIC-001-auth.md"): epicContent,
		filepath.Join(planningDir, "prd-auth.md"):    prdContent,
		filepath.Join(planningDir, "tasks-auth.md"):  tasksContent,
		filepath.Join(planningDir, "001-auth-plan.md"): planContent,
	}
	for path, content := range files {
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", path, err)
		}
	}

	result := validation.ValidateConsistency(tmpDir, "auth", 1)

	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}
}

func TestValidateConsistency_Checkpoint2(t *testing.T) {
	tmpDir := t.TempDir()
	planningDir := filepath.Join(tmpDir, ".agents", "planning")

	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}

	prdContent := `# PRD: Auth

## Requirements

- [ ] Implement login
`
	tasksContent := `# Tasks

## P0 Tasks

- [ ] INCOMPLETE P0 TASK

## P1 Tasks

- [ ] Some P1 task
`
	files := map[string]string{
		filepath.Join(planningDir, "prd-auth.md"):   prdContent,
		filepath.Join(planningDir, "tasks-auth.md"): tasksContent,
	}
	for path, content := range files {
		if err := os.WriteFile(path, []byte(content), 0644); err != nil {
			t.Fatalf("Failed to create file %s: %v", path, err)
		}
	}

	// Checkpoint 2 should fail due to incomplete P0 tasks
	result := validation.ValidateConsistency(tmpDir, "auth", 2)

	if result.Valid {
		t.Error("Expected validation to fail at checkpoint 2 with incomplete P0 tasks")
	}

	foundTaskCheck := false
	for _, check := range result.Checks {
		if check.Name == "task_completion" && !check.Passed {
			foundTaskCheck = true
			break
		}
	}
	if !foundTaskCheck {
		t.Error("Expected task_completion check to fail")
	}
}

// Tests for ValidateArtifactNaming

func TestValidateArtifactNaming(t *testing.T) {
	tests := []struct {
		path         string
		expectValid  bool
		expectType   string
	}{
		{"EPIC-001-auth.md", true, "epic"},
		{"ADR-001-database.md", true, "adr"},
		{"prd-auth.md", true, "prd"},
		{"tasks-auth.md", true, "tasks"},
		{"001-auth-plan.md", true, "plan"},
		{"TM-001-auth-flow.md", true, "tm"},
		{"REQ-001-user-login.md", true, "req"},
		{"2024-01-01-session-01.md", true, "session"},
		{"random-file.md", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			valid, patternType := validation.ValidateArtifactNaming(tt.path)
			if valid != tt.expectValid {
				t.Errorf("ValidateArtifactNaming(%q) valid = %v, expected %v", tt.path, valid, tt.expectValid)
			}
			if patternType != tt.expectType {
				t.Errorf("ValidateArtifactNaming(%q) type = %q, expected %q", tt.path, patternType, tt.expectType)
			}
		})
	}
}

// Tests for ValidateConsistencyFromContent

func TestValidateConsistencyFromContent_Checkpoint1(t *testing.T) {
	epicContent := `# EPIC-001-auth

### Success Criteria

- [ ] Users can log in
`
	prdContent := `# PRD: Auth

References: EPIC-001

## Requirements

- [ ] Implement login
`
	tasksContent := `# Tasks

### Task 1
- [ ] Implement login
`
	planContent := `# Plan`

	result := validation.ValidateConsistencyFromContent(epicContent, prdContent, tasksContent, planContent, "auth", 1)

	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}
}

func TestValidateConsistencyFromContent_FewerRequirements(t *testing.T) {
	epicContent := `# EPIC-001-auth

### Success Criteria

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3
`
	prdContent := `# PRD: Auth

References: EPIC-001

## Requirements

- [ ] Only one requirement
`
	tasksContent := `# Tasks

### Task 1
`
	planContent := `# Plan`

	result := validation.ValidateConsistencyFromContent(epicContent, prdContent, tasksContent, planContent, "auth", 1)

	if result.Valid {
		t.Error("Expected validation to fail due to fewer requirements than criteria")
	}
}

// Tests for ValidateAllFeatures

func TestValidateAllFeatures(t *testing.T) {
	tmpDir := t.TempDir()
	planningDir := filepath.Join(tmpDir, ".agents", "planning")

	if err := os.MkdirAll(planningDir, 0755); err != nil {
		t.Fatalf("Failed to create planning dir: %v", err)
	}

	// Create two features
	features := []string{"auth", "payment"}
	for _, f := range features {
		prdPath := filepath.Join(planningDir, "prd-"+f+".md")
		tasksPath := filepath.Join(planningDir, "tasks-"+f+".md")

		prdContent := "# PRD\n\n## Requirements\n\n- [ ] Req 1\n"
		tasksContent := "# Tasks\n\n### Task 1\n"

		if err := os.WriteFile(prdPath, []byte(prdContent), 0644); err != nil {
			t.Fatalf("Failed to create file: %v", err)
		}
		if err := os.WriteFile(tasksPath, []byte(tasksContent), 0644); err != nil {
			t.Fatalf("Failed to create file: %v", err)
		}
	}

	results := validation.ValidateAllFeatures(tmpDir, 1)

	if len(results) != 2 {
		t.Errorf("Expected 2 validation results, got %d", len(results))
	}
}
