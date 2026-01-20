package main

import (
	"os"
	"path/filepath"
	"testing"
)

// === Tests for matchCwdToProject ===

func TestMatchCwdToProject_ExactMatch(t *testing.T) {
	codePaths := map[string]string{
		"brain": "/Users/peter.kloss/Dev/brain",
	}

	result := matchCwdToProject("/Users/peter.kloss/Dev/brain", codePaths)

	if result != "brain" {
		t.Errorf("matchCwdToProject() = %q, want %q", result, "brain")
	}
}

func TestMatchCwdToProject_Subdirectory(t *testing.T) {
	codePaths := map[string]string{
		"brain": "/Users/peter.kloss/Dev/brain",
	}

	result := matchCwdToProject("/Users/peter.kloss/Dev/brain/apps/mcp", codePaths)

	if result != "brain" {
		t.Errorf("matchCwdToProject() = %q, want %q", result, "brain")
	}
}

func TestMatchCwdToProject_DeepSubdirectory(t *testing.T) {
	codePaths := map[string]string{
		"brain": "/Users/peter.kloss/Dev/brain",
	}

	result := matchCwdToProject("/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd/hooks", codePaths)

	if result != "brain" {
		t.Errorf("matchCwdToProject() = %q, want %q", result, "brain")
	}
}

func TestMatchCwdToProject_NestedProjects_DeepestWins(t *testing.T) {
	codePaths := map[string]string{
		"parent":       "/Users/peter.kloss/Dev",
		"brain":        "/Users/peter.kloss/Dev/brain",
		"brain-plugin": "/Users/peter.kloss/Dev/brain/apps/claude-plugin",
	}

	// CWD in brain-plugin should match brain-plugin (deepest)
	result := matchCwdToProject("/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd", codePaths)
	if result != "brain-plugin" {
		t.Errorf("matchCwdToProject() = %q, want %q (deepest match)", result, "brain-plugin")
	}

	// CWD in brain/apps/mcp should match brain (not parent)
	result = matchCwdToProject("/Users/peter.kloss/Dev/brain/apps/mcp", codePaths)
	if result != "brain" {
		t.Errorf("matchCwdToProject() = %q, want %q (deeper than parent)", result, "brain")
	}
}

func TestMatchCwdToProject_NoMatch(t *testing.T) {
	codePaths := map[string]string{
		"brain": "/Users/peter.kloss/Dev/brain",
	}

	result := matchCwdToProject("/Users/peter.kloss/Dev/other-project", codePaths)

	if result != "" {
		t.Errorf("matchCwdToProject() = %q, want empty string", result)
	}
}

func TestMatchCwdToProject_EmptyCodePaths(t *testing.T) {
	codePaths := map[string]string{}

	result := matchCwdToProject("/Users/peter.kloss/Dev/brain", codePaths)

	if result != "" {
		t.Errorf("matchCwdToProject() = %q, want empty string", result)
	}
}

func TestMatchCwdToProject_PartialPathMatch_NoFalsePositive(t *testing.T) {
	codePaths := map[string]string{
		"brain": "/Users/peter.kloss/Dev/brain",
	}

	// /Users/peter.kloss/Dev/brain-other should NOT match brain
	// (it starts with "brain" but is not inside it)
	result := matchCwdToProject("/Users/peter.kloss/Dev/brain-other", codePaths)

	if result != "" {
		t.Errorf("matchCwdToProject() = %q, want empty string (partial match should not count)", result)
	}
}

// === Tests for resolveProject ===

func TestResolveProject_ExplicitWins(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		return "env-project" // All env vars return something
	}

	result := resolveProject("explicit-project", "")

	if result != "explicit-project" {
		t.Errorf("resolveProject() = %q, want %q (explicit should win)", result, "explicit-project")
	}
}

func TestResolveProject_BMProjectEnv(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BM_PROJECT" {
			return "bm-project"
		}
		return ""
	}

	result := resolveProject("", "")

	if result != "bm-project" {
		t.Errorf("resolveProject() = %q, want %q", result, "bm-project")
	}
}

func TestResolveProject_BMActiveProjectEnv(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BM_ACTIVE_PROJECT" {
			return "active-project"
		}
		return ""
	}

	result := resolveProject("", "")

	if result != "active-project" {
		t.Errorf("resolveProject() = %q, want %q", result, "active-project")
	}
}

func TestResolveProject_BrainProjectEnv(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BRAIN_PROJECT" {
			return "brain-project"
		}
		return ""
	}

	result := resolveProject("", "")

	if result != "brain-project" {
		t.Errorf("resolveProject() = %q, want %q", result, "brain-project")
	}
}

func TestResolveProject_EnvPrecedence(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	// BM_PROJECT should win over BM_ACTIVE_PROJECT and BRAIN_PROJECT
	GetEnv = func(key string) string {
		switch key {
		case "BM_PROJECT":
			return "bm"
		case "BM_ACTIVE_PROJECT":
			return "active"
		case "BRAIN_PROJECT":
			return "brain"
		}
		return ""
	}

	result := resolveProject("", "")

	if result != "bm" {
		t.Errorf("resolveProject() = %q, want %q (BM_PROJECT should have highest env priority)", result, "bm")
	}
}

func TestResolveProject_NoCwdMatch_ByDesign(t *testing.T) {
	// resolveProject intentionally does NOT do CWD matching.
	// CWD matching is only for session_start via identifyProject.
	// This test verifies that resolveProject returns empty when no env vars are set.

	// Save and restore originals
	origGetEnv := GetEnv
	defer func() {
		GetEnv = origGetEnv
	}()

	// No env vars set
	GetEnv = func(key string) string { return "" }

	// Even with a valid CWD that could match, resolveProject should return empty
	result := resolveProject("", "/some/path")

	if result != "" {
		t.Errorf("resolveProject() = %q, want empty (CWD matching not supported)", result)
	}
}

func TestResolveProject_NoEnvVars_ReturnsEmpty(t *testing.T) {
	// resolveProject returns empty when no env vars are set.
	// This is correct behavior - callers should show an error or prompt user.

	// Save and restore originals
	origGetEnv := GetEnv
	defer func() {
		GetEnv = origGetEnv
	}()

	// No env vars set
	GetEnv = func(key string) string { return "" }

	result := resolveProject("", "")

	if result != "" {
		t.Errorf("resolveProject() = %q, want empty string", result)
	}
}

// === Tests for loadBrainConfig ===

func TestLoadBrainConfig_ValidConfig(t *testing.T) {
	// Save and restore original
	origBrainConfigPath := brainConfigPath
	defer func() { brainConfigPath = origBrainConfigPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "brain-config.json")
	configContent := `{
  "code_paths": {
    "brain": "/Users/peter.kloss/Dev/brain",
    "other": "/some/other/path"
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	brainConfigPath = func() string { return configPath }

	config, err := loadBrainConfig()

	if err != nil {
		t.Fatalf("loadBrainConfig() returned error: %v", err)
	}
	if len(config.CodePaths) != 2 {
		t.Errorf("loadBrainConfig() CodePaths length = %d, want 2", len(config.CodePaths))
	}
	if config.CodePaths["brain"] != "/Users/peter.kloss/Dev/brain" {
		t.Errorf("loadBrainConfig() CodePaths[brain] = %q, want %q",
			config.CodePaths["brain"], "/Users/peter.kloss/Dev/brain")
	}
}

func TestLoadBrainConfig_MissingFile_ReturnsEmpty(t *testing.T) {
	// Save and restore original
	origBrainConfigPath := brainConfigPath
	defer func() { brainConfigPath = origBrainConfigPath }()

	brainConfigPath = func() string { return "/nonexistent/path/brain-config.json" }

	config, err := loadBrainConfig()

	if err != nil {
		t.Fatalf("loadBrainConfig() returned error: %v", err)
	}
	if len(config.CodePaths) != 0 {
		t.Errorf("loadBrainConfig() CodePaths length = %d, want 0", len(config.CodePaths))
	}
}

func TestLoadBrainConfig_InvalidJSON_ReturnsError(t *testing.T) {
	// Save and restore original
	origBrainConfigPath := brainConfigPath
	defer func() { brainConfigPath = origBrainConfigPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "brain-config.json")
	if err := os.WriteFile(configPath, []byte("not valid json"), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	brainConfigPath = func() string { return configPath }

	_, err := loadBrainConfig()

	if err == nil {
		t.Error("loadBrainConfig() should return error for invalid JSON")
	}
}

func TestLoadBrainConfig_EmptyCodePaths_InitializesMap(t *testing.T) {
	// Save and restore original
	origBrainConfigPath := brainConfigPath
	defer func() { brainConfigPath = origBrainConfigPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "brain-config.json")
	// JSON without code_paths field
	if err := os.WriteFile(configPath, []byte(`{}`), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	brainConfigPath = func() string { return configPath }

	config, err := loadBrainConfig()

	if err != nil {
		t.Fatalf("loadBrainConfig() returned error: %v", err)
	}
	if config.CodePaths == nil {
		t.Error("loadBrainConfig() CodePaths should be initialized, not nil")
	}
}
