package internal

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// BatchPRReviewOperation defines the operation to perform
type BatchPRReviewOperation string

const (
	OperationSetup   BatchPRReviewOperation = "Setup"
	OperationStatus  BatchPRReviewOperation = "Status"
	OperationCleanup BatchPRReviewOperation = "Cleanup"
	OperationAll     BatchPRReviewOperation = "All"
)

// BatchPRReviewConfig holds configuration for batch PR review operations
type BatchPRReviewConfig struct {
	PRNumbers    []int
	Operation    BatchPRReviewOperation
	WorktreeRoot string
	Force        bool
}

// WorktreeStatus represents the status of a single worktree
type WorktreeStatus struct {
	PR       int    `json:"pr"`
	Path     string `json:"path"`
	Exists   bool   `json:"exists"`
	Clean    *bool  `json:"clean,omitempty"`
	Branch   string `json:"branch,omitempty"`
	Commit   string `json:"commit,omitempty"`
	Unpushed *bool  `json:"unpushed,omitempty"`
}

// WorktreeOperationResult represents the result of a worktree operation
type WorktreeOperationResult struct {
	PR      int    `json:"pr"`
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// BatchPRReviewResult represents the overall result of a batch PR review operation
type BatchPRReviewResult struct {
	ValidationResult
	Operation    BatchPRReviewOperation    `json:"operation"`
	WorktreeRoot string                    `json:"worktreeRoot"`
	Statuses     []WorktreeStatus          `json:"statuses,omitempty"`
	Results      []WorktreeOperationResult `json:"results,omitempty"`
}

// CommandRunner abstracts command execution for testing
type CommandRunner interface {
	Run(name string, args ...string) (string, error)
	RunInDir(dir string, name string, args ...string) (string, error)
}

// RealCommandRunner executes actual commands
type RealCommandRunner struct{}

// Run executes a command and returns its output
func (r *RealCommandRunner) Run(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// RunInDir executes a command in a specific directory
func (r *RealCommandRunner) RunInDir(dir string, name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	return string(output), err
}

// DefaultCommandRunner is the default command runner
var DefaultCommandRunner CommandRunner = &RealCommandRunner{}

// GetRepoRoot returns the git repository root
func GetRepoRoot(runner CommandRunner) (string, error) {
	output, err := runner.Run("git", "rev-parse", "--show-toplevel")
	if err != nil {
		return "", fmt.Errorf("not in a git repository: %w", err)
	}
	return strings.TrimSpace(output), nil
}

// GetPRBranch retrieves the branch name for a PR number
func GetPRBranch(prNumber int, runner CommandRunner) (string, error) {
	output, err := runner.Run("gh", "pr", "view", fmt.Sprintf("%d", prNumber), "--json", "headRefName")
	if err != nil {
		return "", fmt.Errorf("PR #%d not found or not accessible: %w", prNumber, err)
	}

	var result struct {
		HeadRefName string `json:"headRefName"`
	}
	if err := json.Unmarshal([]byte(output), &result); err != nil {
		return "", fmt.Errorf("PR #%d: unable to parse branch information: %w", prNumber, err)
	}

	if result.HeadRefName == "" {
		return "", fmt.Errorf("PR #%d: branch name is empty", prNumber)
	}

	return result.HeadRefName, nil
}

// CreatePRWorktree creates a worktree for a PR
func CreatePRWorktree(prNumber int, worktreeRoot string, runner CommandRunner) WorktreeOperationResult {
	result := WorktreeOperationResult{
		PR: prNumber,
	}

	branch, err := GetPRBranch(prNumber, runner)
	if err != nil {
		result.Success = false
		result.Error = err.Error()
		return result
	}

	worktreePath := filepath.Join(worktreeRoot, fmt.Sprintf("worktree-pr-%d", prNumber))

	// Check if worktree already exists
	if info, err := os.Stat(worktreePath); err == nil && info.IsDir() {
		result.Success = true
		result.Message = fmt.Sprintf("Worktree already exists: %s", worktreePath)
		return result
	}

	// Fetch the branch from remote
	_, _ = runner.Run("git", "fetch", "origin", fmt.Sprintf("%s:%s", branch, branch))

	// If fetch fails, try fetching without creating local branch
	_, _ = runner.Run("git", "fetch", "origin", branch)

	// Create worktree
	_, err = runner.Run("git", "worktree", "add", worktreePath, branch)
	if err != nil {
		// Try with origin/ prefix
		_, err = runner.Run("git", "worktree", "add", worktreePath, fmt.Sprintf("origin/%s", branch))
		if err != nil {
			result.Success = false
			result.Error = fmt.Sprintf("failed to create worktree: %v", err)
			return result
		}
	}

	result.Success = true
	result.Message = fmt.Sprintf("Created: %s", worktreePath)
	return result
}

// GetWorktreeStatus gets the status of a worktree for a PR
func GetWorktreeStatus(prNumber int, worktreeRoot string, runner CommandRunner) WorktreeStatus {
	worktreePath := filepath.Join(worktreeRoot, fmt.Sprintf("worktree-pr-%d", prNumber))

	status := WorktreeStatus{
		PR:   prNumber,
		Path: worktreePath,
	}

	info, err := os.Stat(worktreePath)
	if err != nil || !info.IsDir() {
		status.Exists = false
		return status
	}

	status.Exists = true

	// Get git status
	output, err := runner.RunInDir(worktreePath, "git", "status", "--short")
	if err == nil {
		clean := strings.TrimSpace(output) == ""
		status.Clean = &clean
	}

	// Get current branch
	output, err = runner.RunInDir(worktreePath, "git", "branch", "--show-current")
	if err == nil {
		status.Branch = strings.TrimSpace(output)
	}

	// Get latest commit hash
	output, err = runner.RunInDir(worktreePath, "git", "log", "-1", "--format=%h")
	if err == nil {
		status.Commit = strings.TrimSpace(output)
	}

	// Check for unpushed commits
	output, err = runner.RunInDir(worktreePath, "git", "rev-parse", "--abbrev-ref", "@{u}")
	if err == nil && strings.TrimSpace(output) != "" {
		// Has upstream, check for unpushed
		output, err = runner.RunInDir(worktreePath, "git", "log", "@{u}..", "--oneline")
		if err == nil {
			unpushed := strings.TrimSpace(output) != ""
			status.Unpushed = &unpushed
		}
	}

	return status
}

// PushWorktreeChanges commits and pushes changes in a worktree
func PushWorktreeChanges(prNumber int, worktreeRoot string, runner CommandRunner) WorktreeOperationResult {
	result := WorktreeOperationResult{
		PR: prNumber,
	}

	status := GetWorktreeStatus(prNumber, worktreeRoot, runner)
	if !status.Exists {
		result.Success = false
		result.Error = fmt.Sprintf("Worktree for PR #%d does not exist", prNumber)
		return result
	}

	isClean := status.Clean != nil && *status.Clean
	hasUnpushed := status.Unpushed != nil && *status.Unpushed

	if isClean && !hasUnpushed {
		result.Success = true
		result.Message = fmt.Sprintf("PR #%d: Already clean and pushed", prNumber)
		return result
	}

	// Commit changes if not clean
	if !isClean {
		_, err := runner.RunInDir(status.Path, "git", "add", ".")
		if err != nil {
			result.Success = false
			result.Error = fmt.Sprintf("PR #%d: 'git add .' failed: %v", prNumber, err)
			return result
		}

		commitMsg := fmt.Sprintf("chore(pr-%d): finalize review response session", prNumber)
		_, err = runner.RunInDir(status.Path, "git", "commit", "-m", commitMsg)
		if err != nil {
			result.Success = false
			result.Error = fmt.Sprintf("PR #%d: 'git commit' failed: %v", prNumber, err)
			return result
		}
	}

	// Push changes
	if hasUnpushed || !isClean {
		_, err := runner.RunInDir(status.Path, "git", "push")
		if err != nil {
			result.Success = false
			result.Error = fmt.Sprintf("PR #%d: 'git push' failed: %v", prNumber, err)
			return result
		}
	}

	result.Success = true
	result.Message = fmt.Sprintf("PR #%d: Synced", prNumber)
	return result
}

// RemovePRWorktree removes a worktree for a PR
func RemovePRWorktree(prNumber int, worktreeRoot string, force bool, runner CommandRunner) WorktreeOperationResult {
	result := WorktreeOperationResult{
		PR: prNumber,
	}

	status := GetWorktreeStatus(prNumber, worktreeRoot, runner)
	if !status.Exists {
		result.Success = true
		result.Message = fmt.Sprintf("Worktree for PR #%d does not exist", prNumber)
		return result
	}

	isClean := status.Clean != nil && *status.Clean
	hasUnpushed := status.Unpushed != nil && *status.Unpushed

	if !isClean && !force {
		result.Success = false
		result.Error = fmt.Sprintf("Worktree for PR #%d has uncommitted changes. Use force to remove anyway", prNumber)
		return result
	}

	if hasUnpushed && !force {
		result.Success = false
		result.Error = fmt.Sprintf("Worktree for PR #%d has unpushed commits. Use force to remove anyway", prNumber)
		return result
	}

	args := []string{"worktree", "remove", status.Path}
	if force {
		args = append(args, "--force")
	}

	_, err := runner.Run("git", args...)
	if err != nil {
		result.Success = false
		result.Error = fmt.Sprintf("Failed to remove worktree for PR #%d: %v", prNumber, err)
		return result
	}

	result.Success = true
	result.Message = fmt.Sprintf("Removed: %s", status.Path)
	return result
}

// RunBatchPRReview executes a batch PR review operation
func RunBatchPRReview(config BatchPRReviewConfig) BatchPRReviewResult {
	return RunBatchPRReviewWithRunner(config, DefaultCommandRunner)
}

// RunBatchPRReviewWithRunner executes a batch PR review operation with a custom runner
func RunBatchPRReviewWithRunner(config BatchPRReviewConfig, runner CommandRunner) BatchPRReviewResult {
	result := BatchPRReviewResult{
		Operation:    config.Operation,
		WorktreeRoot: config.WorktreeRoot,
	}

	// Determine worktree root if not specified
	if config.WorktreeRoot == "" {
		repoRoot, err := GetRepoRoot(runner)
		if err != nil {
			result.Valid = false
			result.Message = err.Error()
			return result
		}
		config.WorktreeRoot = filepath.Dir(repoRoot)
		result.WorktreeRoot = config.WorktreeRoot
	}

	var checks []Check
	allPassed := true

	switch config.Operation {
	case OperationSetup:
		result.Results = make([]WorktreeOperationResult, 0, len(config.PRNumbers))
		for _, pr := range config.PRNumbers {
			opResult := CreatePRWorktree(pr, config.WorktreeRoot, runner)
			result.Results = append(result.Results, opResult)
			passed := opResult.Success
			if !passed {
				allPassed = false
			}
			checks = append(checks, Check{
				Name:    fmt.Sprintf("setup_pr_%d", pr),
				Passed:  passed,
				Message: opResult.Message + opResult.Error,
			})
		}

	case OperationStatus:
		result.Statuses = make([]WorktreeStatus, 0, len(config.PRNumbers))
		for _, pr := range config.PRNumbers {
			status := GetWorktreeStatus(pr, config.WorktreeRoot, runner)
			result.Statuses = append(result.Statuses, status)
			passed := status.Exists
			checks = append(checks, Check{
				Name:    fmt.Sprintf("status_pr_%d", pr),
				Passed:  passed,
				Message: fmt.Sprintf("PR #%d: exists=%v", pr, status.Exists),
			})
		}

	case OperationCleanup:
		result.Results = make([]WorktreeOperationResult, 0, len(config.PRNumbers)*2)

		// First push any changes
		for _, pr := range config.PRNumbers {
			pushResult := PushWorktreeChanges(pr, config.WorktreeRoot, runner)
			result.Results = append(result.Results, pushResult)
		}

		// Then remove worktrees
		for _, pr := range config.PRNumbers {
			removeResult := RemovePRWorktree(pr, config.WorktreeRoot, config.Force, runner)
			result.Results = append(result.Results, removeResult)
			passed := removeResult.Success
			if !passed {
				allPassed = false
			}
			checks = append(checks, Check{
				Name:    fmt.Sprintf("cleanup_pr_%d", pr),
				Passed:  passed,
				Message: removeResult.Message + removeResult.Error,
			})
		}

	case OperationAll:
		// Phase 1: Setup
		setupResults := make([]WorktreeOperationResult, 0, len(config.PRNumbers))
		for _, pr := range config.PRNumbers {
			opResult := CreatePRWorktree(pr, config.WorktreeRoot, runner)
			setupResults = append(setupResults, opResult)
			passed := opResult.Success
			if !passed {
				allPassed = false
			}
			checks = append(checks, Check{
				Name:    fmt.Sprintf("setup_pr_%d", pr),
				Passed:  passed,
				Message: opResult.Message + opResult.Error,
			})
		}
		result.Results = setupResults

		// Phase 2: Get status
		result.Statuses = make([]WorktreeStatus, 0, len(config.PRNumbers))
		for _, pr := range config.PRNumbers {
			status := GetWorktreeStatus(pr, config.WorktreeRoot, runner)
			result.Statuses = append(result.Statuses, status)
		}
	}

	result.Valid = allPassed
	result.Checks = checks

	if allPassed {
		result.Message = fmt.Sprintf("Batch PR review %s completed successfully", config.Operation)
	} else {
		result.Message = fmt.Sprintf("Batch PR review %s completed with errors", config.Operation)
	}

	return result
}
