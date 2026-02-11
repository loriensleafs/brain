package internal

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// WorktreeDetectionResult holds the result of worktree detection.
type WorktreeDetectionResult struct {
	MainWorktreePath string
	IsLinkedWorktree bool
}

// DetectWorktreeMainPath detects whether cwd is inside a linked git worktree
// and returns the main worktree path if so.
//
// Returns nil if:
//   - cwd is not in a git repo
//   - cwd is in the main worktree (not a linked worktree)
//   - git is not installed or too old (< 2.31.0)
//   - the repo is bare
//   - any error occurs (graceful degradation)
//
// Algorithm follows DESIGN-002 steps 1-7.
func DetectWorktreeMainPath(cwd string) (*WorktreeDetectionResult, error) {
	// Step 1: Fast pre-check — walk up from cwd looking for .git
	if !hasGitMarker(cwd) {
		return nil, nil
	}

	// Step 2: Spawn git subprocess with 3-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "git", "rev-parse",
		"--path-format=absolute", "--git-common-dir", "--git-dir", "--is-bare-repository")
	cmd.Dir = cwd

	output, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("git rev-parse timed out after 3s")
		}
		// Git not installed, too old, or failed — graceful degradation
		return nil, nil
	}

	// Step 3: Parse output — expect exactly 3 lines
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) != 3 {
		return nil, nil
	}

	commonDir := strings.TrimSpace(lines[0])
	gitDir := strings.TrimSpace(lines[1])
	isBare := strings.TrimSpace(lines[2])

	// Step 4: Validate — bare repos not supported
	if isBare == "true" {
		return nil, nil
	}

	// Step 5: Compare paths — normalize before comparison
	normalizedCommon, err := normalizePath(commonDir)
	if err != nil {
		return nil, nil
	}
	normalizedGit, err := normalizePath(gitDir)
	if err != nil {
		return nil, nil
	}

	if normalizedCommon == normalizedGit {
		// Main worktree, not linked — return nil
		return nil, nil
	}

	// Step 6: Derive main worktree path
	// commonDir is /path/to/main-repo/.git → dirname gives /path/to/main-repo
	mainWorktreePath := filepath.Dir(normalizedCommon)

	// Step 7: Return result
	return &WorktreeDetectionResult{
		MainWorktreePath: mainWorktreePath,
		IsLinkedWorktree: true,
	}, nil
}

// hasGitMarker walks up from dir looking for a .git file or directory.
func hasGitMarker(dir string) bool {
	dir = filepath.Clean(dir)
	for {
		gitPath := filepath.Join(dir, ".git")
		if _, err := os.Stat(gitPath); err == nil {
			return true
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root
			return false
		}
		dir = parent
	}
}

// normalizePath resolves symlinks and cleans the path for reliable comparison.
func normalizePath(p string) (string, error) {
	cleaned := filepath.Clean(p)
	resolved, err := filepath.EvalSymlinks(cleaned)
	if err != nil {
		// If symlink resolution fails, fall back to cleaned path
		return cleaned, nil
	}
	return resolved, nil
}
