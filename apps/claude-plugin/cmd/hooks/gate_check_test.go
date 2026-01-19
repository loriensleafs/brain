package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// TestCheckToolBlocked verifies tool blocking logic for each mode
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
			result := CheckToolBlocked(tt.tool, tt.mode)

			if result.Allowed != tt.wantAllowed {
				t.Errorf("CheckToolBlocked(%q, %q).Allowed = %v, want %v",
					tt.tool, tt.mode, result.Allowed, tt.wantAllowed)
			}

			if result.Tool != tt.tool {
				t.Errorf("CheckToolBlocked(%q, %q).Tool = %q, want %q",
					tt.tool, tt.mode, result.Tool, tt.tool)
			}

			if result.Mode != tt.mode {
				t.Errorf("CheckToolBlocked(%q, %q).Mode = %q, want %q",
					tt.tool, tt.mode, result.Mode, tt.mode)
			}

			hasMessage := result.Message != ""
			if hasMessage != tt.wantMessage {
				t.Errorf("CheckToolBlocked(%q, %q).Message empty = %v, want %v",
					tt.tool, tt.mode, !hasMessage, !tt.wantMessage)
			}
		})
	}
}

// TestFormatBlockMessage verifies block message formatting
func TestFormatBlockMessage(t *testing.T) {
	tests := []struct {
		name    string
		tool    string
		mode    string
		wantIn  []string // Strings that should be in the message
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

// TestReadSessionState tests reading session state from file
func TestReadSessionState(t *testing.T) {
	// Create temp directory for test
	tmpDir := t.TempDir()
	stateDir := filepath.Join(tmpDir, ".local", "state", "brain")
	if err := os.MkdirAll(stateDir, 0755); err != nil {
		t.Fatalf("Failed to create state dir: %v", err)
	}

	// Override home directory for test
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	t.Run("returns disabled when file does not exist", func(t *testing.T) {
		// Ensure no session.json exists
		sessionPath := filepath.Join(stateDir, "session.json")
		os.Remove(sessionPath)

		state, err := ReadSessionState()

		if err != nil {
			t.Fatalf("ReadSessionState() error = %v, want nil", err)
		}
		if state.Mode != "disabled" {
			t.Errorf("ReadSessionState().Mode = %q, want %q", state.Mode, "disabled")
		}
	})

	t.Run("reads valid session state", func(t *testing.T) {
		sessionData := SessionState{
			Mode:      "coding",
			Task:      "Implementing tests",
			Feature:   "session-tests",
			SessionID: "test-session-123",
			UpdatedAt: "2024-01-15T10:00:00Z",
		}

		sessionPath := filepath.Join(stateDir, "session.json")
		data, _ := json.Marshal(sessionData)
		if err := os.WriteFile(sessionPath, data, 0644); err != nil {
			t.Fatalf("Failed to write session file: %v", err)
		}

		state, err := ReadSessionState()

		if err != nil {
			t.Fatalf("ReadSessionState() error = %v, want nil", err)
		}
		if state.Mode != "coding" {
			t.Errorf("ReadSessionState().Mode = %q, want %q", state.Mode, "coding")
		}
		if state.Task != "Implementing tests" {
			t.Errorf("ReadSessionState().Task = %q, want %q", state.Task, "Implementing tests")
		}
		if state.Feature != "session-tests" {
			t.Errorf("ReadSessionState().Feature = %q, want %q", state.Feature, "session-tests")
		}
	})

	t.Run("defaults to disabled for empty mode", func(t *testing.T) {
		sessionData := SessionState{
			Mode:      "", // Empty mode
			SessionID: "test-session-456",
		}

		sessionPath := filepath.Join(stateDir, "session.json")
		data, _ := json.Marshal(sessionData)
		if err := os.WriteFile(sessionPath, data, 0644); err != nil {
			t.Fatalf("Failed to write session file: %v", err)
		}

		state, err := ReadSessionState()

		if err != nil {
			t.Fatalf("ReadSessionState() error = %v, want nil", err)
		}
		if state.Mode != "disabled" {
			t.Errorf("ReadSessionState().Mode = %q, want %q", state.Mode, "disabled")
		}
	})

	t.Run("returns error for invalid JSON", func(t *testing.T) {
		sessionPath := filepath.Join(stateDir, "session.json")
		if err := os.WriteFile(sessionPath, []byte("not valid json"), 0644); err != nil {
			t.Fatalf("Failed to write session file: %v", err)
		}

		_, err := ReadSessionState()

		if err == nil {
			t.Error("ReadSessionState() error = nil, want error for invalid JSON")
		}
	})
}

// TestPerformGateCheck tests the integration of session state reading and tool checking
func TestPerformGateCheck(t *testing.T) {
	// Create temp directory for test
	tmpDir := t.TempDir()
	stateDir := filepath.Join(tmpDir, ".local", "state", "brain")
	if err := os.MkdirAll(stateDir, 0755); err != nil {
		t.Fatalf("Failed to create state dir: %v", err)
	}

	// Override home directory for test
	origHome := os.Getenv("HOME")
	os.Setenv("HOME", tmpDir)
	defer os.Setenv("HOME", origHome)

	t.Run("blocks Edit in analysis mode from file", func(t *testing.T) {
		sessionData := SessionState{
			Mode:      "analysis",
			SessionID: "test-session",
		}

		sessionPath := filepath.Join(stateDir, "session.json")
		data, _ := json.Marshal(sessionData)
		if err := os.WriteFile(sessionPath, data, 0644); err != nil {
			t.Fatalf("Failed to write session file: %v", err)
		}

		result := PerformGateCheck("Edit")

		if result.Allowed {
			t.Error("PerformGateCheck(Edit) in analysis mode should not be allowed")
		}
		if result.Mode != "analysis" {
			t.Errorf("PerformGateCheck(Edit).Mode = %q, want %q", result.Mode, "analysis")
		}
		if result.Message == "" {
			t.Error("PerformGateCheck(Edit) should have a block message")
		}
	})

	t.Run("allows Edit in coding mode from file", func(t *testing.T) {
		sessionData := SessionState{
			Mode:      "coding",
			SessionID: "test-session",
		}

		sessionPath := filepath.Join(stateDir, "session.json")
		data, _ := json.Marshal(sessionData)
		if err := os.WriteFile(sessionPath, data, 0644); err != nil {
			t.Fatalf("Failed to write session file: %v", err)
		}

		result := PerformGateCheck("Edit")

		if !result.Allowed {
			t.Error("PerformGateCheck(Edit) in coding mode should be allowed")
		}
		if result.Mode != "coding" {
			t.Errorf("PerformGateCheck(Edit).Mode = %q, want %q", result.Mode, "coding")
		}
	})

	t.Run("allows tool when no session file (fail-open on missing file)", func(t *testing.T) {
		// Remove session file
		sessionPath := filepath.Join(stateDir, "session.json")
		os.Remove(sessionPath)

		result := PerformGateCheck("Edit")

		if !result.Allowed {
			t.Error("PerformGateCheck should allow when no session file (disabled mode)")
		}
		if result.Mode != "disabled" {
			t.Errorf("PerformGateCheck.Mode = %q, want %q", result.Mode, "disabled")
		}
	})

	t.Run("allows tool on file read error (fail-open)", func(t *testing.T) {
		sessionPath := filepath.Join(stateDir, "session.json")
		if err := os.WriteFile(sessionPath, []byte("invalid json"), 0644); err != nil {
			t.Fatalf("Failed to write session file: %v", err)
		}

		result := PerformGateCheck("Edit")

		if !result.Allowed {
			t.Error("PerformGateCheck should allow on file read error (fail-open)")
		}
		if result.Mode != "unknown" {
			t.Errorf("PerformGateCheck.Mode = %q, want %q for error case", result.Mode, "unknown")
		}
	})
}

// TestGateCheckResult verifies the GateCheckResult struct serialization
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

// TestModeBlockedTools verifies the mode-tool blocking configuration
func TestModeBlockedTools(t *testing.T) {
	t.Run("analysis mode has correct blocked tools", func(t *testing.T) {
		blocked := modeBlockedTools["analysis"]
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
		blocked := modeBlockedTools["planning"]
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
		blocked := modeBlockedTools["coding"]
		if len(blocked) != 0 {
			t.Errorf("coding mode should have no blocked tools, got %v", blocked)
		}
	})

	t.Run("disabled mode has no blocked tools", func(t *testing.T) {
		blocked := modeBlockedTools["disabled"]
		if len(blocked) != 0 {
			t.Errorf("disabled mode should have no blocked tools, got %v", blocked)
		}
	})
}

// TestSessionState verifies the SessionState struct
func TestSessionState(t *testing.T) {
	t.Run("JSON unmarshaling works correctly", func(t *testing.T) {
		jsonData := `{
			"mode": "planning",
			"task": "Design session system",
			"feature": "session-mode",
			"sessionId": "abc-123",
			"updatedAt": "2024-01-15T12:00:00Z"
		}`

		var state SessionState
		if err := json.Unmarshal([]byte(jsonData), &state); err != nil {
			t.Fatalf("Failed to unmarshal SessionState: %v", err)
		}

		if state.Mode != "planning" {
			t.Errorf("Mode = %q, want %q", state.Mode, "planning")
		}
		if state.Task != "Design session system" {
			t.Errorf("Task = %q, want %q", state.Task, "Design session system")
		}
		if state.Feature != "session-mode" {
			t.Errorf("Feature = %q, want %q", state.Feature, "session-mode")
		}
		if state.SessionID != "abc-123" {
			t.Errorf("SessionID = %q, want %q", state.SessionID, "abc-123")
		}
		if state.UpdatedAt != "2024-01-15T12:00:00Z" {
			t.Errorf("UpdatedAt = %q, want %q", state.UpdatedAt, "2024-01-15T12:00:00Z")
		}
	})

	t.Run("JSON unmarshaling handles missing optional fields", func(t *testing.T) {
		jsonData := `{"mode": "analysis"}`

		var state SessionState
		if err := json.Unmarshal([]byte(jsonData), &state); err != nil {
			t.Fatalf("Failed to unmarshal SessionState: %v", err)
		}

		if state.Mode != "analysis" {
			t.Errorf("Mode = %q, want %q", state.Mode, "analysis")
		}
		if state.Task != "" {
			t.Errorf("Task = %q, want empty", state.Task)
		}
		if state.Feature != "" {
			t.Errorf("Feature = %q, want empty", state.Feature)
		}
	})
}

// Benchmarks
func BenchmarkCheckToolBlocked(b *testing.B) {
	b.Run("blocked tool", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			CheckToolBlocked("Edit", "analysis")
		}
	})

	b.Run("allowed tool", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			CheckToolBlocked("Read", "analysis")
		}
	})

	b.Run("disabled mode", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			CheckToolBlocked("Edit", "disabled")
		}
	})
}
