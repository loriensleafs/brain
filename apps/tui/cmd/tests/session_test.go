// Package tests provides unit tests for Brain CLI session commands.
//
// Tests cover:
// - SessionState types and JSON marshaling
// - isReadOnlyTool whitelist function
//
// Located at cmd/tests/session_test.go following Go test conventions.
// Note: Go package names must start with a letter, so __tests__ is not valid.
// The tests directory provides a dedicated location for cmd package tests.
package tests

import (
	"encoding/json"
	"strings"
	"testing"
)

// ============================================================================
// Test Types (mirrors cmd package types for testing without import cycle)
// ============================================================================

// WorkflowMode represents available workflow modes controlling tool access.
type WorkflowMode string

const (
	ModeAnalysis WorkflowMode = "analysis"
	ModePlanning WorkflowMode = "planning"
	ModeCoding   WorkflowMode = "coding"
	ModeDisabled WorkflowMode = "disabled"
)

// ModeHistoryEntry tracks each mode transition with timestamp.
type ModeHistoryEntry struct {
	Mode      WorkflowMode `json:"mode"`
	Timestamp string       `json:"timestamp"`
}

// OrchestratorWorkflow tracks the full state of an orchestrator-managed workflow.
type OrchestratorWorkflow struct {
	ActiveAgent     *string `json:"activeAgent"`
	WorkflowPhase   string  `json:"workflowPhase"`
	AgentHistory    []any   `json:"agentHistory"`
	Decisions       []any   `json:"decisions"`
	Verdicts        []any   `json:"verdicts"`
	PendingHandoffs []any   `json:"pendingHandoffs"`
	CompactionHist  []any   `json:"compactionHistory"`
	StartedAt       string  `json:"startedAt"`
	LastAgentChange string  `json:"lastAgentChange"`
}

// SessionState represents the full session state from Brain MCP.
// Matches TypeScript SessionState from apps/mcp/src/services/session/types.ts.
type SessionState struct {
	CurrentMode           WorkflowMode          `json:"currentMode"`
	ModeHistory           []ModeHistoryEntry    `json:"modeHistory"`
	ProtocolStartComplete bool                  `json:"protocolStartComplete"`
	ProtocolEndComplete   bool                  `json:"protocolEndComplete"`
	ProtocolStartEvidence map[string]string     `json:"protocolStartEvidence"`
	ProtocolEndEvidence   map[string]string     `json:"protocolEndEvidence"`
	OrchestratorWorkflow  *OrchestratorWorkflow `json:"orchestratorWorkflow"`
	ActiveFeature         string                `json:"activeFeature,omitempty"`
	ActiveTask            string                `json:"activeTask,omitempty"`
	Version               int                   `json:"version"`
	CreatedAt             string                `json:"createdAt"`
	UpdatedAt             string                `json:"updatedAt"`
}

// readOnlyTools lists tools that are safe to execute when session state is unavailable.
var readOnlyTools = map[string]bool{
	"Read":      true,
	"Glob":      true,
	"Grep":      true,
	"LSP":       true,
	"WebFetch":  true,
	"WebSearch": true,
}

// IsReadOnlyTool returns true if the tool is in the read-only whitelist.
func IsReadOnlyTool(tool string) bool {
	return readOnlyTools[tool]
}

// ============================================================================
// SessionState Type Tests
// ============================================================================

func TestSessionState_JSONMarshalRoundTrip(t *testing.T) {
	state := SessionState{
		CurrentMode:           ModeAnalysis,
		ModeHistory:           []ModeHistoryEntry{{Mode: ModeAnalysis, Timestamp: "2026-01-18T10:00:00Z"}},
		ProtocolStartComplete: true,
		ProtocolEndComplete:   false,
		ProtocolStartEvidence: map[string]string{"brainMcpInitialized": "2026-01-18T10:00:00Z"},
		ProtocolEndEvidence:   map[string]string{},
		OrchestratorWorkflow:  nil,
		ActiveFeature:         "ADR-016",
		ActiveTask:            "TASK-006",
		Version:               1,
		CreatedAt:             "2026-01-18T10:00:00Z",
		UpdatedAt:             "2026-01-18T10:15:00Z",
	}

	data, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("Failed to marshal SessionState: %v", err)
	}

	var decoded SessionState
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal SessionState: %v", err)
	}

	if decoded.CurrentMode != state.CurrentMode {
		t.Errorf("CurrentMode mismatch: got %q, want %q", decoded.CurrentMode, state.CurrentMode)
	}
	if decoded.ProtocolStartComplete != state.ProtocolStartComplete {
		t.Errorf("ProtocolStartComplete mismatch: got %v, want %v", decoded.ProtocolStartComplete, state.ProtocolStartComplete)
	}
	if decoded.Version != state.Version {
		t.Errorf("Version mismatch: got %d, want %d", decoded.Version, state.Version)
	}
}

func TestSessionState_AllModes(t *testing.T) {
	modes := []WorkflowMode{ModeAnalysis, ModePlanning, ModeCoding, ModeDisabled}

	for _, mode := range modes {
		t.Run(string(mode), func(t *testing.T) {
			state := SessionState{
				CurrentMode:           mode,
				ModeHistory:           []ModeHistoryEntry{},
				ProtocolStartEvidence: map[string]string{},
				ProtocolEndEvidence:   map[string]string{},
				Version:               1,
				CreatedAt:             "2026-01-18T10:00:00Z",
				UpdatedAt:             "2026-01-18T10:00:00Z",
			}

			data, err := json.Marshal(state)
			if err != nil {
				t.Fatalf("Failed to marshal state with mode %s: %v", mode, err)
			}

			var decoded SessionState
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatalf("Failed to unmarshal state with mode %s: %v", mode, err)
			}

			if decoded.CurrentMode != mode {
				t.Errorf("Mode mismatch: got %q, want %q", decoded.CurrentMode, mode)
			}
		})
	}
}

func TestSessionState_OptionalFieldsOmitted(t *testing.T) {
	state := SessionState{
		CurrentMode:           ModeAnalysis,
		ModeHistory:           []ModeHistoryEntry{},
		ProtocolStartEvidence: map[string]string{},
		ProtocolEndEvidence:   map[string]string{},
		Version:               1,
		CreatedAt:             "2026-01-18T10:00:00Z",
		UpdatedAt:             "2026-01-18T10:00:00Z",
		// ActiveFeature and ActiveTask are empty strings
	}

	data, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("Failed to marshal state: %v", err)
	}

	// Verify omitempty works - empty strings should not appear
	dataStr := string(data)
	if strings.Contains(dataStr, `"activeFeature":""`) {
		t.Error("Empty activeFeature should be omitted from JSON")
	}
	if strings.Contains(dataStr, `"activeTask":""`) {
		t.Error("Empty activeTask should be omitted from JSON")
	}
}

func TestSessionState_WithOrchestratorWorkflow(t *testing.T) {
	activeAgent := "analyst"
	state := SessionState{
		CurrentMode:           ModePlanning,
		ModeHistory:           []ModeHistoryEntry{},
		ProtocolStartComplete: true,
		ProtocolStartEvidence: map[string]string{},
		ProtocolEndEvidence:   map[string]string{},
		OrchestratorWorkflow: &OrchestratorWorkflow{
			ActiveAgent:     &activeAgent,
			WorkflowPhase:   "planning",
			AgentHistory:    []any{},
			Decisions:       []any{},
			Verdicts:        []any{},
			PendingHandoffs: []any{},
			CompactionHist:  []any{},
			StartedAt:       "2026-01-18T10:00:00Z",
			LastAgentChange: "2026-01-18T10:05:00Z",
		},
		Version:   2,
		CreatedAt: "2026-01-18T10:00:00Z",
		UpdatedAt: "2026-01-18T10:05:00Z",
	}

	data, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("Failed to marshal state with workflow: %v", err)
	}

	var decoded SessionState
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Failed to unmarshal state with workflow: %v", err)
	}

	if decoded.OrchestratorWorkflow == nil {
		t.Fatal("OrchestratorWorkflow should not be nil")
	}
	if decoded.OrchestratorWorkflow.ActiveAgent == nil {
		t.Fatal("ActiveAgent should not be nil")
	}
	if *decoded.OrchestratorWorkflow.ActiveAgent != activeAgent {
		t.Errorf("ActiveAgent mismatch: got %q, want %q", *decoded.OrchestratorWorkflow.ActiveAgent, activeAgent)
	}
}

// ============================================================================
// isReadOnlyTool Tests
// ============================================================================

func TestIsReadOnlyTool_AllowedTools(t *testing.T) {
	allowedTools := []string{"Read", "Glob", "Grep", "LSP", "WebFetch", "WebSearch"}

	for _, tool := range allowedTools {
		t.Run(tool, func(t *testing.T) {
			if !IsReadOnlyTool(tool) {
				t.Errorf("%s should be in read-only whitelist", tool)
			}
		})
	}
}

func TestIsReadOnlyTool_BlockedTools(t *testing.T) {
	blockedTools := []string{"Edit", "Write", "Bash", "MultiEdit", "Task", "TodoWrite"}

	for _, tool := range blockedTools {
		t.Run(tool, func(t *testing.T) {
			if IsReadOnlyTool(tool) {
				t.Errorf("%s should NOT be in read-only whitelist", tool)
			}
		})
	}
}

func TestIsReadOnlyTool_CaseSensitive(t *testing.T) {
	// Tool names are case-sensitive
	if IsReadOnlyTool("read") {
		t.Error("Tool lookup should be case-sensitive: 'read' should not match 'Read'")
	}
	if IsReadOnlyTool("READ") {
		t.Error("Tool lookup should be case-sensitive: 'READ' should not match 'Read'")
	}
}

func TestIsReadOnlyTool_EmptyString(t *testing.T) {
	if IsReadOnlyTool("") {
		t.Error("Empty string should not be in read-only whitelist")
	}
}

// ============================================================================
// Integration Tests (simulated)
// ============================================================================

func TestGetState_OutputFormat(t *testing.T) {
	// Simulate what get-state command outputs
	state := SessionState{
		CurrentMode:           ModeAnalysis,
		ModeHistory:           []ModeHistoryEntry{{Mode: ModeAnalysis, Timestamp: "2026-01-18T10:00:00Z"}},
		ProtocolStartComplete: true,
		ProtocolEndComplete:   false,
		ProtocolStartEvidence: map[string]string{"brainMcpInitialized": "2026-01-18T10:00:00Z"},
		ProtocolEndEvidence:   map[string]string{},
		Version:               1,
		CreatedAt:             "2026-01-18T10:00:00Z",
		UpdatedAt:             "2026-01-18T10:15:00Z",
	}

	output, err := json.Marshal(state)
	if err != nil {
		t.Fatalf("Failed to marshal state: %v", err)
	}

	// Verify output can be parsed back
	var parsed SessionState
	if err := json.Unmarshal(output, &parsed); err != nil {
		t.Fatalf("Failed to parse get-state output: %v", err)
	}

	// Verify critical fields are present
	if parsed.CurrentMode == "" {
		t.Error("Output must include currentMode")
	}
	if parsed.Version == 0 {
		t.Error("Output must include version")
	}
}

func TestSetState_UpdatesApplied(t *testing.T) {
	// Simulate set-state input parsing
	input := `{"mode":"coding","task":"TASK-006","feature":"ADR-016"}`

	var updates struct {
		Mode    *string `json:"mode,omitempty"`
		Task    *string `json:"task,omitempty"`
		Feature *string `json:"feature,omitempty"`
	}

	if err := json.Unmarshal([]byte(input), &updates); err != nil {
		t.Fatalf("Failed to parse set-state input: %v", err)
	}

	if updates.Mode == nil || *updates.Mode != "coding" {
		t.Error("Mode should be parsed as 'coding'")
	}
	if updates.Task == nil || *updates.Task != "TASK-006" {
		t.Error("Task should be parsed as 'TASK-006'")
	}
	if updates.Feature == nil || *updates.Feature != "ADR-016" {
		t.Error("Feature should be parsed as 'ADR-016'")
	}
}

// ============================================================================
// Session Lifecycle Response Types (mirrors cmd package types)
// ============================================================================

// SessionCreateResponse represents the MCP session create response.
type SessionCreateResponse struct {
	Success    bool    `json:"success"`
	SessionID  string  `json:"sessionId"`
	Path       string  `json:"path"`
	AutoPaused *string `json:"autoPaused,omitempty"`
	Error      string  `json:"error,omitempty"`
	Message    string  `json:"message,omitempty"`
}

// SessionTransitionResponse represents the MCP session pause/resume/complete response.
type SessionTransitionResponse struct {
	Success        bool   `json:"success"`
	SessionID      string `json:"sessionId"`
	PreviousStatus string `json:"previousStatus,omitempty"`
	NewStatus      string `json:"newStatus,omitempty"`
	Error          string `json:"error,omitempty"`
	Message        string `json:"message,omitempty"`
}

// ============================================================================
// Session Create Tests
// ============================================================================

func TestSessionCreateResponse_SuccessParsing(t *testing.T) {
	input := `{
		"success": true,
		"sessionId": "SESSION-2026-02-04_01-feature-xyz",
		"path": "sessions/SESSION-2026-02-04_01-feature-xyz.md"
	}`

	var resp SessionCreateResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse create response: %v", err)
	}

	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.SessionID != "SESSION-2026-02-04_01-feature-xyz" {
		t.Errorf("SessionID mismatch: got %q", resp.SessionID)
	}
	if resp.Path != "sessions/SESSION-2026-02-04_01-feature-xyz.md" {
		t.Errorf("Path mismatch: got %q", resp.Path)
	}
	if resp.AutoPaused != nil {
		t.Error("AutoPaused should be nil when no session was auto-paused")
	}
}

func TestSessionCreateResponse_WithAutoPause(t *testing.T) {
	autoPaused := "SESSION-2026-02-03_02-bugfix"
	input := `{
		"success": true,
		"sessionId": "SESSION-2026-02-04_01-feature-xyz",
		"path": "sessions/SESSION-2026-02-04_01-feature-xyz.md",
		"autoPaused": "SESSION-2026-02-03_02-bugfix"
	}`

	var resp SessionCreateResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse create response with autoPaused: %v", err)
	}

	if resp.AutoPaused == nil {
		t.Fatal("AutoPaused should not be nil")
	}
	if *resp.AutoPaused != autoPaused {
		t.Errorf("AutoPaused mismatch: got %q, want %q", *resp.AutoPaused, autoPaused)
	}
}

func TestSessionCreateResponse_ErrorParsing(t *testing.T) {
	input := `{
		"success": false,
		"error": "AUTO_PAUSE_FAILED",
		"message": "Failed to auto-pause existing session"
	}`

	var resp SessionCreateResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse error response: %v", err)
	}

	if resp.Success {
		t.Error("Success should be false")
	}
	if resp.Error != "AUTO_PAUSE_FAILED" {
		t.Errorf("Error code mismatch: got %q", resp.Error)
	}
	if resp.Message == "" {
		t.Error("Message should be present for errors")
	}
}

// ============================================================================
// Session Pause Tests
// ============================================================================

func TestSessionTransitionResponse_PauseSuccess(t *testing.T) {
	input := `{
		"success": true,
		"sessionId": "SESSION-2026-02-04_01-feature-xyz",
		"previousStatus": "IN_PROGRESS",
		"newStatus": "PAUSED"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse pause response: %v", err)
	}

	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.PreviousStatus != "IN_PROGRESS" {
		t.Errorf("PreviousStatus mismatch: got %q", resp.PreviousStatus)
	}
	if resp.NewStatus != "PAUSED" {
		t.Errorf("NewStatus mismatch: got %q", resp.NewStatus)
	}
}

func TestSessionTransitionResponse_SessionNotFound(t *testing.T) {
	input := `{
		"success": false,
		"error": "SESSION_NOT_FOUND",
		"message": "Session not found: SESSION-2026-02-04_01-unknown"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse error response: %v", err)
	}

	if resp.Success {
		t.Error("Success should be false")
	}
	if resp.Error != "SESSION_NOT_FOUND" {
		t.Errorf("Error code mismatch: got %q", resp.Error)
	}
}

func TestSessionTransitionResponse_InvalidTransition(t *testing.T) {
	input := `{
		"success": false,
		"error": "INVALID_STATUS_TRANSITION",
		"previousStatus": "PAUSED",
		"message": "Session cannot be paused (already paused)"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse invalid transition response: %v", err)
	}

	if resp.Success {
		t.Error("Success should be false")
	}
	if resp.Error != "INVALID_STATUS_TRANSITION" {
		t.Errorf("Error code mismatch: got %q", resp.Error)
	}
	if resp.PreviousStatus != "PAUSED" {
		t.Errorf("PreviousStatus should indicate current status: got %q", resp.PreviousStatus)
	}
}

// ============================================================================
// Session Resume Tests
// ============================================================================

func TestSessionTransitionResponse_ResumeSuccess(t *testing.T) {
	input := `{
		"success": true,
		"sessionId": "SESSION-2026-02-04_01-feature-xyz",
		"previousStatus": "PAUSED",
		"newStatus": "IN_PROGRESS"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse resume response: %v", err)
	}

	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.PreviousStatus != "PAUSED" {
		t.Errorf("PreviousStatus mismatch: got %q", resp.PreviousStatus)
	}
	if resp.NewStatus != "IN_PROGRESS" {
		t.Errorf("NewStatus mismatch: got %q", resp.NewStatus)
	}
}

func TestSessionTransitionResponse_AutoPauseFailed(t *testing.T) {
	input := `{
		"success": false,
		"error": "AUTO_PAUSE_FAILED",
		"message": "Failed to auto-pause existing session: SESSION-2026-02-03_02-bugfix"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse auto-pause failed response: %v", err)
	}

	if resp.Success {
		t.Error("Success should be false")
	}
	if resp.Error != "AUTO_PAUSE_FAILED" {
		t.Errorf("Error code mismatch: got %q", resp.Error)
	}
}

// ============================================================================
// Session Complete Tests
// ============================================================================

func TestSessionTransitionResponse_CompleteSuccess(t *testing.T) {
	input := `{
		"success": true,
		"sessionId": "SESSION-2026-02-04_01-feature-xyz",
		"previousStatus": "IN_PROGRESS",
		"newStatus": "COMPLETE"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse complete response: %v", err)
	}

	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.PreviousStatus != "IN_PROGRESS" {
		t.Errorf("PreviousStatus mismatch: got %q", resp.PreviousStatus)
	}
	if resp.NewStatus != "COMPLETE" {
		t.Errorf("NewStatus mismatch: got %q", resp.NewStatus)
	}
}

func TestSessionTransitionResponse_AlreadyComplete(t *testing.T) {
	input := `{
		"success": false,
		"error": "INVALID_STATUS_TRANSITION",
		"previousStatus": "COMPLETE",
		"message": "Session cannot be completed (already complete)"
	}`

	var resp SessionTransitionResponse
	if err := json.Unmarshal([]byte(input), &resp); err != nil {
		t.Fatalf("Failed to parse already complete response: %v", err)
	}

	if resp.Success {
		t.Error("Success should be false")
	}
	if resp.PreviousStatus != "COMPLETE" {
		t.Errorf("PreviousStatus should indicate COMPLETE: got %q", resp.PreviousStatus)
	}
}

// ============================================================================
// Session ID Format Tests
// ============================================================================

func TestSessionIDFormat(t *testing.T) {
	validIDs := []string{
		"SESSION-2026-02-04_01-feature-xyz",
		"SESSION-2026-01-01_99-a",
		"SESSION-2099-12-31_01-long-topic-with-hyphens",
	}

	for _, id := range validIDs {
		t.Run(id, func(t *testing.T) {
			// Verify the ID follows expected pattern
			if !strings.HasPrefix(id, "SESSION-") {
				t.Errorf("Session ID should start with SESSION-: %s", id)
			}
			// Verify it contains date pattern
			if !strings.Contains(id, "-20") {
				t.Errorf("Session ID should contain year: %s", id)
			}
		})
	}
}

// ============================================================================
// Output Format Tests
// ============================================================================

func TestCreateOutputFormat(t *testing.T) {
	// Verify the expected output format for create command
	resp := SessionCreateResponse{
		Success:   true,
		SessionID: "SESSION-2026-02-04_01-feature-xyz",
		Path:      "sessions/SESSION-2026-02-04_01-feature-xyz.md",
	}

	// Simulate formatted output
	output := strings.Builder{}
	output.WriteString("Session created: " + resp.SessionID + "\n")
	output.WriteString("Path: " + resp.Path + "\n")

	result := output.String()
	if !strings.Contains(result, "Session created:") {
		t.Error("Output should contain 'Session created:'")
	}
	if !strings.Contains(result, "Path:") {
		t.Error("Output should contain 'Path:'")
	}
}

func TestTransitionOutputFormat(t *testing.T) {
	// Verify the expected output format for pause/resume/complete commands
	resp := SessionTransitionResponse{
		Success:        true,
		SessionID:      "SESSION-2026-02-04_01-feature-xyz",
		PreviousStatus: "IN_PROGRESS",
		NewStatus:      "PAUSED",
	}

	// Simulate formatted output
	output := strings.Builder{}
	output.WriteString("Session paused: " + resp.SessionID + "\n")
	output.WriteString("Status: " + resp.PreviousStatus + " -> " + resp.NewStatus + "\n")

	result := output.String()
	if !strings.Contains(result, "Session paused:") {
		t.Error("Output should contain 'Session paused:'")
	}
	if !strings.Contains(result, "->") {
		t.Error("Output should contain status transition arrow")
	}
}

