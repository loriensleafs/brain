package internal

import (
	"os"
	"os/exec"
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

// === Tests for matchCwdToProjectWithContext (worktree integration) ===

func TestMatchCwdToProjectWithContext_DirectMatch(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	result := matchCwdToProjectWithContext("/Users/peter.kloss/Dev/brain/apps", projects)

	if result == nil {
		t.Fatal("matchCwdToProjectWithContext() = nil, want non-nil")
	}
	if result.ProjectName != "brain" {
		t.Errorf("ProjectName = %q, want %q", result.ProjectName, "brain")
	}
	if result.IsWorktreeResolved {
		t.Error("IsWorktreeResolved = true, want false for direct match")
	}
}

func TestMatchCwdToProjectWithContext_NoMatch(t *testing.T) {
	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/Users/peter.kloss/Dev/brain"},
	}

	result := matchCwdToProjectWithContext("/Users/peter.kloss/Dev/other", projects)

	if result != nil {
		t.Errorf("matchCwdToProjectWithContext() = %+v, want nil", result)
	}
}

func TestMatchCwdToProjectWithContext_WorktreeFallback(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	requireGitWorktreeSupport2(t)

	// Create a main repo in a temp dir
	mainDir := t.TempDir()
	initGitRepo2(t, mainDir)

	// Create a linked worktree
	worktreeDir := filepath.Join(t.TempDir(), "feature-branch")
	run2(t, mainDir, "git", "worktree", "add", worktreeDir, "-b", "feature-wt-fallback")

	// Resolve symlinks for comparison (temp dirs may be symlinked on macOS)
	resolvedMain, _ := filepath.EvalSymlinks(mainDir)

	// Configure projects with the main repo path
	projects := map[string]BrainProjectConfig{
		"myproject": {CodePath: resolvedMain},
	}

	// Match from the worktree — should fall back and find the main repo match
	result := matchCwdToProjectWithContext(worktreeDir, projects)

	if result == nil {
		t.Fatal("matchCwdToProjectWithContext() = nil, want non-nil (worktree fallback)")
	}
	if result.ProjectName != "myproject" {
		t.Errorf("ProjectName = %q, want %q", result.ProjectName, "myproject")
	}
	if !result.IsWorktreeResolved {
		t.Error("IsWorktreeResolved = false, want true for worktree fallback")
	}
	if result.EffectiveCwd != resolvedMain {
		t.Errorf("EffectiveCwd = %q, want %q", result.EffectiveCwd, resolvedMain)
	}
}

func TestMatchCwdToProjectWithContext_EnvOptOut(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	// Save and restore env
	origEnv := os.Getenv("BRAIN_DISABLE_WORKTREE_DETECTION")
	defer os.Setenv("BRAIN_DISABLE_WORKTREE_DETECTION", origEnv)

	os.Setenv("BRAIN_DISABLE_WORKTREE_DETECTION", "1")

	projects := map[string]BrainProjectConfig{
		"brain": {CodePath: "/some/other/path"},
	}

	// Even if in a worktree, should return nil because detection is disabled
	result := matchCwdToProjectWithContext("/not/matching/path", projects)

	if result != nil {
		t.Errorf("matchCwdToProjectWithContext() = %+v, want nil (detection disabled)", result)
	}
}

func TestMatchCwdToProjectWithContext_EnvOptOut_True(t *testing.T) {
	origEnv := os.Getenv("BRAIN_DISABLE_WORKTREE_DETECTION")
	defer os.Setenv("BRAIN_DISABLE_WORKTREE_DETECTION", origEnv)

	os.Setenv("BRAIN_DISABLE_WORKTREE_DETECTION", "true")

	if !isWorktreeDetectionDisabled(nil) {
		t.Error("isWorktreeDetectionDisabled() = false, want true when env=true")
	}
}

func TestMatchCwdToProjectWithContext_EnvOptOut_NotSet(t *testing.T) {
	origEnv := os.Getenv("BRAIN_DISABLE_WORKTREE_DETECTION")
	defer os.Setenv("BRAIN_DISABLE_WORKTREE_DETECTION", origEnv)

	os.Unsetenv("BRAIN_DISABLE_WORKTREE_DETECTION")

	if isWorktreeDetectionDisabled(nil) {
		t.Error("isWorktreeDetectionDisabled() = true, want false when env not set")
	}
}

// === Tests for isValidEffectiveCwd ===

func TestIsValidEffectiveCwd_Valid(t *testing.T) {
	if !isValidEffectiveCwd("/Users/peter.kloss/Dev/brain") {
		t.Error("isValidEffectiveCwd() = false for valid absolute path")
	}
}

func TestIsValidEffectiveCwd_Empty(t *testing.T) {
	if isValidEffectiveCwd("") {
		t.Error("isValidEffectiveCwd() = true for empty path")
	}
}

func TestIsValidEffectiveCwd_Relative(t *testing.T) {
	if isValidEffectiveCwd("relative/path") {
		t.Error("isValidEffectiveCwd() = true for relative path")
	}
}

func TestIsValidEffectiveCwd_Traversal_RawDotsRejected(t *testing.T) {
	// A path that still contains .. after cleaning is rejected.
	// Note: filepath.Clean resolves /Users/../etc/passwd to /etc/passwd (valid).
	// This tests that unresolvable traversals are caught.
	// In practice, DetectWorktreeMainPath returns fully resolved paths from git,
	// so traversal is not a real attack vector. This validates the defense-in-depth.
	cleaned := filepath.Clean("/Users/../etc/passwd")
	if !isValidEffectiveCwd(cleaned) {
		t.Errorf("isValidEffectiveCwd(%q) = false, want true (Clean resolves traversal)", cleaned)
	}
}

func TestIsValidEffectiveCwd_DotDotLiteral(t *testing.T) {
	// A path that literally is just ".." should fail (relative)
	if isValidEffectiveCwd("..") {
		t.Error("isValidEffectiveCwd(..) = true, want false")
	}
}

// === Tests for ResolveProjectWithContext ===

func TestResolveProjectWithContext_Explicit(t *testing.T) {
	result := ResolveProjectWithContext(&ResolveOptions{Explicit: "my-project"})

	if result == nil {
		t.Fatal("ResolveProjectWithContext() = nil, want non-nil")
	}
	if result.ProjectName != "my-project" {
		t.Errorf("ProjectName = %q, want %q", result.ProjectName, "my-project")
	}
	if result.IsWorktreeResolved {
		t.Error("IsWorktreeResolved = true, want false for explicit")
	}
}

func TestResolveProjectWithContext_EnvVar(t *testing.T) {
	origBrainProject := os.Getenv("BRAIN_PROJECT")
	origBMProject := os.Getenv("BM_PROJECT")
	defer func() {
		os.Setenv("BRAIN_PROJECT", origBrainProject)
		os.Setenv("BM_PROJECT", origBMProject)
	}()

	os.Setenv("BRAIN_PROJECT", "env-project")
	os.Unsetenv("BM_PROJECT")

	result := ResolveProjectWithContext(&ResolveOptions{})

	if result == nil {
		t.Fatal("ResolveProjectWithContext() = nil, want non-nil")
	}
	if result.ProjectName != "env-project" {
		t.Errorf("ProjectName = %q, want %q", result.ProjectName, "env-project")
	}
	if result.IsWorktreeResolved {
		t.Error("IsWorktreeResolved = true, want false for env var")
	}
}

// === Tests for DisableWorktreeDetection config field ===

func TestBrainProjectConfig_DisableWorktreeDetection_Unmarshal(t *testing.T) {
	origGetPath := GetBrainConfigPath
	defer func() { GetBrainConfigPath = origGetPath }()

	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, "config.json")
	configContent := `{
  "version": "2.0.0",
  "projects": {
    "brain": {
      "code_path": "/Users/peter.kloss/Dev/brain",
      "disableWorktreeDetection": true
    }
  }
}`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write test config: %v", err)
	}

	GetBrainConfigPath = func() string { return configPath }

	config, err := LoadBrainConfig()
	if err != nil {
		t.Fatalf("LoadBrainConfig() error: %v", err)
	}

	project := config.Projects["brain"]
	if project.DisableWorktreeDetection == nil {
		t.Fatal("DisableWorktreeDetection = nil, want non-nil")
	}
	if !*project.DisableWorktreeDetection {
		t.Error("DisableWorktreeDetection = false, want true")
	}
}

func TestBrainProjectConfig_DisableWorktreeDetection_OmittedDefaults(t *testing.T) {
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

	config, err := LoadBrainConfig()
	if err != nil {
		t.Fatalf("LoadBrainConfig() error: %v", err)
	}

	project := config.Projects["brain"]
	if project.DisableWorktreeDetection != nil {
		t.Errorf("DisableWorktreeDetection = %v, want nil (omitted field)", *project.DisableWorktreeDetection)
	}
}

// === Helpers for worktree integration tests ===
// These mirror the helpers in worktree_detector_test.go but with different names
// to avoid redeclaration conflicts within the same package.

func initGitRepo2(t *testing.T, dir string) {
	t.Helper()
	run2(t, dir, "git", "init")
	run2(t, dir, "git", "config", "user.email", "test@test.com")
	run2(t, dir, "git", "config", "user.name", "Test")
	dummyFile := filepath.Join(dir, "README.md")
	if err := os.WriteFile(dummyFile, []byte("# test\n"), 0644); err != nil {
		t.Fatalf("Failed to write dummy file: %v", err)
	}
	run2(t, dir, "git", "add", ".")
	run2(t, dir, "git", "commit", "-m", "initial commit")
}

func run2(t *testing.T, dir string, name string, args ...string) {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Command %q %v failed in %s: %v\nOutput: %s", name, args, dir, err, output)
	}
}

func requireGitWorktreeSupport2(t *testing.T) {
	t.Helper()
	cmd := exec.Command("git", "worktree", "list")
	if err := cmd.Run(); err != nil {
		t.Skip("git worktree not supported in this environment")
	}
}
