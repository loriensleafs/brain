package internal_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Test helper to create a skill directory with SKILL.md
func createTestSkill(t *testing.T, basePath, skillName, content string) string {
	t.Helper()
	skillDir := filepath.Join(basePath, ".claude", "skills", skillName)
	if err := os.MkdirAll(skillDir, 0755); err != nil {
		t.Fatalf("Failed to create skill directory: %v", err)
	}

	skillPath := filepath.Join(skillDir, "SKILL.md")
	if err := os.WriteFile(skillPath, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create SKILL.md: %v", err)
	}

	return skillPath
}

// Test helper to create a skill script
func createTestScript(t *testing.T, basePath, operation, scriptName string) string {
	t.Helper()
	scriptDir := filepath.Join(basePath, ".claude", "skills", "github", "scripts", operation)
	if err := os.MkdirAll(scriptDir, 0755); err != nil {
		t.Fatalf("Failed to create script directory: %v", err)
	}

	scriptPath := filepath.Join(scriptDir, scriptName)
	if err := os.WriteFile(scriptPath, []byte("# Test script"), 0644); err != nil {
		t.Fatalf("Failed to create script: %v", err)
	}

	return scriptPath
}

func TestCheckSkillExists_ValidSkill(t *testing.T) {
	tmpDir := t.TempDir()

	content := `---
name: test-skill
description: A test skill for validation
---

# Test Skill

This is a test skill.
`
	createTestSkill(t, tmpDir, "test-skill", content)

	result := internal.CheckSkillExists(tmpDir, "test-skill")

	if !result.Exists {
		t.Errorf("Expected skill to exist, got Exists=%v, Message=%s", result.Exists, result.Message)
	}

	if result.Name != "test-skill" {
		t.Errorf("Expected name 'test-skill', got '%s'", result.Name)
	}

	if result.Description != "A test skill for validation" {
		t.Errorf("Expected description 'A test skill for validation', got '%s'", result.Description)
	}

	if result.Message != "Skill exists and is valid" {
		t.Errorf("Expected success message, got '%s'", result.Message)
	}

	// Verify all checks passed
	for _, check := range result.Checks {
		if !check.Passed {
			t.Errorf("Check '%s' failed: %s", check.Name, check.Message)
		}
	}
}

func TestCheckSkillExists_SkillNotFound(t *testing.T) {
	tmpDir := t.TempDir()

	result := internal.CheckSkillExists(tmpDir, "nonexistent-skill")

	if result.Exists {
		t.Error("Expected skill to not exist")
	}

	if result.Message != "Skill not found" {
		t.Errorf("Expected 'Skill not found' message, got '%s'", result.Message)
	}

	// Verify file_exists check failed
	if len(result.Checks) != 1 {
		t.Fatalf("Expected 1 check, got %d", len(result.Checks))
	}

	if result.Checks[0].Name != "file_exists" {
		t.Errorf("Expected 'file_exists' check, got '%s'", result.Checks[0].Name)
	}

	if result.Checks[0].Passed {
		t.Error("Expected file_exists check to fail")
	}
}

func TestCheckSkillExists_EmptySkillName(t *testing.T) {
	tmpDir := t.TempDir()

	result := internal.CheckSkillExists(tmpDir, "")

	if result.Exists {
		t.Error("Expected skill to not exist with empty name")
	}

	if result.Message != "Skill name is required" {
		t.Errorf("Expected 'Skill name is required' message, got '%s'", result.Message)
	}

	// Verify skill_name_provided check failed
	if len(result.Checks) != 1 {
		t.Fatalf("Expected 1 check, got %d", len(result.Checks))
	}

	if result.Checks[0].Name != "skill_name_provided" {
		t.Errorf("Expected 'skill_name_provided' check, got '%s'", result.Checks[0].Name)
	}
}

func TestCheckSkillExists_NoFrontmatter(t *testing.T) {
	tmpDir := t.TempDir()

	content := `# Test Skill

This skill has no frontmatter.
`
	createTestSkill(t, tmpDir, "no-frontmatter", content)

	result := internal.CheckSkillExists(tmpDir, "no-frontmatter")

	if !result.Exists {
		t.Error("Expected skill file to exist")
	}

	if result.Message != "Skill exists but has invalid frontmatter" {
		t.Errorf("Expected invalid frontmatter message, got '%s'", result.Message)
	}

	// Find frontmatter_valid check
	var frontmatterCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "frontmatter_valid" {
			frontmatterCheck = &result.Checks[i]
			break
		}
	}

	if frontmatterCheck == nil {
		t.Fatal("Expected frontmatter_valid check to be present")
	}

	if frontmatterCheck.Passed {
		t.Error("Expected frontmatter_valid check to fail")
	}
}

func TestCheckSkillExists_MissingName(t *testing.T) {
	tmpDir := t.TempDir()

	content := `---
description: Has description but no name
---

# Test Skill
`
	createTestSkill(t, tmpDir, "missing-name", content)

	result := internal.CheckSkillExists(tmpDir, "missing-name")

	if !result.Exists {
		t.Error("Expected skill file to exist")
	}

	if result.Name != "" {
		t.Errorf("Expected empty name, got '%s'", result.Name)
	}

	if result.Description != "Has description but no name" {
		t.Errorf("Expected description, got '%s'", result.Description)
	}

	// Find name_present check
	var nameCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "name_present" {
			nameCheck = &result.Checks[i]
			break
		}
	}

	if nameCheck == nil {
		t.Fatal("Expected name_present check to be present")
	}

	if nameCheck.Passed {
		t.Error("Expected name_present check to fail")
	}
}

func TestCheckSkillExists_MissingDescription(t *testing.T) {
	tmpDir := t.TempDir()

	content := `---
name: has-name-only
---

# Test Skill
`
	createTestSkill(t, tmpDir, "missing-desc", content)

	result := internal.CheckSkillExists(tmpDir, "missing-desc")

	if !result.Exists {
		t.Error("Expected skill file to exist")
	}

	if result.Name != "has-name-only" {
		t.Errorf("Expected name 'has-name-only', got '%s'", result.Name)
	}

	if result.Description != "" {
		t.Errorf("Expected empty description, got '%s'", result.Description)
	}

	// Find description_present check
	var descCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "description_present" {
			descCheck = &result.Checks[i]
			break
		}
	}

	if descCheck == nil {
		t.Fatal("Expected description_present check to be present")
	}

	if descCheck.Passed {
		t.Error("Expected description_present check to fail")
	}
}

func TestCheckSkillExists_QuotedValues(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		wantName    string
		wantDesc    string
	}{
		{
			name: "double_quotes",
			content: `---
name: "quoted-skill"
description: "A skill with quoted values"
---

# Quoted Skill
`,
			wantName: "quoted-skill",
			wantDesc: "A skill with quoted values",
		},
		{
			name: "single_quotes",
			content: `---
name: 'single-quoted'
description: 'Single quoted description'
---

# Single Quoted
`,
			wantName: "single-quoted",
			wantDesc: "Single quoted description",
		},
		{
			name: "mixed_quotes",
			content: `---
name: "double-quoted"
description: 'single-quoted'
---

# Mixed
`,
			wantName: "double-quoted",
			wantDesc: "single-quoted",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpDir := t.TempDir()
			createTestSkill(t, tmpDir, tt.name, tt.content)

			result := internal.CheckSkillExists(tmpDir, tt.name)

			if result.Name != tt.wantName {
				t.Errorf("Expected name '%s', got '%s'", tt.wantName, result.Name)
			}

			if result.Description != tt.wantDesc {
				t.Errorf("Expected description '%s', got '%s'", tt.wantDesc, result.Description)
			}
		})
	}
}

func TestCheckSkillExists_UnclosedFrontmatter(t *testing.T) {
	tmpDir := t.TempDir()

	content := `---
name: unclosed
description: Missing closing delimiter

# This is content, not frontmatter
`
	createTestSkill(t, tmpDir, "unclosed", content)

	result := internal.CheckSkillExists(tmpDir, "unclosed")

	if !result.Exists {
		t.Error("Expected skill file to exist")
	}

	// Find frontmatter_valid check
	var fmCheck *internal.Check
	for i := range result.Checks {
		if result.Checks[i].Name == "frontmatter_valid" {
			fmCheck = &result.Checks[i]
			break
		}
	}

	if fmCheck == nil {
		t.Fatal("Expected frontmatter_valid check to be present")
	}

	if fmCheck.Passed {
		t.Error("Expected frontmatter_valid check to fail for unclosed frontmatter")
	}
}

func TestListSkills(t *testing.T) {
	tmpDir := t.TempDir()

	// Create multiple skills
	skills := []string{"skill-a", "skill-b", "skill-c"}
	for _, s := range skills {
		content := `---
name: ` + s + `
description: Test skill
---
`
		createTestSkill(t, tmpDir, s, content)
	}

	// Create a directory without SKILL.md (should be excluded)
	noSkillDir := filepath.Join(tmpDir, ".claude", "skills", "no-skill-file")
	if err := os.MkdirAll(noSkillDir, 0755); err != nil {
		t.Fatalf("Failed to create directory: %v", err)
	}

	result, err := internal.ListSkills(tmpDir)
	if err != nil {
		t.Fatalf("ListSkills failed: %v", err)
	}

	if len(result) != 3 {
		t.Errorf("Expected 3 skills, got %d", len(result))
	}

	// Verify all expected skills are present
	skillSet := make(map[string]bool)
	for _, s := range result {
		skillSet[s] = true
	}

	for _, expected := range skills {
		if !skillSet[expected] {
			t.Errorf("Expected skill '%s' not found in results", expected)
		}
	}

	// Verify directory without SKILL.md is not included
	if skillSet["no-skill-file"] {
		t.Error("Directory without SKILL.md should not be included")
	}
}

func TestListSkills_NoSkillsDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	result, err := internal.ListSkills(tmpDir)
	if err != nil {
		t.Fatalf("ListSkills failed: %v", err)
	}

	if result != nil && len(result) != 0 {
		t.Errorf("Expected empty list for missing skills directory, got %v", result)
	}
}

func TestValidateAllSkills(t *testing.T) {
	tmpDir := t.TempDir()

	// Create valid skill
	validContent := `---
name: valid-skill
description: A valid skill
---
`
	createTestSkill(t, tmpDir, "valid-skill", validContent)

	// Create invalid skill (missing description)
	invalidContent := `---
name: invalid-skill
---
`
	createTestSkill(t, tmpDir, "invalid-skill", invalidContent)

	results, err := internal.ValidateAllSkills(tmpDir)
	if err != nil {
		t.Fatalf("ValidateAllSkills failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 results, got %d", len(results))
	}

	// Check valid skill
	validResult, ok := results["valid-skill"]
	if !ok {
		t.Fatal("Expected 'valid-skill' in results")
	}
	if !validResult.Exists {
		t.Error("Expected valid-skill to exist")
	}
	if validResult.Message != "Skill exists and is valid" {
		t.Errorf("Expected success message for valid-skill, got '%s'", validResult.Message)
	}

	// Check invalid skill
	invalidResult, ok := results["invalid-skill"]
	if !ok {
		t.Fatal("Expected 'invalid-skill' in results")
	}
	if !invalidResult.Exists {
		t.Error("Expected invalid-skill file to exist")
	}
	if invalidResult.Message == "Skill exists and is valid" {
		t.Error("Expected validation issues message for invalid-skill")
	}
}

// Tests for CheckSkillScript (PowerShell compatibility)

func TestCheckSkillScript_Found(t *testing.T) {
	tmpDir := t.TempDir()

	createTestScript(t, tmpDir, "pr", "Get-PRContext.ps1")

	found, path := internal.CheckSkillScript(tmpDir, "pr", "PRContext")

	if !found {
		t.Error("Expected script to be found")
	}

	if path == "" {
		t.Error("Expected non-empty path")
	}

	expectedSuffix := filepath.Join(".claude", "skills", "github", "scripts", "pr", "Get-PRContext.ps1")
	if !containsSuffix(path, expectedSuffix) {
		t.Errorf("Expected path to end with '%s', got '%s'", expectedSuffix, path)
	}
}

func TestCheckSkillScript_NotFound(t *testing.T) {
	tmpDir := t.TempDir()

	// Create a different script
	createTestScript(t, tmpDir, "pr", "Get-PRComments.ps1")

	found, path := internal.CheckSkillScript(tmpDir, "pr", "Nonexistent")

	if found {
		t.Error("Expected script to not be found")
	}

	if path != "" {
		t.Errorf("Expected empty path, got '%s'", path)
	}
}

func TestCheckSkillScript_InvalidOperation(t *testing.T) {
	tmpDir := t.TempDir()

	found, _ := internal.CheckSkillScript(tmpDir, "invalid", "action")

	if found {
		t.Error("Expected false for invalid operation")
	}
}

func TestCheckSkillScript_EmptyAction(t *testing.T) {
	tmpDir := t.TempDir()

	found, _ := internal.CheckSkillScript(tmpDir, "pr", "")

	if found {
		t.Error("Expected false for empty action")
	}
}

func TestCheckSkillScript_CaseInsensitive(t *testing.T) {
	tmpDir := t.TempDir()

	createTestScript(t, tmpDir, "issue", "Get-IssueDetails.ps1")

	// Search with different case
	found, _ := internal.CheckSkillScript(tmpDir, "issue", "issuedetails")

	if !found {
		t.Error("Expected case-insensitive match")
	}
}

func TestCheckSkillScript_AllOperations(t *testing.T) {
	operations := []string{"pr", "issue", "reactions", "label", "milestone"}

	for _, op := range operations {
		t.Run(op, func(t *testing.T) {
			tmpDir := t.TempDir()

			scriptName := "Test-" + op + "-Action.ps1"
			createTestScript(t, tmpDir, op, scriptName)

			found, _ := internal.CheckSkillScript(tmpDir, op, "Action")

			if !found {
				t.Errorf("Expected script to be found for operation '%s'", op)
			}
		})
	}
}

func TestListSkillScripts(t *testing.T) {
	tmpDir := t.TempDir()

	scripts := []string{"Get-PRContext.ps1", "Get-PRComments.ps1", "Merge-PR.ps1"}
	for _, s := range scripts {
		createTestScript(t, tmpDir, "pr", s)
	}

	// Add a non-PS1 file (should be ignored)
	nonScript := filepath.Join(tmpDir, ".claude", "skills", "github", "scripts", "pr", "readme.md")
	if err := os.WriteFile(nonScript, []byte("readme"), 0644); err != nil {
		t.Fatalf("Failed to create readme: %v", err)
	}

	result, err := internal.ListSkillScripts(tmpDir, "pr")
	if err != nil {
		t.Fatalf("ListSkillScripts failed: %v", err)
	}

	if len(result) != 3 {
		t.Errorf("Expected 3 scripts, got %d", len(result))
	}

	// Verify script names (without extension)
	expected := map[string]bool{
		"Get-PRContext":  true,
		"Get-PRComments": true,
		"Merge-PR":       true,
	}

	for _, script := range result {
		if !expected[script] {
			t.Errorf("Unexpected script: %s", script)
		}
	}
}

func TestListSkillScripts_NoDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	result, err := internal.ListSkillScripts(tmpDir, "pr")
	if err != nil {
		t.Fatalf("ListSkillScripts failed: %v", err)
	}

	if result != nil && len(result) != 0 {
		t.Errorf("Expected empty list, got %v", result)
	}
}

func TestListAllSkillScripts(t *testing.T) {
	tmpDir := t.TempDir()

	// Create scripts in different operations
	createTestScript(t, tmpDir, "pr", "Get-PR.ps1")
	createTestScript(t, tmpDir, "pr", "Merge-PR.ps1")
	createTestScript(t, tmpDir, "issue", "Get-Issue.ps1")
	createTestScript(t, tmpDir, "milestone", "Get-Milestone.ps1")

	result, err := internal.ListAllSkillScripts(tmpDir)
	if err != nil {
		t.Fatalf("ListAllSkillScripts failed: %v", err)
	}

	if len(result) != 3 {
		t.Errorf("Expected 3 operations with scripts, got %d", len(result))
	}

	if len(result["pr"]) != 2 {
		t.Errorf("Expected 2 PR scripts, got %d", len(result["pr"]))
	}

	if len(result["issue"]) != 1 {
		t.Errorf("Expected 1 issue script, got %d", len(result["issue"]))
	}

	if len(result["milestone"]) != 1 {
		t.Errorf("Expected 1 milestone script, got %d", len(result["milestone"]))
	}

	// Operations without scripts should not be in result
	if _, ok := result["reactions"]; ok {
		t.Error("Expected reactions to not be in result (no scripts)")
	}

	if _, ok := result["label"]; ok {
		t.Error("Expected label to not be in result (no scripts)")
	}
}

// Helper function to check if path ends with expected suffix
func containsSuffix(path, suffix string) bool {
	// Normalize separators
	path = filepath.ToSlash(path)
	suffix = filepath.ToSlash(suffix)
	return len(path) >= len(suffix) && path[len(path)-len(suffix):] == suffix
}

func TestCheckSkillExists_SkillPathInResult(t *testing.T) {
	tmpDir := t.TempDir()

	content := `---
name: path-test
description: Test path in result
---
`
	createTestSkill(t, tmpDir, "path-test", content)

	result := internal.CheckSkillExists(tmpDir, "path-test")

	if result.SkillPath == "" {
		t.Error("Expected SkillPath to be set")
	}

	expectedPath := filepath.Join(tmpDir, ".claude", "skills", "path-test", "SKILL.md")
	if result.SkillPath != expectedPath {
		t.Errorf("Expected path '%s', got '%s'", expectedPath, result.SkillPath)
	}
}

func TestCheckSkillExists_SkillPathOnNotFound(t *testing.T) {
	tmpDir := t.TempDir()

	result := internal.CheckSkillExists(tmpDir, "missing")

	if result.SkillPath == "" {
		t.Error("Expected SkillPath to be set even when skill not found")
	}

	expectedPath := filepath.Join(tmpDir, ".claude", "skills", "missing", "SKILL.md")
	if result.SkillPath != expectedPath {
		t.Errorf("Expected path '%s', got '%s'", expectedPath, result.SkillPath)
	}
}
