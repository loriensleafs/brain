package internal_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for ValidateSlashCommandFromContent - Frontmatter Validation

func TestValidateSlashCommandFromContent_ValidCommand(t *testing.T) {
	content := `---
description: Use when you need to analyze code patterns
---

# Analyze Command

This command helps analyze code patterns.
`
	result := internal.ValidateSlashCommandFromContent(content, "analyze.md")

	if !result.Valid {
		t.Errorf("Expected valid command to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}

	if !result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be true")
	}

	if result.Frontmatter.Description != "Use when you need to analyze code patterns" {
		t.Errorf("Expected description, got: %s", result.Frontmatter.Description)
	}

	if !result.FieldValidation.DescriptionPresent {
		t.Error("Expected DescriptionPresent to be true")
	}

	if !result.FieldValidation.DescriptionValid {
		t.Errorf("Expected DescriptionValid to be true, got error: %s", result.FieldValidation.DescriptionError)
	}
}

func TestValidateSlashCommandFromContent_MissingFrontmatter(t *testing.T) {
	content := `# Analyze Command

This command has no frontmatter.
`
	result := internal.ValidateSlashCommandFromContent(content, "analyze.md")

	if result.Valid {
		t.Error("Expected missing frontmatter to fail validation")
	}

	if result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be false")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "frontmatter_present" && !check.Passed {
			foundCheck = true
			if !strings.Contains(check.Message, "BLOCKING:") {
				t.Error("Expected BLOCKING violation")
			}
			break
		}
	}
	if !foundCheck {
		t.Error("Expected frontmatter_present check to fail")
	}
}

func TestValidateSlashCommandFromContent_FrontmatterNotOnLine1(t *testing.T) {
	content := `
---
description: Use when testing
---

# Content
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected frontmatter not on line 1 to fail validation")
	}

	if result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be false when not on line 1")
	}
}

func TestValidateSlashCommandFromContent_UnclosedFrontmatter(t *testing.T) {
	content := `---
description: Use when testing

# Content without closing ---
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected unclosed frontmatter to fail validation")
	}
}

func TestValidateSlashCommandFromContent_MissingDescription(t *testing.T) {
	content := `---
argument-hint: Some hint
---

# Content
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected missing description to fail validation")
	}

	if result.FieldValidation.DescriptionPresent {
		t.Error("Expected DescriptionPresent to be false")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "description_required" && !check.Passed {
			foundCheck = true
			if !strings.Contains(check.Message, "BLOCKING:") {
				t.Error("Expected BLOCKING violation")
			}
			break
		}
	}
	if !foundCheck {
		t.Error("Expected description_required check to fail")
	}
}

func TestValidateSlashCommandFromContent_DescriptionActionVerbs(t *testing.T) {
	tests := []struct {
		name           string
		description    string
		expectValid    bool
		expectBlocking bool
	}{
		{"Use when", "Use when you need to test", true, false},
		{"Generate", "Generate test data", true, false},
		{"Research", "Research API patterns", true, false},
		{"Invoke", "Invoke build pipeline", true, false},
		{"Create", "Create new feature", true, false},
		{"Analyze", "Analyze code complexity", true, false},
		{"Review", "Review pull request", true, false},
		{"Search", "Search for patterns", true, false},
		{"Invalid start", "This does something", false, false}, // Warning only
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := `---
description: ` + tt.description + `
---

# Content
`
			result := internal.ValidateSlashCommandFromContent(content, "test.md")

			if tt.expectValid && !result.FieldValidation.DescriptionValid {
				t.Errorf("Expected description '%s' to be valid, got error: %s", tt.description, result.FieldValidation.DescriptionError)
			}

			if !tt.expectValid && result.FieldValidation.DescriptionValid {
				t.Errorf("Expected description '%s' to be invalid", tt.description)
			}

			// Check if it's blocking or just warning
			if !tt.expectValid && !tt.expectBlocking {
				// Should be a warning, not blocking
				if !result.Valid {
					t.Errorf("Expected warning-only violation to pass validation")
				}
			}
		})
	}
}

// Tests for Argument Validation

func TestValidateSlashCommandFromContent_ArgumentsWithHint(t *testing.T) {
	content := `---
description: Use when running tests
argument-hint: <test-path>
---

Run tests at $ARGUMENTS
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if !result.Valid {
		t.Errorf("Expected valid argument usage to pass, got: %s", result.Message)
	}

	if !result.ArgumentConsistent {
		t.Error("Expected ArgumentConsistent to be true")
	}

	if result.Frontmatter.ArgumentHint != "<test-path>" {
		t.Errorf("Expected argument-hint '<test-path>', got: '%s'", result.Frontmatter.ArgumentHint)
	}
}

func TestValidateSlashCommandFromContent_ArgumentsWithoutHint(t *testing.T) {
	content := `---
description: Use when running tests
---

Run tests at $ARGUMENTS
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected arguments without hint to fail validation")
	}

	if result.ArgumentConsistent {
		t.Error("Expected ArgumentConsistent to be false")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "argument_consistency" && !check.Passed {
			foundCheck = true
			if !strings.Contains(check.Message, "BLOCKING:") {
				t.Error("Expected BLOCKING violation for arguments without hint")
			}
			break
		}
	}
	if !foundCheck {
		t.Error("Expected argument_consistency check to fail")
	}
}

func TestValidateSlashCommandFromContent_HintWithoutArguments(t *testing.T) {
	content := `---
description: Use when running tests
argument-hint: <test-path>
---

Run all tests.
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	// This is a warning, not blocking
	if !result.Valid {
		t.Error("Expected hint without arguments to be a warning (not blocking)")
	}

	if result.ArgumentConsistent {
		t.Error("Expected ArgumentConsistent to be false")
	}

	foundWarning := false
	for _, check := range result.Checks {
		if check.Name == "argument_consistency" && !check.Passed {
			foundWarning = true
			if !strings.Contains(check.Message, "WARNING:") {
				t.Error("Expected WARNING for hint without arguments")
			}
			break
		}
	}
	if !foundWarning {
		t.Error("Expected argument_consistency warning")
	}
}

func TestValidateSlashCommandFromContent_PositionalArguments(t *testing.T) {
	tests := []struct {
		name    string
		content string
	}{
		{"$1 usage", `---
description: Use when testing
argument-hint: <arg>
---

Use $1 here
`},
		{"$2 usage", `---
description: Use when testing
argument-hint: <arg1> <arg2>
---

Use $2 here
`},
		{"$3 usage", `---
description: Use when testing
argument-hint: <arg1> <arg2> <arg3>
---

Use $3 here
`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateSlashCommandFromContent(tt.content, "test.md")

			if !result.Valid {
				t.Errorf("Expected positional arguments to pass, got: %s", result.Message)
			}

			if !result.ArgumentConsistent {
				t.Error("Expected ArgumentConsistent to be true")
			}
		})
	}
}

// Tests for Security Validation

func TestValidateSlashCommandFromContent_BashWithAllowedTools(t *testing.T) {
	content := `---
description: Use when running git commands
allowed-tools: [git, gh]
---

!git status
!gh pr list
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if !result.Valid {
		t.Errorf("Expected bash with allowed-tools to pass, got: %s", result.Message)
	}

	if !result.SecurityCompliant {
		t.Error("Expected SecurityCompliant to be true")
	}

	if len(result.Frontmatter.AllowedTools) != 2 {
		t.Errorf("Expected 2 allowed tools, got: %d", len(result.Frontmatter.AllowedTools))
	}
}

func TestValidateSlashCommandFromContent_BashWithoutAllowedTools(t *testing.T) {
	content := `---
description: Use when running git commands
---

!git status
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected bash without allowed-tools to fail validation")
	}

	if result.SecurityCompliant {
		t.Error("Expected SecurityCompliant to be false")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "security_allowed_tools" && !check.Passed {
			foundCheck = true
			if !strings.Contains(check.Message, "BLOCKING:") {
				t.Error("Expected BLOCKING violation")
			}
			break
		}
	}
	if !foundCheck {
		t.Error("Expected security_allowed_tools check to fail")
	}
}

func TestValidateSlashCommandFromContent_OverlyPermissiveWildcard(t *testing.T) {
	tests := []struct {
		name        string
		allowedList string
		expectValid bool
	}{
		{"bare wildcard", "[*]", false},
		{"path wildcard", "[**/*]", false},
		{"mcp scoped wildcard", "[mcp__*]", true},
		{"mcp specific namespace", "[mcp__serena__*]", true},
		{"mcp forgetful namespace", "[mcp__forgetful__*]", true},
		{"mixed valid", "[git, mcp__*]", true},
		{"mixed invalid", "[git, *]", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := `---
description: Use when running commands
allowed-tools: ` + tt.allowedList + `
---

!command run
`
			result := internal.ValidateSlashCommandFromContent(content, "test.md")

			if tt.expectValid && !result.Valid {
				t.Errorf("Expected allowed-tools '%s' to be valid, got: %s", tt.allowedList, result.Message)
			}

			if !tt.expectValid && result.Valid {
				t.Errorf("Expected allowed-tools '%s' to be invalid", tt.allowedList)
			}
		})
	}
}

func TestValidateSlashCommandFromContent_NoBashExecution(t *testing.T) {
	content := `---
description: Use when analyzing code
---

Analyze the following code for patterns.
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if !result.Valid {
		t.Errorf("Expected no bash execution to pass, got: %s", result.Message)
	}

	if !result.SecurityCompliant {
		t.Error("Expected SecurityCompliant to be true (no bash)")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "security_allowed_tools" && check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected security_allowed_tools check to pass")
	}
}

// Tests for Length Validation

func TestValidateSlashCommandFromContent_AcceptableLength(t *testing.T) {
	// Create content with 50 lines
	lines := make([]string, 50)
	lines[0] = "---"
	lines[1] = "description: Use when testing"
	lines[2] = "---"
	lines[3] = ""
	lines[4] = "# Test Command"
	for i := 5; i < 50; i++ {
		lines[i] = "Line " + string(rune('0'+i%10))
	}
	content := strings.Join(lines, "\n")

	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.LengthWarning {
		t.Error("Expected no length warning for 50 lines")
	}

	if result.LineCount != 50 {
		t.Errorf("Expected LineCount 50, got: %d", result.LineCount)
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "length_check" && check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected length_check to pass")
	}
}

func TestValidateSlashCommandFromContent_ExceedsMaxLength(t *testing.T) {
	// Create content with 250 lines
	lines := make([]string, 250)
	lines[0] = "---"
	lines[1] = "description: Use when testing"
	lines[2] = "---"
	lines[3] = ""
	lines[4] = "# Test Command"
	for i := 5; i < 250; i++ {
		lines[i] = "Line content here"
	}
	content := strings.Join(lines, "\n")

	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	// Should still pass validation (warning only)
	if !result.Valid {
		t.Error("Expected length warning to be non-blocking")
	}

	if !result.LengthWarning {
		t.Error("Expected LengthWarning to be true")
	}

	if result.LineCount != 250 {
		t.Errorf("Expected LineCount 250, got: %d", result.LineCount)
	}

	foundWarning := false
	for _, check := range result.Checks {
		if check.Name == "length_check" && !check.Passed {
			foundWarning = true
			if !strings.Contains(check.Message, "WARNING:") {
				t.Error("Expected WARNING for length")
			}
			if !strings.Contains(check.Message, "Consider converting to skill") {
				t.Error("Expected suggestion to convert to skill")
			}
			break
		}
	}
	if !foundWarning {
		t.Error("Expected length_check warning")
	}
}

// Tests for ValidateSlashCommand (file-based)

func TestValidateSlashCommand_FileNotFound(t *testing.T) {
	result := internal.ValidateSlashCommand("/nonexistent/path/command.md")

	if result.Valid {
		t.Error("Expected nonexistent file to fail validation")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "file_exists" && !check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected file_exists check to fail")
	}
}

func TestValidateSlashCommand_ValidFile(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "analyze.md")

	content := `---
description: Use when analyzing code
---

# Analyze Command

Analyze code patterns.
`
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSlashCommand(filePath)

	if !result.Valid {
		t.Errorf("Expected valid file to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}
}

// Tests for ValidateSlashCommandDirectory

func TestValidateSlashCommandDirectory_EmptyDir(t *testing.T) {
	tmpDir := t.TempDir()

	results := internal.ValidateSlashCommandDirectory(tmpDir)

	if len(results) != 0 {
		t.Errorf("Expected 0 results for empty dir, got: %d", len(results))
	}
}

func TestValidateSlashCommandDirectory_WithFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create valid command file
	validContent := `---
description: Use when testing
---

# Valid Command
`
	if err := os.WriteFile(filepath.Join(tmpDir, "valid.md"), []byte(validContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create invalid command file (missing description)
	invalidContent := `---
argument-hint: <path>
---

# Invalid Command
`
	if err := os.WriteFile(filepath.Join(tmpDir, "invalid.md"), []byte(invalidContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSlashCommandDirectory(tmpDir)

	if len(results) != 2 {
		t.Errorf("Expected 2 results, got: %d", len(results))
	}

	validCount := 0
	invalidCount := 0
	for _, r := range results {
		if r.Valid {
			validCount++
		} else {
			invalidCount++
		}
	}

	if validCount != 1 {
		t.Errorf("Expected 1 valid result, got: %d", validCount)
	}

	if invalidCount != 1 {
		t.Errorf("Expected 1 invalid result, got: %d", invalidCount)
	}
}

func TestValidateSlashCommandDirectory_SkipsNonMarkdown(t *testing.T) {
	tmpDir := t.TempDir()

	// Create command file
	commandContent := `---
description: Use when testing
---

# Command
`
	if err := os.WriteFile(filepath.Join(tmpDir, "test.md"), []byte(commandContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create non-markdown files
	if err := os.WriteFile(filepath.Join(tmpDir, "config.json"), []byte(`{}`), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "script.ps1"), []byte(`# script`), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSlashCommandDirectory(tmpDir)

	if len(results) != 1 {
		t.Errorf("Expected 1 result (non-markdown skipped), got: %d", len(results))
	}
}

func TestValidateSlashCommandDirectory_SkipsSubdirs(t *testing.T) {
	tmpDir := t.TempDir()

	// Create subdirectory
	subDir := filepath.Join(tmpDir, "subdir")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	// Create command file in main dir
	commandContent := `---
description: Use when testing
---

# Command
`
	if err := os.WriteFile(filepath.Join(tmpDir, "test.md"), []byte(commandContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create file in subdir (should not be checked by non-recursive version)
	if err := os.WriteFile(filepath.Join(subDir, "nested.md"), []byte(commandContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSlashCommandDirectory(tmpDir)

	if len(results) != 1 {
		t.Errorf("Expected 1 result (subdirs not traversed), got: %d", len(results))
	}
}

func TestValidateSlashCommandDirectory_NonexistentDir(t *testing.T) {
	results := internal.ValidateSlashCommandDirectory("/nonexistent/path")

	if len(results) != 0 {
		t.Errorf("Expected 0 results for nonexistent dir, got: %d", len(results))
	}
}

// Tests for ValidateSlashCommandDirectoryRecursive

func TestValidateSlashCommandDirectoryRecursive_TraversesSubdirs(t *testing.T) {
	tmpDir := t.TempDir()

	// Create subdirectory structure
	subDir := filepath.Join(tmpDir, "subdir")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	commandContent := `---
description: Use when testing
---

# Command
`

	// Create file in main dir
	if err := os.WriteFile(filepath.Join(tmpDir, "root.md"), []byte(commandContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create file in subdir
	if err := os.WriteFile(filepath.Join(subDir, "nested.md"), []byte(commandContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSlashCommandDirectoryRecursive(tmpDir)

	if len(results) != 2 {
		t.Errorf("Expected 2 results (recursive), got: %d", len(results))
	}
}

// Tests for ValidateSlashCommandFiles

func TestValidateSlashCommandFiles_EmptyList(t *testing.T) {
	results := internal.ValidateSlashCommandFiles([]string{})

	if len(results) != 0 {
		t.Errorf("Expected 0 results for empty list, got: %d", len(results))
	}
}

func TestValidateSlashCommandFiles_MixedFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create valid command file
	validContent := `---
description: Use when testing
---

# Valid
`
	validPath := filepath.Join(tmpDir, "valid.md")
	if err := os.WriteFile(validPath, []byte(validContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create invalid command file
	invalidContent := `# No frontmatter
`
	invalidPath := filepath.Join(tmpDir, "invalid.md")
	if err := os.WriteFile(invalidPath, []byte(invalidContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	filePaths := []string{
		validPath,
		invalidPath,
		filepath.Join(tmpDir, "config.json"), // Non-markdown, should be skipped
	}

	results := internal.ValidateSlashCommandFiles(filePaths)

	// Should validate 2 files (not json)
	if len(results) != 2 {
		t.Errorf("Expected 2 results, got: %d", len(results))
	}
}

// Tests for helper functions

func TestCountBlockingViolations(t *testing.T) {
	results := []internal.SlashCommandValidationResult{
		{ValidationResult: internal.ValidationResult{Valid: true}},
		{ValidationResult: internal.ValidationResult{Valid: false}},
		{ValidationResult: internal.ValidationResult{Valid: false}},
		{ValidationResult: internal.ValidationResult{Valid: true}},
	}

	count := internal.CountBlockingViolations(results)

	if count != 2 {
		t.Errorf("Expected 2 blocking violations, got: %d", count)
	}
}

func TestCountWarnings(t *testing.T) {
	results := []internal.SlashCommandValidationResult{
		{
			ValidationResult: internal.ValidationResult{
				Valid: true,
				Checks: []internal.Check{
					{Passed: false, Message: "WARNING: length issue"},
					{Passed: true, Message: "OK"},
				},
			},
		},
		{
			ValidationResult: internal.ValidationResult{
				Valid: true,
				Checks: []internal.Check{
					{Passed: false, Message: "WARNING: description format"},
				},
			},
		},
	}

	count := internal.CountWarnings(results)

	if count != 2 {
		t.Errorf("Expected 2 warnings, got: %d", count)
	}
}

// Tests for YAML parsing edge cases

func TestValidateSlashCommandFromContent_QuotedValues(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{
			name: "double quoted description",
			content: `---
description: "Use when testing"
---
`,
			expected: "Use when testing",
		},
		{
			name: "single quoted description",
			content: `---
description: 'Use when testing'
---
`,
			expected: "Use when testing",
		},
		{
			name: "unquoted description",
			content: `---
description: Use when testing
---
`,
			expected: "Use when testing",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateSlashCommandFromContent(tt.content, "test.md")

			if result.Frontmatter.Description != tt.expected {
				t.Errorf("Expected description '%s', got: '%s'", tt.expected, result.Frontmatter.Description)
			}
		})
	}
}

func TestValidateSlashCommandFromContent_YAMLComments(t *testing.T) {
	content := `---
# This is a comment
description: Use when testing
# Another comment
argument-hint: <path>
---

# Content
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if !result.Valid {
		t.Errorf("Expected YAML with comments to be valid, got: %s", result.Message)
	}

	if result.Frontmatter.Description != "Use when testing" {
		t.Errorf("Expected description 'Use when testing', got: '%s'", result.Frontmatter.Description)
	}

	if result.Frontmatter.ArgumentHint != "<path>" {
		t.Errorf("Expected argument-hint '<path>', got: '%s'", result.Frontmatter.ArgumentHint)
	}
}

func TestValidateSlashCommandFromContent_EmptyContent(t *testing.T) {
	result := internal.ValidateSlashCommandFromContent("", "test.md")

	if result.Valid {
		t.Error("Expected empty content to fail validation")
	}

	if result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be false for empty content")
	}
}

func TestValidateSlashCommandFromContent_OnlyFrontmatterDelimiters(t *testing.T) {
	content := `---
---

# Content
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected empty frontmatter to fail validation (missing description)")
	}
}

// Tests for remediation messages

func TestValidateSlashCommandFromContent_Remediation(t *testing.T) {
	content := `# No frontmatter
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected validation to fail")
	}

	if result.Remediation == "" {
		t.Error("Expected Remediation to be set")
	}

	if !strings.Contains(result.Remediation, "frontmatter") {
		t.Errorf("Expected remediation to mention frontmatter, got: %s", result.Remediation)
	}
}

func TestValidateSlashCommandFromContent_RemediationMultipleIssues(t *testing.T) {
	content := `---
argument-hint: <path>
---

!command run
$ARGUMENTS
`
	result := internal.ValidateSlashCommandFromContent(content, "test.md")

	if result.Valid {
		t.Error("Expected validation to fail")
	}

	// Should have remediation for missing description and allowed-tools
	if !strings.Contains(result.Remediation, "description") {
		t.Errorf("Expected remediation to mention description, got: %s", result.Remediation)
	}

	if !strings.Contains(result.Remediation, "allowed-tools") {
		t.Errorf("Expected remediation to mention allowed-tools, got: %s", result.Remediation)
	}
}

// Tests for combined validation scenarios

func TestValidateSlashCommandFromContent_CompleteValidCommand(t *testing.T) {
	content := `---
description: Use when generating test data for integration tests
argument-hint: <output-path>
allowed-tools: [mcp__forgetful__*, npm]
---

# Generate Test Data

Generate test fixtures at $ARGUMENTS.

!npm run generate-fixtures
`
	result := internal.ValidateSlashCommandFromContent(content, "generate-test-data.md")

	if !result.Valid {
		t.Errorf("Expected complete valid command to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}

	if !result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be true")
	}

	if !result.FieldValidation.DescriptionValid {
		t.Errorf("Expected description valid, got error: %s", result.FieldValidation.DescriptionError)
	}

	if !result.ArgumentConsistent {
		t.Error("Expected ArgumentConsistent to be true")
	}

	if !result.SecurityCompliant {
		t.Error("Expected SecurityCompliant to be true")
	}

	if result.LengthWarning {
		t.Error("Expected no length warning")
	}
}

// Benchmark tests

func BenchmarkValidateSlashCommandFromContent(b *testing.B) {
	content := `---
description: Use when analyzing code patterns in the codebase
argument-hint: <file-path>
allowed-tools: [mcp__*, git]
---

# Analyze Command

Analyze the code at $ARGUMENTS for:
- Code patterns
- Performance issues
- Security vulnerabilities

!git diff HEAD~1

Then provide recommendations.
`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidateSlashCommandFromContent(content, "analyze.md")
	}
}

func BenchmarkValidateSlashCommandDirectory(b *testing.B) {
	tmpDir := b.TempDir()

	// Create 10 command files
	for i := 0; i < 10; i++ {
		content := `---
description: Use when testing command ` + string(rune('0'+i)) + `
---

# Command ` + string(rune('0'+i)) + `

Content here.
`
		filename := "command-" + string(rune('0'+i)) + ".md"
		os.WriteFile(filepath.Join(tmpDir, filename), []byte(content), 0644)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidateSlashCommandDirectory(tmpDir)
	}
}
