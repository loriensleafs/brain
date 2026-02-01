package internal_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Helper function to create spec file with frontmatter
func createSpecFile(t *testing.T, dir, filename, content string) string {
	t.Helper()
	filePath := filepath.Join(dir, filename)
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file %s: %v", filePath, err)
	}
	return filePath
}

// Helper function to create test specs directory structure
func createSpecsStructure(t *testing.T, tmpDir string) string {
	t.Helper()
	specsDir := filepath.Join(tmpDir, "specs")
	reqDir := filepath.Join(specsDir, "requirements")
	designDir := filepath.Join(specsDir, "design")
	taskDir := filepath.Join(specsDir, "tasks")

	for _, dir := range []string{reqDir, designDir, taskDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create directory %s: %v", dir, err)
		}
	}
	return specsDir
}

// Tests for ParseYAMLFrontmatter

func TestParseYAMLFrontmatter_ValidSpec(t *testing.T) {
	tmpDir := t.TempDir()
	content := `---
type: requirement
id: REQ-001
status: draft
related:
  - DESIGN-001
  - DESIGN-002
---

# Requirement Title

Some content here.
`
	filePath := createSpecFile(t, tmpDir, "REQ-001-test.md", content)

	spec := internal.ParseYAMLFrontmatter(filePath)

	if spec == nil {
		t.Fatal("Expected spec to be parsed, got nil")
	}
	if spec.Type != "requirement" {
		t.Errorf("Expected type 'requirement', got %q", spec.Type)
	}
	if spec.ID != "REQ-001" {
		t.Errorf("Expected id 'REQ-001', got %q", spec.ID)
	}
	if spec.Status != "draft" {
		t.Errorf("Expected status 'draft', got %q", spec.Status)
	}
	if len(spec.Related) != 2 {
		t.Errorf("Expected 2 related items, got %d", len(spec.Related))
	}
	if spec.FilePath != filePath {
		t.Errorf("Expected filePath %q, got %q", filePath, spec.FilePath)
	}
}

func TestParseYAMLFrontmatter_NoFrontmatter(t *testing.T) {
	tmpDir := t.TempDir()
	content := `# Just a regular markdown file

No frontmatter here.
`
	filePath := createSpecFile(t, tmpDir, "no-frontmatter.md", content)

	spec := internal.ParseYAMLFrontmatter(filePath)

	if spec != nil {
		t.Error("Expected nil for file without frontmatter")
	}
}

func TestParseYAMLFrontmatter_EmptyRelated(t *testing.T) {
	tmpDir := t.TempDir()
	content := `---
type: task
id: TASK-001
status: pending
---

# Task Title
`
	filePath := createSpecFile(t, tmpDir, "TASK-001-test.md", content)

	spec := internal.ParseYAMLFrontmatter(filePath)

	if spec == nil {
		t.Fatal("Expected spec to be parsed, got nil")
	}
	if len(spec.Related) != 0 {
		t.Errorf("Expected 0 related items, got %d", len(spec.Related))
	}
}

func TestParseYAMLFrontmatter_NonexistentFile(t *testing.T) {
	spec := internal.ParseYAMLFrontmatter("/nonexistent/path/file.md")

	if spec != nil {
		t.Error("Expected nil for nonexistent file")
	}
}

func TestParseYAMLFrontmatter_AlphanumericIDs(t *testing.T) {
	tmpDir := t.TempDir()
	content := `---
type: design
id: DESIGN-ABC
status: approved
related:
  - REQ-001
  - REQ-ABC
---

# Design Title
`
	filePath := createSpecFile(t, tmpDir, "DESIGN-ABC-test.md", content)

	spec := internal.ParseYAMLFrontmatter(filePath)

	if spec == nil {
		t.Fatal("Expected spec to be parsed, got nil")
	}
	if len(spec.Related) != 2 {
		t.Errorf("Expected 2 related items, got %d: %v", len(spec.Related), spec.Related)
	}
}

// Tests for LoadAllSpecs

func TestLoadAllSpecs_EmptyDirectory(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	specs := internal.LoadAllSpecs(specsDir)

	if len(specs.Requirements) != 0 {
		t.Errorf("Expected 0 requirements, got %d", len(specs.Requirements))
	}
	if len(specs.Designs) != 0 {
		t.Errorf("Expected 0 designs, got %d", len(specs.Designs))
	}
	if len(specs.Tasks) != 0 {
		t.Errorf("Expected 0 tasks, got %d", len(specs.Tasks))
	}
}

func TestLoadAllSpecs_WithSpecs(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create requirement
	reqContent := `---
type: requirement
id: REQ-001
status: draft
---
# Requirement
`
	createSpecFile(t, filepath.Join(specsDir, "requirements"), "REQ-001-test.md", reqContent)

	// Create design
	designContent := `---
type: design
id: DESIGN-001
status: draft
related:
  - REQ-001
---
# Design
`
	createSpecFile(t, filepath.Join(specsDir, "design"), "DESIGN-001-test.md", designContent)

	// Create task
	taskContent := `---
type: task
id: TASK-001
status: pending
related:
  - DESIGN-001
---
# Task
`
	createSpecFile(t, filepath.Join(specsDir, "tasks"), "TASK-001-test.md", taskContent)

	specs := internal.LoadAllSpecs(specsDir)

	if len(specs.Requirements) != 1 {
		t.Errorf("Expected 1 requirement, got %d", len(specs.Requirements))
	}
	if len(specs.Designs) != 1 {
		t.Errorf("Expected 1 design, got %d", len(specs.Designs))
	}
	if len(specs.Tasks) != 1 {
		t.Errorf("Expected 1 task, got %d", len(specs.Tasks))
	}
	if len(specs.All) != 3 {
		t.Errorf("Expected 3 total specs, got %d", len(specs.All))
	}
}

func TestLoadAllSpecs_MissingDirectories(t *testing.T) {
	tmpDir := t.TempDir()
	// Only create specs directory without subdirectories
	specsDir := filepath.Join(tmpDir, "specs")
	if err := os.MkdirAll(specsDir, 0755); err != nil {
		t.Fatalf("Failed to create specs dir: %v", err)
	}

	specs := internal.LoadAllSpecs(specsDir)

	// Should not panic and return empty maps
	if len(specs.Requirements) != 0 {
		t.Errorf("Expected 0 requirements, got %d", len(specs.Requirements))
	}
	if len(specs.Designs) != 0 {
		t.Errorf("Expected 0 designs, got %d", len(specs.Designs))
	}
	if len(specs.Tasks) != 0 {
		t.Errorf("Expected 0 tasks, got %d", len(specs.Tasks))
	}
}

// Tests for TestTraceabilityRules

func TestTestTraceabilityRules_Rule1_ForwardTraceability(t *testing.T) {
	// Rule 1: Every REQ must trace to at least one DESIGN
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "draft"},
		"REQ-002": {ID: "REQ-002", Status: "draft"}, // Orphaned
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "draft", Related: []string{"REQ-001"}},
	}
	tasks := map[string]*internal.SpecFrontmatter{}

	specs := &internal.SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*internal.SpecFrontmatter),
	}

	result := internal.TestTraceabilityRules(specs)

	// REQ-002 should be orphaned (warning)
	foundOrphanedReq := false
	for _, w := range result.Warnings {
		if w.Rule == "Rule 1: Forward Traceability" && strings.Contains(w.Message, "REQ-002") {
			foundOrphanedReq = true
			break
		}
	}
	if !foundOrphanedReq {
		t.Error("Expected warning for orphaned REQ-002")
	}
}

func TestTestTraceabilityRules_Rule2_BackwardTraceability(t *testing.T) {
	// Rule 2: Every TASK must reference at least one DESIGN
	requirements := map[string]*internal.SpecFrontmatter{}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "draft"},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "pending", Related: []string{"DESIGN-001"}}, // Valid
		"TASK-002": {ID: "TASK-002", Status: "pending", Related: []string{}},             // Untraced
	}

	specs := &internal.SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*internal.SpecFrontmatter),
	}

	result := internal.TestTraceabilityRules(specs)

	// TASK-002 should have error for no DESIGN reference
	foundUntracedTask := false
	for _, e := range result.Errors {
		if e.Rule == "Rule 2: Backward Traceability" && strings.Contains(e.Message, "TASK-002") {
			foundUntracedTask = true
			break
		}
	}
	if !foundUntracedTask {
		t.Error("Expected error for untraced TASK-002")
	}
}

func TestTestTraceabilityRules_Rule3_CompleteChain(t *testing.T) {
	// Rule 3: Every DESIGN must have both REQ and TASK references
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "draft"},
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "draft", Related: []string{"REQ-001"}}, // Has REQ, needs TASK
		"DESIGN-002": {ID: "DESIGN-002", Status: "draft", Related: []string{}},          // Has neither
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "pending", Related: []string{"DESIGN-001"}},
	}

	specs := &internal.SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*internal.SpecFrontmatter),
	}

	result := internal.TestTraceabilityRules(specs)

	// DESIGN-001 should have valid chain
	if result.ValidChains != 1 {
		t.Errorf("Expected 1 valid chain, got %d", result.ValidChains)
	}

	// DESIGN-002 should have warnings for missing REQ and TASK
	foundNoReq := false
	foundNoTask := false
	for _, w := range result.Warnings {
		if w.Rule == "Rule 3: Complete Chain" && strings.Contains(w.Message, "DESIGN-002") {
			if strings.Contains(w.Message, "no REQ reference") {
				foundNoReq = true
			}
			if strings.Contains(w.Message, "no TASK referencing") {
				foundNoTask = true
			}
		}
	}
	if !foundNoReq {
		t.Error("Expected warning for DESIGN-002 missing REQ reference")
	}
	if !foundNoTask {
		t.Error("Expected warning for DESIGN-002 missing TASK reference")
	}
}

func TestTestTraceabilityRules_Rule4_ReferenceValidity(t *testing.T) {
	// Rule 4: All referenced IDs must exist
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "draft"},
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "draft", Related: []string{"REQ-999"}}, // Broken REQ ref
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "pending", Related: []string{"DESIGN-999"}}, // Broken DESIGN ref
	}

	specs := &internal.SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*internal.SpecFrontmatter),
	}

	result := internal.TestTraceabilityRules(specs)

	// Should have errors for broken references
	brokenDesignRef := false
	brokenReqRef := false
	for _, e := range result.Errors {
		if e.Rule == "Rule 4: Reference Validity" {
			if strings.Contains(e.Message, "TASK-001") && strings.Contains(e.Message, "DESIGN-999") {
				brokenDesignRef = true
			}
			if strings.Contains(e.Message, "DESIGN-001") && strings.Contains(e.Message, "REQ-999") {
				brokenReqRef = true
			}
		}
	}
	if !brokenDesignRef {
		t.Error("Expected error for broken DESIGN-999 reference from TASK-001")
	}
	if !brokenReqRef {
		t.Error("Expected error for broken REQ-999 reference from DESIGN-001")
	}
}

func TestTestTraceabilityRules_Rule5_StatusConsistency(t *testing.T) {
	// Rule 5: Status consistency check
	requirements := map[string]*internal.SpecFrontmatter{}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "draft"},    // Not complete
		"DESIGN-002": {ID: "DESIGN-002", Status: "complete"}, // Complete
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "complete", Related: []string{"DESIGN-001"}}, // Task complete, design not
		"TASK-002": {ID: "TASK-002", Status: "complete", Related: []string{"DESIGN-002"}}, // Both complete
	}

	specs := &internal.SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*internal.SpecFrontmatter),
	}

	result := internal.TestTraceabilityRules(specs)

	// Should have info for status inconsistency
	foundInconsistency := false
	for _, i := range result.Info {
		if i.Rule == "Rule 5: Status Consistency" && strings.Contains(i.Message, "TASK-001") {
			foundInconsistency = true
			break
		}
	}
	if !foundInconsistency {
		t.Error("Expected info for status inconsistency between TASK-001 and DESIGN-001")
	}
}

func TestTestTraceabilityRules_AllPassing(t *testing.T) {
	// Complete valid traceability chain
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "complete"},
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "complete", Related: []string{"REQ-001"}},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "complete", Related: []string{"DESIGN-001"}},
	}

	specs := &internal.SpecCollection{
		Requirements: requirements,
		Designs:      designs,
		Tasks:        tasks,
		All:          make(map[string]*internal.SpecFrontmatter),
	}

	result := internal.TestTraceabilityRules(specs)

	if len(result.Errors) != 0 {
		t.Errorf("Expected 0 errors, got %d: %v", len(result.Errors), result.Errors)
	}
	if len(result.Warnings) != 0 {
		t.Errorf("Expected 0 warnings, got %d: %v", len(result.Warnings), result.Warnings)
	}
	if result.ValidChains != 1 {
		t.Errorf("Expected 1 valid chain, got %d", result.ValidChains)
	}
}

// Tests for ValidateTraceability

func TestValidateTraceability_NonexistentPath(t *testing.T) {
	result := internal.ValidateTraceability("/nonexistent/path/specs", false)

	if result.Valid {
		t.Error("Expected validation to fail for nonexistent path")
	}
	if result.ExitCode != 1 {
		t.Errorf("Expected exit code 1, got %d", result.ExitCode)
	}
}

func TestValidateTraceability_EmptySpecs(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	result := internal.ValidateTraceability(specsDir, false)

	if !result.Valid {
		t.Errorf("Expected validation to pass for empty specs, got: %s", result.Message)
	}
	if result.ExitCode != 0 {
		t.Errorf("Expected exit code 0, got %d", result.ExitCode)
	}
}

func TestValidateTraceability_WithErrors(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create task with broken reference
	taskContent := `---
type: task
id: TASK-001
status: pending
related:
  - DESIGN-999
---
# Task
`
	createSpecFile(t, filepath.Join(specsDir, "tasks"), "TASK-001-test.md", taskContent)

	result := internal.ValidateTraceability(specsDir, false)

	if result.Valid {
		t.Error("Expected validation to fail with errors")
	}
	if result.ExitCode != 1 {
		t.Errorf("Expected exit code 1, got %d", result.ExitCode)
	}
	if len(result.Errors) == 0 {
		t.Error("Expected errors to be reported")
	}
}

func TestValidateTraceability_WithWarnings_NonStrict(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create orphaned requirement (triggers warning)
	reqContent := `---
type: requirement
id: REQ-001
status: draft
---
# Requirement
`
	createSpecFile(t, filepath.Join(specsDir, "requirements"), "REQ-001-test.md", reqContent)

	result := internal.ValidateTraceability(specsDir, false)

	if !result.Valid {
		t.Errorf("Expected validation to pass in non-strict mode, got: %s", result.Message)
	}
	if result.ExitCode != 0 {
		t.Errorf("Expected exit code 0 in non-strict mode, got %d", result.ExitCode)
	}
	if len(result.Warnings) == 0 {
		t.Error("Expected warnings to be reported")
	}
}

func TestValidateTraceability_WithWarnings_Strict(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create orphaned requirement (triggers warning)
	reqContent := `---
type: requirement
id: REQ-001
status: draft
---
# Requirement
`
	createSpecFile(t, filepath.Join(specsDir, "requirements"), "REQ-001-test.md", reqContent)

	result := internal.ValidateTraceability(specsDir, true)

	if result.Valid {
		t.Error("Expected validation to fail in strict mode with warnings")
	}
	if result.ExitCode != 2 {
		t.Errorf("Expected exit code 2 in strict mode with warnings, got %d", result.ExitCode)
	}
}

func TestValidateTraceability_CompleteChain(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create complete valid chain
	reqContent := `---
type: requirement
id: REQ-001
status: complete
---
# Requirement
`
	createSpecFile(t, filepath.Join(specsDir, "requirements"), "REQ-001-test.md", reqContent)

	designContent := `---
type: design
id: DESIGN-001
status: complete
related:
  - REQ-001
---
# Design
`
	createSpecFile(t, filepath.Join(specsDir, "design"), "DESIGN-001-test.md", designContent)

	taskContent := `---
type: task
id: TASK-001
status: complete
related:
  - DESIGN-001
---
# Task
`
	createSpecFile(t, filepath.Join(specsDir, "tasks"), "TASK-001-test.md", taskContent)

	result := internal.ValidateTraceability(specsDir, true)

	if !result.Valid {
		t.Errorf("Expected validation to pass for complete chain, got: %s", result.Message)
		for _, e := range result.Errors {
			t.Errorf("Error: %s", e.Message)
		}
		for _, w := range result.Warnings {
			t.Errorf("Warning: %s", w.Message)
		}
	}
	if result.ExitCode != 0 {
		t.Errorf("Expected exit code 0, got %d", result.ExitCode)
	}
	if result.Stats.ValidChains != 1 {
		t.Errorf("Expected 1 valid chain, got %d", result.Stats.ValidChains)
	}
}

// Tests for ValidateTraceabilityFromContent

func TestValidateTraceabilityFromContent_Valid(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "complete"},
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "complete", Related: []string{"REQ-001"}},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "complete", Related: []string{"DESIGN-001"}},
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, false)

	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
	}
	if result.Stats.Requirements != 1 {
		t.Errorf("Expected 1 requirement, got %d", result.Stats.Requirements)
	}
	if result.Stats.Designs != 1 {
		t.Errorf("Expected 1 design, got %d", result.Stats.Designs)
	}
	if result.Stats.Tasks != 1 {
		t.Errorf("Expected 1 task, got %d", result.Stats.Tasks)
	}
}

func TestValidateTraceabilityFromContent_WithErrors(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{}
	designs := map[string]*internal.SpecFrontmatter{}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "pending", Related: []string{"DESIGN-999"}},
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, false)

	if result.Valid {
		t.Error("Expected validation to fail with errors")
	}
	if len(result.Errors) == 0 {
		t.Error("Expected errors to be present")
	}
}

// Tests for FormatTraceabilityResults

func TestFormatTraceabilityResults_JSON(t *testing.T) {
	result := internal.TraceabilityValidationResult{
		ValidationResult: internal.ValidationResult{
			Valid:   true,
			Message: "All traceability checks passed",
		},
		Stats: internal.TraceabilityStats{
			Requirements: 1,
			Designs:      1,
			Tasks:        1,
			ValidChains:  1,
		},
		ExitCode: 0,
	}

	output := internal.FormatTraceabilityResults(result, "json")

	// Verify it's valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(output), &parsed); err != nil {
		t.Errorf("Expected valid JSON output, got error: %v", err)
	}

	// Check some fields
	if parsed["valid"] != true {
		t.Error("Expected valid field to be true in JSON")
	}
}

func TestFormatTraceabilityResults_Markdown(t *testing.T) {
	result := internal.TraceabilityValidationResult{
		ValidationResult: internal.ValidationResult{
			Valid:   false,
			Message: "Validation failed",
		},
		Stats: internal.TraceabilityStats{
			Requirements: 2,
			Designs:      1,
			Tasks:        3,
			ValidChains:  1,
		},
		Errors: []internal.TraceabilityIssue{
			{Rule: "Rule 4", Source: "TASK-001", Message: "Broken reference"},
		},
		Warnings: []internal.TraceabilityIssue{
			{Rule: "Rule 1", Source: "REQ-002", Message: "Orphaned requirement"},
		},
	}

	output := internal.FormatTraceabilityResults(result, "markdown")

	// Check for markdown elements
	if !strings.Contains(output, "# Traceability Validation Report") {
		t.Error("Expected markdown header")
	}
	if !strings.Contains(output, "| Requirements | 2 |") {
		t.Error("Expected requirements count in table")
	}
	if !strings.Contains(output, "## Errors") {
		t.Error("Expected Errors section")
	}
	if !strings.Contains(output, "## Warnings") {
		t.Error("Expected Warnings section")
	}
}

func TestFormatTraceabilityResults_Console(t *testing.T) {
	result := internal.TraceabilityValidationResult{
		ValidationResult: internal.ValidationResult{
			Valid:   true,
			Message: "All traceability checks passed",
		},
		Stats: internal.TraceabilityStats{
			Requirements: 1,
			Designs:      1,
			Tasks:        1,
			ValidChains:  1,
		},
	}

	output := internal.FormatTraceabilityResults(result, "console")

	if !strings.Contains(output, "Traceability Validation Report") {
		t.Error("Expected console header")
	}
	if !strings.Contains(output, "Requirements: 1") {
		t.Error("Expected requirements count")
	}
	if !strings.Contains(output, "All traceability checks passed!") {
		t.Error("Expected success message")
	}
}

func TestFormatTraceabilityResults_DefaultToConsole(t *testing.T) {
	result := internal.TraceabilityValidationResult{
		Stats: internal.TraceabilityStats{Requirements: 1},
	}

	output := internal.FormatTraceabilityResults(result, "unknown-format")

	// Should default to console format
	if !strings.Contains(output, "Traceability Validation Report") {
		t.Error("Expected console format for unknown format type")
	}
}

// Integration tests

func TestValidateTraceability_MultipleChains(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create multiple complete chains
	specs := []struct {
		dir      string
		filename string
		content  string
	}{
		{"requirements", "REQ-001-auth.md", `---
type: requirement
id: REQ-001
status: complete
---
# Auth Requirement
`},
		{"requirements", "REQ-002-payment.md", `---
type: requirement
id: REQ-002
status: complete
---
# Payment Requirement
`},
		{"design", "DESIGN-001-auth.md", `---
type: design
id: DESIGN-001
status: complete
related:
  - REQ-001
---
# Auth Design
`},
		{"design", "DESIGN-002-payment.md", `---
type: design
id: DESIGN-002
status: complete
related:
  - REQ-002
---
# Payment Design
`},
		{"tasks", "TASK-001-auth.md", `---
type: task
id: TASK-001
status: complete
related:
  - DESIGN-001
---
# Auth Task
`},
		{"tasks", "TASK-002-payment.md", `---
type: task
id: TASK-002
status: complete
related:
  - DESIGN-002
---
# Payment Task
`},
	}

	for _, spec := range specs {
		createSpecFile(t, filepath.Join(specsDir, spec.dir), spec.filename, spec.content)
	}

	result := internal.ValidateTraceability(specsDir, true)

	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
	}
	if result.Stats.Requirements != 2 {
		t.Errorf("Expected 2 requirements, got %d", result.Stats.Requirements)
	}
	if result.Stats.Designs != 2 {
		t.Errorf("Expected 2 designs, got %d", result.Stats.Designs)
	}
	if result.Stats.Tasks != 2 {
		t.Errorf("Expected 2 tasks, got %d", result.Stats.Tasks)
	}
	if result.Stats.ValidChains != 2 {
		t.Errorf("Expected 2 valid chains, got %d", result.Stats.ValidChains)
	}
}

func TestValidateTraceability_MixedIssues(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create specs with mixed issues
	specs := []struct {
		dir      string
		filename string
		content  string
	}{
		{"requirements", "REQ-001-auth.md", `---
type: requirement
id: REQ-001
status: complete
---
# Auth Requirement (will be orphaned - no design references it)
`},
		{"design", "DESIGN-001-payment.md", `---
type: design
id: DESIGN-001
status: draft
related:
  - REQ-999
---
# Payment Design (broken REQ reference)
`},
		{"tasks", "TASK-001-something.md", `---
type: task
id: TASK-001
status: complete
related:
  - DESIGN-001
---
# Task (references DESIGN-001, which is draft but task is complete)
`},
	}

	for _, spec := range specs {
		createSpecFile(t, filepath.Join(specsDir, spec.dir), spec.filename, spec.content)
	}

	result := internal.ValidateTraceability(specsDir, false)

	// Should have errors (broken reference)
	if len(result.Errors) == 0 {
		t.Error("Expected errors for broken reference")
	}

	// Should have warnings (orphaned REQ, design missing task)
	if len(result.Warnings) == 0 {
		t.Error("Expected warnings for orphaned requirement")
	}

	// Should have info (status inconsistency)
	if len(result.Info) == 0 {
		t.Error("Expected info for status inconsistency")
	}
}

func TestValidateTraceability_CRLFLineEndings(t *testing.T) {
	tmpDir := t.TempDir()
	specsDir := createSpecsStructure(t, tmpDir)

	// Create spec with CRLF line endings
	content := "---\r\ntype: requirement\r\nid: REQ-001\r\nstatus: draft\r\nrelated:\r\n  - DESIGN-001\r\n---\r\n\r\n# Requirement\r\n"
	createSpecFile(t, filepath.Join(specsDir, "requirements"), "REQ-001-test.md", content)

	designContent := "---\r\ntype: design\r\nid: DESIGN-001\r\nstatus: draft\r\nrelated:\r\n  - REQ-001\r\n---\r\n\r\n# Design\r\n"
	createSpecFile(t, filepath.Join(specsDir, "design"), "DESIGN-001-test.md", designContent)

	taskContent := "---\r\ntype: task\r\nid: TASK-001\r\nstatus: pending\r\nrelated:\r\n  - DESIGN-001\r\n---\r\n\r\n# Task\r\n"
	createSpecFile(t, filepath.Join(specsDir, "tasks"), "TASK-001-test.md", taskContent)

	result := internal.ValidateTraceability(specsDir, true)

	if !result.Valid {
		t.Errorf("Expected validation to pass with CRLF line endings, got: %s", result.Message)
		for _, e := range result.Errors {
			t.Errorf("Error: %s", e.Message)
		}
		for _, w := range result.Warnings {
			t.Errorf("Warning: %s", w.Message)
		}
	}
}

// Edge case tests

func TestValidateTraceability_TaskWithMultipleDesignRefs(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "complete"},
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "complete", Related: []string{"REQ-001"}},
		"DESIGN-002": {ID: "DESIGN-002", Status: "complete", Related: []string{"REQ-001"}},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "complete", Related: []string{"DESIGN-001", "DESIGN-002"}},
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, true)

	if !result.Valid {
		t.Errorf("Expected validation to pass with multiple design refs, got: %s", result.Message)
	}
	if result.Stats.ValidChains != 2 {
		t.Errorf("Expected 2 valid chains, got %d", result.Stats.ValidChains)
	}
}

func TestValidateTraceability_DesignWithMultipleReqRefs(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{
		"REQ-001": {ID: "REQ-001", Status: "complete"},
		"REQ-002": {ID: "REQ-002", Status: "complete"},
	}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "complete", Related: []string{"REQ-001", "REQ-002"}},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "complete", Related: []string{"DESIGN-001"}},
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, true)

	if !result.Valid {
		t.Errorf("Expected validation to pass with multiple req refs, got: %s", result.Message)
	}
	// Both REQs should be traced (no orphan warnings)
	for _, w := range result.Warnings {
		if strings.Contains(w.Message, "orphaned requirement") {
			t.Errorf("Unexpected orphan warning: %s", w.Message)
		}
	}
}

func TestValidateTraceability_CaseInsensitiveStatus(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "Draft"}, // Uppercase D
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "COMPLETE", Related: []string{"DESIGN-001"}}, // Uppercase
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, false)

	// Should detect status inconsistency with case-insensitive comparison
	foundInfo := false
	for _, i := range result.Info {
		if i.Rule == "Rule 5: Status Consistency" {
			foundInfo = true
			break
		}
	}
	if !foundInfo {
		t.Error("Expected status consistency info with case-insensitive comparison")
	}
}

func TestValidateTraceability_DoneStatus(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "done"},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "done", Related: []string{"DESIGN-001"}},
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, false)

	// Should not report status inconsistency since both are "done"
	for _, i := range result.Info {
		if i.Rule == "Rule 5: Status Consistency" && strings.Contains(i.Message, "TASK-001") {
			t.Errorf("Unexpected status inconsistency: %s", i.Message)
		}
	}
}

func TestValidateTraceability_ImplementedStatus(t *testing.T) {
	requirements := map[string]*internal.SpecFrontmatter{}
	designs := map[string]*internal.SpecFrontmatter{
		"DESIGN-001": {ID: "DESIGN-001", Status: "implemented"},
	}
	tasks := map[string]*internal.SpecFrontmatter{
		"TASK-001": {ID: "TASK-001", Status: "implemented", Related: []string{"DESIGN-001"}},
	}

	result := internal.ValidateTraceabilityFromContent(requirements, designs, tasks, false)

	// Should not report status inconsistency since both are "implemented"
	for _, i := range result.Info {
		if i.Rule == "Rule 5: Status Consistency" && strings.Contains(i.Message, "TASK-001") {
			t.Errorf("Unexpected status inconsistency: %s", i.Message)
		}
	}
}
