package tests

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/validation"
)

// Helper function to create a temp git repo
func createTempGitRepo(t *testing.T) string {
	t.Helper()
	tmpDir := t.TempDir()

	// Initialize git repo
	cmd := exec.Command("git", "init")
	cmd.Dir = tmpDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to init git repo: %v", err)
	}

	// Configure git user for commits
	cmd = exec.Command("git", "config", "user.email", "test@test.com")
	cmd.Dir = tmpDir
	cmd.Run()
	cmd = exec.Command("git", "config", "user.name", "Test User")
	cmd.Dir = tmpDir
	cmd.Run()

	return tmpDir
}

// Tests for DetectTestCoverageGaps

func TestDetectTestCoverageGaps_GoFiles(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	// Create Go source files
	srcDir := filepath.Join(tmpDir, "pkg", "service")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create source file without test
	srcFile := filepath.Join(srcDir, "handler.go")
	if err := os.WriteFile(srcFile, []byte("package service\n\nfunc Handle() {}"), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	// Create source file with test
	srcFileWithTest := filepath.Join(srcDir, "processor.go")
	if err := os.WriteFile(srcFileWithTest, []byte("package service\n\nfunc Process() {}"), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}
	testFile := filepath.Join(srcDir, "processor_test.go")
	if err := os.WriteFile(testFile, []byte("package service\n\nfunc TestProcess(t *testing.T) {}"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	if result.TotalSourceFiles != 2 {
		t.Errorf("Expected 2 total source files, got %d", result.TotalSourceFiles)
	}
	if result.FilesWithTests != 1 {
		t.Errorf("Expected 1 file with tests, got %d", result.FilesWithTests)
	}
	if result.FilesWithoutTests != 1 {
		t.Errorf("Expected 1 file without tests, got %d", result.FilesWithoutTests)
	}
	if result.CoveragePercent != 50.0 {
		t.Errorf("Expected 50%% coverage, got %.1f%%", result.CoveragePercent)
	}
	if len(result.MissingTests) != 1 {
		t.Errorf("Expected 1 missing test, got %d", len(result.MissingTests))
	}
	if len(result.MissingTests) > 0 {
		if !strings.Contains(result.MissingTests[0].SourceFile, "handler.go") {
			t.Errorf("Expected handler.go in missing tests, got %s", result.MissingTests[0].SourceFile)
		}
	}
}

func TestDetectTestCoverageGaps_PowerShellFiles(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	scriptsDir := filepath.Join(tmpDir, "scripts")
	if err := os.MkdirAll(scriptsDir, 0755); err != nil {
		t.Fatalf("Failed to create scripts dir: %v", err)
	}

	// Create PS1 file without test
	psFile := filepath.Join(scriptsDir, "Deploy-App.ps1")
	if err := os.WriteFile(psFile, []byte("Write-Host 'Deploying'"), 0644); err != nil {
		t.Fatalf("Failed to create ps1 file: %v", err)
	}

	// Create PS1 file with test
	psFileWithTest := filepath.Join(scriptsDir, "Build-App.ps1")
	if err := os.WriteFile(psFileWithTest, []byte("Write-Host 'Building'"), 0644); err != nil {
		t.Fatalf("Failed to create ps1 file: %v", err)
	}
	testFile := filepath.Join(scriptsDir, "Build-App.Tests.ps1")
	if err := os.WriteFile(testFile, []byte("Describe 'Build-App' {}"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "powershell",
	})

	if result.TotalSourceFiles != 2 {
		t.Errorf("Expected 2 total source files, got %d", result.TotalSourceFiles)
	}
	if result.FilesWithTests != 1 {
		t.Errorf("Expected 1 file with tests, got %d", result.FilesWithTests)
	}
	if len(result.MissingTests) != 1 {
		t.Errorf("Expected 1 missing test, got %d", len(result.MissingTests))
	}
}

func TestDetectTestCoverageGaps_TypeScriptFiles(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create TS file without test
	tsFile := filepath.Join(srcDir, "api.ts")
	if err := os.WriteFile(tsFile, []byte("export const api = {}"), 0644); err != nil {
		t.Fatalf("Failed to create ts file: %v", err)
	}

	// Create TS file with .test.ts
	tsFileWithTest := filepath.Join(srcDir, "utils.ts")
	if err := os.WriteFile(tsFileWithTest, []byte("export const utils = {}"), 0644); err != nil {
		t.Fatalf("Failed to create ts file: %v", err)
	}
	testFile := filepath.Join(srcDir, "utils.test.ts")
	if err := os.WriteFile(testFile, []byte("describe('utils', () => {})"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// Create TS file with .spec.ts
	tsFileWithSpec := filepath.Join(srcDir, "helpers.ts")
	if err := os.WriteFile(tsFileWithSpec, []byte("export const helpers = {}"), 0644); err != nil {
		t.Fatalf("Failed to create ts file: %v", err)
	}
	specFile := filepath.Join(srcDir, "helpers.spec.ts")
	if err := os.WriteFile(specFile, []byte("describe('helpers', () => {})"), 0644); err != nil {
		t.Fatalf("Failed to create spec file: %v", err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "typescript",
	})

	if result.TotalSourceFiles != 3 {
		t.Errorf("Expected 3 total source files, got %d", result.TotalSourceFiles)
	}
	if result.FilesWithTests != 2 {
		t.Errorf("Expected 2 files with tests (.test.ts and .spec.ts), got %d", result.FilesWithTests)
	}
	if len(result.MissingTests) != 1 {
		t.Errorf("Expected 1 missing test, got %d", len(result.MissingTests))
	}
}

func TestDetectTestCoverageGaps_PythonFiles(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create Python file without test
	pyFile := filepath.Join(srcDir, "app.py")
	if err := os.WriteFile(pyFile, []byte("def main(): pass"), 0644); err != nil {
		t.Fatalf("Failed to create py file: %v", err)
	}

	// Create Python file with test (test_*.py convention)
	pyFileWithTest := filepath.Join(srcDir, "utils.py")
	if err := os.WriteFile(pyFileWithTest, []byte("def helper(): pass"), 0644); err != nil {
		t.Fatalf("Failed to create py file: %v", err)
	}
	testFile := filepath.Join(srcDir, "test_utils.py")
	if err := os.WriteFile(testFile, []byte("def test_helper(): pass"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "python",
	})

	if result.TotalSourceFiles != 2 {
		t.Errorf("Expected 2 total source files, got %d", result.TotalSourceFiles)
	}
	if result.FilesWithTests != 1 {
		t.Errorf("Expected 1 file with tests, got %d", result.FilesWithTests)
	}
}

func TestDetectTestCoverageGaps_CSharpFiles(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create C# file without test
	csFile := filepath.Join(srcDir, "Service.cs")
	if err := os.WriteFile(csFile, []byte("public class Service {}"), 0644); err != nil {
		t.Fatalf("Failed to create cs file: %v", err)
	}

	// Create C# file with test
	csFileWithTest := filepath.Join(srcDir, "Controller.cs")
	if err := os.WriteFile(csFileWithTest, []byte("public class Controller {}"), 0644); err != nil {
		t.Fatalf("Failed to create cs file: %v", err)
	}
	testFile := filepath.Join(srcDir, "ControllerTests.cs")
	if err := os.WriteFile(testFile, []byte("[TestClass] public class ControllerTests {}"), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "csharp",
	})

	if result.TotalSourceFiles != 2 {
		t.Errorf("Expected 2 total source files, got %d", result.TotalSourceFiles)
	}
	if result.FilesWithTests != 1 {
		t.Errorf("Expected 1 file with tests, got %d", result.FilesWithTests)
	}
}

func TestDetectTestCoverageGaps_Threshold(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create 2 files, 1 with test = 50% coverage
	if err := os.WriteFile(filepath.Join(srcDir, "a.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "b.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "b_test.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	// Test with threshold below coverage - should pass
	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath:  tmpDir,
		Language:  "go",
		Threshold: 40.0,
	})

	if !result.Valid {
		t.Error("Expected validation to pass when coverage >= threshold")
	}

	// Test with threshold above coverage - should fail
	result = validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath:  tmpDir,
		Language:  "go",
		Threshold: 80.0,
	})

	if result.Valid {
		t.Error("Expected validation to fail when coverage < threshold")
	}

	foundThresholdCheck := false
	for _, check := range result.Checks {
		if check.Name == "coverage_threshold" && !check.Passed {
			foundThresholdCheck = true
		}
	}
	if !foundThresholdCheck {
		t.Error("Expected coverage_threshold check to fail")
	}
}

func TestDetectTestCoverageGaps_AllFilesHaveTests(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create files with tests
	if err := os.WriteFile(filepath.Join(srcDir, "a.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "a_test.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "b.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "b_test.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	if !result.Valid {
		t.Error("Expected validation to pass")
	}
	if result.CoveragePercent != 100.0 {
		t.Errorf("Expected 100%% coverage, got %.1f%%", result.CoveragePercent)
	}
	if len(result.MissingTests) != 0 {
		t.Errorf("Expected no missing tests, got %d", len(result.MissingTests))
	}
	if result.Message != "All source files have test coverage" {
		t.Errorf("Unexpected message: %s", result.Message)
	}
}

func TestDetectTestCoverageGaps_NoSourceFiles(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	// Empty directory
	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	if !result.Valid {
		t.Error("Expected validation to pass with no files")
	}
	if result.CoveragePercent != 100.0 {
		t.Errorf("Expected 100%% coverage for empty directory, got %.1f%%", result.CoveragePercent)
	}
	if result.Message != "No source files to check for test coverage" {
		t.Errorf("Unexpected message: %s", result.Message)
	}
}

func TestDetectTestCoverageGaps_IgnorePatterns(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create source files
	if err := os.WriteFile(filepath.Join(srcDir, "handler.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "generated.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	// Test with custom ignore pattern
	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath:       tmpDir,
		Language:       "go",
		CustomPatterns: []string{`generated\.go$`},
	})

	if result.TotalSourceFiles != 1 {
		t.Errorf("Expected 1 source file (generated.go ignored), got %d", result.TotalSourceFiles)
	}
}

func TestDetectTestCoverageGaps_IgnoreFile(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create source files
	if err := os.WriteFile(filepath.Join(srcDir, "handler.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "mock_service.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create ignore file
	ignoreFile := filepath.Join(tmpDir, ".testignore")
	ignoreContent := `# Ignore mock files
mock_.*\.go$
`
	if err := os.WriteFile(ignoreFile, []byte(ignoreContent), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath:   tmpDir,
		Language:   "go",
		IgnoreFile: ignoreFile,
	})

	if result.TotalSourceFiles != 1 {
		t.Errorf("Expected 1 source file (mock ignored), got %d", result.TotalSourceFiles)
	}
}

func TestDetectTestCoverageGaps_TestInSubdirectory(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	testsDir := filepath.Join(srcDir, "tests")
	if err := os.MkdirAll(testsDir, 0755); err != nil {
		t.Fatalf("Failed to create dirs: %v", err)
	}

	// Create source file
	if err := os.WriteFile(filepath.Join(srcDir, "handler.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create test in tests/ subdirectory
	if err := os.WriteFile(filepath.Join(testsDir, "handler_test.go"), []byte("package tests"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	if result.FilesWithTests != 1 {
		t.Errorf("Expected 1 file with tests (in tests/ subdir), got %d", result.FilesWithTests)
	}
}

func TestDetectTestCoverageGaps_DefaultIgnore(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	// Create vendor directory (should be ignored)
	vendorDir := filepath.Join(tmpDir, "vendor", "pkg")
	if err := os.MkdirAll(vendorDir, 0755); err != nil {
		t.Fatalf("Failed to create vendor dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(vendorDir, "lib.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create main.go (should be ignored)
	if err := os.WriteFile(filepath.Join(tmpDir, "main.go"), []byte("package main"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create regular source file
	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(srcDir, "service.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	// Should only count service.go, not vendor/pkg/lib.go or main.go
	if result.TotalSourceFiles != 1 {
		t.Errorf("Expected 1 source file (vendor and main ignored), got %d", result.TotalSourceFiles)
	}
}

func TestDetectTestCoverageGaps_NotGitRepo(t *testing.T) {
	tmpDir := t.TempDir()
	// Don't initialize git

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	if result.Valid {
		t.Error("Expected validation to fail for non-git directory")
	}
	if result.Message != "Not in a git repository" {
		t.Errorf("Unexpected message: %s", result.Message)
	}
}

func TestDetectTestCoverageGaps_UnsupportedLanguage(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "cobol",
	})

	if result.Valid {
		t.Error("Expected validation to fail for unsupported language")
	}
	if !strings.Contains(result.Message, "Unsupported language") {
		t.Errorf("Unexpected message: %s", result.Message)
	}
}

func TestDetectTestCoverageGaps_AutoDetectLanguage(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create Go files (majority)
	for i := 0; i < 5; i++ {
		if err := os.WriteFile(filepath.Join(srcDir, "file"+string(rune('a'+i))+".go"), []byte("package pkg"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	// Create one TS file
	if err := os.WriteFile(filepath.Join(srcDir, "utils.ts"), []byte("export {}"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		// No language specified - should auto-detect Go
	})

	if result.Language != "go" {
		t.Errorf("Expected auto-detected language 'go', got '%s'", result.Language)
	}
}

// Tests for convenience functions

func TestDetectTestCoverageGapsForLanguage(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	if err := os.WriteFile(filepath.Join(srcDir, "handler.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGapsForLanguage(tmpDir, "go", 0)

	if result.Language != "go" {
		t.Errorf("Expected language 'go', got '%s'", result.Language)
	}
	if result.TotalSourceFiles != 1 {
		t.Errorf("Expected 1 source file, got %d", result.TotalSourceFiles)
	}
}

func TestDetectTestCoverageGapsStaged(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create and stage a file
	stagedFile := filepath.Join(srcDir, "staged.go")
	if err := os.WriteFile(stagedFile, []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	cmd := exec.Command("git", "add", "pkg/staged.go")
	cmd.Dir = tmpDir
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to stage file: %v", err)
	}

	// Create unstaged file
	unstagedFile := filepath.Join(srcDir, "unstaged.go")
	if err := os.WriteFile(unstagedFile, []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGapsStaged(tmpDir, "go")

	if !result.StagedOnly {
		t.Error("Expected StagedOnly to be true")
	}
	if result.TotalSourceFiles != 1 {
		t.Errorf("Expected 1 staged source file, got %d", result.TotalSourceFiles)
	}
}

// Tests for GetSupportedLanguages

func TestGetSupportedLanguages(t *testing.T) {
	languages := validation.GetSupportedLanguages()

	expectedLanguages := []string{"go", "powershell", "typescript", "javascript", "python", "csharp"}

	for _, expected := range expectedLanguages {
		found := false
		for _, lang := range languages {
			if lang == expected {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Expected language '%s' not found in supported languages", expected)
		}
	}
}

// Tests for AddLanguageConfig

func TestAddLanguageConfig(t *testing.T) {
	// Add custom language config
	validation.AddLanguageConfig("rust", validation.LanguageConfig{
		Extensions:  []string{".rs"},
		TestSuffix:  "_test.rs",
		TestPattern: validation.LanguageConfigs["go"].TestPattern, // Reuse pattern for testing
		DefaultIgnore: []string{
			`_test\.rs$`,
			`/target/`,
		},
	})

	languages := validation.GetSupportedLanguages()
	found := false
	for _, lang := range languages {
		if lang == "rust" {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected 'rust' to be in supported languages after AddLanguageConfig")
	}

	// Clean up
	delete(validation.LanguageConfigs, "rust")
}

// Tests for edge cases

func TestDetectTestCoverageGaps_EmptyPath(t *testing.T) {
	// Current directory should be used
	// This test assumes we're in a git repo
	cwd, _ := os.Getwd()
	gitRoot := findTestGitRoot(cwd)
	if gitRoot == "" {
		t.Skip("Not in a git repository, skipping test")
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: "",
		Language: "go",
	})

	// Should not fail
	if result.Message == "" {
		t.Error("Expected a message")
	}
}

func TestDetectTestCoverageGaps_Remediation(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create files without tests
	for i := 0; i < 15; i++ {
		if err := os.WriteFile(filepath.Join(srcDir, "file"+string(rune('a'+i))+".go"), []byte("package pkg"), 0644); err != nil {
			t.Fatal(err)
		}
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath:  tmpDir,
		Language:  "go",
		Threshold: 80.0, // Force failure to get remediation
	})

	if result.Remediation == "" {
		t.Error("Expected remediation message")
	}
	if !strings.Contains(result.Remediation, "Add test files") {
		t.Errorf("Remediation should mention adding test files: %s", result.Remediation)
	}
	if !strings.Contains(result.Remediation, "... and") {
		t.Error("Remediation should truncate long lists")
	}
}

func TestDetectTestCoverageGaps_RelativePaths(t *testing.T) {
	tmpDir := createTempGitRepo(t)

	srcDir := filepath.Join(tmpDir, "deep", "nested", "pkg")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	if err := os.WriteFile(filepath.Join(srcDir, "handler.go"), []byte("package pkg"), 0644); err != nil {
		t.Fatal(err)
	}

	result := validation.DetectTestCoverageGaps(validation.TestCoverageGapOptions{
		BasePath: tmpDir,
		Language: "go",
	})

	if len(result.MissingTests) != 1 {
		t.Fatalf("Expected 1 missing test, got %d", len(result.MissingTests))
	}

	// Source path should be relative
	if strings.HasPrefix(result.MissingTests[0].SourceFile, "/") ||
		strings.HasPrefix(result.MissingTests[0].SourceFile, tmpDir) {
		t.Errorf("Expected relative path, got: %s", result.MissingTests[0].SourceFile)
	}

	// Should use forward slashes for consistency
	if strings.Contains(result.MissingTests[0].SourceFile, "\\") {
		t.Errorf("Expected forward slashes in path, got: %s", result.MissingTests[0].SourceFile)
	}
}

// Helper to find git root for testing
func findTestGitRoot(startDir string) string {
	cmd := exec.Command("git", "-C", startDir, "rev-parse", "--show-toplevel")
	output, err := cmd.Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(output))
}
