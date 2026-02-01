package internal_test

import (
	"testing"

	// Import the parent package to initialize schemas via init()
	validation "github.com/peterkloss/brain/packages/validation"
	"github.com/peterkloss/brain/packages/validation/internal"
)

// Ensure validation package is imported (for init() side effects)
var _ = validation.CheckTasks

// TestValidateTestCoverageGapsOptions tests validation of coverage gap options.
func TestValidateTestCoverageGapsOptions_Valid(t *testing.T) {
	opts := internal.TestCoverageGapOptions{
		BasePath:  "/path/to/repo",
		Language:  "go",
		Threshold: 80.0,
	}

	errors := internal.ValidateTestCoverageGapsOptions(opts)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid options, got: %v", errors)
	}
}

func TestValidateTestCoverageGapsOptions_InvalidThreshold(t *testing.T) {
	opts := internal.TestCoverageGapOptions{
		BasePath:  "/path/to/repo",
		Language:  "go",
		Threshold: 150.0, // Invalid: exceeds 100
	}

	errors := internal.ValidateTestCoverageGapsOptions(opts)
	if len(errors) == 0 {
		t.Error("Expected errors for invalid threshold, got none")
	}
}

func TestValidateTestCoverageGapsOptions_EmptyBasePath(t *testing.T) {
	opts := internal.TestCoverageGapOptions{
		BasePath: "", // Empty is valid - defaults to current directory
		Language: "go",
	}

	errors := internal.ValidateTestCoverageGapsOptions(opts)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for empty base path (valid default), got: %v", errors)
	}
}

// TestValidateSkillExistsInput tests validation of skill exists input.
func TestValidateSkillExistsInput_Valid(t *testing.T) {
	errors := internal.ValidateSkillExistsInput("/path/to/repo", "my-skill")
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid input, got: %v", errors)
	}
}

func TestValidateSkillExistsInput_EmptySkillName(t *testing.T) {
	errors := internal.ValidateSkillExistsInput("/path/to/repo", "")
	if len(errors) == 0 {
		t.Error("Expected errors for empty skill name, got none")
	}
}

func TestValidateSkillExistsInput_EmptyBasePath(t *testing.T) {
	errors := internal.ValidateSkillExistsInput("", "my-skill")
	if len(errors) == 0 {
		t.Error("Expected errors for empty base path, got none")
	}
}

func TestValidateSkillExistsInput_InvalidSkillName(t *testing.T) {
	errors := internal.ValidateSkillExistsInput("/path/to/repo", "My_Skill") // Invalid: uppercase and underscore
	if len(errors) == 0 {
		t.Error("Expected errors for invalid skill name pattern, got none")
	}
}

// TestValidateTasksInput tests validation of tasks input.
func TestValidateTasksInput_Valid(t *testing.T) {
	tasks := []map[string]interface{}{
		{
			"name":      "task-1",
			"status":    "IN_PROGRESS",
			"completed": false,
		},
		{
			"name":      "task-2",
			"status":    "COMPLETED",
			"completed": true,
		},
	}

	errors := internal.ValidateTasksInput(tasks)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid tasks, got: %v", errors)
	}
}

func TestValidateTasksInput_EmptyTasks(t *testing.T) {
	tasks := []map[string]interface{}{}

	errors := internal.ValidateTasksInput(tasks)
	// Empty array should be valid
	if len(errors) > 0 {
		t.Errorf("Expected no errors for empty tasks array, got: %v", errors)
	}
}

// TestValidateBatchPRReviewConfig tests validation of batch PR review config.
func TestValidateBatchPRReviewConfig_Valid(t *testing.T) {
	config := internal.BatchPRReviewConfig{
		PRNumbers:    []int{123, 456},
		Operation:    internal.OperationSetup,
		WorktreeRoot: "/path/to/worktrees",
		Force:        false,
	}

	errors := internal.ValidateBatchPRReviewConfig(config)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid config, got: %v", errors)
	}
}

func TestValidateBatchPRReviewConfig_EmptyPRNumbers(t *testing.T) {
	config := internal.BatchPRReviewConfig{
		PRNumbers: []int{},
		Operation: internal.OperationSetup,
	}

	errors := internal.ValidateBatchPRReviewConfig(config)
	if len(errors) == 0 {
		t.Error("Expected errors for empty PR numbers, got none")
	}
}

func TestValidateBatchPRReviewConfig_InvalidPRNumber(t *testing.T) {
	config := internal.BatchPRReviewConfig{
		PRNumbers: []int{0}, // Invalid: must be >= 1
		Operation: internal.OperationSetup,
	}

	errors := internal.ValidateBatchPRReviewConfig(config)
	if len(errors) == 0 {
		t.Error("Expected errors for invalid PR number, got none")
	}
}

// TestValidatePRMaintenanceConfigInput tests validation of PR maintenance config.
func TestValidatePRMaintenanceConfigInput_Valid(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	errors := internal.ValidatePRMaintenanceConfigInput(config)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for default config, got: %v", errors)
	}
}

func TestValidatePRMaintenanceConfigInput_InvalidMaxPRs(t *testing.T) {
	config := internal.PRMaintenanceConfig{
		ProtectedBranches: []string{"main"},
		BotCategories:     map[string][]string{},
		MaxPRs:            0, // Invalid: must be >= 1
	}

	errors := internal.ValidatePRMaintenanceConfigInput(config)
	if len(errors) == 0 {
		t.Error("Expected errors for invalid max PRs, got none")
	}
}

// TestValidatePullRequestInput tests validation of PR input data.
func TestValidatePullRequestInput_Valid(t *testing.T) {
	pr := internal.PullRequest{
		Number:      1,
		Title:       "Test PR",
		Author:      internal.PRAuthor{Login: "developer"},
		HeadRefName: "feature-branch",
		BaseRefName: "main",
		Mergeable:   internal.MergeableMergeable,
	}
	// Initialize nested structs
	pr.ReviewRequests.Nodes = []internal.ReviewRequest{}
	pr.Commits.Nodes = []internal.PRCommit{}

	prs := []internal.PullRequest{pr}

	errors := internal.ValidatePullRequestInput(prs)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid PR input, got: %v", errors)
	}
}

func TestValidatePullRequestInput_EmptyAuthor(t *testing.T) {
	prs := []internal.PullRequest{
		{
			Number: 1,
			Title:  "Test PR",
			Author: internal.PRAuthor{Login: ""}, // Invalid: empty login
		},
	}

	errors := internal.ValidatePullRequestInput(prs)
	if len(errors) == 0 {
		t.Error("Expected errors for empty author login, got none")
	}
}

func TestValidatePullRequestInput_InvalidPRNumber(t *testing.T) {
	prs := []internal.PullRequest{
		{
			Number: 0, // Invalid: must be >= 1
			Title:  "Test PR",
			Author: internal.PRAuthor{Login: "developer"},
		},
	}

	errors := internal.ValidatePullRequestInput(prs)
	if len(errors) == 0 {
		t.Error("Expected errors for invalid PR number, got none")
	}
}

func TestValidatePullRequestInput_Empty(t *testing.T) {
	prs := []internal.PullRequest{}

	errors := internal.ValidatePullRequestInput(prs)
	// Empty array should be valid
	if len(errors) > 0 {
		t.Errorf("Expected no errors for empty PR array, got: %v", errors)
	}
}

// TestValidateTestCoverageGapsResult tests result validation.
func TestValidateTestCoverageGapsResult_Valid(t *testing.T) {
	result := internal.TestCoverageGapResult{
		ValidationResult: internal.ValidationResult{
			Valid: true,
			Checks: []internal.Check{
				{Name: "coverage_threshold", Passed: true, Message: "Coverage meets threshold"},
			},
			Message: "All source files have test coverage",
		},
		BasePath:          "/path/to/repo",
		Language:          "go",
		TotalSourceFiles:  10,
		FilesWithTests:    10,
		FilesWithoutTests: 0,
		CoveragePercent:   100.0,
	}

	errors := internal.ValidateTestCoverageGapsResult(result)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid result, got: %v", errors)
	}
}

// TestValidateSkillExistsResult tests skill exists result validation.
func TestValidateSkillExistsResult_Valid(t *testing.T) {
	result := internal.SkillExistsResult{
		Exists:      true,
		SkillName:   "my-skill",
		SkillPath:   "/path/to/.claude/skills/my-skill/SKILL.md",
		Name:        "my-skill",
		Description: "A test skill",
		Message:     "Skill exists and is valid",
		Checks: []internal.Check{
			{Name: "file_exists", Passed: true, Message: "SKILL.md file exists"},
		},
	}

	errors := internal.ValidateSkillExistsResult(result)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid result, got: %v", errors)
	}
}

// TestValidateBatchPRReviewResult tests batch PR review result validation.
func TestValidateBatchPRReviewResult_Valid(t *testing.T) {
	result := internal.BatchPRReviewResult{
		ValidationResult: internal.ValidationResult{
			Valid: true,
			Checks: []internal.Check{
				{Name: "setup_pr_123", Passed: true, Message: "Created worktree"},
			},
			Message: "Batch PR review Setup completed successfully",
		},
		Operation:    internal.OperationSetup,
		WorktreeRoot: "/path/to/worktrees",
		Results: []internal.WorktreeOperationResult{
			{PR: 123, Success: true, Message: "Created worktree"},
		},
	}

	errors := internal.ValidateBatchPRReviewResult(result)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid result, got: %v", errors)
	}
}

// TestValidatePRMaintenanceResult tests PR maintenance result validation.
func TestValidatePRMaintenanceResult_Valid(t *testing.T) {
	result := internal.PRMaintenanceResult{
		TotalPRs:               5,
		ActionRequired:         []internal.PRActionItem{},
		Blocked:                []internal.PRActionItem{},
		DerivativePRs:          []internal.DerivativePR{},
		ParentsWithDerivatives: []internal.ParentWithDerivatives{},
	}

	errors := internal.ValidatePRMaintenanceResult(result)
	if len(errors) > 0 {
		t.Errorf("Expected no errors for valid result, got: %v", errors)
	}
}
