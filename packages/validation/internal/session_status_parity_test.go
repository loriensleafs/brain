package internal

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// SessionStatusParityTestCase represents a single test case for session status parity testing.
type SessionStatusParityTestCase struct {
	Name          string      `json:"name"`
	Data          interface{} `json:"data"`
	ExpectedError string      `json:"expectedError,omitempty"`
}

// SessionStatusParityTestSuite represents test cases for session status validation.
type SessionStatusParityTestSuite struct {
	Valid   []SessionStatusParityTestCase `json:"valid"`
	Invalid []SessionStatusParityTestCase `json:"invalid"`
}

// SessionStatusParityFixtures represents the fixtures file structure.
type SessionStatusParityFixtures struct {
	SessionStatus SessionStatusParityTestSuite `json:"session-status"`
}

func loadSessionStatusParityFixtures(t *testing.T) *SessionStatusParityFixtures {
	_, currentFile, _, _ := runtime.Caller(0)
	packageRoot := filepath.Dir(filepath.Dir(currentFile))
	fixturePath := filepath.Join(packageRoot, "src", "__tests__", "fixtures", "session-status-parity-test-cases.json")

	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("Failed to load session status parity test fixtures: %v", err)
	}

	var fixtures SessionStatusParityFixtures
	if err := json.Unmarshal(data, &fixtures); err != nil {
		t.Fatalf("Failed to parse session status parity test fixtures: %v", err)
	}

	return &fixtures
}

func TestIsValidSessionStatus(t *testing.T) {
	tests := []struct {
		status   string
		expected bool
	}{
		{"IN_PROGRESS", true},
		{"PAUSED", true},
		{"COMPLETE", true},
		{"in_progress", false},
		{"In_Progress", false},
		{"ACTIVE", false},
		{"", false},
		{"PENDING", false},
	}

	for _, tc := range tests {
		t.Run(tc.status, func(t *testing.T) {
			result := IsValidSessionStatus(tc.status)
			if result != tc.expected {
				t.Errorf("IsValidSessionStatus(%q) = %v, want %v", tc.status, result, tc.expected)
			}
		})
	}
}

func TestSessionStatusValidParity(t *testing.T) {
	fixtures := loadSessionStatusParityFixtures(t)

	for _, tc := range fixtures.SessionStatus.Valid {
		tc := tc // capture
		t.Run(tc.Name, func(t *testing.T) {
			// Convert interface{} to map[string]interface{}
			fm, ok := tc.Data.(map[string]interface{})
			if !ok {
				t.Fatalf("Test data is not a map: %T", tc.Data)
			}

			result := ValidateSessionStatus(fm)

			if !result.Valid {
				t.Errorf("Expected valid but got invalid. Errors: %v", result.Errors)
			}

			if len(result.Errors) != 0 {
				t.Errorf("Expected no errors but got: %v", result.Errors)
			}

			if result.Status == "" {
				t.Error("Expected status to be set for valid result")
			}
		})
	}
}

func TestSessionStatusInvalidParity(t *testing.T) {
	fixtures := loadSessionStatusParityFixtures(t)

	for _, tc := range fixtures.SessionStatus.Invalid {
		tc := tc
		t.Run(tc.Name, func(t *testing.T) {
			// Use ValidateSessionStatusFromAny to handle non-map types
			result := ValidateSessionStatusFromAny(tc.Data)

			if result.Valid {
				t.Error("Expected invalid but got valid")
				return
			}

			if len(result.Errors) == 0 {
				t.Error("Expected errors but got none")
				return
			}

			// Verify expected error constraint
			if tc.ExpectedError != "" {
				found := false
				for _, e := range result.Errors {
					if e.Constraint == tc.ExpectedError {
						found = true
						break
					}
				}
				if !found {
					constraints := make([]string, len(result.Errors))
					for i, e := range result.Errors {
						constraints[i] = e.Constraint
					}
					t.Errorf("Expected constraint %q not found in errors. Got: %v", tc.ExpectedError, constraints)
				}
			}
		})
	}
}

func TestValidateSessionStatusNilMap(t *testing.T) {
	result := ValidateSessionStatus(nil)

	if result.Valid {
		t.Error("Expected invalid for nil map")
	}

	if len(result.Errors) == 0 {
		t.Error("Expected errors for nil map")
	}

	if result.Errors[0].Constraint != "frontmatter_required" {
		t.Errorf("Expected frontmatter_required constraint, got %s", result.Errors[0].Constraint)
	}
}

func TestValidateSessionStatusFromAnyNil(t *testing.T) {
	result := ValidateSessionStatusFromAny(nil)

	if result.Valid {
		t.Error("Expected invalid for nil")
	}

	if result.Errors[0].Constraint != "frontmatter_required" {
		t.Errorf("Expected frontmatter_required constraint, got %s", result.Errors[0].Constraint)
	}
}

func TestValidateSessionStatusFromAnyArray(t *testing.T) {
	result := ValidateSessionStatusFromAny([]string{"a", "b"})

	if result.Valid {
		t.Error("Expected invalid for array")
	}

	if result.Errors[0].Constraint != "frontmatter_required" {
		t.Errorf("Expected frontmatter_required constraint, got %s", result.Errors[0].Constraint)
	}
}

func TestValidateSessionStatusFromAnyString(t *testing.T) {
	result := ValidateSessionStatusFromAny("not a map")

	if result.Valid {
		t.Error("Expected invalid for string")
	}

	if result.Errors[0].Constraint != "frontmatter_required" {
		t.Errorf("Expected frontmatter_required constraint, got %s", result.Errors[0].Constraint)
	}
}

func TestValidateSessionStatusMultipleErrors(t *testing.T) {
	fm := map[string]interface{}{
		"title":  "invalid-title",
		"type":   "note",
		"status": "INVALID",
		"date":   "not-a-date",
	}

	result := ValidateSessionStatus(fm)

	if result.Valid {
		t.Error("Expected invalid")
	}

	// Should have 4 errors: title, type, status, date
	if len(result.Errors) < 4 {
		t.Errorf("Expected at least 4 errors, got %d: %v", len(result.Errors), result.Errors)
	}

	// Check for all expected constraints
	constraints := make(map[string]bool)
	for _, e := range result.Errors {
		constraints[e.Constraint] = true
	}

	expected := []string{"title_invalid", "type_invalid", "status_invalid", "date_invalid"}
	for _, c := range expected {
		if !constraints[c] {
			t.Errorf("Missing expected constraint: %s", c)
		}
	}
}

func TestValidateSessionStatusAllStatuses(t *testing.T) {
	statuses := []string{"IN_PROGRESS", "PAUSED", "COMPLETE"}

	for _, status := range statuses {
		t.Run(status, func(t *testing.T) {
			fm := map[string]interface{}{
				"title":  "SESSION-2026-02-04_01-test",
				"type":   "session",
				"status": status,
				"date":   "2026-02-04",
			}

			result := ValidateSessionStatus(fm)

			if !result.Valid {
				t.Errorf("Expected valid for status %s, got errors: %v", status, result.Errors)
			}

			if result.Status != status {
				t.Errorf("Expected status %s, got %s", status, result.Status)
			}
		})
	}
}

func TestValidateSessionStatusExtraFields(t *testing.T) {
	fm := map[string]interface{}{
		"title":       "SESSION-2026-02-04_01-test",
		"type":        "session",
		"status":      "IN_PROGRESS",
		"date":        "2026-02-04",
		"permalink":   "sessions/test",
		"customField": "allowed",
		"tags":        []string{"session", "test"},
	}

	result := ValidateSessionStatus(fm)

	if !result.Valid {
		t.Errorf("Expected valid with extra fields, got errors: %v", result.Errors)
	}
}

// TestSessionStatusParityOutput generates JSON output for cross-language comparison.
func TestSessionStatusParityOutput(t *testing.T) {
	if os.Getenv("PARITY_OUTPUT") != "1" {
		t.Skip("Skipping parity output test (set PARITY_OUTPUT=1 to run)")
	}

	fixtures := loadSessionStatusParityFixtures(t)

	type ParityOutputEntry struct {
		Name   string            `json:"name"`
		Valid  bool              `json:"valid"`
		Status string            `json:"status,omitempty"`
		Errors []ValidationError `json:"errors"`
	}

	validResults := make([]ParityOutputEntry, 0, len(fixtures.SessionStatus.Valid))
	for _, tc := range fixtures.SessionStatus.Valid {
		fm, _ := tc.Data.(map[string]interface{})
		result := ValidateSessionStatus(fm)
		validResults = append(validResults, ParityOutputEntry{
			Name:   tc.Name,
			Valid:  result.Valid,
			Status: result.Status,
			Errors: result.Errors,
		})
	}

	invalidResults := make([]ParityOutputEntry, 0, len(fixtures.SessionStatus.Invalid))
	for _, tc := range fixtures.SessionStatus.Invalid {
		result := ValidateSessionStatusFromAny(tc.Data)
		invalidResults = append(invalidResults, ParityOutputEntry{
			Name:   tc.Name,
			Valid:  result.Valid,
			Status: result.Status,
			Errors: result.Errors,
		})
	}

	output := map[string]interface{}{
		"valid":   validResults,
		"invalid": invalidResults,
	}

	jsonOutput, _ := json.MarshalIndent(output, "", "  ")
	t.Logf("Session Status Parity Results:\n%s", string(jsonOutput))
}
