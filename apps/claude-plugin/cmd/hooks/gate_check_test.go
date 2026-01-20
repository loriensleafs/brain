// Package main provides unit tests for the gate check functions.
// Tests cover:
// - isReadOnlyTool whitelist function
// - checkToolBlocked mode-based blocking
// - performGateCheck integration with Brain CLI
// - GateCheckResult JSON serialization
package main

import (
	"encoding/json"
	"os"
	"os/exec"
	"slices"
	"testing"
)

// mockExecCommand creates a mock exec.Command that returns the provided JSON output.
func mockExecCommand(output string) func(string, ...string) *exec.Cmd {
	return func(name string, args ...string) *exec.Cmd {
		// Use TestHelperProcess pattern for mocking exec
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcess", "--")
		cmd.Env = append(os.Environ(), "GO_WANT_HELPER_PROCESS=1", "MOCK_OUTPUT="+output)
		return cmd
	}
}

// mockExecCommandError creates a mock exec.Command that simulates an error.
func mockExecCommandError(exitCode int, stderr string) func(string, ...string) *exec.Cmd {
	return func(name string, args ...string) *exec.Cmd {
		cmd := exec.Command(os.Args[0], "-test.run=TestHelperProcess", "--")
		cmd.Env = append(os.Environ(),
			"GO_WANT_HELPER_PROCESS=1",
			"MOCK_ERROR=1",
			"MOCK_EXIT_CODE="+string(rune('0'+exitCode)),
			"MOCK_STDERR="+stderr,
		)
		return cmd
	}
}

// TestHelperProcess is used to mock exec.Command calls.
// It's invoked via the -test.run flag when we need to simulate external commands.
func TestHelperProcess(t *testing.T) {
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

// === Unit Tests for isReadOnlyTool ===

func TestIsReadOnlyTool(t *testing.T) {
	tests := []struct {
		name     string
		tool     string
		expected bool
	}{
		// Read-only tools (should return true)
		{"Read is read-only", "Read", true},
		{"Glob is read-only", "Glob", true},
		{"Grep is read-only", "Grep", true},
		{"LSP is read-only", "LSP", true},
		{"WebFetch is read-only", "WebFetch", true},
		{"WebSearch is read-only", "WebSearch", true},

		// Destructive tools (should return false)
		{"Edit is NOT read-only", "Edit", false},
		{"Write is NOT read-only", "Write", false},
		{"Bash is NOT read-only", "Bash", false},
		{"NotebookEdit is NOT read-only", "NotebookEdit", false},
		{"Task is NOT read-only", "Task", false},
		{"Unknown tool is NOT read-only", "SomeTool", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isReadOnlyTool(tt.tool)
			if result != tt.expected {
				t.Errorf("isReadOnlyTool(%q) = %v, want %v", tt.tool, result, tt.expected)
			}
		})
	}
}

// === Unit Tests for checkToolBlocked ===

func TestCheckToolBlocked(t *testing.T) {
	tests := []struct {
		name        string
		tool        string
		mode        string
		wantAllowed bool
		wantMessage bool
	}{
		// Analysis mode - blocks Edit, Write, Bash, NotebookEdit
		{"analysis blocks Edit", "Edit", "analysis", false, true},
		{"analysis blocks Write", "Write", "analysis", false, true},
		{"analysis blocks Bash", "Bash", "analysis", false, true},
		{"analysis blocks NotebookEdit", "NotebookEdit", "analysis", false, true},
		{"analysis allows Read", "Read", "analysis", true, false},
		{"analysis allows Grep", "Grep", "analysis", true, false},
		{"analysis allows Glob", "Glob", "analysis", true, false},
		{"analysis allows Task", "Task", "analysis", true, false},

		// Planning mode - blocks Edit, Write, NotebookEdit but allows Bash
		{"planning blocks Edit", "Edit", "planning", false, true},
		{"planning blocks Write", "Write", "planning", false, true},
		{"planning blocks NotebookEdit", "NotebookEdit", "planning", false, true},
		{"planning allows Bash", "Bash", "planning", true, false},
		{"planning allows Read", "Read", "planning", true, false},
		{"planning allows Grep", "Grep", "planning", true, false},

		// Coding mode - allows everything
		{"coding allows Edit", "Edit", "coding", true, false},
		{"coding allows Write", "Write", "coding", true, false},
		{"coding allows Bash", "Bash", "coding", true, false},
		{"coding allows Read", "Read", "coding", true, false},
		{"coding allows NotebookEdit", "NotebookEdit", "coding", true, false},

		// Disabled mode - allows everything
		{"disabled allows Edit", "Edit", "disabled", true, false},
		{"disabled allows Write", "Write", "disabled", true, false},
		{"disabled allows Bash", "Bash", "disabled", true, false},
		{"disabled allows everything", "AnyTool", "disabled", true, false},

		// Empty mode - treated as disabled
		{"empty mode allows Edit", "Edit", "", true, false},
		{"empty mode allows Bash", "Bash", "", true, false},

		// Unknown mode - allows by default
		{"unknown mode allows Edit", "Edit", "unknown-mode", true, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := checkToolBlocked(tt.tool, tt.mode)

			if result.Allowed != tt.wantAllowed {
				t.Errorf("checkToolBlocked(%q, %q).Allowed = %v, want %v",
					tt.tool, tt.mode, result.Allowed, tt.wantAllowed)
			}

			if result.Tool != tt.tool {
				t.Errorf("checkToolBlocked(%q, %q).Tool = %q, want %q",
					tt.tool, tt.mode, result.Tool, tt.tool)
			}

			if result.Mode != tt.mode {
				t.Errorf("checkToolBlocked(%q, %q).Mode = %q, want %q",
					tt.tool, tt.mode, result.Mode, tt.mode)
			}

			hasMessage := result.Message != ""
			if hasMessage != tt.wantMessage {
				t.Errorf("checkToolBlocked(%q, %q).Message empty = %v, want %v",
					tt.tool, tt.mode, !hasMessage, !tt.wantMessage)
			}
		})
	}
}

// === Integration Tests for performGateCheck with fail-closed behavior ===

func TestPerformGateCheck_FailClosed_DestructiveTool(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock Brain CLI failure (unavailable)
	ExecCommandGate = mockExecCommandError(1, "Error: brain CLI not available")

	destructiveTools := []string{"Edit", "Write", "Bash", "NotebookEdit", "Task"}
	for _, tool := range destructiveTools {
		t.Run("blocks "+tool+" when state unavailable", func(t *testing.T) {
			result := performGateCheck(tool)

			if result.Allowed {
				t.Errorf("performGateCheck(%q) should BLOCK when state unavailable (fail-closed)", tool)
			}
			if result.Mode != "unknown" {
				t.Errorf("performGateCheck(%q).Mode = %q, want %q", tool, result.Mode, "unknown")
			}
			if result.Message == "" {
				t.Errorf("performGateCheck(%q) should have a block message", tool)
			}
		})
	}
}

func TestPerformGateCheck_FailClosed_ReadOnlyTool(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock Brain CLI failure (unavailable)
	ExecCommandGate = mockExecCommandError(1, "Error: brain CLI not available")

	readOnlyToolsList := []string{"Read", "Glob", "Grep", "LSP", "WebFetch", "WebSearch"}
	for _, tool := range readOnlyToolsList {
		t.Run("allows "+tool+" when state unavailable", func(t *testing.T) {
			result := performGateCheck(tool)

			if !result.Allowed {
				t.Errorf("performGateCheck(%q) should ALLOW read-only tool when state unavailable", tool)
			}
			if result.Mode != "unknown" {
				t.Errorf("performGateCheck(%q).Mode = %q, want %q", tool, result.Mode, "unknown")
			}
		})
	}
}

func TestPerformGateCheck_DisabledMode_AllowsAll(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock successful Brain CLI response with disabled mode
	state := SessionState{
		SessionID:   "test-session",
		CurrentMode: "disabled",
	}
	stateJSON, _ := json.Marshal(state)
	ExecCommandGate = mockExecCommand(string(stateJSON))

	tools := []string{"Edit", "Write", "Bash", "Read", "Grep", "NotebookEdit"}
	for _, tool := range tools {
		t.Run("allows "+tool+" in disabled mode", func(t *testing.T) {
			result := performGateCheck(tool)

			if !result.Allowed {
				t.Errorf("performGateCheck(%q) should ALLOW in disabled mode", tool)
			}
			if result.Mode != "disabled" {
				t.Errorf("performGateCheck(%q).Mode = %q, want %q", tool, result.Mode, "disabled")
			}
		})
	}
}

func TestPerformGateCheck_AnalysisMode_BlocksDestructive(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock successful Brain CLI response with analysis mode
	state := SessionState{
		SessionID:   "test-session",
		CurrentMode: "analysis",
	}
	stateJSON, _ := json.Marshal(state)
	ExecCommandGate = mockExecCommand(string(stateJSON))

	blockedTools := []string{"Edit", "Write", "Bash", "NotebookEdit"}
	for _, tool := range blockedTools {
		t.Run("blocks "+tool+" in analysis mode", func(t *testing.T) {
			result := performGateCheck(tool)

			if result.Allowed {
				t.Errorf("performGateCheck(%q) should BLOCK in analysis mode", tool)
			}
			if result.Mode != "analysis" {
				t.Errorf("performGateCheck(%q).Mode = %q, want %q", tool, result.Mode, "analysis")
			}
		})
	}

	allowedTools := []string{"Read", "Grep", "Glob", "Task"}
	for _, tool := range allowedTools {
		t.Run("allows "+tool+" in analysis mode", func(t *testing.T) {
			result := performGateCheck(tool)

			if !result.Allowed {
				t.Errorf("performGateCheck(%q) should ALLOW in analysis mode", tool)
			}
		})
	}
}

func TestPerformGateCheck_CodingMode_AllowsAll(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock successful Brain CLI response with coding mode
	state := SessionState{
		SessionID:   "test-session",
		CurrentMode: "coding",
	}
	stateJSON, _ := json.Marshal(state)
	ExecCommandGate = mockExecCommand(string(stateJSON))

	tools := []string{"Edit", "Write", "Bash", "Read", "Grep", "NotebookEdit"}
	for _, tool := range tools {
		t.Run("allows "+tool+" in coding mode", func(t *testing.T) {
			result := performGateCheck(tool)

			if !result.Allowed {
				t.Errorf("performGateCheck(%q) should ALLOW in coding mode", tool)
			}
			if result.Mode != "coding" {
				t.Errorf("performGateCheck(%q).Mode = %q, want %q", tool, result.Mode, "coding")
			}
		})
	}
}

func TestPerformGateCheck_SignatureVerificationFailure(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock Brain CLI failure with signature error (exit code 1)
	// The Brain CLI exits non-zero when signature is invalid
	ExecCommandGate = mockExecCommandError(1, "Error: Session state signature invalid - possible tampering")

	t.Run("blocks destructive tool on signature failure", func(t *testing.T) {
		result := performGateCheck("Edit")

		if result.Allowed {
			t.Error("performGateCheck should BLOCK when signature verification fails")
		}
		if result.Mode != "unknown" {
			t.Errorf("Mode = %q, want %q", result.Mode, "unknown")
		}
	})
}

// === Tests for formatBlockMessage ===

func TestFormatBlockMessage(t *testing.T) {
	tests := []struct {
		name   string
		tool   string
		mode   string
		wantIn []string // Strings that should be in the message
	}{
		{
			name:   "analysis mode message",
			tool:   "Edit",
			mode:   "analysis",
			wantIn: []string{"Edit", "analysis", "set_mode", "coding"},
		},
		{
			name:   "planning mode message",
			tool:   "Write",
			mode:   "planning",
			wantIn: []string{"Write", "planning", "set_mode", "coding"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg := formatBlockMessage(tt.tool, tt.mode)

			for _, want := range tt.wantIn {
				if !containsString(msg, want) {
					t.Errorf("formatBlockMessage(%q, %q) = %q, want to contain %q",
						tt.tool, tt.mode, msg, want)
				}
			}
		})
	}
}

// containsString checks if s contains substr
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

// === Tests for GateCheckResult JSON serialization ===

func TestGateCheckResult(t *testing.T) {
	t.Run("serializes to expected JSON format", func(t *testing.T) {
		result := &GateCheckResult{
			Allowed: false,
			Mode:    "analysis",
			Tool:    "Edit",
			Message: "Tool blocked",
		}

		data, err := json.Marshal(result)
		if err != nil {
			t.Fatalf("Failed to marshal GateCheckResult: %v", err)
		}

		var parsed map[string]any
		if err := json.Unmarshal(data, &parsed); err != nil {
			t.Fatalf("Failed to unmarshal GateCheckResult: %v", err)
		}

		if parsed["allowed"] != false {
			t.Errorf("JSON allowed = %v, want false", parsed["allowed"])
		}
		if parsed["mode"] != "analysis" {
			t.Errorf("JSON mode = %v, want analysis", parsed["mode"])
		}
		if parsed["tool"] != "Edit" {
			t.Errorf("JSON tool = %v, want Edit", parsed["tool"])
		}
		if parsed["message"] != "Tool blocked" {
			t.Errorf("JSON message = %v, want Tool blocked", parsed["message"])
		}
	})

	t.Run("omits empty message in JSON", func(t *testing.T) {
		result := &GateCheckResult{
			Allowed: true,
			Mode:    "coding",
			Tool:    "Edit",
			Message: "",
		}

		data, err := json.Marshal(result)
		if err != nil {
			t.Fatalf("Failed to marshal GateCheckResult: %v", err)
		}

		var parsed map[string]any
		if err := json.Unmarshal(data, &parsed); err != nil {
			t.Fatalf("Failed to unmarshal GateCheckResult: %v", err)
		}

		// Message should be empty string or not present
		if msg, exists := parsed["message"]; exists && msg != "" {
			t.Errorf("JSON message = %v, want empty or absent", msg)
		}
	})
}

// === Tests for ModeBlockedTools configuration ===

func TestModeBlockedTools(t *testing.T) {
	t.Run("analysis mode has correct blocked tools", func(t *testing.T) {
		blocked := ModeBlockedTools["analysis"]
		expected := []string{"Edit", "Write", "Bash", "NotebookEdit"}

		if len(blocked) != len(expected) {
			t.Errorf("analysis blocked tools count = %d, want %d", len(blocked), len(expected))
		}

		for _, tool := range expected {
			if !slices.Contains(blocked, tool) {
				t.Errorf("analysis mode should block %q", tool)
			}
		}
	})

	t.Run("planning mode has correct blocked tools", func(t *testing.T) {
		blocked := ModeBlockedTools["planning"]
		expected := []string{"Edit", "Write", "NotebookEdit"}

		if len(blocked) != len(expected) {
			t.Errorf("planning blocked tools count = %d, want %d", len(blocked), len(expected))
		}

		for _, tool := range expected {
			if !slices.Contains(blocked, tool) {
				t.Errorf("planning mode should block %q", tool)
			}
		}

		// Verify Bash is NOT blocked in planning
		if slices.Contains(blocked, "Bash") {
			t.Error("planning mode should NOT block Bash")
		}
	})

	t.Run("coding mode has no blocked tools", func(t *testing.T) {
		blocked := ModeBlockedTools["coding"]
		if len(blocked) != 0 {
			t.Errorf("coding mode should have no blocked tools, got %v", blocked)
		}
	})

	t.Run("disabled mode has no blocked tools", func(t *testing.T) {
		blocked := ModeBlockedTools["disabled"]
		if len(blocked) != 0 {
			t.Errorf("disabled mode should have no blocked tools, got %v", blocked)
		}
	})
}

// === Tests for SessionState JSON serialization ===

func TestSessionState(t *testing.T) {
	t.Run("JSON unmarshaling works correctly", func(t *testing.T) {
		jsonData := `{
			"sessionId": "abc-123",
			"currentMode": "planning",
			"activeTask": "Design session system",
			"activeFeature": "session-mode",
			"version": 5,
			"createdAt": "2024-01-15T10:00:00Z",
			"updatedAt": "2024-01-15T12:00:00Z"
		}`

		var state SessionState
		if err := json.Unmarshal([]byte(jsonData), &state); err != nil {
			t.Fatalf("Failed to unmarshal SessionState: %v", err)
		}

		if state.CurrentMode != "planning" {
			t.Errorf("CurrentMode = %q, want %q", state.CurrentMode, "planning")
		}
		if state.ActiveTask != "Design session system" {
			t.Errorf("ActiveTask = %q, want %q", state.ActiveTask, "Design session system")
		}
		if state.ActiveFeature != "session-mode" {
			t.Errorf("ActiveFeature = %q, want %q", state.ActiveFeature, "session-mode")
		}
		if state.SessionID != "abc-123" {
			t.Errorf("SessionID = %q, want %q", state.SessionID, "abc-123")
		}
		if state.UpdatedAt != "2024-01-15T12:00:00Z" {
			t.Errorf("UpdatedAt = %q, want %q", state.UpdatedAt, "2024-01-15T12:00:00Z")
		}
	})

	t.Run("JSON unmarshaling handles missing optional fields", func(t *testing.T) {
		jsonData := `{"sessionId": "test-123", "currentMode": "analysis"}`

		var state SessionState
		if err := json.Unmarshal([]byte(jsonData), &state); err != nil {
			t.Fatalf("Failed to unmarshal SessionState: %v", err)
		}

		if state.CurrentMode != "analysis" {
			t.Errorf("CurrentMode = %q, want %q", state.CurrentMode, "analysis")
		}
		if state.ActiveTask != "" {
			t.Errorf("ActiveTask = %q, want empty", state.ActiveTask)
		}
		if state.ActiveFeature != "" {
			t.Errorf("ActiveFeature = %q, want empty", state.ActiveFeature)
		}
	})
}

// === Tests for getBrainSessionState ===

func TestGetBrainSessionState_Success(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock successful Brain CLI response
	expectedState := SessionState{
		SessionID:             "test-session-123",
		CurrentMode:           "coding",
		ActiveTask:            "Implement feature",
		ActiveFeature:         "session-protocol",
		ProtocolStartComplete: true,
		Version:               3,
	}
	stateJSON, _ := json.Marshal(expectedState)
	ExecCommandGate = mockExecCommand(string(stateJSON))

	state, err := getBrainSessionState()

	if err != nil {
		t.Fatalf("getBrainSessionState() returned error: %v", err)
	}

	if state.SessionID != expectedState.SessionID {
		t.Errorf("SessionID = %q, want %q", state.SessionID, expectedState.SessionID)
	}
	if state.CurrentMode != expectedState.CurrentMode {
		t.Errorf("CurrentMode = %q, want %q", state.CurrentMode, expectedState.CurrentMode)
	}
	if state.ActiveTask != expectedState.ActiveTask {
		t.Errorf("ActiveTask = %q, want %q", state.ActiveTask, expectedState.ActiveTask)
	}
	if state.ProtocolStartComplete != expectedState.ProtocolStartComplete {
		t.Errorf("ProtocolStartComplete = %v, want %v", state.ProtocolStartComplete, expectedState.ProtocolStartComplete)
	}
}

func TestGetBrainSessionState_CLIError(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock Brain CLI failure
	ExecCommandGate = mockExecCommandError(1, "Error: MCP server not running")

	_, err := getBrainSessionState()

	if err == nil {
		t.Error("getBrainSessionState() should return error when CLI fails")
	}
}

func TestGetBrainSessionState_InvalidJSON(t *testing.T) {
	// Save and restore original ExecCommandGate
	origExecCommand := ExecCommandGate
	defer func() { ExecCommandGate = origExecCommand }()

	// Mock Brain CLI returning invalid JSON
	ExecCommandGate = mockExecCommand("not valid json")

	_, err := getBrainSessionState()

	if err == nil {
		t.Error("getBrainSessionState() should return error for invalid JSON")
	}
}

// === Benchmarks ===

func BenchmarkCheckToolBlocked(b *testing.B) {
	b.Run("blocked tool", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			checkToolBlocked("Edit", "analysis")
		}
	})

	b.Run("allowed tool", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			checkToolBlocked("Read", "analysis")
		}
	})

	b.Run("disabled mode", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			checkToolBlocked("Edit", "disabled")
		}
	})
}

func BenchmarkIsReadOnlyTool(b *testing.B) {
	b.Run("read-only tool", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			isReadOnlyTool("Read")
		}
	})

	b.Run("destructive tool", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			isReadOnlyTool("Edit")
		}
	})
}
