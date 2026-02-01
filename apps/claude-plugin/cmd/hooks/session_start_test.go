// Package main provides unit tests for the session start functions.
// Tests cover:
// - identifyProject with environment variable and CLI auto-detection
// - getGitContext retrieval
// - getBootstrapContext CLI integration
// - loadWorkflowState CLI integration
// - buildSessionOutput integration
package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/utils"
)

// mockExecCommandForSession creates a mock exec.Command that returns the provided output.
func mockExecCommandForSession(output string) func(string, ...string) *exec.Cmd {
	return func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}
}

// mockExecCommandForSessionError creates a mock exec.Command that simulates an error.
func mockExecCommandForSessionError(exitCode int, stderr string) func(string, ...string) *exec.Cmd {
	return func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")
		cmd.Env = append(os.Environ(),
			"GO_WANT_HELPER_PROCESS=1",
			"MOCK_ERROR=1",
			"MOCK_EXIT_CODE="+string(rune('0'+exitCode)),
			"MOCK_STDERR="+stderr,
		)
		return cmd
	}
}

// TestHelperProcessSession is used to mock exec.Command calls.
func TestHelperProcessSession(t *testing.T) {
	if os.Getenv("GO_WANT_HELPER_PROCESS") != "1" {
		return
	}

	if os.Getenv("MOCK_ERROR") == "1" {
		os.Stderr.WriteString(os.Getenv("MOCK_STDERR"))
		exitCode := os.Getenv("MOCK_EXIT_CODE")
		if exitCode != "" && exitCode[0] != '0' {
			os.Exit(int(exitCode[0] - '0'))
		}
		os.Exit(1)
	}

	output := os.Getenv("MOCK_OUTPUT")
	os.Stdout.WriteString(output)
	os.Exit(0)
}

// === Tests for identifyProject ===

func TestIdentifyProject_FromEnvironment(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BRAIN_PROJECT" {
			return "test-project"
		}
		return ""
	}

	project, err := identifyProject("")

	if err != nil {
		t.Fatalf("identifyProject() returned error: %v", err)
	}
	if project != "test-project" {
		t.Errorf("identifyProject() = %q, want %q", project, "test-project")
	}
}

func TestIdentifyProject_FromCwdMatch(t *testing.T) {
	// Save and restore originals
	origGetEnv := GetEnv
	origBrainConfigPath := utils.GetBrainConfigPath
	defer func() {
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origBrainConfigPath)
	}()

	// No environment variable set
	GetEnv = func(key string) string { return "" }

	// Create temp config file with matching path
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	cwd, _ := os.Getwd()
	// Escape backslashes for JSON on Windows
	escapedCwd := strings.ReplaceAll(cwd, "\\", "\\\\")
	configContent := `{"version": "2.0.0", "projects": {"test-project": {"code_path": "` + escapedCwd + `"}}}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	utils.SetBrainConfigPath(func() string { return configPath })

	// Test with empty CWD (falls back to os.Getwd())
	project, err := identifyProject("")

	if err != nil {
		t.Fatalf("identifyProject() returned error: %v", err)
	}
	if project != "test-project" {
		t.Errorf("identifyProject() = %q, want %q", project, "test-project")
	}
}

func TestIdentifyProject_NoCwdMatch_ReturnsError(t *testing.T) {
	// Save and restore originals
	origGetEnv := GetEnv
	origBrainConfigPath := utils.GetBrainConfigPath
	defer func() {
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origBrainConfigPath)
	}()

	// No environment variable set
	GetEnv = func(key string) string { return "" }

	// Create temp config file with non-matching path
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{"version": "2.0.0", "projects": {"other-project": {"code_path": "/some/other/path"}}}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	utils.SetBrainConfigPath(func() string { return configPath })

	_, err := identifyProject("")

	if err == nil {
		t.Error("identifyProject() should return error when no CWD match found")
	}
}

func TestIdentifyProject_EmptyConfig_ReturnsError(t *testing.T) {
	// Save and restore originals
	origGetEnv := GetEnv
	origBrainConfigPath := utils.GetBrainConfigPath
	defer func() {
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origBrainConfigPath)
	}()

	// No environment variable set
	GetEnv = func(key string) string { return "" }

	// Create temp config file with empty projects
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{"version": "2.0.0", "projects": {}}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	utils.SetBrainConfigPath(func() string { return configPath })

	_, err := identifyProject("")

	if err == nil {
		t.Error("identifyProject() should return error when config has no projects")
	}
}

func TestIdentifyProject_WithExplicitCwd(t *testing.T) {
	// Save and restore originals
	origGetEnv := GetEnv
	origBrainConfigPath := utils.GetBrainConfigPath
	defer func() {
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origBrainConfigPath)
	}()

	// No environment variable set
	GetEnv = func(key string) string { return "" }

	// Create temp project dir and config
	projectDir := t.TempDir()
	configDir := t.TempDir()
	configPath := filepath.Join(configDir, "config.json")

	// Escape backslashes for JSON on Windows
	escapedProjectDir := strings.ReplaceAll(projectDir, "\\", "\\\\")
	configContent := `{"version": "2.0.0", "projects": {"explicit-project": {"code_path": "` + escapedProjectDir + `"}}}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	utils.SetBrainConfigPath(func() string { return configPath })

	// Pass explicit CWD that matches the project path
	project, err := identifyProject(projectDir)

	if err != nil {
		t.Fatalf("identifyProject() returned error: %v", err)
	}
	if project != "explicit-project" {
		t.Errorf("identifyProject() = %q, want %q", project, "explicit-project")
	}
}

// === Tests for getGitContext ===

func TestGetGitContext_Success(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	// Track which commands were called
	callCount := 0
	ExecCommandSession = func(name string, args ...string) *exec.Cmd {
		callCount++
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")

		var output string
		if len(args) > 0 {
			switch args[0] {
			case "branch":
				output = "feature/test-branch\n"
			case "log":
				output = "abc123 First commit\ndef456 Second commit\n"
			case "status":
				output = "" // clean
			}
		}
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}

	context, err := getGitContext()

	if err != nil {
		t.Fatalf("getGitContext() returned error: %v", err)
	}
	if context.Branch != "feature/test-branch" {
		t.Errorf("Branch = %q, want %q", context.Branch, "feature/test-branch")
	}
	if context.Status != "clean" {
		t.Errorf("Status = %q, want %q", context.Status, "clean")
	}
}

func TestGetGitContext_DirtyStatus(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	ExecCommandSession = func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")

		var output string
		if len(args) > 0 && args[0] == "status" {
			output = "M  modified_file.go\n?? untracked_file.go\n"
		}
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}

	context, err := getGitContext()

	if err != nil {
		t.Fatalf("getGitContext() returned error: %v", err)
	}
	if context.Status != "dirty" {
		t.Errorf("Status = %q, want %q", context.Status, "dirty")
	}
}

// === Tests for getBootstrapContext ===

func TestGetBootstrapContext_Success(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	bootstrapOutput := `## Memory Context [v6]

**Project:** test-project
**Retrieved:** 1/19/2026, 4:14:34 AM

### Active Features

- Feature-Auth: Authentication implementation
`
	ExecCommandSession = mockExecCommandForSession(bootstrapOutput)

	result, err := getBootstrapContext("test-project")

	if err != nil {
		t.Fatalf("getBootstrapContext() returned error: %v", err)
	}
	if result["markdown"] != bootstrapOutput {
		t.Errorf("getBootstrapContext() markdown mismatch")
	}
}

func TestGetBootstrapContext_Failure(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	ExecCommandSession = mockExecCommandForSessionError(1, "Project not found")

	_, err := getBootstrapContext("nonexistent")

	if err == nil {
		t.Error("getBootstrapContext() should return error on CLI failure")
	}
}

// === Tests for loadWorkflowState ===

func TestLoadWorkflowState_Success(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	stateJSON := `{"mode":"analysis","task":"Investigate bug","sessionId":"abc123"}`
	ExecCommandSession = mockExecCommandForSession(stateJSON)

	state, err := loadWorkflowState()

	if err != nil {
		t.Fatalf("loadWorkflowState() returned error: %v", err)
	}
	if state.Mode != "analysis" {
		t.Errorf("Mode = %q, want %q", state.Mode, "analysis")
	}
	if state.Task != "Investigate bug" {
		t.Errorf("Task = %q, want %q", state.Task, "Investigate bug")
	}
	if state.SessionID != "abc123" {
		t.Errorf("SessionID = %q, want %q", state.SessionID, "abc123")
	}
}

func TestLoadWorkflowState_CLIFailure(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	ExecCommandSession = mockExecCommandForSessionError(1, "Session not found")

	_, err := loadWorkflowState()

	if err == nil {
		t.Error("loadWorkflowState() should return error on CLI failure")
	}
}

func TestLoadWorkflowState_InvalidJSON(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	ExecCommandSession = mockExecCommandForSession("not valid json")

	_, err := loadWorkflowState()

	if err == nil {
		t.Error("loadWorkflowState() should return error for invalid JSON")
	}
}

func TestLoadWorkflowState_CorrectCommandArguments(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	// Track the command and arguments passed
	var capturedName string
	var capturedArgs []string

	ExecCommandSession = func(name string, args ...string) *exec.Cmd {
		capturedName = name
		capturedArgs = args

		// Return valid JSON to avoid parse errors
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+`{"mode":"analysis"}`)
		return cmd
	}

	_, _ = loadWorkflowState()

	// Verify the correct command was called
	if capturedName != "brain" {
		t.Errorf("loadWorkflowState() called command %q, want %q", capturedName, "brain")
	}

	// Verify the correct arguments were passed
	expectedArgs := []string{"session", "get-state"}
	if len(capturedArgs) != len(expectedArgs) {
		t.Errorf("loadWorkflowState() called with %d args %v, want %d args %v",
			len(capturedArgs), capturedArgs, len(expectedArgs), expectedArgs)
		return
	}

	for i, arg := range expectedArgs {
		if capturedArgs[i] != arg {
			t.Errorf("loadWorkflowState() arg[%d] = %q, want %q", i, capturedArgs[i], arg)
		}
	}
}

// === Tests for buildSessionOutput ===

func TestBuildSessionOutput_Success(t *testing.T) {
	// Save and restore originals
	origExecCommand := ExecCommandSession
	origGetEnv := GetEnv
	defer func() {
		ExecCommandSession = origExecCommand
		GetEnv = origGetEnv
	}()

	GetEnv = func(key string) string {
		if key == "BRAIN_PROJECT" {
			return "test-project"
		}
		return ""
	}

	ExecCommandSession = func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")

		var output string
		if name == "brain" && len(args) > 0 {
			switch args[0] {
			case "bootstrap":
				output = "## Memory Context\n**Project:** test-project"
			case "session":
				output = `{"mode":"coding"}`
			}
		} else if name == "git" && len(args) > 0 {
			switch args[0] {
			case "branch":
				output = "main\n"
			case "log":
				output = "abc123 Initial commit\n"
			case "status":
				output = ""
			}
		}
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}

	result := buildSessionOutput("")

	if !result.Success {
		t.Errorf("buildSessionOutput().Success = false, want true. Error: %s", result.Error)
	}
	if result.Project != "test-project" {
		t.Errorf("Project = %q, want %q", result.Project, "test-project")
	}
	if result.GitContext == nil {
		t.Error("GitContext should not be nil")
	}
	if result.WorkflowState == nil {
		t.Error("WorkflowState should not be nil")
	}
}

func TestBuildSessionOutput_ProjectIdentificationFails_ReturnsNoProjectFlag(t *testing.T) {
	// Save and restore originals
	origExecCommand := ExecCommandSession
	origGetEnv := GetEnv
	origBrainConfigPath := utils.GetBrainConfigPath
	defer func() {
		ExecCommandSession = origExecCommand
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origBrainConfigPath)
	}()

	// No environment variable
	GetEnv = func(key string) string { return "" }

	// Empty config (no projects to match against)
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	if err := os.WriteFile(configPath, []byte(`{"version": "2.0.0", "projects": {}}`), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}
	utils.SetBrainConfigPath(func() string { return configPath })

	result := buildSessionOutput("")

	// Now we expect success with noProject flag instead of error
	if !result.Success {
		t.Error("buildSessionOutput().Success = false, want true (with noProject flag)")
	}
	if result.BootstrapInfo == nil {
		t.Fatal("buildSessionOutput().BootstrapInfo should not be nil")
	}
	noProject, ok := result.BootstrapInfo["noProject"].(bool)
	if !ok || !noProject {
		t.Error("buildSessionOutput().BootstrapInfo[\"noProject\"] should be true")
	}
}

func TestBuildSessionOutput_WithExplicitCwd(t *testing.T) {
	// Save and restore originals
	origExecCommand := ExecCommandSession
	origGetEnv := GetEnv
	origBrainConfigPath := utils.GetBrainConfigPath
	defer func() {
		ExecCommandSession = origExecCommand
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origBrainConfigPath)
	}()

	// No environment variable
	GetEnv = func(key string) string { return "" }

	// Create project dir and config
	projectDir := t.TempDir()
	configDir := t.TempDir()
	configPath := filepath.Join(configDir, "config.json")

	escapedProjectDir := strings.ReplaceAll(projectDir, "\\", "\\\\")
	configContent := `{"version": "2.0.0", "projects": {"cwd-project": {"code_path": "` + escapedProjectDir + `"}}}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}
	utils.SetBrainConfigPath(func() string { return configPath })

	ExecCommandSession = func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")
		var output string
		if name == "brain" && len(args) > 0 {
			switch args[0] {
			case "bootstrap":
				output = "## Memory Context\n**Project:** cwd-project"
			case "session":
				output = `{"mode":"coding"}`
			}
		} else if name == "git" {
			output = ""
		}
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}

	// Pass explicit CWD from hook input
	result := buildSessionOutput(projectDir)

	if !result.Success {
		t.Errorf("buildSessionOutput().Success = false, want true. Error: %s", result.Error)
	}
	if result.Project != "cwd-project" {
		t.Errorf("Project = %q, want %q", result.Project, "cwd-project")
	}
}

// === Tests for JSON serialization ===

func TestSessionStartOutput_JSONSerialization(t *testing.T) {
	output := &SessionStartOutput{
		Success: true,
		Project: "my-project",
		GitContext: &GitContextInfo{
			Branch:        "main",
			RecentCommits: []string{"abc123 Initial commit"},
			Status:        "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown": "## Context",
		},
		WorkflowState: &WorkflowStateInfo{
			Mode: "analysis",
			Task: "Research",
		},
	}

	data, err := json.Marshal(output)
	if err != nil {
		t.Fatalf("Failed to marshal SessionStartOutput: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal SessionStartOutput: %v", err)
	}

	if parsed["success"] != true {
		t.Errorf("JSON success = %v, want true", parsed["success"])
	}
	if parsed["project"] != "my-project" {
		t.Errorf("JSON project = %v, want my-project", parsed["project"])
	}
}

func TestSessionStartOutput_OmitsEmptyFields(t *testing.T) {
	output := &SessionStartOutput{
		Success: true,
		Project: "my-project",
	}

	data, err := json.Marshal(output)
	if err != nil {
		t.Fatalf("Failed to marshal SessionStartOutput: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal SessionStartOutput: %v", err)
	}

	// gitContext, bootstrapInfo, workflowState, error should be omitted
	if _, exists := parsed["gitContext"]; exists {
		t.Error("JSON should not contain gitContext when nil")
	}
	if _, exists := parsed["error"]; exists {
		t.Error("JSON should not contain error when empty")
	}
}

// === Tests for formatContextMarkdown ===

func TestFormatContextMarkdown_NoProject_ReturnsInstructions(t *testing.T) {
	output := &SessionStartOutput{
		Success: true,
		BootstrapInfo: map[string]any{
			"noProject": true,
		},
	}

	result := formatContextMarkdown(output)

	// Should contain key instruction elements
	if !strings.Contains(result, "No active project is set") {
		t.Error("Should contain 'No active project is set'")
	}
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("Should contain 'AskUserQuestion'")
	}
	if !strings.Contains(result, "active_project") {
		t.Error("Should contain 'active_project'")
	}
	if !strings.Contains(result, "bootstrap_context") {
		t.Error("Should contain 'bootstrap_context'")
	}
	if !strings.Contains(result, "list_projects") {
		t.Error("Should contain 'list_projects'")
	}
}

func TestFormatContextMarkdown_WithProject_ReturnsBootstrapMarkdown(t *testing.T) {
	bootstrapContent := "## Memory Context\n**Project:** test-project\n\n### Features\n- Feature-Auth"
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown": bootstrapContent,
		},
	}

	result := formatContextMarkdown(output)

	// Should contain git context
	if !strings.Contains(result, "**Branch:** main") {
		t.Error("Should contain branch info")
	}
	if !strings.Contains(result, "**Status:** clean") {
		t.Error("Should contain status info")
	}
	// Should contain bootstrap content
	if !strings.Contains(result, bootstrapContent) {
		t.Error("Should contain bootstrap markdown")
	}
	// Should NOT contain noProject instructions
	if strings.Contains(result, "AskUserQuestion") {
		t.Error("Should NOT contain AskUserQuestion when project is set")
	}
}

func TestFormatContextMarkdown_Error_ReturnsErrorMessage(t *testing.T) {
	output := &SessionStartOutput{
		Success: false,
		Error:   "Something went wrong",
	}

	result := formatContextMarkdown(output)

	if !strings.Contains(result, "**Error:** Something went wrong") {
		t.Error("Should contain error message")
	}
}

func TestNoProjectInstructions_ContainsRequiredElements(t *testing.T) {
	instructions := noProjectInstructions()

	requiredElements := []string{
		"No active project is set",
		"AskUserQuestion",
		"active_project",
		"bootstrap_context",
		".agents/sessions/YYYY-MM-DD-session-NN.md",
		"list_projects",
	}

	for _, elem := range requiredElements {
		if !strings.Contains(instructions, elem) {
			t.Errorf("noProjectInstructions() should contain %q", elem)
		}
	}
}

// === Tests for HookOutput format compliance (Claude Code hook API) ===

func TestHookOutput_FormatCompliance(t *testing.T) {
	// Verify the HookOutput structure matches Claude Code's documented format:
	// {
	//   "hookSpecificOutput": {
	//     "hookEventName": "SessionStart",
	//     "additionalContext": "..."
	//   }
	// }
	hookOutput := HookOutput{
		HookSpecificOutput: HookSpecificOutput{
			HookEventName:     "SessionStart",
			AdditionalContext: "Test context content",
		},
	}

	data, err := json.Marshal(hookOutput)
	if err != nil {
		t.Fatalf("Failed to marshal HookOutput: %v", err)
	}

	// Parse as generic map to verify structure
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal HookOutput: %v", err)
	}

	// Verify top-level structure has only hookSpecificOutput
	if len(parsed) != 1 {
		t.Errorf("HookOutput should have exactly 1 top-level key, got %d", len(parsed))
	}

	hookSpecific, ok := parsed["hookSpecificOutput"].(map[string]any)
	if !ok {
		t.Fatal("HookOutput must contain hookSpecificOutput object")
	}

	// Verify hookSpecificOutput fields
	if hookSpecific["hookEventName"] != "SessionStart" {
		t.Errorf("hookEventName = %v, want SessionStart", hookSpecific["hookEventName"])
	}
	if hookSpecific["additionalContext"] != "Test context content" {
		t.Errorf("additionalContext = %v, want 'Test context content'", hookSpecific["additionalContext"])
	}
}

func TestHookOutput_ContentPreservation(t *testing.T) {
	// Verify all context sections are preserved in additionalContext
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "feature/test",
			Status: "dirty",
		},
		BootstrapInfo: map[string]any{
			"markdown": "## Memory Context\n**Project:** test-project\n\n### Features\n- Feature-Auth",
		},
		WorkflowState: &WorkflowStateInfo{
			Mode:      "analysis",
			Task:      "Research API",
			SessionID: "session-123",
		},
	}

	hookOutput := HookOutput{
		HookSpecificOutput: HookSpecificOutput{
			HookEventName:     "SessionStart",
			AdditionalContext: formatContextMarkdown(output),
		},
	}

	context := hookOutput.HookSpecificOutput.AdditionalContext

	// Verify all sections present
	if !strings.Contains(context, "**Branch:** feature/test") {
		t.Error("additionalContext should contain git branch")
	}
	if !strings.Contains(context, "**Status:** dirty") {
		t.Error("additionalContext should contain git status")
	}
	if !strings.Contains(context, "## Memory Context") {
		t.Error("additionalContext should contain bootstrap markdown header")
	}
	if !strings.Contains(context, "Feature-Auth") {
		t.Error("additionalContext should contain bootstrap content")
	}
	if !strings.Contains(context, "### Workflow State") {
		t.Error("additionalContext should contain workflow state section")
	}
	if !strings.Contains(context, "**Mode:** analysis") {
		t.Error("additionalContext should contain workflow mode")
	}
	if !strings.Contains(context, "**Task:** Research API") {
		t.Error("additionalContext should contain workflow task")
	}
	if !strings.Contains(context, "**Session:** session-123") {
		t.Error("additionalContext should contain session ID")
	}
}

func TestHookOutput_JSONFieldNames(t *testing.T) {
	// Verify exact JSON field names match Claude Code specification
	hookOutput := HookOutput{
		HookSpecificOutput: HookSpecificOutput{
			HookEventName:     "SessionStart",
			AdditionalContext: "content",
		},
	}

	data, err := json.Marshal(hookOutput)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	jsonStr := string(data)

	// Check exact field names (case-sensitive)
	if !strings.Contains(jsonStr, `"hookSpecificOutput"`) {
		t.Error("JSON must contain 'hookSpecificOutput' (camelCase)")
	}
	if !strings.Contains(jsonStr, `"hookEventName"`) {
		t.Error("JSON must contain 'hookEventName' (camelCase)")
	}
	if !strings.Contains(jsonStr, `"additionalContext"`) {
		t.Error("JSON must contain 'additionalContext' (camelCase)")
	}
}

// === Tests for HookInput parsing ===

func TestHookInput_JSONParsing(t *testing.T) {
	jsonInput := `{"session_id": "abc123", "cwd": "/Users/test/project"}`

	var input HookInput
	err := json.Unmarshal([]byte(jsonInput), &input)

	if err != nil {
		t.Fatalf("Failed to unmarshal HookInput: %v", err)
	}
	if input.SessionID != "abc123" {
		t.Errorf("SessionID = %q, want %q", input.SessionID, "abc123")
	}
	if input.CWD != "/Users/test/project" {
		t.Errorf("CWD = %q, want %q", input.CWD, "/Users/test/project")
	}
}

func TestHookInput_PartialJSON(t *testing.T) {
	// Only cwd provided
	jsonInput := `{"cwd": "/path/to/project"}`

	var input HookInput
	err := json.Unmarshal([]byte(jsonInput), &input)

	if err != nil {
		t.Fatalf("Failed to unmarshal HookInput: %v", err)
	}
	if input.SessionID != "" {
		t.Errorf("SessionID = %q, want empty", input.SessionID)
	}
	if input.CWD != "/path/to/project" {
		t.Errorf("CWD = %q, want %q", input.CWD, "/path/to/project")
	}
}

func TestHookInput_EmptyJSON(t *testing.T) {
	jsonInput := `{}`

	var input HookInput
	err := json.Unmarshal([]byte(jsonInput), &input)

	if err != nil {
		t.Fatalf("Failed to unmarshal HookInput: %v", err)
	}
	if input.SessionID != "" {
		t.Errorf("SessionID = %q, want empty", input.SessionID)
	}
	if input.CWD != "" {
		t.Errorf("CWD = %q, want empty", input.CWD)
	}
}
