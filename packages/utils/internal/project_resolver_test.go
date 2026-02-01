package internal

import (
	"os"
	"path/filepath"
	"testing"
)

// === Tests for matchCwdToProjectWithConfig ===

func TestMatchCwdToProjectWithConfig_ExactMatch(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain", projects)

	if result != "brain" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want %q", result, "brain")
	}
}

func TestMatchCwdToProjectWithConfig_Subdirectory(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain/apps/mcp", projects)

	if result != "brain" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want %q", result, "brain")
	}
}

func TestMatchCwdToProjectWithConfig_DeepSubdirectory(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd/hooks", projects)

	if result != "brain" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want %q", result, "brain")
	}
}

func TestMatchCwdToProjectWithConfig_NestedProjects_DeepestWins(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"parent":       {CodePath: "/Users/peter.kloss/Dev"},
		"brain":        {CodePath: "/Users/peter.kloss/Dev/brain"},
		"brain-plugin": {CodePath: "/Users/peter.kloss/Dev/brain/apps/claude-plugin"},
	}

	// CWD in brain-plugin should match brain-plugin (deepest)
	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain/apps/claude-plugin/cmd", projects)
	if result != "brain-plugin" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want %q (deepest match)", result, "brain-plugin")
	}

	// CWD in brain/apps/mcp should match brain (not parent)
	result = matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain/apps/mcp", projects)
	if result != "brain" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want %q (deeper than parent)", result, "brain")
	}
}

func TestMatchCwdToProjectWithConfig_NoMatch(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/other-project", projects)

	if result != "" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want empty string", result)
	}
}

func TestMatchCwdToProjectWithConfig_EmptyProjects(t *testing.T) {
	projects := map[string]BrainProjectConfig{}

	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain", projects)

	if result != "" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want empty string", result)
	}
}

func TestMatchCwdToProjectWithConfig_PartialPathMatch_NoFalsePositive(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	// /Users/peter.kloss/Dev/brain-other should NOT match brain
	// (it starts with "brain" but is not inside it)
	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain-other", projects)

	if result != "" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want empty string (partial match should not count)", result)
	}
}

func TestMatchCwdToProjectWithConfig_EmptyCodePath(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: ""},
	}

	result := matchCwdToProjectWithConfig("/Users/peter.kloss/Dev/brain", projects)

	if result != "" {
		t.Errorf("matchCwdToProjectWithConfig() = %q, want empty string (empty code_path)", result)
	}
}

// === Tests for LoadBrainConfig ===

func TestLoadBrainConfig_ValidConfig(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{
  "version": "2.0.0",
  "projects": {
    "brain": {
      "code_path": "/Users/peter.kloss/Dev/brain"
    },
    "other": {
      "code_path": "/some/other/path"
    }
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	config, err := LoadBrainConfig()

	if err != nil {
		t.Fatalf("LoadBrainConfig() returned error: %v", err)
	}
	if len(config.Projects) != 2 {
		t.Errorf("LoadBrainConfig() Projects length = %d, want 2", len(config.Projects))
	}
	if config.Projects["brain"].CodePath != "/Users/peter.kloss/Dev/brain" {
		t.Errorf("LoadBrainConfig() Projects[brain].CodePath = %q, want %q",
			config.Projects["brain"].CodePath, "/Users/peter.kloss/Dev/brain")
	}
}

func TestLoadBrainConfig_MissingFile_ReturnsEmpty(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	GetBrainConfigPath = func() string { return "/nonexistent/path/config.json" }

	config, err := LoadBrainConfig()

	if err != nil {
		t.Fatalf("LoadBrainConfig() returned error: %v", err)
	}
	if len(config.Projects) != 0 {
		t.Errorf("LoadBrainConfig() Projects length = %d, want 0", len(config.Projects))
	}
}

func TestLoadBrainConfig_InvalidJSON_ReturnsError(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	if err := os.WriteFile(configPath, []byte("not valid json"), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	_, err := LoadBrainConfig()

	if err == nil {
		t.Error("LoadBrainConfig() should return error for invalid JSON")
	}
}

func TestLoadBrainConfig_EmptyProjects_InitializesMap(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	// JSON without projects field
	if err := os.WriteFile(configPath, []byte(`{"version": "2.0.0"}`), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	config, err := LoadBrainConfig()

	if err != nil {
		t.Fatalf("LoadBrainConfig() returned error: %v", err)
	}
	if config.Projects == nil {
		t.Error("LoadBrainConfig() Projects should be initialized, not nil")
	}
}

// === Tests for ResolveProjectFromCwd ===

func TestResolveProjectFromCwd_WithConfig(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{
  "version": "2.0.0",
  "projects": {
    "brain": {
      "code_path": "/Users/peter.kloss/Dev/brain"
    }
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	result := ResolveProjectFromCwd("/Users/peter.kloss/Dev/brain/apps/mcp")

	if result != "brain" {
		t.Errorf("ResolveProjectFromCwd() = %q, want %q", result, "brain")
	}
}

func TestResolveProjectFromCwd_NoMatch(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{
  "version": "2.0.0",
  "projects": {
    "brain": {
      "code_path": "/Users/peter.kloss/Dev/brain"
    }
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	result := ResolveProjectFromCwd("/Users/peter.kloss/Dev/other")

	if result != "" {
		t.Errorf("ResolveProjectFromCwd() = %q, want empty string", result)
	}
}

// === Tests for GetProjectCodePaths ===

func TestGetProjectCodePaths(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{
  "version": "2.0.0",
  "projects": {
    "brain": {
      "code_path": "/Users/peter.kloss/Dev/brain"
    },
    "other": {
      "code_path": "/some/other/path"
    }
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	result := GetProjectCodePaths()

	if len(result) != 2 {
		t.Errorf("GetProjectCodePaths() length = %d, want 2", len(result))
	}
	if result["brain"] != "/Users/peter.kloss/Dev/brain" {
		t.Errorf("GetProjectCodePaths()[brain] = %q, want %q", result["brain"], "/Users/peter.kloss/Dev/brain")
	}
}

func TestGetProjectCodePaths_NoConfig(t *testing.T) {
	// Save and restore original
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	GetBrainConfigPath = func() string { return "/nonexistent/path/config.json" }

	result := GetProjectCodePaths()

	if len(result) != 0 {
		t.Errorf("GetProjectCodePaths() length = %d, want 0", len(result))
	}
}

// === Tests for ResolveProject with environment variables ===

func TestResolveProject_ExplicitWins(t *testing.T) {
	// Save and restore env
	origBrainProject := os.Getenv("BRAIN_PROJECT")
	origBMProject := os.Getenv("BM_PROJECT")
	defer func() {
		os.Setenv("BRAIN_PROJECT", origBrainProject)
		os.Setenv("BM_PROJECT", origBMProject)
	}()

	os.Setenv("BRAIN_PROJECT", "env-project")
	os.Setenv("BM_PROJECT", "bm-project")

	result := ResolveProject(&ResolveOptions{Explicit: "explicit-project"})

	if result != "explicit-project" {
		t.Errorf("ResolveProject() = %q, want %q (explicit wins)", result, "explicit-project")
	}
}

func TestResolveProject_BRAIN_PROJECT_BeforeBM_PROJECT(t *testing.T) {
	// Save and restore env
	origBrainProject := os.Getenv("BRAIN_PROJECT")
	origBMProject := os.Getenv("BM_PROJECT")
	defer func() {
		os.Setenv("BRAIN_PROJECT", origBrainProject)
		os.Setenv("BM_PROJECT", origBMProject)
	}()

	os.Setenv("BRAIN_PROJECT", "brain-env")
	os.Setenv("BM_PROJECT", "bm-env")

	result := ResolveProject(&ResolveOptions{})

	if result != "brain-env" {
		t.Errorf("ResolveProject() = %q, want %q (BRAIN_PROJECT before BM_PROJECT)", result, "brain-env")
	}
}

func TestResolveProject_BM_PROJECT_Fallback(t *testing.T) {
	// Save and restore env
	origBrainProject := os.Getenv("BRAIN_PROJECT")
	origBMProject := os.Getenv("BM_PROJECT")
	defer func() {
		os.Setenv("BRAIN_PROJECT", origBrainProject)
		os.Setenv("BM_PROJECT", origBMProject)
	}()

	os.Unsetenv("BRAIN_PROJECT")
	os.Setenv("BM_PROJECT", "bm-env")

	result := ResolveProject(&ResolveOptions{})

	if result != "bm-env" {
		t.Errorf("ResolveProject() = %q, want %q (BM_PROJECT fallback)", result, "bm-env")
	}
}

func TestResolveProject_CWD_Fallback(t *testing.T) {
	// Save and restore env
	origBrainProject := os.Getenv("BRAIN_PROJECT")
	origBMProject := os.Getenv("BM_PROJECT")
	origGetPath := GetBrainConfigPath
	defer func() {
		os.Setenv("BRAIN_PROJECT", origBrainProject)
		os.Setenv("BM_PROJECT", origBMProject)
		GetBrainConfigPath = origGetPath
	}()

	os.Unsetenv("BRAIN_PROJECT")
	os.Unsetenv("BM_PROJECT")

	// Setup config
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{
  "version": "2.0.0",
  "projects": {
    "brain": {
      "code_path": "/Users/peter.kloss/Dev/brain"
    }
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}
	GetBrainConfigPath = func() string { return configPath }

	result := ResolveProject(&ResolveOptions{CWD: "/Users/peter.kloss/Dev/brain/apps"})

	if result != "brain" {
		t.Errorf("ResolveProject() = %q, want %q (CWD fallback)", result, "brain")
	}
}
