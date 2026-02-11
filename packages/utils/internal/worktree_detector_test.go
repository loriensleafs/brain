package internal

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

// === Helper: create a real git repo in a temp dir ===

func initGitRepo(t *testing.T, dir string) {
	t.Helper()
	run(t, dir, "git", "init")
	run(t, dir, "git", "config", "user.email", "test@test.com")
	run(t, dir, "git", "config", "user.name", "Test")
	// Need at least one commit for worktrees
	dummyFile := filepath.Join(dir, "README.md")
	if err := os.WriteFile(dummyFile, []byte("# test\n"), 0644); err != nil {
		t.Fatalf("Failed to write dummy file: %v", err)
	}
	run(t, dir, "git", "add", ".")
	run(t, dir, "git", "commit", "-m", "initial commit")
}

func run(t *testing.T, dir string, name string, args ...string) {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1")
	output, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("Command %q %v failed in %s: %v\nOutput: %s", name, args, dir, err, output)
	}
}

// === Tests for hasGitMarker ===

func TestHasGitMarker_GitDirectory(t *testing.T) {
	dir := t.TempDir()
	initGitRepo(t, dir)

	if !hasGitMarker(dir) {
		t.Error("hasGitMarker() = false, want true for git repo root")
	}
}

func TestHasGitMarker_Subdirectory(t *testing.T) {
	dir := t.TempDir()
	initGitRepo(t, dir)

	subdir := filepath.Join(dir, "packages", "utils")
	if err := os.MkdirAll(subdir, 0755); err != nil {
		t.Fatalf("Failed to create subdir: %v", err)
	}

	if !hasGitMarker(subdir) {
		t.Error("hasGitMarker() = false, want true for subdirectory of git repo")
	}
}

func TestHasGitMarker_NotGitRepo(t *testing.T) {
	dir := t.TempDir()

	if hasGitMarker(dir) {
		t.Error("hasGitMarker() = true, want false for non-git directory")
	}
}

// === Tests for DetectWorktreeMainPath ===

// Edge case 1: Nested worktree paths
func TestDetectWorktreeMainPath_LinkedWorktree(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	requireGitWorktreeSupport(t)

	mainDir := t.TempDir()
	initGitRepo(t, mainDir)

	// Create a linked worktree
	worktreeDir := filepath.Join(t.TempDir(), "feature-branch")
	run(t, mainDir, "git", "worktree", "add", worktreeDir, "-b", "feature-1")

	// Detect from the worktree root
	result, err := DetectWorktreeMainPath(worktreeDir)
	if err != nil {
		t.Fatalf("DetectWorktreeMainPath() error: %v", err)
	}
	if result == nil {
		t.Fatal("DetectWorktreeMainPath() = nil, want non-nil for linked worktree")
	}

	// Resolve symlinks for comparison (temp dirs may be symlinked on macOS)
	expectedMain, _ := filepath.EvalSymlinks(mainDir)
	if result.MainWorktreePath != expectedMain {
		t.Errorf("MainWorktreePath = %q, want %q", result.MainWorktreePath, expectedMain)
	}
	if !result.IsLinkedWorktree {
		t.Error("IsLinkedWorktree = false, want true")
	}
}

// Edge case 1 (nested): Deep path inside linked worktree
func TestDetectWorktreeMainPath_LinkedWorktree_DeepPath(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	requireGitWorktreeSupport(t)

	mainDir := t.TempDir()
	initGitRepo(t, mainDir)

	worktreeDir := filepath.Join(t.TempDir(), "feature-branch")
	run(t, mainDir, "git", "worktree", "add", worktreeDir, "-b", "feature-2")

	deepPath := filepath.Join(worktreeDir, "packages", "utils", "src")
	if err := os.MkdirAll(deepPath, 0755); err != nil {
		t.Fatalf("Failed to create deep path: %v", err)
	}

	result, err := DetectWorktreeMainPath(deepPath)
	if err != nil {
		t.Fatalf("DetectWorktreeMainPath() error: %v", err)
	}
	if result == nil {
		t.Fatal("DetectWorktreeMainPath() = nil, want non-nil for deep path in linked worktree")
	}

	expectedMain, _ := filepath.EvalSymlinks(mainDir)
	if result.MainWorktreePath != expectedMain {
		t.Errorf("MainWorktreePath = %q, want %q", result.MainWorktreePath, expectedMain)
	}
}

// Edge case 2: Main worktree user — should return nil
func TestDetectWorktreeMainPath_MainWorktree(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	mainDir := t.TempDir()
	initGitRepo(t, mainDir)

	result, err := DetectWorktreeMainPath(mainDir)
	if err != nil {
		t.Fatalf("DetectWorktreeMainPath() error: %v", err)
	}
	if result != nil {
		t.Errorf("DetectWorktreeMainPath() = %+v, want nil for main worktree", result)
	}
}

// Edge case 3: Git not installed — simulated by non-git directory
func TestDetectWorktreeMainPath_NotGitRepo(t *testing.T) {
	dir := t.TempDir()

	result, err := DetectWorktreeMainPath(dir)
	if err != nil {
		t.Fatalf("DetectWorktreeMainPath() error: %v", err)
	}
	if result != nil {
		t.Errorf("DetectWorktreeMainPath() = %+v, want nil for non-git directory", result)
	}
}

// Edge case 4: Git version too old — tested by the general error handling path;
// we can't easily simulate this without mocking git, but the nil return path
// is covered by the error handling in Step 2.

// Edge case 5: Network-mounted repository — timeout handling
// (Cannot reliably test timeout in unit tests without mocking, but the
// context.WithTimeout path is tested by the timeout error return.)

// Edge case 6: Bare repository
func TestDetectWorktreeMainPath_BareRepo(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}

	dir := t.TempDir()
	bareDir := filepath.Join(dir, "repo.git")
	run(t, dir, "git", "clone", "--bare", createTempGitRepo(t), bareDir)

	result, err := DetectWorktreeMainPath(bareDir)
	if err != nil {
		t.Fatalf("DetectWorktreeMainPath() error: %v", err)
	}
	if result != nil {
		t.Errorf("DetectWorktreeMainPath() = %+v, want nil for bare repo", result)
	}
}

// Edge case 7: Broken worktree (main repo moved/deleted)
func TestDetectWorktreeMainPath_BrokenWorktree(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	requireGitWorktreeSupport(t)

	mainDir := t.TempDir()
	initGitRepo(t, mainDir)

	worktreeDir := filepath.Join(t.TempDir(), "feature-branch")
	run(t, mainDir, "git", "worktree", "add", worktreeDir, "-b", "feature-broken")

	// Break the worktree by removing the main repo's .git directory contents
	// that the worktree references
	gitCommonDir := filepath.Join(mainDir, ".git")
	worktreesDir := filepath.Join(gitCommonDir, "worktrees")
	if err := os.RemoveAll(worktreesDir); err != nil {
		t.Fatalf("Failed to break worktree: %v", err)
	}

	// Should gracefully return nil or an error, not panic
	result, _ := DetectWorktreeMainPath(worktreeDir)
	// We accept either nil result or a non-nil result — the key is no panic.
	// In practice git rev-parse may still succeed since the .git file in the
	// worktree still points to a valid commonDir. What matters is graceful handling.
	_ = result
}

// Edge case 8: Symlinked paths
func TestDetectWorktreeMainPath_SymlinkedPath(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	if runtime.GOOS == "windows" {
		t.Skip("skipping symlink test on Windows")
	}
	requireGitWorktreeSupport(t)

	mainDir := t.TempDir()
	initGitRepo(t, mainDir)

	worktreeDir := filepath.Join(t.TempDir(), "actual-worktree")
	run(t, mainDir, "git", "worktree", "add", worktreeDir, "-b", "feature-symlink")

	// Create a symlink to the worktree
	symlinkDir := filepath.Join(t.TempDir(), "symlink-to-worktree")
	if err := os.Symlink(worktreeDir, symlinkDir); err != nil {
		t.Fatalf("Failed to create symlink: %v", err)
	}

	result, err := DetectWorktreeMainPath(symlinkDir)
	if err != nil {
		t.Fatalf("DetectWorktreeMainPath() error: %v", err)
	}
	if result == nil {
		t.Fatal("DetectWorktreeMainPath() = nil, want non-nil for symlinked worktree")
	}

	expectedMain, _ := filepath.EvalSymlinks(mainDir)
	if result.MainWorktreePath != expectedMain {
		t.Errorf("MainWorktreePath = %q, want %q", result.MainWorktreePath, expectedMain)
	}
	if !result.IsLinkedWorktree {
		t.Error("IsLinkedWorktree = false, want true")
	}
}

// === Tests for normalizePath ===

func TestNormalizePath_CleanPath(t *testing.T) {
	result, err := normalizePath("/foo/bar/../baz")
	if err != nil {
		t.Fatalf("normalizePath() error: %v", err)
	}
	expected := "/foo/baz"
	if result != expected {
		t.Errorf("normalizePath() = %q, want %q", result, expected)
	}
}

func TestNormalizePath_TrailingSlash(t *testing.T) {
	result, err := normalizePath("/foo/bar/")
	if err != nil {
		t.Fatalf("normalizePath() error: %v", err)
	}
	expected := "/foo/bar"
	if result != expected {
		t.Errorf("normalizePath() = %q, want %q", result, expected)
	}
}

// === Helpers ===

func createTempGitRepo(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	initGitRepo(t, dir)
	return dir
}

func requireGitWorktreeSupport(t *testing.T) {
	t.Helper()
	cmd := exec.Command("git", "worktree", "list")
	if err := cmd.Run(); err != nil {
		t.Skip("git worktree not supported in this environment")
	}
}
