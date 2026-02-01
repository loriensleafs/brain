package internal_test

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// MockCommandRunner provides controllable command execution for tests
type MockCommandRunner struct {
	Commands []MockCommand
	RunCalls []RunCall
}

type MockCommand struct {
	Name        string
	ArgsContain string
	Output      string
	Error       error
}

type RunCall struct {
	Dir  string
	Name string
	Args []string
}

func NewMockCommandRunner() *MockCommandRunner {
	return &MockCommandRunner{
		Commands: []MockCommand{},
		RunCalls: []RunCall{},
	}
}

func (m *MockCommandRunner) AddCommand(name, argsContain, output string, err error) {
	m.Commands = append(m.Commands, MockCommand{
		Name:        name,
		ArgsContain: argsContain,
		Output:      output,
		Error:       err,
	})
}

func (m *MockCommandRunner) findCommand(name string, args []string) *MockCommand {
	argsStr := strings.Join(args, " ")
	for i := len(m.Commands) - 1; i >= 0; i-- {
		cmd := &m.Commands[i]
		if cmd.Name == name && (cmd.ArgsContain == "" || strings.Contains(argsStr, cmd.ArgsContain)) {
			return cmd
		}
	}
	return nil
}

func (m *MockCommandRunner) Run(name string, args ...string) (string, error) {
	m.RunCalls = append(m.RunCalls, RunCall{Name: name, Args: args})
	if cmd := m.findCommand(name, args); cmd != nil {
		return cmd.Output, cmd.Error
	}
	return "", fmt.Errorf("no mock configured for command: %s %v", name, args)
}

func (m *MockCommandRunner) RunInDir(dir string, name string, args ...string) (string, error) {
	m.RunCalls = append(m.RunCalls, RunCall{Dir: dir, Name: name, Args: args})
	if cmd := m.findCommand(name, args); cmd != nil {
		return cmd.Output, cmd.Error
	}
	return "", fmt.Errorf("no mock configured for command: %s %v", name, args)
}

// Tests for GetRepoRoot

func TestGetRepoRoot_Success(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("git", "rev-parse", "/path/to/repo\n", nil)

	root, err := internal.GetRepoRoot(mock)

	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if root != "/path/to/repo" {
		t.Errorf("Expected '/path/to/repo', got: %s", root)
	}
}

func TestGetRepoRoot_NotARepo(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("git", "rev-parse", "", fmt.Errorf("fatal: not a git repository"))

	_, err := internal.GetRepoRoot(mock)

	if err == nil {
		t.Error("Expected error for non-git directory")
	}
	if !strings.Contains(err.Error(), "not in a git repository") {
		t.Errorf("Expected 'not in a git repository' error, got: %v", err)
	}
}

// Tests for GetPRBranch

func TestGetPRBranch_Success(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/my-branch"}`, nil)

	branch, err := internal.GetPRBranch(123, mock)

	if err != nil {
		t.Errorf("Expected no error, got: %v", err)
	}
	if branch != "feature/my-branch" {
		t.Errorf("Expected 'feature/my-branch', got: %s", branch)
	}
}

func TestGetPRBranch_PRNotFound(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", "", fmt.Errorf("no pull request found"))

	_, err := internal.GetPRBranch(999, mock)

	if err == nil {
		t.Error("Expected error for non-existent PR")
	}
	if !strings.Contains(err.Error(), "PR #999 not found") {
		t.Errorf("Expected 'PR #999 not found' error, got: %v", err)
	}
}

func TestGetPRBranch_InvalidJSON(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", "not valid json", nil)

	_, err := internal.GetPRBranch(123, mock)

	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
	if !strings.Contains(err.Error(), "unable to parse branch information") {
		t.Errorf("Expected parse error, got: %v", err)
	}
}

func TestGetPRBranch_EmptyBranch(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":""}`, nil)

	_, err := internal.GetPRBranch(123, mock)

	if err == nil {
		t.Error("Expected error for empty branch name")
	}
	if !strings.Contains(err.Error(), "branch name is empty") {
		t.Errorf("Expected 'branch name is empty' error, got: %v", err)
	}
}

// Tests for CreatePRWorktree

func TestCreatePRWorktree_Success(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/test"}`, nil)
	mock.AddCommand("git", "fetch", "", nil)
	mock.AddCommand("git", "worktree", "", nil)

	result := internal.CreatePRWorktree(123, tmpDir, mock)

	if !result.Success {
		t.Errorf("Expected success, got error: %s", result.Error)
	}
	if result.PR != 123 {
		t.Errorf("Expected PR 123, got: %d", result.PR)
	}
}

func TestCreatePRWorktree_AlreadyExists(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/test"}`, nil)

	result := internal.CreatePRWorktree(123, tmpDir, mock)

	if !result.Success {
		t.Errorf("Expected success for existing worktree, got error: %s", result.Error)
	}
	if !strings.Contains(result.Message, "already exists") {
		t.Errorf("Expected 'already exists' message, got: %s", result.Message)
	}
}

func TestCreatePRWorktree_PRNotFound(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", "", fmt.Errorf("PR not found"))

	result := internal.CreatePRWorktree(999, tmpDir, mock)

	if result.Success {
		t.Error("Expected failure for non-existent PR")
	}
	if !strings.Contains(result.Error, "not found") {
		t.Errorf("Expected 'not found' error, got: %s", result.Error)
	}
}

func TestCreatePRWorktree_FallbackToOrigin(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/test"}`, nil)
	mock.AddCommand("git", "fetch", "", nil)
	// First worktree add fails
	mock.Commands = append(mock.Commands, MockCommand{
		Name:        "git",
		ArgsContain: "worktree add",
		Output:      "",
		Error:       fmt.Errorf("branch not found"),
	})
	// Second worktree add with origin/ prefix succeeds
	mock.Commands = append(mock.Commands, MockCommand{
		Name:        "git",
		ArgsContain: "origin/",
		Output:      "",
		Error:       nil,
	})

	result := internal.CreatePRWorktree(123, tmpDir, mock)

	if !result.Success {
		t.Errorf("Expected success after fallback, got error: %s", result.Error)
	}
}

// Tests for GetWorktreeStatus

func TestGetWorktreeStatus_NotExists(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()

	status := internal.GetWorktreeStatus(123, tmpDir, mock)

	if status.Exists {
		t.Error("Expected Exists=false for non-existent worktree")
	}
	if status.PR != 123 {
		t.Errorf("Expected PR 123, got: %d", status.PR)
	}
}

func TestGetWorktreeStatus_ExistsClean(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", "", nil)                         // Clean - no output
	mock.AddCommand("git", "branch", "feature/test\n", nil)           // Branch name
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)           // Commit hash (log -1 --format=%h)
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil) // Has upstream
	mock.AddCommand("git", "@{u}..", "", nil)                         // No unpushed - empty

	status := internal.GetWorktreeStatus(123, tmpDir, mock)

	if !status.Exists {
		t.Error("Expected Exists=true")
	}
	if status.Clean == nil || !*status.Clean {
		t.Error("Expected Clean=true")
	}
	if status.Branch != "feature/test" {
		t.Errorf("Expected branch 'feature/test', got: %s", status.Branch)
	}
	if status.Commit != "abc1234" {
		t.Errorf("Expected commit 'abc1234', got: %s", status.Commit)
	}
	if status.Unpushed == nil || *status.Unpushed {
		t.Error("Expected Unpushed=false")
	}
}

func TestGetWorktreeStatus_ExistsDirty(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", " M file.go\n", nil)             // Has changes
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)           // Commit hash
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "def5678 uncommitted\n", nil)    // Has unpushed

	status := internal.GetWorktreeStatus(123, tmpDir, mock)

	if !status.Exists {
		t.Error("Expected Exists=true")
	}
	if status.Clean == nil || *status.Clean {
		t.Error("Expected Clean=false")
	}
	if status.Unpushed == nil || !*status.Unpushed {
		t.Error("Expected Unpushed=true")
	}
}

// Tests for PushWorktreeChanges

func TestPushWorktreeChanges_NotExists(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()

	result := internal.PushWorktreeChanges(123, tmpDir, mock)

	if result.Success {
		t.Error("Expected failure for non-existent worktree")
	}
	if !strings.Contains(result.Error, "does not exist") {
		t.Errorf("Expected 'does not exist' error, got: %s", result.Error)
	}
}

func TestPushWorktreeChanges_AlreadyClean(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", "", nil)                         // Clean
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)           // Commit hash
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "", nil)                         // No unpushed

	result := internal.PushWorktreeChanges(123, tmpDir, mock)

	if !result.Success {
		t.Errorf("Expected success, got error: %s", result.Error)
	}
	if !strings.Contains(result.Message, "Already clean") {
		t.Errorf("Expected 'Already clean' message, got: %s", result.Message)
	}
}

func TestPushWorktreeChanges_CommitAndPush(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", " M file.go\n", nil)   // Has changes
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil) // Commit hash
	mock.AddCommand("git", "rev-parse", "", fmt.Errorf("no upstream"))
	mock.AddCommand("git", "add", "", nil)
	mock.AddCommand("git", "commit", "", nil)
	mock.AddCommand("git", "push", "", nil)

	result := internal.PushWorktreeChanges(123, tmpDir, mock)

	if !result.Success {
		t.Errorf("Expected success, got error: %s", result.Error)
	}
	if !strings.Contains(result.Message, "Synced") {
		t.Errorf("Expected 'Synced' message, got: %s", result.Message)
	}
}

func TestPushWorktreeChanges_AddFails(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", " M file.go\n", nil)
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)
	mock.AddCommand("git", "rev-parse", "", fmt.Errorf("no upstream"))
	mock.AddCommand("git", "add", "", fmt.Errorf("git add failed"))

	result := internal.PushWorktreeChanges(123, tmpDir, mock)

	if result.Success {
		t.Error("Expected failure when git add fails")
	}
	if !strings.Contains(result.Error, "git add") {
		t.Errorf("Expected 'git add' error, got: %s", result.Error)
	}
}

// Tests for RemovePRWorktree

func TestRemovePRWorktree_NotExists(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()

	result := internal.RemovePRWorktree(123, tmpDir, false, mock)

	if !result.Success {
		t.Errorf("Expected success for non-existent worktree, got error: %s", result.Error)
	}
	if !strings.Contains(result.Message, "does not exist") {
		t.Errorf("Expected 'does not exist' message, got: %s", result.Message)
	}
}

func TestRemovePRWorktree_Success(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", "", nil)                         // Clean
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)           // Commit hash
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "", nil)                         // No unpushed
	mock.AddCommand("git", "worktree", "", nil)                       // Remove

	result := internal.RemovePRWorktree(123, tmpDir, false, mock)

	if !result.Success {
		t.Errorf("Expected success, got error: %s", result.Error)
	}
	if !strings.Contains(result.Message, "Removed") {
		t.Errorf("Expected 'Removed' message, got: %s", result.Message)
	}
}

func TestRemovePRWorktree_DirtyWithoutForce(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", " M file.go\n", nil) // Has changes
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)
	mock.AddCommand("git", "rev-parse", "", fmt.Errorf("no upstream"))

	result := internal.RemovePRWorktree(123, tmpDir, false, mock)

	if result.Success {
		t.Error("Expected failure for dirty worktree without force")
	}
	if !strings.Contains(result.Error, "uncommitted changes") {
		t.Errorf("Expected 'uncommitted changes' error, got: %s", result.Error)
	}
}

func TestRemovePRWorktree_DirtyWithForce(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", " M file.go\n", nil)
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)
	mock.AddCommand("git", "rev-parse", "", fmt.Errorf("no upstream"))
	mock.AddCommand("git", "worktree", "", nil)

	result := internal.RemovePRWorktree(123, tmpDir, true, mock)

	if !result.Success {
		t.Errorf("Expected success with force, got error: %s", result.Error)
	}
}

func TestRemovePRWorktree_UnpushedWithoutForce(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", "", nil)                         // Clean
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)           // Commit hash
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "def5678 uncommitted\n", nil)    // Has unpushed

	result := internal.RemovePRWorktree(123, tmpDir, false, mock)

	if result.Success {
		t.Error("Expected failure for unpushed commits without force")
	}
	if !strings.Contains(result.Error, "unpushed commits") {
		t.Errorf("Expected 'unpushed commits' error, got: %s", result.Error)
	}
}

// Tests for RunBatchPRReviewWithRunner

func TestRunBatchPRReview_Setup(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/test"}`, nil)
	mock.AddCommand("git", "fetch", "", nil)
	mock.AddCommand("git", "worktree", "", nil)

	config := internal.BatchPRReviewConfig{
		PRNumbers:    []int{123, 456},
		Operation:    internal.OperationSetup,
		WorktreeRoot: tmpDir,
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if !result.Valid {
		t.Errorf("Expected valid result, got: %s", result.Message)
	}
	if result.Operation != internal.OperationSetup {
		t.Errorf("Expected Setup operation, got: %s", result.Operation)
	}
	if len(result.Results) != 2 {
		t.Errorf("Expected 2 results, got: %d", len(result.Results))
	}
}

func TestRunBatchPRReview_Status(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	mock.AddCommand("git", "status", "", nil)
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "", nil)

	config := internal.BatchPRReviewConfig{
		PRNumbers:    []int{123, 456},
		Operation:    internal.OperationStatus,
		WorktreeRoot: tmpDir,
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if len(result.Statuses) != 2 {
		t.Errorf("Expected 2 statuses, got: %d", len(result.Statuses))
	}
	// First PR exists, second does not
	if !result.Statuses[0].Exists {
		t.Error("Expected first PR worktree to exist")
	}
	if result.Statuses[1].Exists {
		t.Error("Expected second PR worktree to not exist")
	}
}

func TestRunBatchPRReview_Cleanup(t *testing.T) {
	tmpDir := t.TempDir()
	worktreePath := filepath.Join(tmpDir, "worktree-pr-123")
	if err := os.MkdirAll(worktreePath, 0755); err != nil {
		t.Fatalf("Failed to create worktree dir: %v", err)
	}

	mock := NewMockCommandRunner()
	// For push
	mock.AddCommand("git", "status", "", nil)
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "", nil)
	// For remove
	mock.AddCommand("git", "worktree", "", nil)

	config := internal.BatchPRReviewConfig{
		PRNumbers:    []int{123},
		Operation:    internal.OperationCleanup,
		WorktreeRoot: tmpDir,
		Force:        false,
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if !result.Valid {
		t.Errorf("Expected valid result, got: %s", result.Message)
	}
	if len(result.Results) != 2 { // push + remove
		t.Errorf("Expected 2 results (push and remove), got: %d", len(result.Results))
	}
}

func TestRunBatchPRReview_All(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/test"}`, nil)
	mock.AddCommand("git", "fetch", "", nil)
	mock.AddCommand("git", "worktree", "", nil)
	mock.AddCommand("git", "status", "", nil)
	mock.AddCommand("git", "branch", "feature/test\n", nil)
	mock.AddCommand("git", "--format=%h", "abc1234\n", nil)
	mock.AddCommand("git", "rev-parse", "origin/feature/test\n", nil)
	mock.AddCommand("git", "@{u}..", "", nil)

	config := internal.BatchPRReviewConfig{
		PRNumbers:    []int{123},
		Operation:    internal.OperationAll,
		WorktreeRoot: tmpDir,
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if !result.Valid {
		t.Errorf("Expected valid result, got: %s", result.Message)
	}
	if len(result.Results) != 1 { // Setup results
		t.Errorf("Expected 1 setup result, got: %d", len(result.Results))
	}
	if len(result.Statuses) != 1 { // Status results
		t.Errorf("Expected 1 status, got: %d", len(result.Statuses))
	}
}

func TestRunBatchPRReview_NoWorktreeRoot(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("git", "rev-parse", "/path/to/repo\n", nil)
	mock.AddCommand("gh", "pr view", `{"headRefName":"feature/test"}`, nil)
	mock.AddCommand("git", "fetch", "", nil)
	mock.AddCommand("git", "worktree", "", nil)

	config := internal.BatchPRReviewConfig{
		PRNumbers: []int{123},
		Operation: internal.OperationSetup,
		// WorktreeRoot not set - should use parent of repo
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if result.WorktreeRoot != "/path/to" {
		t.Errorf("Expected worktree root to be '/path/to', got: %s", result.WorktreeRoot)
	}
}

func TestRunBatchPRReview_NotInRepo(t *testing.T) {
	mock := NewMockCommandRunner()
	mock.AddCommand("git", "rev-parse", "", fmt.Errorf("not a git repo"))

	config := internal.BatchPRReviewConfig{
		PRNumbers: []int{123},
		Operation: internal.OperationSetup,
		// WorktreeRoot not set
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if result.Valid {
		t.Error("Expected invalid result when not in git repo")
	}
	if !strings.Contains(result.Message, "not in a git repository") {
		t.Errorf("Expected 'not in a git repository' message, got: %s", result.Message)
	}
}

func TestRunBatchPRReview_PartialFailure(t *testing.T) {
	tmpDir := t.TempDir()
	mock := NewMockCommandRunner()
	// First PR succeeds
	mock.Commands = append(mock.Commands, MockCommand{
		Name:        "gh",
		ArgsContain: "123",
		Output:      `{"headRefName":"feature/test-1"}`,
		Error:       nil,
	})
	mock.AddCommand("git", "fetch", "", nil)
	mock.AddCommand("git", "worktree", "", nil)
	// Second PR fails
	mock.Commands = append(mock.Commands, MockCommand{
		Name:        "gh",
		ArgsContain: "456",
		Output:      "",
		Error:       fmt.Errorf("PR not found"),
	})

	config := internal.BatchPRReviewConfig{
		PRNumbers:    []int{123, 456},
		Operation:    internal.OperationSetup,
		WorktreeRoot: tmpDir,
	}

	result := internal.RunBatchPRReviewWithRunner(config, mock)

	if result.Valid {
		t.Error("Expected invalid result for partial failure")
	}
	if len(result.Results) != 2 {
		t.Errorf("Expected 2 results, got: %d", len(result.Results))
	}
	if !result.Results[0].Success {
		t.Error("Expected first PR to succeed")
	}
	if result.Results[1].Success {
		t.Error("Expected second PR to fail")
	}
}

// Tests for operation constants

func TestOperationConstants(t *testing.T) {
	if internal.OperationSetup != "Setup" {
		t.Errorf("Expected OperationSetup='Setup', got: %s", internal.OperationSetup)
	}
	if internal.OperationStatus != "Status" {
		t.Errorf("Expected OperationStatus='Status', got: %s", internal.OperationStatus)
	}
	if internal.OperationCleanup != "Cleanup" {
		t.Errorf("Expected OperationCleanup='Cleanup', got: %s", internal.OperationCleanup)
	}
	if internal.OperationAll != "All" {
		t.Errorf("Expected OperationAll='All', got: %s", internal.OperationAll)
	}
}
