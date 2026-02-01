package internal_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for ValidateSkillFormatFromContent

func TestValidateSkillFormatFromContent_ValidSkill(t *testing.T) {
	content := `---
name: pr-review-helper
description: Helps review pull requests systematically
---

# PR Review Helper

This skill helps with PR reviews.
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-review-helper.md")

	if !result.Valid {
		t.Errorf("Expected valid skill to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}

	if !result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be true")
	}

	if result.Frontmatter.Name != "pr-review-helper" {
		t.Errorf("Expected name 'pr-review-helper', got: %s", result.Frontmatter.Name)
	}

	if result.Frontmatter.Description != "Helps review pull requests systematically" {
		t.Errorf("Expected description, got: %s", result.Frontmatter.Description)
	}

	if !result.FieldValidation.NamePresent {
		t.Error("Expected NamePresent to be true")
	}

	if !result.FieldValidation.NameValid {
		t.Errorf("Expected NameValid to be true, got error: %s", result.FieldValidation.NameError)
	}

	if !result.FieldValidation.DescriptionPresent {
		t.Error("Expected DescriptionPresent to be true")
	}

	if !result.FieldValidation.DescriptionValid {
		t.Errorf("Expected DescriptionValid to be true, got error: %s", result.FieldValidation.DescriptionError)
	}

	if !result.FieldValidation.YAMLSyntaxValid {
		t.Errorf("Expected YAMLSyntaxValid to be true, got error: %s", result.FieldValidation.YAMLSyntaxError)
	}
}

func TestValidateSkillFormatFromContent_MissingFrontmatter(t *testing.T) {
	content := `# PR Review Helper

This skill has no frontmatter.
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-review.md")

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
			break
		}
	}
	if !foundCheck {
		t.Error("Expected frontmatter_present check to fail")
	}
}

func TestValidateSkillFormatFromContent_FrontmatterNotOnLine1(t *testing.T) {
	content := `
---
name: test-skill
description: Test description
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected frontmatter not on line 1 to fail validation")
	}

	if result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be false when not on line 1")
	}
}

func TestValidateSkillFormatFromContent_UnclosedFrontmatter(t *testing.T) {
	content := `---
name: test-skill
description: Test description

# Content without closing ---
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected unclosed frontmatter to fail validation")
	}

	if !result.FrontmatterPresent {
		// Frontmatter starts but is not closed
		t.Log("Frontmatter detected as not present due to missing closing delimiter")
	}
}

func TestValidateSkillFormatFromContent_MissingNameField(t *testing.T) {
	content := `---
description: Test description
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected missing name field to fail validation")
	}

	if result.FieldValidation.NamePresent {
		t.Error("Expected NamePresent to be false")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "name_required" && !check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected name_required check to fail")
	}
}

func TestValidateSkillFormatFromContent_MissingDescriptionField(t *testing.T) {
	content := `---
name: test-skill
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected missing description field to fail validation")
	}

	if result.FieldValidation.DescriptionPresent {
		t.Error("Expected DescriptionPresent to be false")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "description_required" && !check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected description_required check to fail")
	}
}

func TestValidateSkillFormatFromContent_InvalidNameFormat(t *testing.T) {
	tests := []struct {
		name        string
		skillName   string
		expectValid bool
	}{
		{"valid lowercase", "test-skill", true},
		{"valid with numbers", "skill-123", true},
		{"valid all numbers", "123", true},
		{"valid single char", "a", true},
		{"invalid uppercase", "Test-Skill", false},
		{"invalid spaces", "test skill", false},
		{"invalid underscores", "test_skill", false},
		{"invalid special chars", "test@skill", false},
		{"invalid empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			content := `---
name: ` + tt.skillName + `
description: Test description
---

# Content
`
			result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

			if tt.expectValid && !result.FieldValidation.NameValid {
				t.Errorf("Expected name '%s' to be valid, got error: %s", tt.skillName, result.FieldValidation.NameError)
			}

			if !tt.expectValid && result.FieldValidation.NameValid {
				t.Errorf("Expected name '%s' to be invalid", tt.skillName)
			}
		})
	}
}

func TestValidateSkillFormatFromContent_NameTooLong(t *testing.T) {
	// Create a name longer than 64 characters
	longName := strings.Repeat("a", 65)
	content := `---
name: ` + longName + `
description: Test description
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected name > 64 chars to fail validation")
	}

	if result.FieldValidation.NameValid {
		t.Error("Expected NameValid to be false for long name")
	}

	if !strings.Contains(result.FieldValidation.NameError, "64") {
		t.Errorf("Expected error to mention 64 character limit, got: %s", result.FieldValidation.NameError)
	}
}

func TestValidateSkillFormatFromContent_DescriptionTooLong(t *testing.T) {
	// Create a description longer than 1024 characters
	longDesc := strings.Repeat("a", 1025)
	content := `---
name: test-skill
description: ` + longDesc + `
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected description > 1024 chars to fail validation")
	}

	if result.FieldValidation.DescriptionValid {
		t.Error("Expected DescriptionValid to be false for long description")
	}

	if !strings.Contains(result.FieldValidation.DescriptionError, "1024") {
		t.Errorf("Expected error to mention 1024 character limit, got: %s", result.FieldValidation.DescriptionError)
	}
}

func TestValidateSkillFormatFromContent_InvalidFilenamePrefix(t *testing.T) {
	content := `---
name: test-skill
description: Test description
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "skill-test.md")

	if result.Valid {
		t.Error("Expected 'skill-' prefix to fail validation")
	}

	if !result.PrefixViolation {
		t.Error("Expected PrefixViolation to be true")
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "filename_prefix" && !check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected filename_prefix check to fail")
	}
}

func TestValidateSkillFormatFromContent_ValidFilenamePrefix(t *testing.T) {
	content := `---
name: test-skill
description: Test description
---

# Content
`
	validNames := []string{
		"pr-001-review.md",
		"qa-002-testing.md",
		"build-optimization.md",
		"git-workflow.md",
	}

	for _, name := range validNames {
		t.Run(name, func(t *testing.T) {
			result := internal.ValidateSkillFormatFromContent(content, name)

			if result.PrefixViolation {
				t.Errorf("Expected filename '%s' to not have prefix violation", name)
			}

			foundCheck := false
			for _, check := range result.Checks {
				if check.Name == "filename_prefix" && check.Passed {
					foundCheck = true
					break
				}
			}
			if !foundCheck {
				t.Errorf("Expected filename_prefix check to pass for '%s'", name)
			}
		})
	}
}

func TestValidateSkillFormatFromContent_BundledSkills(t *testing.T) {
	content := `---
name: bundled-skills
description: Multiple skills bundled together
---

## Skill-PR-001: First Skill

Content for first skill.

## Skill-PR-002: Second Skill

Content for second skill.

## Skill-QA-003: Third Skill

Content for third skill.
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-bundled.md")

	if result.Valid {
		t.Error("Expected bundled skills to fail validation")
	}

	if len(result.BundledSkills) != 3 {
		t.Errorf("Expected 3 bundled skills detected, got: %d", len(result.BundledSkills))
	}

	foundCheck := false
	for _, check := range result.Checks {
		if check.Name == "single_skill" && !check.Passed {
			foundCheck = true
			break
		}
	}
	if !foundCheck {
		t.Error("Expected single_skill check to fail")
	}
}

func TestValidateSkillFormatFromContent_SingleSkillHeader(t *testing.T) {
	content := `---
name: single-skill
description: A single skill
---

## Skill-PR-001: Single Skill

Content for the skill.
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-single.md")

	if !result.Valid {
		t.Errorf("Expected single skill header to pass, got: %s", result.Message)
	}

	if len(result.BundledSkills) > 1 {
		t.Errorf("Expected 0 or 1 bundled skill, got: %d", len(result.BundledSkills))
	}
}

func TestValidateSkillFormatFromContent_QuotedValues(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		expected string
	}{
		{
			name: "double quoted name",
			content: `---
name: "test-skill"
description: Test description
---
`,
			expected: "test-skill",
		},
		{
			name: "single quoted name",
			content: `---
name: 'test-skill'
description: Test description
---
`,
			expected: "test-skill",
		},
		{
			name: "unquoted name",
			content: `---
name: test-skill
description: Test description
---
`,
			expected: "test-skill",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.ValidateSkillFormatFromContent(tt.content, "pr-001-test.md")

			if result.Frontmatter.Name != tt.expected {
				t.Errorf("Expected name '%s', got: '%s'", tt.expected, result.Frontmatter.Name)
			}
		})
	}
}

func TestValidateSkillFormatFromContent_YAMLComments(t *testing.T) {
	content := `---
# This is a comment
name: test-skill
description: Test description
# Another comment
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if !result.Valid {
		t.Errorf("Expected YAML with comments to be valid, got: %s", result.Message)
	}

	if result.Frontmatter.Name != "test-skill" {
		t.Errorf("Expected name 'test-skill', got: '%s'", result.Frontmatter.Name)
	}
}

// Tests for ValidateSkillFormat (file-based)

func TestValidateSkillFormat_FileNotFound(t *testing.T) {
	result := internal.ValidateSkillFormat("/nonexistent/path/skill.md")

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

func TestValidateSkillFormat_ValidFile(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "pr-001-review.md")

	content := `---
name: pr-review-skill
description: A skill for reviewing PRs
---

# PR Review Skill

Content here.
`
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSkillFormat(filePath)

	if !result.Valid {
		t.Errorf("Expected valid file to pass, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}
}

func TestValidateSkillFormat_InvalidPrefixFile(t *testing.T) {
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "skill-test.md")

	content := `---
name: test-skill
description: Test description
---

# Content
`
	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := internal.ValidateSkillFormat(filePath)

	if result.Valid {
		t.Error("Expected skill- prefix to fail validation")
	}

	if !result.PrefixViolation {
		t.Error("Expected PrefixViolation to be true")
	}
}

// Tests for ValidateSkillDirectory

func TestValidateSkillDirectory_EmptyDir(t *testing.T) {
	tmpDir := t.TempDir()

	results := internal.ValidateSkillDirectory(tmpDir)

	if len(results) != 0 {
		t.Errorf("Expected 0 results for empty dir, got: %d", len(results))
	}
}

func TestValidateSkillDirectory_WithFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create valid skill file
	validContent := `---
name: valid-skill
description: A valid skill
---

# Content
`
	if err := os.WriteFile(filepath.Join(tmpDir, "pr-001-valid.md"), []byte(validContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create invalid skill file
	invalidContent := `---
name: INVALID_NAME
description: Invalid name format
---

# Content
`
	if err := os.WriteFile(filepath.Join(tmpDir, "pr-002-invalid.md"), []byte(invalidContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSkillDirectory(tmpDir)

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

func TestValidateSkillDirectory_SkipsIndexFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create skill file
	skillContent := `---
name: test-skill
description: Test
---

# Content
`
	if err := os.WriteFile(filepath.Join(tmpDir, "pr-001-test.md"), []byte(skillContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create index files that should be skipped
	indexContent := `# Index

List of skills...
`
	if err := os.WriteFile(filepath.Join(tmpDir, "skills-pr-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "memory-index.md"), []byte(indexContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSkillDirectory(tmpDir)

	// Should only validate the skill file, not index files
	if len(results) != 1 {
		t.Errorf("Expected 1 result (index files skipped), got: %d", len(results))
	}
}

func TestValidateSkillDirectory_SkipsNonMarkdown(t *testing.T) {
	tmpDir := t.TempDir()

	// Create skill file
	skillContent := `---
name: test-skill
description: Test
---

# Content
`
	if err := os.WriteFile(filepath.Join(tmpDir, "pr-001-test.md"), []byte(skillContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create non-markdown files
	if err := os.WriteFile(filepath.Join(tmpDir, "config.json"), []byte(`{}`), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "script.ps1"), []byte(`# script`), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSkillDirectory(tmpDir)

	if len(results) != 1 {
		t.Errorf("Expected 1 result (non-markdown skipped), got: %d", len(results))
	}
}

func TestValidateSkillDirectory_SkipsSubdirs(t *testing.T) {
	tmpDir := t.TempDir()

	// Create subdirectory
	subDir := filepath.Join(tmpDir, "subdir")
	if err := os.MkdirAll(subDir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	// Create skill file in main dir
	skillContent := `---
name: test-skill
description: Test
---

# Content
`
	if err := os.WriteFile(filepath.Join(tmpDir, "pr-001-test.md"), []byte(skillContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create file in subdir (should not be checked)
	if err := os.WriteFile(filepath.Join(subDir, "pr-002-nested.md"), []byte(skillContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	results := internal.ValidateSkillDirectory(tmpDir)

	if len(results) != 1 {
		t.Errorf("Expected 1 result (subdirs not traversed), got: %d", len(results))
	}
}

func TestValidateSkillDirectory_NonexistentDir(t *testing.T) {
	results := internal.ValidateSkillDirectory("/nonexistent/path")

	if len(results) != 0 {
		t.Errorf("Expected 0 results for nonexistent dir, got: %d", len(results))
	}
}

// Tests for ValidateSkillFiles

func TestValidateSkillFiles_EmptyList(t *testing.T) {
	results := internal.ValidateSkillFiles([]string{})

	if len(results) != 0 {
		t.Errorf("Expected 0 results for empty list, got: %d", len(results))
	}
}

func TestValidateSkillFiles_MixedFiles(t *testing.T) {
	tmpDir := t.TempDir()

	// Create valid skill file
	validContent := `---
name: valid-skill
description: A valid skill
---

# Content
`
	validPath := filepath.Join(tmpDir, "pr-001-valid.md")
	if err := os.WriteFile(validPath, []byte(validContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create file with bad prefix
	badPrefixPath := filepath.Join(tmpDir, "skill-bad.md")
	if err := os.WriteFile(badPrefixPath, []byte(validContent), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	// Create index file (should be skipped)
	indexPath := filepath.Join(tmpDir, "skills-pr-index.md")
	if err := os.WriteFile(indexPath, []byte("# Index"), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	filePaths := []string{
		validPath,
		badPrefixPath,
		indexPath,
		filepath.Join(tmpDir, "config.json"), // Non-markdown, should be skipped
	}

	results := internal.ValidateSkillFiles(filePaths)

	// Should validate 2 files: valid and bad prefix (not index, not json)
	if len(results) != 2 {
		t.Errorf("Expected 2 results, got: %d", len(results))
	}
}

func TestValidateSkillFiles_SkipsIndexFiles(t *testing.T) {
	tmpDir := t.TempDir()

	indexPaths := []string{
		filepath.Join(tmpDir, "skills-pr-index.md"),
		filepath.Join(tmpDir, "skills-qa-index.md"),
		filepath.Join(tmpDir, "memory-index.md"),
	}

	for _, p := range indexPaths {
		if err := os.WriteFile(p, []byte("# Index"), 0644); err != nil {
			t.Fatalf("Failed to create file: %v", err)
		}
	}

	results := internal.ValidateSkillFiles(indexPaths)

	if len(results) != 0 {
		t.Errorf("Expected 0 results (all index files), got: %d", len(results))
	}
}

// Tests for remediation messages

func TestValidateSkillFormatFromContent_Remediation(t *testing.T) {
	// Multiple issues
	content := `# No frontmatter
`
	result := internal.ValidateSkillFormatFromContent(content, "skill-bad.md")

	if result.Valid {
		t.Error("Expected validation to fail")
	}

	if result.Remediation == "" {
		t.Error("Expected Remediation to be set")
	}

	// Should mention frontmatter and filename issues
	if !strings.Contains(result.Remediation, "frontmatter") && !strings.Contains(result.Remediation, "Rename") {
		t.Errorf("Expected remediation to mention issues, got: %s", result.Remediation)
	}
}

// Edge cases

func TestValidateSkillFormatFromContent_EmptyContent(t *testing.T) {
	result := internal.ValidateSkillFormatFromContent("", "pr-001-empty.md")

	if result.Valid {
		t.Error("Expected empty content to fail validation")
	}

	if result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be false for empty content")
	}
}

func TestValidateSkillFormatFromContent_OnlyFrontmatterDelimiters(t *testing.T) {
	content := `---
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if result.Valid {
		t.Error("Expected empty frontmatter to fail validation (missing required fields)")
	}

	// Empty frontmatter (no content between delimiters) is treated as not present
	// because there are no actual YAML fields defined
	if result.FrontmatterPresent {
		t.Error("Expected FrontmatterPresent to be false (empty frontmatter has no content)")
	}
}

func TestValidateSkillFormatFromContent_MaxLengthName(t *testing.T) {
	// Exactly 64 characters - should be valid
	maxName := strings.Repeat("a", 64)
	content := `---
name: ` + maxName + `
description: Test
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if !result.FieldValidation.NameValid {
		t.Errorf("Expected 64-char name to be valid, got error: %s", result.FieldValidation.NameError)
	}
}

func TestValidateSkillFormatFromContent_MaxLengthDescription(t *testing.T) {
	// Exactly 1024 characters - should be valid
	maxDesc := strings.Repeat("a", 1024)
	content := `---
name: test-skill
description: ` + maxDesc + `
---

# Content
`
	result := internal.ValidateSkillFormatFromContent(content, "pr-001-test.md")

	if !result.FieldValidation.DescriptionValid {
		t.Errorf("Expected 1024-char description to be valid, got error: %s", result.FieldValidation.DescriptionError)
	}
}

// Benchmark tests

func BenchmarkValidateSkillFormatFromContent(b *testing.B) {
	content := `---
name: benchmark-skill
description: A skill for benchmarking purposes
---

# Benchmark Skill

This is the content of the benchmark skill. It contains multiple paragraphs
of text to simulate a realistic skill file size.

## Section 1

Some content here.

## Section 2

More content here.
`
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidateSkillFormatFromContent(content, "pr-001-benchmark.md")
	}
}

func BenchmarkValidateSkillDirectory(b *testing.B) {
	tmpDir := b.TempDir()

	// Create 10 skill files
	for i := 0; i < 10; i++ {
		content := `---
name: skill-` + string(rune('0'+i)) + `
description: Skill number ` + string(rune('0'+i)) + `
---

# Skill ` + string(rune('0'+i)) + `

Content here.
`
		filename := "pr-00" + string(rune('0'+i)) + "-skill.md"
		os.WriteFile(filepath.Join(tmpDir, filename), []byte(content), 0644)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidateSkillDirectory(tmpDir)
	}
}
