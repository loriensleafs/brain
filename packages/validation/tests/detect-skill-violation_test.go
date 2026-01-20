package tests

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/validation"
)

// Tests for GhCommandPatterns

func TestGhCommandPatterns_PRCommands(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"pr create", "gh pr create --title 'test'", true},
		{"pr merge", "gh pr merge 123", true},
		{"pr close", "gh pr close 123", true},
		{"pr view", "gh pr view 123", true},
		{"pr list", "gh pr list", true},
		{"pr diff", "gh pr diff 123", true},
		{"pr checkout not matched", "gh pr checkout 123", false},
		{"no match", "echo hello", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched := false
			for _, pattern := range validation.GhCommandPatterns {
				if pattern.MatchString(tt.input) {
					matched = true
					break
				}
			}
			if matched != tt.expected {
				t.Errorf("Pattern match for %q = %v, expected %v", tt.input, matched, tt.expected)
			}
		})
	}
}

func TestGhCommandPatterns_IssueCommands(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"issue create", "gh issue create --title 'bug'", true},
		{"issue close", "gh issue close 42", true},
		{"issue view", "gh issue view 42", true},
		{"issue list", "gh issue list", true},
		{"issue edit not matched", "gh issue edit 42", false},
		{"no match", "echo hello", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched := false
			for _, pattern := range validation.GhCommandPatterns {
				if pattern.MatchString(tt.input) {
					matched = true
					break
				}
			}
			if matched != tt.expected {
				t.Errorf("Pattern match for %q = %v, expected %v", tt.input, matched, tt.expected)
			}
		})
	}
}

func TestGhCommandPatterns_APICommands(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"api repos", "gh api repos/owner/repo", true},
		{"api graphql", "gh api graphql -f query='...'", true},
		{"api with flags", "gh api -X POST /repos/owner/repo/issues", true},
		{"no match", "echo hello", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched := false
			for _, pattern := range validation.GhCommandPatterns {
				if pattern.MatchString(tt.input) {
					matched = true
					break
				}
			}
			if matched != tt.expected {
				t.Errorf("Pattern match for %q = %v, expected %v", tt.input, matched, tt.expected)
			}
		})
	}
}

func TestGhCommandPatterns_RepoCommands(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"repo clone", "gh repo clone owner/repo", true},
		{"repo create", "gh repo create my-repo", true},
		{"repo view", "gh repo view", true},
		{"no match", "echo hello", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched := false
			for _, pattern := range validation.GhCommandPatterns {
				if pattern.MatchString(tt.input) {
					matched = true
					break
				}
			}
			if matched != tt.expected {
				t.Errorf("Pattern match for %q = %v, expected %v", tt.input, matched, tt.expected)
			}
		})
	}
}

// Tests for DetectSkillViolationsFromContent

func TestDetectSkillViolationsFromContent_NoViolations(t *testing.T) {
	contents := map[string]string{
		"clean.md": `# Clean File

This file has no gh commands.
Just regular documentation.
`,
		"clean.ps1": `# PowerShell script
Write-Host "Hello"
git status
`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if !result.Valid {
		t.Error("Expected validation to pass")
	}
	if len(result.Violations) != 0 {
		t.Errorf("Expected 0 violations, got %d", len(result.Violations))
	}
	if result.FilesChecked != 2 {
		t.Errorf("Expected 2 files checked, got %d", result.FilesChecked)
	}
	if result.Message != "No skill violations detected" {
		t.Errorf("Unexpected message: %s", result.Message)
	}
}

func TestDetectSkillViolationsFromContent_WithViolations(t *testing.T) {
	contents := map[string]string{
		"violation.md": `# PR Documentation

To create a PR, run:
gh pr create --title "my pr"
`,
		"clean.md": `# Clean File
No violations here.
`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if !result.Valid {
		// Note: violations are non-blocking warnings
		t.Error("Expected validation to pass (violations are warnings)")
	}
	if len(result.Violations) != 1 {
		t.Errorf("Expected 1 violation, got %d", len(result.Violations))
	}
	if result.Violations[0].File != "violation.md" {
		t.Errorf("Expected violation in violation.md, got %s", result.Violations[0].File)
	}
	if result.Violations[0].Line != 4 {
		t.Errorf("Expected violation on line 4, got %d", result.Violations[0].Line)
	}
	if result.Violations[0].Command != "pr" {
		t.Errorf("Expected command 'pr', got %s", result.Violations[0].Command)
	}
}

func TestDetectSkillViolationsFromContent_MultipleViolations(t *testing.T) {
	contents := map[string]string{
		"file1.md":  `gh pr create --title "test"`,
		"file2.ps1": `gh issue create --title "bug"`,
		"file3.md":  `gh api repos/owner/repo`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if len(result.Violations) != 3 {
		t.Errorf("Expected 3 violations, got %d", len(result.Violations))
	}

	// Check capability gaps
	if len(result.CapabilityGaps) != 3 {
		t.Errorf("Expected 3 capability gaps, got %d: %v", len(result.CapabilityGaps), result.CapabilityGaps)
	}
}

func TestDetectSkillViolationsFromContent_OnlyFirstViolationPerLine(t *testing.T) {
	contents := map[string]string{
		"multi.md": `gh pr create && gh issue create`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	// Should only report first violation per line
	if len(result.Violations) != 1 {
		t.Errorf("Expected 1 violation (first per line), got %d", len(result.Violations))
	}
}

func TestDetectSkillViolationsFromContent_EmptyContent(t *testing.T) {
	contents := map[string]string{}

	result := validation.DetectSkillViolationsFromContent(contents)

	if !result.Valid {
		t.Error("Expected validation to pass for empty content")
	}
	if len(result.Violations) != 0 {
		t.Errorf("Expected 0 violations, got %d", len(result.Violations))
	}
	if result.FilesChecked != 0 {
		t.Errorf("Expected 0 files checked, got %d", result.FilesChecked)
	}
}

// Tests for ScanFileForViolations

func TestScanFileForViolations_ValidFile(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "test.md")

	content := `# Documentation

## Commands

gh pr list
gh issue view 42
echo "no violation"
gh api repos/owner/repo
`
	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	violations, err := validation.ScanFileForViolations(testFile)
	if err != nil {
		t.Fatalf("ScanFileForViolations failed: %v", err)
	}

	if len(violations) != 3 {
		t.Errorf("Expected 3 violations, got %d", len(violations))
	}

	// Check line numbers
	expectedLines := []int{5, 6, 8}
	for i, v := range violations {
		if v.Line != expectedLines[i] {
			t.Errorf("Violation %d: expected line %d, got %d", i, expectedLines[i], v.Line)
		}
	}
}

func TestScanFileForViolations_NoViolations(t *testing.T) {
	tmpDir := t.TempDir()
	testFile := filepath.Join(tmpDir, "clean.md")

	content := `# Clean File

This file has no gh commands.
git status
git push
`
	if err := os.WriteFile(testFile, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	violations, err := validation.ScanFileForViolations(testFile)
	if err != nil {
		t.Fatalf("ScanFileForViolations failed: %v", err)
	}

	if len(violations) != 0 {
		t.Errorf("Expected 0 violations, got %d", len(violations))
	}
}

func TestScanFileForViolations_NonexistentFile(t *testing.T) {
	_, err := validation.ScanFileForViolations("/nonexistent/path/file.md")
	if err == nil {
		t.Error("Expected error for nonexistent file")
	}
}

// Tests for SkillViolationResult methods

func TestSkillViolationResult_HasSkillViolations(t *testing.T) {
	// Test with violations
	resultWithViolations := validation.SkillViolationResult{
		Violations: []validation.SkillViolation{
			{File: "test.md", Line: 1, Command: "pr"},
		},
	}
	if !resultWithViolations.HasSkillViolations() {
		t.Error("Expected HasSkillViolations to return true")
	}

	// Test without violations
	resultNoViolations := validation.SkillViolationResult{}
	if resultNoViolations.HasSkillViolations() {
		t.Error("Expected HasSkillViolations to return false")
	}
}

func TestSkillViolationResult_ViolationCount(t *testing.T) {
	result := validation.SkillViolationResult{
		Violations: []validation.SkillViolation{
			{File: "a.md", Line: 1},
			{File: "b.md", Line: 2},
			{File: "c.md", Line: 3},
		},
	}

	if result.ViolationCount() != 3 {
		t.Errorf("Expected ViolationCount 3, got %d", result.ViolationCount())
	}
}

// Tests for DetectSkillViolations with file system

// initGitRepo initializes a git repo in the given directory.
func initGitRepo(t *testing.T, dir string) {
	t.Helper()
	cmd := exec.Command("git", "-C", dir, "init")
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to initialize git repo: %v", err)
	}
	// Configure git to avoid warnings
	exec.Command("git", "-C", dir, "config", "user.email", "test@example.com").Run()
	exec.Command("git", "-C", dir, "config", "user.name", "Test User").Run()
}

func TestDetectSkillViolations_NoSkillsDir(t *testing.T) {
	// Create a git repo without skills directory
	tmpDir := t.TempDir()
	initGitRepo(t, tmpDir)

	result := validation.DetectSkillViolations(tmpDir, false)

	// Should pass (no skills dir means nothing to enforce)
	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
	}
	if result.SkillsDir == "" {
		t.Error("Expected SkillsDir to be set")
	}
}

func TestDetectSkillViolations_WithSkillsDirNoViolations(t *testing.T) {
	// Create a git repo with skills directory
	tmpDir := t.TempDir()
	initGitRepo(t, tmpDir)
	skillsDir := filepath.Join(tmpDir, ".claude", "skills", "github", "scripts")

	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		t.Fatalf("Failed to create skills dir: %v", err)
	}

	// Create a clean markdown file
	cleanFile := filepath.Join(tmpDir, "README.md")
	if err := os.WriteFile(cleanFile, []byte("# README\nNo gh commands here."), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectSkillViolations(tmpDir, false)

	if !result.Valid {
		t.Errorf("Expected validation to pass, got: %s", result.Message)
	}
	if len(result.Violations) != 0 {
		t.Errorf("Expected 0 violations, got %d", len(result.Violations))
	}
	if result.FilesChecked == 0 {
		t.Error("Expected at least 1 file checked")
	}
}

func TestDetectSkillViolations_WithViolations(t *testing.T) {
	// Create a git repo with skills directory
	tmpDir := t.TempDir()
	initGitRepo(t, tmpDir)
	skillsDir := filepath.Join(tmpDir, ".claude", "skills", "github", "scripts")

	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		t.Fatalf("Failed to create skills dir: %v", err)
	}

	// Create files with violations
	violationFile := filepath.Join(tmpDir, "docs.md")
	content := `# Documentation

## Creating PRs

Run: gh pr create --title "test"
`
	if err := os.WriteFile(violationFile, []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectSkillViolations(tmpDir, false)

	// Should still be valid (violations are warnings)
	if !result.Valid {
		t.Errorf("Expected validation to pass (warnings only), got: %s", result.Message)
	}
	if len(result.Violations) != 1 {
		t.Errorf("Expected 1 violation, got %d", len(result.Violations))
	}
	if len(result.CapabilityGaps) != 1 {
		t.Errorf("Expected 1 capability gap, got %d", len(result.CapabilityGaps))
	}
	if result.CapabilityGaps[0] != "pr" {
		t.Errorf("Expected capability gap 'pr', got %s", result.CapabilityGaps[0])
	}
}

func TestDetectSkillViolations_ExcludesGitDir(t *testing.T) {
	// Create a git repo with skills directory
	tmpDir := t.TempDir()
	initGitRepo(t, tmpDir)
	gitDir := filepath.Join(tmpDir, ".git")
	skillsDir := filepath.Join(tmpDir, ".claude", "skills", "github", "scripts")

	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		t.Fatalf("Failed to create skills dir: %v", err)
	}

	// Create a file inside .git that would be a violation
	gitFile := filepath.Join(gitDir, "hooks", "pre-commit.md")
	if err := os.MkdirAll(filepath.Dir(gitFile), 0755); err != nil {
		t.Fatalf("Failed to create hooks dir: %v", err)
	}
	if err := os.WriteFile(gitFile, []byte("gh pr create"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Create a clean file outside .git
	cleanFile := filepath.Join(tmpDir, "README.md")
	if err := os.WriteFile(cleanFile, []byte("# README"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectSkillViolations(tmpDir, false)

	// Should not detect the violation inside .git
	if len(result.Violations) != 0 {
		t.Errorf("Expected 0 violations (files in .git excluded), got %d", len(result.Violations))
	}
}

func TestDetectSkillViolations_ExcludesNodeModules(t *testing.T) {
	// Create a git repo with skills directory
	tmpDir := t.TempDir()
	gitDir := filepath.Join(tmpDir, ".git")
	skillsDir := filepath.Join(tmpDir, ".claude", "skills", "github", "scripts")
	nodeModulesDir := filepath.Join(tmpDir, "node_modules", "some-pkg")

	if err := os.MkdirAll(gitDir, 0755); err != nil {
		t.Fatalf("Failed to create .git dir: %v", err)
	}
	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		t.Fatalf("Failed to create skills dir: %v", err)
	}
	if err := os.MkdirAll(nodeModulesDir, 0755); err != nil {
		t.Fatalf("Failed to create node_modules dir: %v", err)
	}

	// Create a file inside node_modules that would be a violation
	nodeFile := filepath.Join(nodeModulesDir, "README.md")
	if err := os.WriteFile(nodeFile, []byte("gh pr create"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Create a clean file outside node_modules
	cleanFile := filepath.Join(tmpDir, "README.md")
	if err := os.WriteFile(cleanFile, []byte("# README"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectSkillViolations(tmpDir, false)

	// Should not detect the violation inside node_modules
	if len(result.Violations) != 0 {
		t.Errorf("Expected 0 violations (files in node_modules excluded), got %d", len(result.Violations))
	}
}

func TestDetectSkillViolations_OnlyMdPs1Files(t *testing.T) {
	// Create a git repo with skills directory
	tmpDir := t.TempDir()
	gitDir := filepath.Join(tmpDir, ".git")
	skillsDir := filepath.Join(tmpDir, ".claude", "skills", "github", "scripts")

	if err := os.MkdirAll(gitDir, 0755); err != nil {
		t.Fatalf("Failed to create .git dir: %v", err)
	}
	if err := os.MkdirAll(skillsDir, 0755); err != nil {
		t.Fatalf("Failed to create skills dir: %v", err)
	}

	// Create files with violations but wrong extension
	txtFile := filepath.Join(tmpDir, "notes.txt")
	if err := os.WriteFile(txtFile, []byte("gh pr create"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	jsFile := filepath.Join(tmpDir, "script.js")
	if err := os.WriteFile(jsFile, []byte("// gh pr create"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Create a clean .md file
	mdFile := filepath.Join(tmpDir, "README.md")
	if err := os.WriteFile(mdFile, []byte("# README"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectSkillViolations(tmpDir, false)

	// Should not detect violations in .txt or .js files
	if len(result.Violations) != 0 {
		t.Errorf("Expected 0 violations (only .md/.ps1/.psm1 checked), got %d", len(result.Violations))
	}
}

// Tests for remediation message

func TestBuildSkillViolationRemediation(t *testing.T) {
	contents := map[string]string{
		"test.md": `gh pr create
gh issue list
gh api repos/owner/repo`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if result.Remediation == "" {
		t.Error("Expected remediation message")
	}

	// Check that remediation contains expected content
	if len(result.CapabilityGaps) == 0 {
		t.Error("Expected capability gaps")
	}
}

// Tests for edge cases

func TestDetectSkillViolations_WhitespaceVariations(t *testing.T) {
	contents := map[string]string{
		"test.md": `gh  pr  create
gh	pr	create
  gh pr create
`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	// All variations should be detected
	if len(result.Violations) < 2 {
		t.Errorf("Expected at least 2 violations for whitespace variations, got %d", len(result.Violations))
	}
}

func TestDetectSkillViolations_InlineCode(t *testing.T) {
	contents := map[string]string{
		"docs.md": "Use `gh pr create` to create a PR.",
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	// Should still detect inline code references
	if len(result.Violations) != 1 {
		t.Errorf("Expected 1 violation for inline code, got %d", len(result.Violations))
	}
}

func TestDetectSkillViolations_CodeBlock(t *testing.T) {
	contents := map[string]string{
		"docs.md": "```bash\ngh pr create --title 'test'\n```",
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	// Should detect gh commands in code blocks
	if len(result.Violations) != 1 {
		t.Errorf("Expected 1 violation in code block, got %d", len(result.Violations))
	}
}

func TestDetectSkillViolations_PowerShellFile(t *testing.T) {
	contents := map[string]string{
		"script.ps1": `# PowerShell script
$result = gh pr list
gh issue create --title "Bug"
`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if len(result.Violations) != 2 {
		t.Errorf("Expected 2 violations in PowerShell file, got %d", len(result.Violations))
	}
}

func TestDetectSkillViolations_PowerShellModuleFile(t *testing.T) {
	contents := map[string]string{
		"module.psm1": `function Get-PR {
    gh pr view $Number
}
`,
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if len(result.Violations) != 1 {
		t.Errorf("Expected 1 violation in PowerShell module file, got %d", len(result.Violations))
	}
}

// Test for checks structure

func TestDetectSkillViolationsFromContent_ChecksStructure(t *testing.T) {
	contents := map[string]string{
		"test.md": "gh pr create",
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	if len(result.Checks) == 0 {
		t.Error("Expected checks to be populated")
	}

	foundSkillCheck := false
	for _, check := range result.Checks {
		if check.Name == "skill_violation" {
			foundSkillCheck = true
			if check.Passed {
				t.Error("Expected skill_violation check to fail")
			}
		}
	}

	if !foundSkillCheck {
		t.Error("Expected skill_violation check in results")
	}
}

func TestDetectSkillViolationsFromContent_NoViolationsChecks(t *testing.T) {
	contents := map[string]string{
		"clean.md": "No violations here",
	}

	result := validation.DetectSkillViolationsFromContent(contents)

	foundPassingCheck := false
	for _, check := range result.Checks {
		if check.Name == "skill_violation" && check.Passed {
			foundPassingCheck = true
		}
	}

	if !foundPassingCheck {
		t.Error("Expected passing skill_violation check")
	}
}
