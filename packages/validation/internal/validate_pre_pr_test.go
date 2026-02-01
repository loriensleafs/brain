package internal_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for ValidatePrePR

func TestValidatePrePR_EmptyDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	result := internal.ValidatePrePR(tmpDir, false)

	// Empty directory in full mode may note missing CI config but still pass core checks
	// Cross-cutting and fail-safe checks should pass with no source files
	if !result.CrossCuttingConcerns.Passed {
		t.Errorf("Expected cross-cutting concerns to pass for empty dir, got issues: %v", result.CrossCuttingConcerns.Issues)
	}
	if !result.FailSafeDesign.Passed {
		t.Errorf("Expected fail-safe design to pass for empty dir, got issues: %v", result.FailSafeDesign.Issues)
	}
	if result.Mode != "full" {
		t.Errorf("Expected mode 'full', got: %s", result.Mode)
	}
}

func TestValidatePrePR_QuickMode(t *testing.T) {
	tmpDir := t.TempDir()

	result := internal.ValidatePrePR(tmpDir, true)

	if result.Mode != "quick" {
		t.Errorf("Expected mode 'quick', got: %s", result.Mode)
	}
}

// Tests for ValidateCrossCuttingConcerns

func TestValidateCrossCuttingConcerns_NoIssues(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create clean source file
	content := `package main

func main() {
	fmt.Println("Hello, World!")
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "main.go"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCrossCuttingConcerns(config)

	if !result.Passed {
		t.Errorf("Expected clean file to pass, got issues: %v", result.Issues)
	}
}

func TestValidateCrossCuttingConcerns_HardcodedSecrets(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create file with hardcoded secrets
	content := `package main

const apiKey = "sk-1234567890abcdef"
const password = "secret123"
`
	if err := os.WriteFile(filepath.Join(srcDir, "config.go"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCrossCuttingConcerns(config)

	if result.Passed {
		t.Error("Expected hardcoded secrets to fail validation")
	}
	if len(result.HardcodedValues) == 0 {
		t.Error("Expected HardcodedValues to be populated")
	}
}

func TestValidateCrossCuttingConcerns_TodoComments(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create file with TODO comments
	content := `package main

// TODO: implement this
// FIXME: broken
// XXX: temporary hack
func main() {
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "main.go"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCrossCuttingConcerns(config)

	if result.Passed {
		t.Error("Expected TODO comments to fail validation")
	}
	if len(result.TodoComments) == 0 {
		t.Error("Expected TodoComments to be populated")
	}
}

func TestValidateCrossCuttingConcerns_HardcodedIP(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	content := `package main

const serverIP = "192.168.1.100"
const port = "localhost:8080"
`
	if err := os.WriteFile(filepath.Join(srcDir, "server.go"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCrossCuttingConcerns(config)

	if result.Passed {
		t.Error("Expected hardcoded IP/localhost to fail validation")
	}
	if len(result.HardcodedValues) == 0 {
		t.Error("Expected HardcodedValues to contain IP address")
	}
}

// Tests for ValidateFailSafeDesign

func TestValidateFailSafeDesign_NoIssues(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "scripts")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create scripts dir: %v", err)
	}

	// Create PowerShell script with proper error handling
	content := `$ErrorActionPreference = 'Stop'

git status
if ($LASTEXITCODE -ne 0) {
    throw "Git status failed"
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "deploy.ps1"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateFailSafeDesign(config)

	if !result.Passed {
		t.Errorf("Expected proper error handling to pass, got issues: %v", result.Issues)
	}
}

func TestValidateFailSafeDesign_SilentFailure(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create file with silent failure pattern
	content := `function doSomething() {
    try {
        riskyOperation();
    } catch {}
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "util.js"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateFailSafeDesign(config)

	if result.Passed {
		t.Error("Expected empty catch block to fail validation")
	}
	if len(result.SilentFailures) == 0 {
		t.Error("Expected SilentFailures to be populated")
	}
}

func TestValidateFailSafeDesign_SilentContinue(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "scripts")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create scripts dir: %v", err)
	}

	content := `Get-Item "nonexistent" -ErrorAction SilentlyContinue
`
	if err := os.WriteFile(filepath.Join(srcDir, "test.ps1"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateFailSafeDesign(config)

	if result.Passed {
		t.Error("Expected SilentlyContinue to fail validation")
	}
	if len(result.SilentFailures) == 0 {
		t.Error("Expected SilentFailures to contain SilentlyContinue pattern")
	}
}

func TestValidateFailSafeDesign_InsecureDefaults(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	content := `package main

var client = &http.Client{
    Transport: &http.Transport{
        TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
    },
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "client.go"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateFailSafeDesign(config)

	if result.Passed {
		t.Error("Expected InsecureSkipVerify to fail validation")
	}
	if len(result.InsecureDefaults) == 0 {
		t.Error("Expected InsecureDefaults to be populated")
	}
}

func TestValidateFailSafeDesign_DevNull(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "scripts")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create scripts dir: %v", err)
	}

	content := `#!/bin/bash
command_that_might_fail 2>/dev/null
`
	if err := os.WriteFile(filepath.Join(srcDir, "run.sh"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateFailSafeDesign(config)

	if result.Passed {
		t.Error("Expected 2>/dev/null to fail validation")
	}
}

// Tests for ValidateTestImplementationAlignment

func TestValidateTestImplementationAlignment_NoSourceFiles(t *testing.T) {
	tmpDir := t.TempDir()

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateTestImplementationAlignment(config)

	if !result.Passed {
		t.Errorf("Expected empty directory to pass: %v", result.Issues)
	}
}

func TestValidateTestImplementationAlignment_WithTests(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create source file
	srcContent := `package main

func Add(a, b int) int {
    return a + b
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "math.go"), []byte(srcContent), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	// Create test file
	testContent := `package main

import "testing"

func TestAdd(t *testing.T) {
    result := Add(1, 2)
    if result != 3 {
        t.Error("Expected 3")
    }
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "math_test.go"), []byte(testContent), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateTestImplementationAlignment(config)

	if result.CoveragePercent < 0 {
		t.Errorf("Expected non-negative coverage, got: %f", result.CoveragePercent)
	}
}

// Tests for ValidateCIEnvironment

func TestValidateCIEnvironment_NoConfig(t *testing.T) {
	tmpDir := t.TempDir()

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCIEnvironment(config)

	// No CI config should note the absence
	if len(result.Issues) == 0 {
		t.Error("Expected issue noting missing CI configuration")
	}
}

func TestValidateCIEnvironment_GitHubActions(t *testing.T) {
	tmpDir := t.TempDir()
	workflowDir := filepath.Join(tmpDir, ".github", "workflows")
	if err := os.MkdirAll(workflowDir, 0755); err != nil {
		t.Fatalf("Failed to create workflows dir: %v", err)
	}

	// Create GitHub Actions workflow
	content := `name: CI
on: [push, pull_request]
env:
  CI: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: make build
      - name: Test
        run: make test
        env:
          GITHUB_ACTIONS: true
`
	if err := os.WriteFile(filepath.Join(workflowDir, "ci.yml"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create workflow file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCIEnvironment(config)

	if !result.ConfigDocumented {
		t.Error("Expected ConfigDocumented to be true")
	}
	if !result.CIFlagsVerified {
		t.Error("Expected CIFlagsVerified to be true")
	}
	if !result.BuildVerified {
		t.Error("Expected BuildVerified to be true")
	}
}

func TestValidateCIEnvironment_ContinueOnError(t *testing.T) {
	tmpDir := t.TempDir()
	workflowDir := filepath.Join(tmpDir, ".github", "workflows")
	if err := os.MkdirAll(workflowDir, 0755); err != nil {
		t.Fatalf("Failed to create workflows dir: %v", err)
	}

	content := `name: CI
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Risky step
        run: might-fail
        continue-on-error: true
`
	if err := os.WriteFile(filepath.Join(workflowDir, "ci.yml"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create workflow file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateCIEnvironment(config)

	// Should warn about continue-on-error
	foundWarning := false
	for _, issue := range result.Issues {
		if len(issue) > 0 && (issue[0:2] == "ci" || issue[0:1] == ".") {
			foundWarning = true
			break
		}
	}
	if !foundWarning && len(result.Issues) == 0 {
		t.Error("Expected warning about continue-on-error")
	}
}

// Tests for ValidateEnvironmentVariables

func TestValidateEnvironmentVariables_NoEnvFile(t *testing.T) {
	tmpDir := t.TempDir()

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateEnvironmentVariables(config)

	// No env file and no env vars in code should pass
	if !result.Passed {
		t.Errorf("Expected no env file to pass: %v", result.Issues)
	}
}

func TestValidateEnvironmentVariables_DocumentedVars(t *testing.T) {
	tmpDir := t.TempDir()

	// Create .env.example
	envContent := `DATABASE_URL=postgres://localhost/db
API_KEY=your-api-key-here
DEBUG=false
`
	if err := os.WriteFile(filepath.Join(tmpDir, ".env.example"), []byte(envContent), 0644); err != nil {
		t.Fatalf("Failed to create .env.example: %v", err)
	}

	// Create source file using env vars
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	srcContent := `const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;
`
	if err := os.WriteFile(filepath.Join(srcDir, "config.js"), []byte(srcContent), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateEnvironmentVariables(config)

	if !result.Passed {
		t.Errorf("Expected documented env vars to pass: %v", result.Issues)
	}
	if len(result.DocumentedVars) < 2 {
		t.Errorf("Expected at least 2 documented vars, got: %v", result.DocumentedVars)
	}
}

func TestValidateEnvironmentVariables_UndocumentedVars(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create source file with undocumented env var
	srcContent := `const secret = process.env.MY_SECRET_KEY;
`
	if err := os.WriteFile(filepath.Join(srcDir, "config.js"), []byte(srcContent), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	// Empty .env.example
	if err := os.WriteFile(filepath.Join(tmpDir, ".env.example"), []byte(""), 0644); err != nil {
		t.Fatalf("Failed to create .env.example: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateEnvironmentVariables(config)

	if result.Passed {
		t.Error("Expected undocumented env var to fail validation")
	}
	if len(result.MissingDefaults) == 0 {
		t.Error("Expected MissingDefaults to contain MY_SECRET_KEY")
	}
}

func TestValidateEnvironmentVariables_WellKnownVars(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create source file using well-known env vars
	srcContent := `const home = process.env.HOME;
const ci = process.env.CI;
const nodeEnv = process.env.NODE_ENV;
`
	if err := os.WriteFile(filepath.Join(srcDir, "config.js"), []byte(srcContent), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	result := internal.ValidateEnvironmentVariables(config)

	// Well-known vars should not be flagged as missing
	if !result.Passed {
		t.Errorf("Expected well-known env vars to pass: %v", result.Issues)
	}
}

// Tests for ValidatePrePRFromContent

func TestValidatePrePRFromContent_Clean(t *testing.T) {
	content := map[string]string{
		"main.go": `package main

func main() {
	fmt.Println("Hello")
}
`,
	}

	result := internal.ValidatePrePRFromContent(content, false)

	if !result.Valid {
		t.Errorf("Expected clean content to pass: %s", result.Message)
	}
}

func TestValidatePrePRFromContent_WithIssues(t *testing.T) {
	content := map[string]string{
		"config.go": `package main

const apiKey = "secret123"
// TODO: remove hardcoded value
`,
	}

	result := internal.ValidatePrePRFromContent(content, false)

	if result.Valid {
		t.Error("Expected content with issues to fail")
	}
	if result.CrossCuttingConcerns.Passed {
		t.Error("Expected cross-cutting concerns to fail")
	}
}

func TestValidatePrePRFromContent_SilentFailure(t *testing.T) {
	content := map[string]string{
		"util.js": `function doSomething() {
    try {
        riskyOperation();
    } catch {}
}
`,
	}

	result := internal.ValidatePrePRFromContent(content, false)

	if result.Valid {
		t.Error("Expected silent failure to fail validation")
	}
	if result.FailSafeDesign.Passed {
		t.Error("Expected fail-safe design to fail")
	}
}

func TestValidatePrePRFromContent_QuickMode(t *testing.T) {
	content := map[string]string{
		"main.go": `package main

func main() {}
`,
	}

	result := internal.ValidatePrePRFromContent(content, true)

	if result.Mode != "quick" {
		t.Errorf("Expected mode 'quick', got: %s", result.Mode)
	}
}

// Tests for ValidatePrePRWithConfig

func TestValidatePrePRWithConfig_CustomSourceDirs(t *testing.T) {
	tmpDir := t.TempDir()
	customDir := filepath.Join(tmpDir, "custom-src")
	if err := os.MkdirAll(customDir, 0755); err != nil {
		t.Fatalf("Failed to create custom dir: %v", err)
	}

	// Create file with issue in custom directory
	content := `const secret = "password123"
`
	if err := os.WriteFile(filepath.Join(customDir, "config.js"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	config := internal.DefaultPrePRConfig(tmpDir)
	config.SourceDirs = []string{"custom-src"}

	result := internal.ValidatePrePRWithConfig(config)

	if result.Valid {
		t.Error("Expected issue in custom dir to fail validation")
	}
}

func TestValidatePrePRWithConfig_SkipTests(t *testing.T) {
	tmpDir := t.TempDir()

	config := internal.DefaultPrePRConfig(tmpDir)
	config.SkipTests = true

	result := internal.ValidatePrePRWithConfig(config)

	// When skipping tests, TestImplementation should be empty/default
	if result.TestImplementation.Passed && len(result.TestImplementation.Issues) > 0 {
		t.Error("Expected test validation to be skipped")
	}
}

// Tests for DefaultPrePRConfig

func TestDefaultPrePRConfig(t *testing.T) {
	config := internal.DefaultPrePRConfig("/test/path")

	if config.BasePath != "/test/path" {
		t.Errorf("Expected BasePath '/test/path', got: %s", config.BasePath)
	}
	if config.QuickMode {
		t.Error("Expected QuickMode to be false by default")
	}
	if config.SkipTests {
		t.Error("Expected SkipTests to be false by default")
	}
	if len(config.SourceDirs) == 0 {
		t.Error("Expected default SourceDirs to be populated")
	}
	if len(config.EnvFiles) == 0 {
		t.Error("Expected default EnvFiles to be populated")
	}
}

// Integration Tests

func TestValidatePrePR_FullWorkflow_Clean(t *testing.T) {
	tmpDir := t.TempDir()

	// Set up clean project structure
	dirs := []string{
		filepath.Join(tmpDir, "src"),
		filepath.Join(tmpDir, "tests"),
		filepath.Join(tmpDir, ".github", "workflows"),
	}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatalf("Failed to create dir %s: %v", dir, err)
		}
	}

	// Clean source file
	srcContent := `package main

import "fmt"

func Hello(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func main() {
	fmt.Println(Hello("World"))
}
`
	if err := os.WriteFile(filepath.Join(tmpDir, "src", "main.go"), []byte(srcContent), 0644); err != nil {
		t.Fatalf("Failed to create source file: %v", err)
	}

	// Test file
	testContent := `package main

import "testing"

func TestHello(t *testing.T) {
	result := Hello("Test")
	expected := "Hello, Test!"
	if result != expected {
		t.Errorf("Expected %s, got %s", expected, result)
	}
}
`
	if err := os.WriteFile(filepath.Join(tmpDir, "src", "main_test.go"), []byte(testContent), 0644); err != nil {
		t.Fatalf("Failed to create test file: %v", err)
	}

	// CI workflow
	workflowContent := `name: CI
on: [push]
env:
  CI: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: go build ./...
      - name: Test
        run: go test ./...
`
	if err := os.WriteFile(filepath.Join(tmpDir, ".github", "workflows", "ci.yml"), []byte(workflowContent), 0644); err != nil {
		t.Fatalf("Failed to create workflow file: %v", err)
	}

	result := internal.ValidatePrePR(tmpDir, false)

	if !result.Valid {
		t.Errorf("Expected clean project to pass validation, got: %s", result.Message)
		for _, check := range result.Checks {
			if !check.Passed {
				t.Errorf("Failed check: %s - %s", check.Name, check.Message)
			}
		}
	}
}

func TestValidatePrePR_FullWorkflow_WithIssues(t *testing.T) {
	tmpDir := t.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	if err := os.MkdirAll(srcDir, 0755); err != nil {
		t.Fatalf("Failed to create src dir: %v", err)
	}

	// Create file with multiple issues
	content := `package main

const apiKey = "sk-hardcoded-secret"
const serverIP = "192.168.1.1"

// TODO: fix this
// FIXME: and this

func riskyOperation() {
	defer func() {
		if r := recover(); r != nil {
			// silently ignore
		}
	}()
}
`
	if err := os.WriteFile(filepath.Join(srcDir, "bad.go"), []byte(content), 0644); err != nil {
		t.Fatalf("Failed to create file: %v", err)
	}

	result := internal.ValidatePrePR(tmpDir, false)

	if result.Valid {
		t.Error("Expected project with issues to fail validation")
	}

	// Check that specific issues were detected
	if result.CrossCuttingConcerns.Passed {
		t.Error("Expected cross-cutting concerns to fail")
	}
	if len(result.CrossCuttingConcerns.HardcodedValues) == 0 {
		t.Error("Expected hardcoded values to be detected")
	}
	if len(result.CrossCuttingConcerns.TodoComments) == 0 {
		t.Error("Expected TODO comments to be detected")
	}
}

// Benchmark Tests

func BenchmarkValidatePrePR(b *testing.B) {
	tmpDir := b.TempDir()
	srcDir := filepath.Join(tmpDir, "src")
	os.MkdirAll(srcDir, 0755)

	// Create a few source files
	for i := 0; i < 10; i++ {
		content := `package main

func Function` + string(rune('A'+i)) + `() {
	fmt.Println("Hello")
}
`
		os.WriteFile(filepath.Join(srcDir, "file"+string(rune('0'+i))+".go"), []byte(content), 0644)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidatePrePR(tmpDir, false)
	}
}

func BenchmarkValidatePrePRFromContent(b *testing.B) {
	content := map[string]string{
		"main.go":   `package main; func main() {}`,
		"config.go": `package main; const x = "test"`,
		"util.go":   `package main; func util() {}`,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		internal.ValidatePrePRFromContent(content, false)
	}
}
