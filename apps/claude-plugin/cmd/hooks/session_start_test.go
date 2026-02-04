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
	if result.Markdown != bootstrapOutput {
		t.Errorf("getBootstrapContext() markdown mismatch")
	}
	// Markdown output should not parse as JSON
	if result.ParsedJSON {
		t.Error("getBootstrapContext() should not parse markdown as JSON")
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

func TestFormatContextMarkdown_WithProject_NoActiveSession(t *testing.T) {
	// Per FEATURE-001: When project is set but no active session,
	// hook must provide instructions for session creation via AskUserQuestion
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
		ActiveSession: nil,     // No active session
		OpenSessions:  []OpenSession{}, // No open sessions
	}

	result := formatContextMarkdown(output)

	// Should contain git context
	if !strings.Contains(result, "**Branch:** main") {
		t.Error("Should contain branch info")
	}
	if !strings.Contains(result, "**Status:** clean") {
		t.Error("Should contain status info")
	}
	// Should contain bootstrap content in Project Context section
	if !strings.Contains(result, "### Project Context") {
		t.Error("Should contain project context section")
	}
	// Per FEATURE-001: When no active session, MUST contain AskUserQuestion instructions
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("Should contain AskUserQuestion when no active session exists")
	}
	// Should contain session creation instructions
	if !strings.Contains(result, "### No Active Session") {
		t.Error("Should contain no active session header")
	}
}

func TestFormatContextMarkdown_WithProject_HasActiveSession(t *testing.T) {
	// Per FEATURE-001: When project is set AND active session exists,
	// hook passes context WITHOUT AskUserQuestion instructions
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
		ActiveSession: &ActiveSession{
			SessionID: "SESSION-2026-02-04_01-test",
			Status:    "IN_PROGRESS",
			Date:      "2026-02-04",
			IsValid:   true,
			Checks:    []SessionValidationCheck{},
		},
		OpenSessions: []OpenSession{},
	}

	result := formatContextMarkdown(output)

	// Should contain git context
	if !strings.Contains(result, "**Branch:** main") {
		t.Error("Should contain branch info")
	}
	// Should contain active session info
	if !strings.Contains(result, "### Active Session") {
		t.Error("Should contain active session header")
	}
	// Per FEATURE-001: When active session exists, should NOT prompt for session selection
	if strings.Contains(result, "Use the AskUserQuestion tool") {
		t.Error("Should NOT contain AskUserQuestion prompt when active session exists")
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

// === Tests for formatSessionInstructions (NEW - replaces formatResumePrompt) ===

func TestFormatSessionInstructions_WithOpenSessions(t *testing.T) {
	sessions := []OpenSession{
		{SessionID: "SESSION-2026-02-04_01-feature-work", Status: "IN_PROGRESS", Date: "2026-02-04", Branch: "feat/session-resume", Topic: "feature work"},
		{SessionID: "SESSION-2026-02-03_02-bug-fix", Status: "PAUSED", Date: "2026-02-03", Topic: "bug fix"},
	}

	result := formatSessionInstructions(sessions)

	// Check required elements per FEATURE-001 spec
	if !strings.Contains(result, "DO THE FOLLOWING IMMEDIATELY") {
		t.Error("Should contain immediate action directive")
	}
	if !strings.Contains(result, "### Open Sessions Detected") {
		t.Error("Should contain '### Open Sessions Detected' header")
	}
	if !strings.Contains(result, "Found 2 session(s)") {
		t.Error("Should contain count of sessions")
	}
	if !strings.Contains(result, "SESSION-2026-02-04_01-feature-work - feature work") {
		t.Error("Should contain first session ID and topic")
	}
	if !strings.Contains(result, "Date: 2026-02-04") {
		t.Error("Should contain first session date")
	}
	if !strings.Contains(result, "Branch: feat/session-resume") {
		t.Error("Should contain first session branch")
	}
	if !strings.Contains(result, "SESSION-2026-02-03_02-bug-fix - bug fix") {
		t.Error("Should contain second session ID and topic")
	}
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("Should contain AskUserQuestion instruction")
	}
	if !strings.Contains(result, "MCP `session` tool") {
		t.Error("Should reference MCP session tool")
	}
	if !strings.Contains(result, "operation=`resume`") {
		t.Error("Should contain resume operation instruction")
	}
	if !strings.Contains(result, "operation=`create`") {
		t.Error("Should contain create operation instruction")
	}
}

func TestFormatSessionInstructions_NoSessions(t *testing.T) {
	sessions := []OpenSession{}

	result := formatSessionInstructions(sessions)

	// Should still provide instructions (for new session)
	if !strings.Contains(result, "DO THE FOLLOWING IMMEDIATELY") {
		t.Error("Should contain immediate action directive")
	}
	if !strings.Contains(result, "### No Active Session") {
		t.Error("Should contain no active session header")
	}
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("Should contain AskUserQuestion instruction")
	}
	if !strings.Contains(result, "session topic") {
		t.Error("Should ask about session topic")
	}
	if !strings.Contains(result, "operation=`create`") {
		t.Error("Should contain create operation instruction")
	}
	// Should NOT contain resume instructions
	if strings.Contains(result, "operation=`resume`") {
		t.Error("Should NOT contain resume operation when no sessions")
	}
}

func TestFormatSessionInstructions_SingleSession(t *testing.T) {
	sessions := []OpenSession{
		{SessionID: "SESSION-2026-02-04_01-solo", Status: "IN_PROGRESS", Date: "2026-02-04"},
	}

	result := formatSessionInstructions(sessions)

	if !strings.Contains(result, "Found 1 session(s)") {
		t.Error("Should contain count of 1 session")
	}
	if !strings.Contains(result, "SESSION-2026-02-04_01-solo") {
		t.Error("Should contain session ID")
	}
}

// === Tests for formatActiveSessionContext ===

func TestFormatActiveSessionContext_FullData(t *testing.T) {
	activeSession := &ActiveSession{
		SessionID: "SESSION-2026-02-04_01-test",
		Status:    "IN_PROGRESS",
		Path:      "sessions/SESSION-2026-02-04_01-test.md",
		Mode:      "coding",
		Task:      "Implement feature X",
		Branch:    "feat/test",
		Date:      "2026-02-04",
		Topic:     "test feature",
		IsValid:   true,
		Checks:    []SessionValidationCheck{{Name: "brain_init", Passed: true}},
	}

	result := formatActiveSessionContext(activeSession)

	if !strings.Contains(result, "### Active Session") {
		t.Error("Should contain active session header")
	}
	if !strings.Contains(result, "SESSION-2026-02-04_01-test - test feature") {
		t.Error("Should contain session ID and topic")
	}
	if !strings.Contains(result, "**Status**: IN_PROGRESS") {
		t.Error("Should contain status")
	}
	if !strings.Contains(result, "**Date**: 2026-02-04") {
		t.Error("Should contain date")
	}
	if !strings.Contains(result, "**Branch**: feat/test") {
		t.Error("Should contain branch")
	}
	if !strings.Contains(result, "**Mode**: coding") {
		t.Error("Should contain mode")
	}
	if !strings.Contains(result, "**Current Task**: Implement feature X") {
		t.Error("Should contain current task")
	}
	if !strings.Contains(result, "All checks passed") {
		t.Error("Should indicate validation passed")
	}
}

func TestFormatActiveSessionContext_ValidationFailed(t *testing.T) {
	activeSession := &ActiveSession{
		SessionID: "SESSION-2026-02-04_01-test",
		Status:    "IN_PROGRESS",
		Path:      "sessions/SESSION-2026-02-04_01-test.md",
		Date:      "2026-02-04",
		IsValid:   false,
		Checks: []SessionValidationCheck{
			{Name: "brain_init", Passed: true},
			{Name: "git_branch", Passed: false},
		},
	}

	result := formatActiveSessionContext(activeSession)

	if !strings.Contains(result, "Some checks failed") {
		t.Error("Should indicate validation failed")
	}
	if !strings.Contains(result, "brain_init: [PASS]") {
		t.Error("Should show passed check")
	}
	if !strings.Contains(result, "git_branch: [FAIL]") {
		t.Error("Should show failed check")
	}
}

// === Tests for formatContextMarkdown with session data (UPDATED for new hook flow) ===

func TestFormatContextMarkdown_WithActiveSession(t *testing.T) {
	// Per FEATURE-001: When activeSession exists, pass context, DO NOT include openSessions
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown": "## Memory Context\n**Project:** test-project",
		},
		ActiveSession: &ActiveSession{
			SessionID: "SESSION-2026-02-04_01-active",
			Status:    "IN_PROGRESS",
			Date:      "2026-02-04",
			Topic:     "active work",
			IsValid:   true,
			Checks:    []SessionValidationCheck{},
		},
		OpenSessions: []OpenSession{
			{SessionID: "SESSION-2026-02-03_01-paused", Status: "PAUSED", Date: "2026-02-03"},
		},
	}

	result := formatContextMarkdown(output)

	// Should contain active session context
	if !strings.Contains(result, "### Active Session") {
		t.Error("Should contain active session header")
	}
	if !strings.Contains(result, "SESSION-2026-02-04_01-active") {
		t.Error("Should contain active session ID")
	}
	// Should NOT contain open sessions prompt (per hook flow spec)
	if strings.Contains(result, "### Open Sessions Detected") {
		t.Error("Should NOT contain open sessions when active session exists")
	}
	// Should NOT contain AskUserQuestion instructions
	if strings.Contains(result, "Use the AskUserQuestion tool") {
		t.Error("Should NOT prompt for session selection when active session exists")
	}
}

func TestFormatContextMarkdown_WithOpenSessionsNoActive(t *testing.T) {
	// Per FEATURE-001: When no activeSession but openSessions exist, include mandatory instructions
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown": "## Memory Context\n**Project:** test-project",
		},
		ActiveSession: nil,
		OpenSessions: []OpenSession{
			{SessionID: "SESSION-2026-02-04_01-feature", Status: "IN_PROGRESS", Date: "2026-02-04", Branch: "feat/test"},
		},
	}

	result := formatContextMarkdown(output)

	// Should contain open sessions detected prompt
	if !strings.Contains(result, "### Open Sessions Detected") {
		t.Error("Should contain open sessions detected header")
	}
	if !strings.Contains(result, "Found 1 session(s)") {
		t.Error("Should contain session count")
	}
	// Should contain AskUserQuestion instruction
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("Should contain AskUserQuestion instruction")
	}
	// Should contain MCP session tool instructions
	if !strings.Contains(result, "MCP `session` tool") {
		t.Error("Should reference MCP session tool")
	}
}

func TestFormatContextMarkdown_NoSessions(t *testing.T) {
	// Per FEATURE-001: When no sessions, provide instructions for new session creation
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown": "## Memory Context\n**Project:** test-project",
		},
		ActiveSession: nil,
		OpenSessions:  []OpenSession{},
	}

	result := formatContextMarkdown(output)

	// Should contain new session instructions
	if !strings.Contains(result, "### No Active Session") {
		t.Error("Should contain no active session header")
	}
	// Should contain AskUserQuestion instruction
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("Should contain AskUserQuestion instruction")
	}
	// Should NOT contain open sessions prompt
	if strings.Contains(result, "### Open Sessions Detected") {
		t.Error("Should NOT contain open sessions header when no sessions")
	}
}

// === Tests for OpenSession struct JSON serialization (UPDATED for new struct) ===

func TestOpenSession_JSONSerialization(t *testing.T) {
	session := OpenSession{
		SessionID: "SESSION-2026-02-04_01-test",
		Status:    "IN_PROGRESS",
		Date:      "2026-02-04",
		Branch:    "feat/test",
		Topic:     "test feature",
		Permalink: "sessions/SESSION-2026-02-04_01-test",
	}

	data, err := json.Marshal(session)
	if err != nil {
		t.Fatalf("Failed to marshal OpenSession: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal OpenSession: %v", err)
	}

	if parsed["sessionId"] != "SESSION-2026-02-04_01-test" {
		t.Errorf("JSON sessionId = %v, want SESSION-2026-02-04_01-test", parsed["sessionId"])
	}
	if parsed["status"] != "IN_PROGRESS" {
		t.Errorf("JSON status = %v, want IN_PROGRESS", parsed["status"])
	}
	if parsed["date"] != "2026-02-04" {
		t.Errorf("JSON date = %v, want 2026-02-04", parsed["date"])
	}
	if parsed["branch"] != "feat/test" {
		t.Errorf("JSON branch = %v, want feat/test", parsed["branch"])
	}
}

func TestOpenSession_OmitsEmptyOptionalFields(t *testing.T) {
	session := OpenSession{
		SessionID: "SESSION-2026-02-04_01-minimal",
		Status:    "IN_PROGRESS",
		Date:      "2026-02-04",
		Permalink: "sessions/SESSION-2026-02-04_01-minimal",
	}

	data, err := json.Marshal(session)
	if err != nil {
		t.Fatalf("Failed to marshal OpenSession: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal OpenSession: %v", err)
	}

	// branch and topic should be omitted when empty (omitempty tag)
	if branch, exists := parsed["branch"]; exists && branch != "" {
		t.Error("JSON should omit branch when not set")
	}
	if topic, exists := parsed["topic"]; exists && topic != "" {
		t.Error("JSON should omit topic when not set")
	}
	// Required fields should be present
	if parsed["sessionId"] == nil {
		t.Error("JSON should contain sessionId")
	}
	if parsed["status"] == nil {
		t.Error("JSON should contain status")
	}
}

// === Tests for ActiveSession struct JSON serialization ===

func TestActiveSession_JSONSerialization(t *testing.T) {
	session := ActiveSession{
		SessionID: "SESSION-2026-02-04_01-test",
		Status:    "IN_PROGRESS",
		Path:      "sessions/SESSION-2026-02-04_01-test.md",
		Mode:      "coding",
		Task:      "Implement feature",
		Branch:    "feat/test",
		Date:      "2026-02-04",
		Topic:     "test feature",
		IsValid:   true,
		Checks:    []SessionValidationCheck{{Name: "brain_init", Passed: true}},
	}

	data, err := json.Marshal(session)
	if err != nil {
		t.Fatalf("Failed to marshal ActiveSession: %v", err)
	}

	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal ActiveSession: %v", err)
	}

	if parsed["sessionId"] != "SESSION-2026-02-04_01-test" {
		t.Errorf("JSON sessionId = %v, want SESSION-2026-02-04_01-test", parsed["sessionId"])
	}
	if parsed["status"] != "IN_PROGRESS" {
		t.Errorf("JSON status = %v, want IN_PROGRESS", parsed["status"])
	}
	if parsed["path"] != "sessions/SESSION-2026-02-04_01-test.md" {
		t.Errorf("JSON path = %v, want sessions/SESSION-2026-02-04_01-test.md", parsed["path"])
	}
	if parsed["isValid"] != true {
		t.Errorf("JSON isValid = %v, want true", parsed["isValid"])
	}
}

// === Tests for BootstrapResponse JSON parsing ===

func TestBootstrapResponse_JSONParsing(t *testing.T) {
	jsonInput := `{
		"metadata": {
			"project": "test-project",
			"generated_at": "2026-02-04T10:30:00Z",
			"note_count": 5,
			"timeframe": "5d"
		},
		"open_sessions": [
			{
				"sessionId": "SESSION-2026-02-04_01-test",
				"status": "IN_PROGRESS",
				"date": "2026-02-04",
				"branch": "feat/test",
				"permalink": "sessions/SESSION-2026-02-04_01-test"
			}
		],
		"active_session": {
			"sessionId": "SESSION-2026-02-04_01-test",
			"status": "IN_PROGRESS",
			"path": "sessions/SESSION-2026-02-04_01-test.md",
			"date": "2026-02-04",
			"isValid": true,
			"checks": []
		}
	}`

	var resp BootstrapResponse
	err := json.Unmarshal([]byte(jsonInput), &resp)

	if err != nil {
		t.Fatalf("Failed to unmarshal BootstrapResponse: %v", err)
	}
	if resp.Metadata.Project != "test-project" {
		t.Errorf("Metadata.Project = %q, want %q", resp.Metadata.Project, "test-project")
	}
	if len(resp.OpenSessions) != 1 {
		t.Fatalf("OpenSessions length = %d, want 1", len(resp.OpenSessions))
	}
	if resp.OpenSessions[0].SessionID != "SESSION-2026-02-04_01-test" {
		t.Errorf("OpenSessions[0].SessionID = %q, want %q", resp.OpenSessions[0].SessionID, "SESSION-2026-02-04_01-test")
	}
	if resp.ActiveSession == nil {
		t.Fatal("ActiveSession should not be nil")
	}
	if resp.ActiveSession.SessionID != "SESSION-2026-02-04_01-test" {
		t.Errorf("ActiveSession.SessionID = %q, want %q", resp.ActiveSession.SessionID, "SESSION-2026-02-04_01-test")
	}
}

// =============================================================================
// FEATURE-001 Required Test Scenarios (M6 Hook Integration)
// =============================================================================
// These tests cover the 7 required test scenarios from FEATURE-001-session-management:
// 1. TestHook_ActiveSession_PassesContext - active session exists, pass context
// 2. TestHook_OpenSessions_ListsOptions - no active, open sessions exist
// 3. TestHook_NoSessions_PromptNew - no sessions at all
// 4. TestHook_BootstrapError_GracefulDegradation - bootstrap fails
// 5. Hook never creates sessions (verified by code review - no create method)
// 6. Hook never resumes sessions (verified by code review - no resume method)
// 7. TestHook_MalformedJSON_SafeDefault - malformed JSON handling

func TestHook_ActiveSession_PassesContext(t *testing.T) {
	// Scenario 1: Active session exists
	// Expected: Pass context to AI, no AskUserQuestion instructions
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "feat/active-work",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown":   "## Memory Context\n**Project:** test-project",
			"parsedJSON": true,
		},
		ActiveSession: &ActiveSession{
			SessionID: "SESSION-2026-02-04_01-active",
			Status:    "IN_PROGRESS",
			Path:      "sessions/SESSION-2026-02-04_01-active.md",
			Date:      "2026-02-04",
			Topic:     "active work",
			Branch:    "feat/active-work",
			IsValid:   true,
			Checks:    []SessionValidationCheck{{Name: "brain_init", Passed: true}},
		},
		// Note: openSessions may exist but should NOT be in output per spec
		OpenSessions: []OpenSession{
			{SessionID: "SESSION-2026-02-03_01-paused", Status: "PAUSED", Date: "2026-02-03"},
		},
	}

	result := formatContextMarkdown(output)

	// PASS criteria: Contains active session context
	if !strings.Contains(result, "### Active Session") {
		t.Error("[FAIL] Should contain active session header")
	}
	if !strings.Contains(result, "SESSION-2026-02-04_01-active") {
		t.Error("[FAIL] Should contain active session ID")
	}
	if !strings.Contains(result, "**Status**: IN_PROGRESS") {
		t.Error("[FAIL] Should contain status")
	}

	// PASS criteria: Does NOT include openSessions or AskUserQuestion
	if strings.Contains(result, "### Open Sessions Detected") {
		t.Error("[FAIL] Should NOT include open sessions when active session exists")
	}
	if strings.Contains(result, "Use the AskUserQuestion tool") {
		t.Error("[FAIL] Should NOT prompt for session selection when active session exists")
	}
}

func TestHook_OpenSessions_ListsOptions(t *testing.T) {
	// Scenario 2: No active session, 2 open sessions exist
	// Expected: Include open sessions, AskUserQuestion instructions
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown":   "## Memory Context\n**Project:** test-project",
			"parsedJSON": true,
		},
		ActiveSession: nil,
		OpenSessions: []OpenSession{
			{SessionID: "SESSION-2026-02-04_01-feature", Status: "IN_PROGRESS", Date: "2026-02-04", Branch: "feat/feature", Topic: "feature work"},
			{SessionID: "SESSION-2026-02-03_02-bugfix", Status: "PAUSED", Date: "2026-02-03", Topic: "bug fix"},
		},
	}

	result := formatContextMarkdown(output)

	// PASS criteria: Contains open sessions list
	if !strings.Contains(result, "### Open Sessions Detected") {
		t.Error("[FAIL] Should contain open sessions header")
	}
	if !strings.Contains(result, "Found 2 session(s)") {
		t.Error("[FAIL] Should list 2 sessions")
	}
	if !strings.Contains(result, "SESSION-2026-02-04_01-feature") {
		t.Error("[FAIL] Should contain first session ID")
	}
	if !strings.Contains(result, "SESSION-2026-02-03_02-bugfix") {
		t.Error("[FAIL] Should contain second session ID")
	}

	// PASS criteria: Contains AskUserQuestion instructions
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("[FAIL] Should contain AskUserQuestion instruction")
	}
	if !strings.Contains(result, "MANDATORY ACTION") {
		t.Error("[FAIL] Should contain mandatory action directive")
	}

	// PASS criteria: Contains MCP session tool instructions
	if !strings.Contains(result, "MCP `session` tool") {
		t.Error("[FAIL] Should reference MCP session tool")
	}
	if !strings.Contains(result, "operation=`resume`") {
		t.Error("[FAIL] Should include resume operation")
	}
	if !strings.Contains(result, "operation=`create`") {
		t.Error("[FAIL] Should include create operation")
	}
}

func TestHook_NoSessions_PromptNew(t *testing.T) {
	// Scenario 3: No active session, no open sessions
	// Expected: AskUserQuestion for new session only
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"markdown":   "## Memory Context\n**Project:** test-project",
			"parsedJSON": true,
		},
		ActiveSession: nil,
		OpenSessions:  []OpenSession{},
	}

	result := formatContextMarkdown(output)

	// PASS criteria: Contains new session instructions
	if !strings.Contains(result, "### No Active Session") {
		t.Error("[FAIL] Should contain no active session header")
	}
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("[FAIL] Should contain AskUserQuestion instruction")
	}
	if !strings.Contains(result, "session topic") {
		t.Error("[FAIL] Should ask about session topic")
	}

	// PASS criteria: Only create operation (no resume)
	if !strings.Contains(result, "operation=`create`") {
		t.Error("[FAIL] Should include create operation")
	}
	if strings.Contains(result, "operation=`resume`") {
		t.Error("[FAIL] Should NOT include resume when no open sessions")
	}
	if strings.Contains(result, "### Open Sessions Detected") {
		t.Error("[FAIL] Should NOT contain open sessions header")
	}
}

func TestHook_BootstrapError_GracefulDegradation(t *testing.T) {
	// Scenario 4: Bootstrap error response
	// Expected: Graceful degradation, log warning, continue with available context
	output := &SessionStartOutput{
		Success: true,
		Project: "test-project",
		GitContext: &GitContextInfo{
			Branch: "main",
			Status: "clean",
		},
		BootstrapInfo: map[string]any{
			"warning": "Could not get bootstrap context: connection refused",
		},
		ActiveSession: nil,
		OpenSessions:  []OpenSession{},
	}

	result := formatContextMarkdown(output)

	// PASS criteria: Contains warning but doesn't fail completely
	if !strings.Contains(result, "**Warning:**") {
		t.Error("[FAIL] Should contain warning message")
	}
	if !strings.Contains(result, "Could not get bootstrap context") {
		t.Error("[FAIL] Should include error details in warning")
	}

	// PASS criteria: Still provides session instructions
	if !strings.Contains(result, "### No Active Session") {
		t.Error("[FAIL] Should still contain session instructions on bootstrap error")
	}
	if !strings.Contains(result, "AskUserQuestion") {
		t.Error("[FAIL] Should still prompt for session creation")
	}
}

func TestHook_MalformedJSON_SafeDefault(t *testing.T) {
	// Scenario 7: Malformed JSON from bootstrap
	// Expected: Log error, return safe default (treat as no session data)
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	// Mock bootstrap to return malformed JSON
	ExecCommandSession = func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcessSession", "--")
		var output string
		if name == "brain" && len(args) > 0 {
			switch args[0] {
			case "bootstrap":
				// Return malformed JSON mixed with markdown
				output = "## Memory Context\n{invalid json here}"
			case "session":
				output = `{"mode":"coding"}`
			case "projects":
				output = ""
			}
		} else if name == "git" {
			output = ""
		}
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}

	result, err := getBootstrapContext("test-project")

	// PASS criteria: No error returned (graceful handling)
	if err != nil {
		t.Errorf("[FAIL] getBootstrapContext should not return error on malformed JSON: %v", err)
	}
	if result == nil {
		t.Fatal("[FAIL] Result should not be nil")
	}

	// PASS criteria: JSON parsing failed, falls back to markdown
	if result.ParsedJSON {
		t.Error("[FAIL] ParsedJSON should be false for malformed JSON")
	}
	// PASS criteria: Markdown content preserved
	if result.Markdown == "" {
		t.Error("[FAIL] Markdown should be preserved even when JSON parsing fails")
	}
}

// Test: getBootstrapContext with valid structured JSON
func TestGetBootstrapContext_StructuredJSON_Success(t *testing.T) {
	// Save and restore original ExecCommandSession
	origExecCommand := ExecCommandSession
	defer func() { ExecCommandSession = origExecCommand }()

	// Mock bootstrap to return valid structured JSON
	validJSON := `{
		"metadata": {"project": "test-project", "generated_at": "2026-02-04T10:30:00Z", "note_count": 5, "timeframe": "5d"},
		"open_sessions": [{"sessionId": "SESSION-2026-02-04_01-test", "status": "IN_PROGRESS", "date": "2026-02-04", "permalink": "sessions/SESSION-2026-02-04_01-test"}],
		"active_session": {"sessionId": "SESSION-2026-02-04_01-test", "status": "IN_PROGRESS", "path": "sessions/SESSION-2026-02-04_01-test.md", "date": "2026-02-04", "isValid": true, "checks": []}
	}`
	ExecCommandSession = mockExecCommandForSession(validJSON)

	result, err := getBootstrapContext("test-project")

	if err != nil {
		t.Fatalf("getBootstrapContext() returned error: %v", err)
	}

	// PASS criteria: JSON successfully parsed
	if !result.ParsedJSON {
		t.Error("[FAIL] ParsedJSON should be true for valid JSON")
	}

	// PASS criteria: Session data extracted
	if len(result.OpenSessions) != 1 {
		t.Errorf("[FAIL] OpenSessions length = %d, want 1", len(result.OpenSessions))
	}
	if result.OpenSessions[0].SessionID != "SESSION-2026-02-04_01-test" {
		t.Errorf("[FAIL] OpenSessions[0].SessionID = %q, want %q", result.OpenSessions[0].SessionID, "SESSION-2026-02-04_01-test")
	}
	if result.ActiveSession == nil {
		t.Error("[FAIL] ActiveSession should not be nil")
	} else if result.ActiveSession.SessionID != "SESSION-2026-02-04_01-test" {
		t.Errorf("[FAIL] ActiveSession.SessionID = %q, want %q", result.ActiveSession.SessionID, "SESSION-2026-02-04_01-test")
	}
}

// =============================================================================
// Tests for parseOpenSessionsFromMarkdown (Legacy Fallback)
// =============================================================================
// These tests cover the legacy markdown parsing when JSON is not available.

func TestParseOpenSessionsFromMarkdown_SessionStateFormat(t *testing.T) {
	// Test the new "### Session State" format
	markdown := `## Memory Context [v7] (Full)

**Project:** test-project

### Session State

**Active Session**: None
**Open Sessions**: 2 sessions available
- SESSION-2026-02-04_01-feature - feature work (IN_PROGRESS) (branch: ` + "`feat/test`" + `)
- SESSION-2026-02-03_02-bugfix (PAUSED)

### Active Features

- Feature-Auth`

	sessions := parseOpenSessionsFromMarkdown(markdown)

	if len(sessions) != 2 {
		t.Fatalf("parseOpenSessionsFromMarkdown() returned %d sessions, want 2", len(sessions))
	}

	// Check first session
	if sessions[0].SessionID != "SESSION-2026-02-04_01-feature" {
		t.Errorf("sessions[0].SessionID = %q, want %q", sessions[0].SessionID, "SESSION-2026-02-04_01-feature")
	}
	if sessions[0].Status != "IN_PROGRESS" {
		t.Errorf("sessions[0].Status = %q, want %q", sessions[0].Status, "IN_PROGRESS")
	}
	if sessions[0].Date != "2026-02-04" {
		t.Errorf("sessions[0].Date = %q, want %q", sessions[0].Date, "2026-02-04")
	}
	if sessions[0].Branch != "feat/test" {
		t.Errorf("sessions[0].Branch = %q, want %q", sessions[0].Branch, "feat/test")
	}

	// Check second session
	if sessions[1].SessionID != "SESSION-2026-02-03_02-bugfix" {
		t.Errorf("sessions[1].SessionID = %q, want %q", sessions[1].SessionID, "SESSION-2026-02-03_02-bugfix")
	}
	if sessions[1].Status != "PAUSED" {
		t.Errorf("sessions[1].Status = %q, want %q", sessions[1].Status, "PAUSED")
	}
}

func TestParseOpenSessionsFromMarkdown_NoSection(t *testing.T) {
	// Test when no session section exists
	markdown := `## Memory Context [v7] (Full)

**Project:** test-project

### Active Features

- Feature-Auth`

	sessions := parseOpenSessionsFromMarkdown(markdown)

	if len(sessions) != 0 {
		t.Errorf("parseOpenSessionsFromMarkdown() returned %d sessions, want 0", len(sessions))
	}
}

func TestParseOpenSessionsFromMarkdown_LowercaseStatus(t *testing.T) {
	// Test that lowercase status values are normalized to uppercase
	markdown := `### Session State

- SESSION-2026-02-04_01-test (in_progress)
- SESSION-2026-02-03_02-other (paused)`

	sessions := parseOpenSessionsFromMarkdown(markdown)

	if len(sessions) != 2 {
		t.Fatalf("parseOpenSessionsFromMarkdown() returned %d sessions, want 2", len(sessions))
	}

	if sessions[0].Status != "IN_PROGRESS" {
		t.Errorf("sessions[0].Status = %q, want %q (should be uppercase)", sessions[0].Status, "IN_PROGRESS")
	}
	if sessions[1].Status != "PAUSED" {
		t.Errorf("sessions[1].Status = %q, want %q (should be uppercase)", sessions[1].Status, "PAUSED")
	}
}

func TestParseOpenSessionsFromMarkdown_AtEndOfDocument(t *testing.T) {
	// Test when Session State section is at end of document (no following ###)
	markdown := `## Memory Context

**Project:** test-project

### Session State

**Open Sessions**: 1 session available
- SESSION-2026-02-04_01-final (IN_PROGRESS)`

	sessions := parseOpenSessionsFromMarkdown(markdown)

	if len(sessions) != 1 {
		t.Fatalf("parseOpenSessionsFromMarkdown() returned %d sessions, want 1", len(sessions))
	}
	if sessions[0].SessionID != "SESSION-2026-02-04_01-final" {
		t.Errorf("sessions[0].SessionID = %q, want %q", sessions[0].SessionID, "SESSION-2026-02-04_01-final")
	}
}
