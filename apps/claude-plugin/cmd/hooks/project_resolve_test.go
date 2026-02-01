package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/peterkloss/brain/packages/utils"
)

// === Tests for resolveProjectFromEnv ===

func TestResolveProjectFromEnv_ExplicitWins(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		return "env-project" // All env vars return something
	}

	result := resolveProjectFromEnv("explicit-project")

	if result != "explicit-project" {
		t.Errorf("resolveProjectFromEnv() = %q, want %q (explicit should win)", result, "explicit-project")
	}
}

func TestResolveProjectFromEnv_BrainProjectEnv(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BRAIN_PROJECT" {
			return "brain-project"
		}
		return ""
	}

	result := resolveProjectFromEnv("")

	if result != "brain-project" {
		t.Errorf("resolveProjectFromEnv() = %q, want %q", result, "brain-project")
	}
}

func TestResolveProjectFromEnv_BMProjectEnv(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BM_PROJECT" {
			return "bm-project"
		}
		return ""
	}

	result := resolveProjectFromEnv("")

	if result != "bm-project" {
		t.Errorf("resolveProjectFromEnv() = %q, want %q", result, "bm-project")
	}
}

func TestResolveProjectFromEnv_BMActiveProjectEnv(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BM_ACTIVE_PROJECT" {
			return "active-project"
		}
		return ""
	}

	result := resolveProjectFromEnv("")

	if result != "active-project" {
		t.Errorf("resolveProjectFromEnv() = %q, want %q", result, "active-project")
	}
}

func TestResolveProjectFromEnv_EnvPrecedence(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	// BRAIN_PROJECT should win over BM_PROJECT and BM_ACTIVE_PROJECT
	GetEnv = func(key string) string {
		switch key {
		case "BRAIN_PROJECT":
			return "brain"
		case "BM_PROJECT":
			return "bm"
		case "BM_ACTIVE_PROJECT":
			return "active"
		}
		return ""
	}

	result := resolveProjectFromEnv("")

	if result != "brain" {
		t.Errorf("resolveProjectFromEnv() = %q, want %q (BRAIN_PROJECT should have highest env priority)", result, "brain")
	}
}

func TestResolveProjectFromEnv_NoEnvVars_ReturnsEmpty(t *testing.T) {
	// resolveProjectFromEnv returns empty when no env vars are set.
	// This is correct behavior - callers should show an error or prompt user.

	// Save and restore originals
	origGetEnv := GetEnv
	defer func() {
		GetEnv = origGetEnv
	}()

	// No env vars set
	GetEnv = func(key string) string { return "" }

	result := resolveProjectFromEnv("")

	if result != "" {
		t.Errorf("resolveProjectFromEnv() = %q, want empty string", result)
	}
}

// === Tests for resolveProjectWithCwd using utils package ===

func TestResolveProjectWithCwd_EnvWins(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	GetEnv = func(key string) string {
		if key == "BRAIN_PROJECT" {
			return "env-project"
		}
		return ""
	}

	// Even with a CWD that could match, env should win
	result := resolveProjectWithCwd("", "/some/path")

	if result != "env-project" {
		t.Errorf("resolveProjectWithCwd() = %q, want %q (env should win)", result, "env-project")
	}
}

func TestResolveProjectWithCwd_FallsBackToCwd(t *testing.T) {
	// Save and restore originals
	origGetEnv := GetEnv
	origGetPath := utils.GetBrainConfigPath
	defer func() {
		GetEnv = origGetEnv
		utils.SetBrainConfigPath(origGetPath)
	}()

	// No env vars set
	GetEnv = func(key string) string { return "" }

	// Set up test config
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

	utils.SetBrainConfigPath(func() string { return configPath })

	// Should fall back to CWD matching via utils
	result := resolveProjectWithCwd("", "/Users/peter.kloss/Dev/brain/apps/mcp")

	if result != "brain" {
		t.Errorf("resolveProjectWithCwd() = %q, want %q (should match via CWD)", result, "brain")
	}
}

func TestResolveProjectWithCwd_ExplicitWins(t *testing.T) {
	// Save and restore original GetEnv
	origGetEnv := GetEnv
	defer func() { GetEnv = origGetEnv }()

	// Set env to verify explicit wins
	GetEnv = func(key string) string {
		if key == "BRAIN_PROJECT" {
			return "env-project"
		}
		return ""
	}

	result := resolveProjectWithCwd("explicit-project", "/some/path")

	if result != "explicit-project" {
		t.Errorf("resolveProjectWithCwd() = %q, want %q (explicit should win)", result, "explicit-project")
	}
}
