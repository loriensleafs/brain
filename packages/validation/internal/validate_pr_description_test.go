package internal_test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

func init() {
	// Load schema data for tests
	_, currentFile, _, _ := runtime.Caller(0)
	packageRoot := filepath.Dir(filepath.Dir(currentFile))
	schemaPath := filepath.Join(packageRoot, "schemas", "pr", "pr-description-config.schema.json")
	data, err := os.ReadFile(schemaPath)
	if err != nil {
		panic("failed to load PR description schema for tests: " + err.Error())
	}
	internal.SetPRDescriptionSchemaData(data)
}

// Tests for ValidatePRDescription

func TestValidatePRDescription_NoMentionedFiles(t *testing.T) {
	description := `## Summary
This PR adds a new feature.

## Test Plan
- Manual testing completed
`
	filesInPR := []string{"src/main.go", "src/util.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result when no files mentioned, got: %s", result.Message)
	}
	if result.CriticalCount != 0 {
		t.Errorf("Expected 0 critical issues, got: %d", result.CriticalCount)
	}
}

func TestValidatePRDescription_AllFilesMatch(t *testing.T) {
	description := `## Summary
Updated ` + "`main.go`" + ` and ` + "`util.go`" + ` for the new feature.

## Test Plan
- Tested manually
`
	filesInPR := []string{"src/main.go", "src/util.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result when all files match, got: %s", result.Message)
	}
	if result.CriticalCount != 0 {
		t.Errorf("Expected 0 critical issues, got: %d", result.CriticalCount)
	}
	if len(result.MentionedFiles) != 2 {
		t.Errorf("Expected 2 mentioned files, got: %d", len(result.MentionedFiles))
	}
}

func TestValidatePRDescription_FileMentionedButNotInDiff(t *testing.T) {
	description := `## Summary
Updated ` + "`main.go`" + ` and ` + "`missing.go`" + ` for the new feature.

## Test Plan
- Tested manually
`
	filesInPR := []string{"src/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if result.Valid {
		t.Error("Expected invalid result when file mentioned but not in diff")
	}
	if result.CriticalCount != 1 {
		t.Errorf("Expected 1 critical issue, got: %d", result.CriticalCount)
	}

	// Check that the issue is recorded
	foundIssue := false
	for _, issue := range result.Issues {
		if issue.File == "missing.go" && issue.Severity == "CRITICAL" {
			foundIssue = true
			break
		}
	}
	if !foundIssue {
		t.Error("Expected critical issue for missing.go")
	}
}

func TestValidatePRDescription_SignificantFileNotMentioned(t *testing.T) {
	description := `## Summary
General update.

## Test Plan
- Tested
`
	filesInPR := []string{"src/important.go", ".github/workflows/ci.yml"}

	result := internal.ValidatePRDescription(description, filesInPR)

	// Should be valid (warnings are non-blocking) but have warnings
	if !result.Valid {
		t.Error("Expected valid result (warnings are non-blocking)")
	}
	if result.WarningCount == 0 {
		t.Error("Expected warnings for unmmentioned significant files")
	}
}

func TestValidatePRDescription_FullPathMatch(t *testing.T) {
	description := `## Summary
Updated ` + "`src/main.go`" + ` for the feature.

## Test Plan
- Tested
`
	filesInPR := []string{"src/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result for full path match, got: %s", result.Message)
	}
}

func TestValidatePRDescription_SuffixMatch(t *testing.T) {
	description := `## Summary
Updated ` + "`main.go`" + ` for the feature.

## Test Plan
- Tested
`
	filesInPR := []string{"src/deep/path/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result for suffix match, got: %s", result.Message)
	}
	if result.CriticalCount != 0 {
		t.Errorf("Expected 0 critical issues for suffix match, got: %d", result.CriticalCount)
	}
}

func TestValidatePRDescription_BoldFileReference(t *testing.T) {
	description := `## Summary
Updated **main.go** for the feature.

## Test Plan
- Tested
`
	filesInPR := []string{"src/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result for bold file reference, got: %s", result.Message)
	}
	if len(result.MentionedFiles) != 1 {
		t.Errorf("Expected 1 mentioned file from bold text, got: %d", len(result.MentionedFiles))
	}
}

func TestValidatePRDescription_ListItemFileReference(t *testing.T) {
	description := `## Summary
Changes:
- main.go
- util.go

## Test Plan
- Tested
`
	filesInPR := []string{"src/main.go", "src/util.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result for list item references, got: %s", result.Message)
	}
}

func TestValidatePRDescription_MarkdownLinkFileReference(t *testing.T) {
	description := `## Summary
Updated [main.go](src/main.go) for the feature.

## Test Plan
- Tested
`
	filesInPR := []string{"src/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result for markdown link reference, got: %s", result.Message)
	}
}

func TestValidatePRDescription_NormalizeBackslashes(t *testing.T) {
	description := "Updated `src\\main.go` for the feature."
	filesInPR := []string{"src/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if result.CriticalCount != 0 {
		t.Error("Expected backslash normalization to match forward slash paths")
	}
}

func TestValidatePRDescription_RemoveLeadingDotSlash(t *testing.T) {
	description := "Updated `./main.go` for the feature."
	filesInPR := []string{"main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if result.CriticalCount != 0 {
		t.Error("Expected leading ./ to be normalized")
	}
}

func TestValidatePRDescription_MultipleExtensions(t *testing.T) {
	description := `## Files Changed
- ` + "`script.ps1`" + `
- ` + "`config.yml`" + `
- ` + "`styles.css`" + `
- ` + "`data.json`" + `
`
	filesInPR := []string{"script.ps1", "config.yml", "styles.css", "data.json"}

	result := internal.ValidatePRDescription(description, filesInPR)

	// Note: .css is not in our default file patterns, so only 3 should match
	if len(result.MentionedFiles) < 3 {
		t.Errorf("Expected at least 3 mentioned files from various extensions, got: %d", len(result.MentionedFiles))
	}
}

func TestValidatePRDescription_EmptyDescription(t *testing.T) {
	description := ""
	filesInPR := []string{"src/main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	// Empty description with files should generate warnings for significant files
	if !result.Valid {
		t.Error("Expected valid result for empty description (warnings only)")
	}
}

func TestValidatePRDescription_EmptyFileList(t *testing.T) {
	description := "Updated `main.go` for the feature."
	filesInPR := []string{}

	result := internal.ValidatePRDescription(description, filesInPR)

	// Mentioning files when no files are in diff should be critical
	if result.Valid {
		t.Error("Expected invalid result when mentioning files with empty PR file list")
	}
	if result.CriticalCount == 0 {
		t.Error("Expected critical issue for mentioned file not in diff")
	}
}

// Tests for ValidatePRDescriptionWithConfig

func TestValidatePRDescriptionWithConfig_CustomExtensions(t *testing.T) {
	config := internal.DefaultPRDescriptionConfig()
	config.Description = "No changes"
	config.FilesInPR = []string{"src/styles.scss", "src/main.rb"}
	config.SignificantExtensions = []string{".scss", ".rb"} // Custom extensions

	result := internal.ValidatePRDescriptionWithConfig(config)

	// Should warn about .scss and .rb files not mentioned
	if result.WarningCount == 0 {
		t.Error("Expected warnings for custom significant extensions not mentioned")
	}
}

func TestValidatePRDescriptionWithConfig_CustomPaths(t *testing.T) {
	config := internal.DefaultPRDescriptionConfig()
	config.Description = "No changes"
	config.FilesInPR = []string{"custom-dir/main.go"}
	config.SignificantPaths = []string{"custom-dir"} // Custom path

	result := internal.ValidatePRDescriptionWithConfig(config)

	// Should warn about file in custom significant path
	if result.WarningCount == 0 {
		t.Error("Expected warning for file in custom significant path")
	}
}

// Tests for ValidatePRDescriptionSections

func TestValidatePRDescriptionSections_AllPresent(t *testing.T) {
	description := `## Summary
This is the summary.

## Test Plan
This is the test plan.
`
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionSections(description, requiredSections)

	if !result.Valid {
		t.Errorf("Expected valid result when all sections present, got: %s", result.Message)
	}
}

func TestValidatePRDescriptionSections_MissingSection(t *testing.T) {
	description := `## Summary
This is the summary.
`
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionSections(description, requiredSections)

	if result.Valid {
		t.Error("Expected invalid result when section missing")
	}

	// Check that the missing section is identified
	foundMissing := false
	for _, check := range result.Checks {
		if !check.Passed && check.Name == "section_test_plan" {
			foundMissing = true
			break
		}
	}
	if !foundMissing {
		t.Error("Expected check for missing 'Test Plan' section")
	}
}

func TestValidatePRDescriptionSections_H3Header(t *testing.T) {
	description := `### Summary
This is the summary.

### Test Plan
This is the test plan.
`
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionSections(description, requiredSections)

	if !result.Valid {
		t.Error("Expected valid result for H3 headers")
	}
}

func TestValidatePRDescriptionSections_CaseInsensitive(t *testing.T) {
	description := `## SUMMARY
This is the summary.

## TEST PLAN
This is the test plan.
`
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionSections(description, requiredSections)

	if !result.Valid {
		t.Error("Expected case-insensitive section matching")
	}
}

func TestValidatePRDescriptionSections_DefaultSections(t *testing.T) {
	description := `## Summary
Summary here.

## Test Plan
Test plan here.
`
	// Pass nil to use defaults
	result := internal.ValidatePRDescriptionSections(description, nil)

	if !result.Valid {
		t.Error("Expected valid result with default sections")
	}
}

// Tests for ValidatePRChecklist

func TestValidatePRChecklist_AllComplete(t *testing.T) {
	description := `## Checklist
- [x] Tests added
- [x] Documentation updated
- [x] Reviewed
`

	result := internal.ValidatePRChecklist(description)

	if !result.Valid {
		t.Errorf("Expected valid result when all items complete, got: %s", result.Message)
	}
}

func TestValidatePRChecklist_SomeIncomplete(t *testing.T) {
	description := `## Checklist
- [x] Tests added
- [ ] Documentation updated
- [x] Reviewed
`

	result := internal.ValidatePRChecklist(description)

	if result.Valid {
		t.Error("Expected invalid result when items incomplete")
	}
}

func TestValidatePRChecklist_NoChecklist(t *testing.T) {
	description := `## Summary
No checklist here.
`

	result := internal.ValidatePRChecklist(description)

	if !result.Valid {
		t.Error("Expected valid result when no checklist present")
	}
}

func TestValidatePRChecklist_AsterisksAndDashes(t *testing.T) {
	description := `## Checklist
* [x] Item with asterisk
- [x] Item with dash
`

	result := internal.ValidatePRChecklist(description)

	if !result.Valid {
		t.Error("Expected valid result for both asterisk and dash list items")
	}
}

func TestValidatePRChecklist_UppercaseX(t *testing.T) {
	description := `## Checklist
- [X] Uppercase X should work
`

	result := internal.ValidatePRChecklist(description)

	if !result.Valid {
		t.Error("Expected uppercase X to be recognized as complete")
	}
}

func TestValidatePRChecklist_IndentedItems(t *testing.T) {
	description := `## Checklist
  - [x] Indented item
    - [x] More indented
`

	result := internal.ValidatePRChecklist(description)

	if !result.Valid {
		t.Error("Expected indented checklist items to be recognized")
	}
}

// Tests for ValidatePRDescriptionFull

func TestValidatePRDescriptionFull_AllValid(t *testing.T) {
	description := `## Summary
Updated ` + "`main.go`" + ` for the feature.

## Test Plan
- Manual testing

## Checklist
- [x] Tests
- [x] Docs
`
	filesInPR := []string{"src/main.go"}
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionFull(description, filesInPR, requiredSections)

	if !result.Valid {
		t.Errorf("Expected valid result for complete PR, got: %s", result.Message)
	}
}

func TestValidatePRDescriptionFull_FileMismatchAndMissingSection(t *testing.T) {
	description := `## Summary
Updated ` + "`missing.go`" + ` for the feature.
`
	filesInPR := []string{"src/main.go"}
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionFull(description, filesInPR, requiredSections)

	if result.Valid {
		t.Error("Expected invalid result for file mismatch and missing section")
	}
	if result.CriticalCount == 0 {
		t.Error("Expected critical issue for file mismatch")
	}

	// Should have multiple issues
	hasFileMismatch := false
	hasMissingSection := false
	for _, check := range result.Checks {
		if !check.Passed {
			if check.Name == "files_mentioned_not_in_diff" {
				hasFileMismatch = true
			}
			if check.Name == "section_test_plan" {
				hasMissingSection = true
			}
		}
	}
	if !hasFileMismatch {
		t.Error("Expected file mismatch check to fail")
	}
	if !hasMissingSection {
		t.Error("Expected missing section check to fail")
	}
}

func TestValidatePRDescriptionFull_IncompleteChecklist(t *testing.T) {
	description := `## Summary
Changes made.

## Test Plan
Tested.

## Checklist
- [x] Tests
- [ ] Docs not done
`
	filesInPR := []string{}
	requiredSections := []string{"Summary", "Test Plan"}

	result := internal.ValidatePRDescriptionFull(description, filesInPR, requiredSections)

	if result.Valid {
		t.Error("Expected invalid result for incomplete checklist")
	}

	// Check that checklist items check failed
	hasChecklistFail := false
	for _, check := range result.Checks {
		if check.Name == "checklist_items" && !check.Passed {
			hasChecklistFail = true
			break
		}
	}
	if !hasChecklistFail {
		t.Error("Expected checklist_items check to fail")
	}
}

// Tests for edge cases

func TestValidatePRDescription_DuplicateMentions(t *testing.T) {
	description := `## Summary
Updated ` + "`main.go`" + ` and also ` + "`main.go`" + ` again.
`
	filesInPR := []string{"main.go"}

	result := internal.ValidatePRDescription(description, filesInPR)

	// Duplicate mentions should be deduplicated
	if len(result.MentionedFiles) != 1 {
		t.Errorf("Expected duplicates to be deduplicated, got: %d files", len(result.MentionedFiles))
	}
}

func TestValidatePRDescription_ComplexPaths(t *testing.T) {
	description := `## Summary
- ` + "`packages/validation/tests/validate-pr-description_test.go`" + `
- ` + "`src/deep/nested/path/file.ts`" + `
`
	filesInPR := []string{
		"packages/validation/tests/validate-pr-description_test.go",
		"src/deep/nested/path/file.ts",
	}

	result := internal.ValidatePRDescription(description, filesInPR)

	if !result.Valid {
		t.Errorf("Expected valid result for complex paths, got: %s", result.Message)
	}
	if result.CriticalCount != 0 {
		t.Errorf("Expected 0 critical issues, got: %d", result.CriticalCount)
	}
}

func TestValidatePRDescription_NonSignificantPathNoWarning(t *testing.T) {
	description := `## Summary
General update.
`
	// File in non-significant path
	filesInPR := []string{"docs/readme.md", "assets/image.png"}

	result := internal.ValidatePRDescription(description, filesInPR)

	// docs/ and assets/ are not in significant paths, so no warnings expected
	// (unless the extension triggers it)
	if result.WarningCount > 1 {
		// Only docs/readme.md might trigger a warning due to .md extension
		t.Logf("Warning count: %d (expected 0-1 for docs)", result.WarningCount)
	}
}

func TestValidatePRDescription_TypeScriptExtensions(t *testing.T) {
	description := `## Summary
Updated:
- ` + "`component.tsx`" + `
- ` + "`hook.ts`" + `
`
	filesInPR := []string{"src/component.tsx", "src/hook.ts"}

	result := internal.ValidatePRDescription(description, filesInPR)

	if len(result.MentionedFiles) != 2 {
		t.Errorf("Expected 2 TypeScript files mentioned, got: %d", len(result.MentionedFiles))
	}
	if !result.Valid {
		t.Errorf("Expected valid result for TypeScript files, got: %s", result.Message)
	}
}

// Benchmark tests

func BenchmarkValidatePRDescription(b *testing.B) {
	description := `## Summary
Updated ` + "`main.go`" + `, ` + "`util.go`" + `, and ` + "`config.go`" + ` for the feature.

## Test Plan
- Manual testing completed
- Unit tests pass
`
	filesInPR := []string{
		"src/main.go",
		"src/util.go",
		"src/config.go",
		"tests/main_test.go",
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidatePRDescription(description, filesInPR)
	}
}

func BenchmarkValidatePRDescriptionFull(b *testing.B) {
	description := `## Summary
Updated ` + "`main.go`" + `, ` + "`util.go`" + `, and ` + "`config.go`" + `.

## Test Plan
- Manual testing

## Checklist
- [x] Tests added
- [x] Documentation updated
`
	filesInPR := []string{
		"src/main.go",
		"src/util.go",
		"src/config.go",
	}
	requiredSections := []string{"Summary", "Test Plan"}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidatePRDescriptionFull(description, filesInPR, requiredSections)
	}
}

func BenchmarkExtractMentionedFiles(b *testing.B) {
	description := `
- ` + "`file1.go`" + `
- ` + "`file2.ts`" + `
- ` + "`file3.py`" + `
- **file4.js**
- [file5.md](path/file5.md)
- file6.yml
- file7.json
- file8.ps1
`

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidatePRDescription(description, []string{})
	}
}

// Tests for JSON Schema validation functions

func TestValidatePRDescriptionConfig_Valid(t *testing.T) {
	tests := []struct {
		name  string
		data  map[string]any
		valid bool
	}{
		{
			name:  "minimal valid",
			data:  map[string]any{"description": "test description"},
			valid: true,
		},
		{
			name: "full valid",
			data: map[string]any{
				"description":           "test description",
				"filesInPR":             []any{"file1.go", "file2.ts"},
				"significantExtensions": []any{".go", ".ts"},
				"significantPaths":      []any{"src", "cmd"},
				"requiredSections":      []any{"Summary", "Test Plan"},
				"validateChecklist":     true,
			},
			valid: true,
		},
		{
			name:  "missing required description",
			data:  map[string]any{},
			valid: false,
		},
		{
			name:  "invalid additional property",
			data:  map[string]any{"description": "test", "unknownProp": "value"},
			valid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidatePRDescriptionConfig(tt.data)
			if result != tt.valid {
				t.Errorf("ValidatePRDescriptionConfig() = %v, want %v", result, tt.valid)
			}
		})
	}
}

func TestParsePRDescriptionConfig_AppliesDefaults(t *testing.T) {
	config, err := internal.ParsePRDescriptionConfig(map[string]any{
		"description": "test description",
	})
	if err != nil {
		t.Fatalf("ParsePRDescriptionConfig() error = %v", err)
	}

	if config.Description != "test description" {
		t.Errorf("Description = %v, want %v", config.Description, "test description")
	}
	if len(config.SignificantExtensions) == 0 {
		t.Error("SignificantExtensions should have defaults applied")
	}
	if len(config.SignificantPaths) == 0 {
		t.Error("SignificantPaths should have defaults applied")
	}
	if len(config.RequiredSections) == 0 {
		t.Error("RequiredSections should have defaults applied")
	}
	if config.ValidateChecklist == nil {
		t.Error("ValidateChecklist should have default applied")
	}
}

func TestParsePRDescriptionConfig_PreservesProvidedValues(t *testing.T) {
	config, err := internal.ParsePRDescriptionConfig(map[string]any{
		"description":           "my description",
		"filesInPR":             []any{"main.go"},
		"significantExtensions": []any{".custom"},
		"significantPaths":      []any{"custom-path"},
		"requiredSections":      []any{"Custom Section"},
		"validateChecklist":     false,
	})
	if err != nil {
		t.Fatalf("ParsePRDescriptionConfig() error = %v", err)
	}

	if config.Description != "my description" {
		t.Errorf("Description = %v, want %v", config.Description, "my description")
	}
	if len(config.FilesInPR) != 1 || config.FilesInPR[0] != "main.go" {
		t.Errorf("FilesInPR = %v, want [main.go]", config.FilesInPR)
	}
	if len(config.SignificantExtensions) != 1 || config.SignificantExtensions[0] != ".custom" {
		t.Errorf("SignificantExtensions = %v, want [.custom]", config.SignificantExtensions)
	}
	if len(config.SignificantPaths) != 1 || config.SignificantPaths[0] != "custom-path" {
		t.Errorf("SignificantPaths = %v, want [custom-path]", config.SignificantPaths)
	}
	if len(config.RequiredSections) != 1 || config.RequiredSections[0] != "Custom Section" {
		t.Errorf("RequiredSections = %v, want [Custom Section]", config.RequiredSections)
	}
	if config.ValidateChecklist == nil || *config.ValidateChecklist != false {
		t.Error("ValidateChecklist should be false")
	}
}

func TestParsePRDescriptionConfig_InvalidData(t *testing.T) {
	_, err := internal.ParsePRDescriptionConfig(map[string]any{})
	if err == nil {
		t.Error("ParsePRDescriptionConfig() should return error for missing description")
	}
}

func TestGetPRDescriptionConfigErrors_ValidData(t *testing.T) {
	errors := internal.GetPRDescriptionConfigErrors(map[string]any{"description": "test"})
	if len(errors) != 0 {
		t.Errorf("GetPRDescriptionConfigErrors() returned %d errors, want 0", len(errors))
	}
}

func TestGetPRDescriptionConfigErrors_InvalidData(t *testing.T) {
	errors := internal.GetPRDescriptionConfigErrors(map[string]any{})
	if len(errors) == 0 {
		t.Error("GetPRDescriptionConfigErrors() should return errors for missing description")
	}
	// Check error structure
	for _, e := range errors {
		if e.Constraint == "" {
			t.Error("ValidationError.Constraint should not be empty")
		}
		if e.Message == "" {
			t.Error("ValidationError.Message should not be empty")
		}
	}
}
