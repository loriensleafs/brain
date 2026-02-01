package internal_test

import (
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for DetectScenario

func TestDetectScenario_BugDetection(t *testing.T) {
	tests := []struct {
		name     string
		prompt   string
		detected bool
		scenario string
	}{
		{"bug keyword", "there is a bug in the code", true, "BUG"},
		{"error keyword", "I got an error message", true, "BUG"},
		{"fix keyword", "can you fix this issue", true, "BUG"},
		{"crash keyword", "the app keeps crashing", true, "BUG"},
		{"debug keyword", "need to debug this problem", true, "BUG"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.DetectScenario(tt.prompt)
			if result.Detected != tt.detected {
				t.Errorf("Expected detected=%v, got %v", tt.detected, result.Detected)
			}
			if result.Scenario != tt.scenario {
				t.Errorf("Expected scenario=%q, got %q", tt.scenario, result.Scenario)
			}
		})
	}
}

func TestDetectScenario_FeatureDetection(t *testing.T) {
	tests := []struct {
		name     string
		prompt   string
		detected bool
		scenario string
	}{
		{"implement keyword", "I want to implement a new API", true, "FEATURE"},
		{"build feature keyword", "let's build feature for authentication", true, "FEATURE"},
		{"new feature keyword", "we need a new feature for exports", true, "FEATURE"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.DetectScenario(tt.prompt)
			if result.Detected != tt.detected {
				t.Errorf("Expected detected=%v, got %v", tt.detected, result.Detected)
			}
			if result.Scenario != tt.scenario {
				t.Errorf("Expected scenario=%q, got %q", tt.scenario, result.Scenario)
			}
		})
	}
}

func TestDetectScenario_NoMatch(t *testing.T) {
	result := internal.DetectScenario("hello world how are you")

	if result.Detected {
		t.Errorf("Expected no detection, got scenario=%q", result.Scenario)
	}
	if result.Scenario != "" {
		t.Errorf("Expected empty scenario, got %q", result.Scenario)
	}
}

func TestDetectScenario_PriorityOrder(t *testing.T) {
	// When multiple keywords match, BUG should take priority over FEATURE
	result := internal.DetectScenario("fix the bug and implement new feature")

	if !result.Detected {
		t.Error("Expected detection")
	}
	if result.Scenario != "BUG" {
		t.Errorf("Expected BUG (higher priority), got %q", result.Scenario)
	}
}

func TestDetectScenario_CaseInsensitive(t *testing.T) {
	result := internal.DetectScenario("There is a BUG in the CODE")

	if !result.Detected {
		t.Error("Expected detection (case insensitive)")
	}
	if result.Scenario != "BUG" {
		t.Errorf("Expected BUG, got %q", result.Scenario)
	}
}

func TestDetectScenario_ResultFields(t *testing.T) {
	result := internal.DetectScenario("there is a bug")

	if !result.Detected {
		t.Fatal("Expected detection")
	}
	if result.Scenario != "BUG" {
		t.Errorf("Expected scenario BUG, got %q", result.Scenario)
	}
	if len(result.Keywords) == 0 {
		t.Error("Expected keywords to be populated")
	}
	if result.Recommended == "" {
		t.Error("Expected recommended to be set")
	}
	if result.Directory != "bugs" {
		t.Errorf("Expected directory 'bugs', got %q", result.Directory)
	}
	if result.NoteType != "bug" {
		t.Errorf("Expected noteType 'bug', got %q", result.NoteType)
	}
}

func TestDetectScenario_AllScenarios(t *testing.T) {
	tests := []struct {
		prompt   string
		scenario string
		dir      string
	}{
		{"there is a bug", "BUG", "bugs"},
		{"implement new feature", "FEATURE", "features"},
		{"define the spec", "SPEC", "specs"},
		{"analyze the codebase", "ANALYSIS", "analysis"},
		{"research the options", "RESEARCH", "research"},
		{"decide which approach", "DECISION", "decisions"},
		{"test the functionality", "TESTING", "testing"},
	}

	for _, tt := range tests {
		t.Run(tt.scenario, func(t *testing.T) {
			result := internal.DetectScenario(tt.prompt)
			if result.Scenario != tt.scenario {
				t.Errorf("Expected %s, got %s", tt.scenario, result.Scenario)
			}
			if result.Directory != tt.dir {
				t.Errorf("Expected dir %s, got %s", tt.dir, result.Directory)
			}
		})
	}
}

// Tests for ValidateScenarioConfig (schema validation)

func TestValidateScenarioConfig_Valid(t *testing.T) {
	config := internal.ScenarioConfig{
		Keywords:    []string{"bug", "error"},
		Recommended: "Create bug note",
		Directory:   "bugs",
		NoteType:    "bug",
	}

	if !internal.ValidateScenarioConfig(config) {
		errors := internal.GetScenarioConfigErrors(config)
		t.Errorf("Expected valid config, got errors: %v", errors)
	}
}

func TestValidateScenarioConfig_EmptyKeywords(t *testing.T) {
	config := internal.ScenarioConfig{
		Keywords:    []string{},
		Recommended: "Create bug note",
		Directory:   "bugs",
		NoteType:    "bug",
	}

	if internal.ValidateScenarioConfig(config) {
		t.Error("Expected invalid config (empty keywords)")
	}
}

// Tests for ValidateScenarioResult (schema validation)

func TestValidateScenarioResult_ValidDetected(t *testing.T) {
	result := internal.ScenarioResult{
		Detected:    true,
		Scenario:    "BUG",
		Keywords:    []string{"bug"},
		Recommended: "Create bug note",
		Directory:   "bugs",
		NoteType:    "bug",
	}

	if !internal.ValidateScenarioResult(result) {
		errors := internal.GetScenarioResultErrors(result)
		t.Errorf("Expected valid result, got errors: %v", errors)
	}
}

func TestValidateScenarioResult_ValidNotDetected(t *testing.T) {
	result := internal.ScenarioResult{
		Detected: false,
	}

	if !internal.ValidateScenarioResult(result) {
		errors := internal.GetScenarioResultErrors(result)
		t.Errorf("Expected valid result for non-detection, got errors: %v", errors)
	}
}
