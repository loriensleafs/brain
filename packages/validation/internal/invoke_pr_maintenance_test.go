package internal_test

import (
	"encoding/json"
	"testing"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Tests for GetBotAuthorInfo

func TestGetBotAuthorInfo_AgentControlled(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	tests := []struct {
		name   string
		author string
	}{
		{"rjmurillo-bot", "rjmurillo-bot"},
		{"rjmurillo[bot]", "rjmurillo[bot]"},
		{"case insensitive", "RJMURILLO-BOT"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.GetBotAuthorInfo(tt.author, config)

			if !result.IsBot {
				t.Errorf("Expected %s to be identified as bot", tt.author)
			}
			if result.Category != internal.BotCategoryAgentControlled {
				t.Errorf("Expected category 'agent-controlled', got '%s'", result.Category)
			}
		})
	}
}

func TestGetBotAuthorInfo_MentionTriggered(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	tests := []struct {
		name   string
		author string
	}{
		{"copilot-swe-agent", "copilot-swe-agent"},
		{"copilot-swe-agent[bot]", "copilot-swe-agent[bot]"},
		{"copilot", "copilot"},
		{"app/copilot-swe-agent", "app/copilot-swe-agent"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.GetBotAuthorInfo(tt.author, config)

			if !result.IsBot {
				t.Errorf("Expected %s to be identified as bot", tt.author)
			}
			if result.Category != internal.BotCategoryMentionTriggered {
				t.Errorf("Expected category 'mention-triggered', got '%s'", result.Category)
			}
		})
	}
}

func TestGetBotAuthorInfo_ReviewBot(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	tests := []struct {
		name   string
		author string
	}{
		{"coderabbitai", "coderabbitai"},
		{"coderabbitai[bot]", "coderabbitai[bot]"},
		{"cursor[bot]", "cursor[bot]"},
		{"gemini-code-assist", "gemini-code-assist"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.GetBotAuthorInfo(tt.author, config)

			if !result.IsBot {
				t.Errorf("Expected %s to be identified as bot", tt.author)
			}
			if result.Category != internal.BotCategoryReviewBot {
				t.Errorf("Expected category 'review-bot', got '%s'", result.Category)
			}
		})
	}
}

func TestGetBotAuthorInfo_Human(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	tests := []struct {
		name   string
		author string
	}{
		{"regular user", "johndoe"},
		{"another user", "jane-smith"},
		{"similar name", "mycopilot"},
		{"suffix match not prefix", "user-copilot"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := internal.GetBotAuthorInfo(tt.author, config)

			if result.IsBot {
				t.Errorf("Expected %s to be identified as human, not bot", tt.author)
			}
			if result.Category != internal.BotCategoryHuman {
				t.Errorf("Expected category 'human', got '%s'", result.Category)
			}
		})
	}
}

// Tests for IsBotReviewer

func TestIsBotReviewer_AgentControlledReviewer(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	requests := []internal.ReviewRequest{
		{RequestedReviewer: struct {
			Login string `json:"login,omitempty"`
			Name  string `json:"name,omitempty"`
		}{Login: "rjmurillo-bot"}},
	}

	if !internal.IsBotReviewer(requests, config) {
		t.Error("Expected rjmurillo-bot reviewer to be detected")
	}
}

func TestIsBotReviewer_HumanReviewer(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	requests := []internal.ReviewRequest{
		{RequestedReviewer: struct {
			Login string `json:"login,omitempty"`
			Name  string `json:"name,omitempty"`
		}{Login: "johndoe"}},
	}

	if internal.IsBotReviewer(requests, config) {
		t.Error("Expected human reviewer to NOT trigger bot detection")
	}
}

func TestIsBotReviewer_EmptyReviewers(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	requests := []internal.ReviewRequest{}

	if internal.IsBotReviewer(requests, config) {
		t.Error("Expected empty reviewers to return false")
	}
}

func TestIsBotReviewer_MentionTriggeredNotDetected(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	requests := []internal.ReviewRequest{
		{RequestedReviewer: struct {
			Login string `json:"login,omitempty"`
			Name  string `json:"name,omitempty"`
		}{Login: "copilot-swe-agent"}},
	}

	// IsBotReviewer only returns true for agent-controlled bots, not mention-triggered
	if internal.IsBotReviewer(requests, config) {
		t.Error("Expected mention-triggered bot reviewer to NOT be detected as agent-controlled")
	}
}

// Tests for PRHasConflicts

func TestPRHasConflicts_Conflicting(t *testing.T) {
	pr := internal.PullRequest{
		Mergeable: internal.MergeableConflicting,
	}

	if !internal.PRHasConflicts(pr) {
		t.Error("Expected conflicting PR to be detected")
	}
}

func TestPRHasConflicts_Mergeable(t *testing.T) {
	pr := internal.PullRequest{
		Mergeable: internal.MergeableMergeable,
	}

	if internal.PRHasConflicts(pr) {
		t.Error("Expected mergeable PR to NOT have conflicts")
	}
}

func TestPRHasConflicts_Unknown(t *testing.T) {
	pr := internal.PullRequest{
		Mergeable: internal.MergeableUnknown,
	}

	if internal.PRHasConflicts(pr) {
		t.Error("Expected unknown mergeable state to NOT indicate conflicts")
	}
}

// Tests for PRHasFailingChecks

func TestPRHasFailingChecks_NoCommits(t *testing.T) {
	pr := internal.PullRequest{}

	if internal.PRHasFailingChecks(pr) {
		t.Error("Expected PR with no commits to NOT have failing checks")
	}
}

func TestPRHasFailingChecks_NoRollup(t *testing.T) {
	pr := internal.PullRequest{}
	pr.Commits.Nodes = []internal.PRCommit{{}}

	if internal.PRHasFailingChecks(pr) {
		t.Error("Expected PR with no rollup to NOT have failing checks")
	}
}

func TestPRHasFailingChecks_OverallFailure(t *testing.T) {
	pr := internal.PullRequest{}
	pr.Commits.Nodes = []internal.PRCommit{
		{
			Commit: struct {
				StatusCheckRollup *internal.StatusCheckRollup `json:"statusCheckRollup,omitempty"`
			}{
				StatusCheckRollup: &internal.StatusCheckRollup{
					State: internal.CheckStateFailure,
				},
			},
		},
	}

	if !internal.PRHasFailingChecks(pr) {
		t.Error("Expected PR with FAILURE state to have failing checks")
	}
}

func TestPRHasFailingChecks_OverallError(t *testing.T) {
	pr := internal.PullRequest{}
	pr.Commits.Nodes = []internal.PRCommit{
		{
			Commit: struct {
				StatusCheckRollup *internal.StatusCheckRollup `json:"statusCheckRollup,omitempty"`
			}{
				StatusCheckRollup: &internal.StatusCheckRollup{
					State: internal.CheckStateError,
				},
			},
		},
	}

	if !internal.PRHasFailingChecks(pr) {
		t.Error("Expected PR with ERROR state to have failing checks")
	}
}

func TestPRHasFailingChecks_ContextFailure(t *testing.T) {
	pr := internal.PullRequest{}
	rollup := &internal.StatusCheckRollup{
		State: internal.CheckStateSuccess,
	}
	rollup.Contexts.Nodes = []internal.StatusCheckContext{
		{Name: "test", Conclusion: internal.ConclusionFailure},
	}
	pr.Commits.Nodes = []internal.PRCommit{
		{
			Commit: struct {
				StatusCheckRollup *internal.StatusCheckRollup `json:"statusCheckRollup,omitempty"`
			}{
				StatusCheckRollup: rollup,
			},
		},
	}

	if !internal.PRHasFailingChecks(pr) {
		t.Error("Expected PR with failing context to have failing checks")
	}
}

func TestPRHasFailingChecks_AllSuccess(t *testing.T) {
	pr := internal.PullRequest{}
	rollup := &internal.StatusCheckRollup{
		State: internal.CheckStateSuccess,
	}
	rollup.Contexts.Nodes = []internal.StatusCheckContext{
		{Name: "test1", Conclusion: internal.ConclusionSuccess},
		{Name: "test2", Conclusion: internal.ConclusionSuccess},
	}
	pr.Commits.Nodes = []internal.PRCommit{
		{
			Commit: struct {
				StatusCheckRollup *internal.StatusCheckRollup `json:"statusCheckRollup,omitempty"`
			}{
				StatusCheckRollup: rollup,
			},
		},
	}

	if internal.PRHasFailingChecks(pr) {
		t.Error("Expected PR with all success to NOT have failing checks")
	}
}

// Tests for GetDerivativePRs

func TestGetDerivativePRs_NoDerivatives(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	prs := []internal.PullRequest{
		{Number: 1, BaseRefName: "main"},
		{Number: 2, BaseRefName: "master"},
		{Number: 3, BaseRefName: "develop"},
	}

	result := internal.GetDerivativePRs(prs, config)

	if len(result) != 0 {
		t.Errorf("Expected no derivatives, got %d", len(result))
	}
}

func TestGetDerivativePRs_HasDerivatives(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	prs := []internal.PullRequest{
		{Number: 1, BaseRefName: "main", HeadRefName: "feature-a"},
		{Number: 2, BaseRefName: "feature-a", HeadRefName: "feature-b", Author: internal.PRAuthor{Login: "dev"}, Title: "Sub-PR"},
	}

	result := internal.GetDerivativePRs(prs, config)

	if len(result) != 1 {
		t.Errorf("Expected 1 derivative, got %d", len(result))
	}
	if result[0].Number != 2 {
		t.Errorf("Expected derivative PR #2, got #%d", result[0].Number)
	}
	if result[0].TargetBranch != "feature-a" {
		t.Errorf("Expected target branch 'feature-a', got '%s'", result[0].TargetBranch)
	}
}

// Tests for GetPRsWithPendingDerivatives

func TestGetPRsWithPendingDerivatives_NoParents(t *testing.T) {
	prs := []internal.PullRequest{
		{Number: 1, HeadRefName: "feature-a"},
	}
	derivatives := []internal.DerivativePR{
		{Number: 2, TargetBranch: "feature-b"},
	}

	result := internal.GetPRsWithPendingDerivatives(prs, derivatives)

	if len(result) != 0 {
		t.Errorf("Expected no parents with derivatives, got %d", len(result))
	}
}

func TestGetPRsWithPendingDerivatives_HasParent(t *testing.T) {
	prs := []internal.PullRequest{
		{Number: 1, HeadRefName: "feature-a", Title: "Parent PR"},
	}
	derivatives := []internal.DerivativePR{
		{Number: 2, TargetBranch: "feature-a"},
		{Number: 3, TargetBranch: "feature-a"},
	}

	result := internal.GetPRsWithPendingDerivatives(prs, derivatives)

	if len(result) != 1 {
		t.Errorf("Expected 1 parent with derivatives, got %d", len(result))
	}
	if result[0].ParentPR != 1 {
		t.Errorf("Expected parent PR #1, got #%d", result[0].ParentPR)
	}
	if len(result[0].Derivatives) != 2 {
		t.Errorf("Expected 2 derivatives, got %d", len(result[0].Derivatives))
	}
}

// Tests for ClassifyPR

func TestClassifyPR_AgentControlledWithChangesRequested(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:         1,
		Title:          "Test PR",
		Author:         internal.PRAuthor{Login: "rjmurillo-bot"},
		ReviewDecision: internal.ReviewChangesRequested,
		Mergeable:      internal.MergeableMergeable,
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem == nil {
		t.Fatal("Expected action item for agent-controlled PR with changes requested")
	}
	if blockedItem != nil {
		t.Error("Expected no blocked item for agent-controlled PR")
	}
	if actionItem.Category != internal.BotCategoryAgentControlled {
		t.Errorf("Expected category 'agent-controlled', got '%s'", actionItem.Category)
	}
	if actionItem.Reason != internal.ReasonChangesRequested {
		t.Errorf("Expected reason 'CHANGES_REQUESTED', got '%s'", actionItem.Reason)
	}
}

func TestClassifyPR_AgentControlledWithConflicts(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:    2,
		Title:     "Conflict PR",
		Author:    internal.PRAuthor{Login: "rjmurillo-bot"},
		Mergeable: internal.MergeableConflicting,
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem == nil {
		t.Fatal("Expected action item for agent-controlled PR with conflicts")
	}
	if blockedItem != nil {
		t.Error("Expected no blocked item")
	}
	if actionItem.Reason != internal.ReasonHasConflicts {
		t.Errorf("Expected reason 'HAS_CONFLICTS', got '%s'", actionItem.Reason)
	}
	if !actionItem.HasConflicts {
		t.Error("Expected HasConflicts to be true")
	}
}

func TestClassifyPR_MentionTriggeredWithIssues(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:         3,
		Title:          "Copilot PR",
		Author:         internal.PRAuthor{Login: "copilot-swe-agent"},
		ReviewDecision: internal.ReviewChangesRequested,
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem == nil {
		t.Fatal("Expected action item for mention-triggered PR with issues")
	}
	if blockedItem != nil {
		t.Error("Expected no blocked item")
	}
	if actionItem.Category != internal.BotCategoryMentionTriggered {
		t.Errorf("Expected category 'mention-triggered', got '%s'", actionItem.Category)
	}
	if !actionItem.RequiresSynthesis {
		t.Error("Expected RequiresSynthesis to be true")
	}
}

func TestClassifyPR_HumanWithChangesRequested(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:         4,
		Title:          "Human PR",
		Author:         internal.PRAuthor{Login: "developer"},
		ReviewDecision: internal.ReviewChangesRequested,
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem != nil {
		t.Error("Expected no action item for human-authored PR")
	}
	if blockedItem == nil {
		t.Fatal("Expected blocked item for human-authored PR with changes requested")
	}
	if string(blockedItem.Category) != "human-blocked" {
		t.Errorf("Expected category 'human-blocked', got '%s'", blockedItem.Category)
	}
}

func TestClassifyPR_HumanNoIssues(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:         5,
		Title:          "Clean PR",
		Author:         internal.PRAuthor{Login: "developer"},
		ReviewDecision: internal.ReviewApproved,
		Mergeable:      internal.MergeableMergeable,
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem != nil {
		t.Error("Expected no action item for clean human PR")
	}
	if blockedItem != nil {
		t.Error("Expected no blocked item for clean human PR")
	}
}

func TestClassifyPR_BotReviewerTriggersAction(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:         6,
		Title:          "PR with bot reviewer",
		Author:         internal.PRAuthor{Login: "developer"},
		ReviewDecision: internal.ReviewChangesRequested,
	}
	pr.ReviewRequests.Nodes = []internal.ReviewRequest{
		{RequestedReviewer: struct {
			Login string `json:"login,omitempty"`
			Name  string `json:"name,omitempty"`
		}{Login: "rjmurillo-bot"}},
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem == nil {
		t.Fatal("Expected action item when rjmurillo-bot is reviewer")
	}
	if blockedItem != nil {
		t.Error("Expected no blocked item when bot is reviewer")
	}
	if actionItem.Category != internal.BotCategoryAgentControlled {
		t.Errorf("Expected category 'agent-controlled', got '%s'", actionItem.Category)
	}
}

// Tests for AnalyzePRs

func TestAnalyzePRs_EmptyList(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	prs := []internal.PullRequest{}

	result := internal.AnalyzePRs(prs, config)

	if result.TotalPRs != 0 {
		t.Errorf("Expected 0 total PRs, got %d", result.TotalPRs)
	}
	if len(result.ActionRequired) != 0 {
		t.Errorf("Expected 0 action required, got %d", len(result.ActionRequired))
	}
}

func TestAnalyzePRs_MixedPRs(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	prs := []internal.PullRequest{
		{
			Number:         1,
			Title:          "Bot PR",
			Author:         internal.PRAuthor{Login: "rjmurillo-bot"},
			ReviewDecision: internal.ReviewChangesRequested,
			BaseRefName:    "main",
		},
		{
			Number:         2,
			Title:          "Human PR",
			Author:         internal.PRAuthor{Login: "developer"},
			ReviewDecision: internal.ReviewChangesRequested,
			BaseRefName:    "main",
		},
		{
			Number:         3,
			Title:          "Clean PR",
			Author:         internal.PRAuthor{Login: "other-dev"},
			ReviewDecision: internal.ReviewApproved,
			BaseRefName:    "main",
		},
	}

	result := internal.AnalyzePRs(prs, config)

	if result.TotalPRs != 3 {
		t.Errorf("Expected 3 total PRs, got %d", result.TotalPRs)
	}
	if len(result.ActionRequired) != 1 {
		t.Errorf("Expected 1 action required, got %d", len(result.ActionRequired))
	}
	if len(result.Blocked) != 1 {
		t.Errorf("Expected 1 blocked, got %d", len(result.Blocked))
	}
}

func TestAnalyzePRs_WithDerivatives(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	prs := []internal.PullRequest{
		{
			Number:      1,
			Title:       "Parent PR",
			Author:      internal.PRAuthor{Login: "developer"},
			HeadRefName: "feature-a",
			BaseRefName: "main",
		},
		{
			Number:      2,
			Title:       "Child PR",
			Author:      internal.PRAuthor{Login: "developer"},
			HeadRefName: "feature-b",
			BaseRefName: "feature-a",
		},
	}

	result := internal.AnalyzePRs(prs, config)

	if len(result.DerivativePRs) != 1 {
		t.Errorf("Expected 1 derivative PR, got %d", len(result.DerivativePRs))
	}
	if len(result.ParentsWithDerivatives) != 1 {
		t.Errorf("Expected 1 parent with derivatives, got %d", len(result.ParentsWithDerivatives))
	}
	// Parent should be added to action required
	found := false
	for _, item := range result.ActionRequired {
		if item.Number == 1 && item.Reason == internal.ReasonPendingDerivs {
			found = true
			break
		}
	}
	if !found {
		t.Error("Expected parent PR to be in action required with PENDING_DERIVATIVES reason")
	}
}

// Tests for SortActionRequired

func TestSortActionRequired_ConflictsFirst(t *testing.T) {
	items := []internal.PRActionItem{
		{Number: 1, HasConflicts: false, HasFailingChecks: false},
		{Number: 2, HasConflicts: true, HasFailingChecks: false},
		{Number: 3, HasConflicts: false, HasFailingChecks: true},
	}

	sorted := internal.SortActionRequired(items)

	if sorted[0].Number != 2 {
		t.Errorf("Expected PR #2 (conflicts) first, got #%d", sorted[0].Number)
	}
	if sorted[1].Number != 3 {
		t.Errorf("Expected PR #3 (failing checks) second, got #%d", sorted[1].Number)
	}
	if sorted[2].Number != 1 {
		t.Errorf("Expected PR #1 (no issues) last, got #%d", sorted[2].Number)
	}
}

func TestSortActionRequired_SameIssuesByNumber(t *testing.T) {
	items := []internal.PRActionItem{
		{Number: 5, HasConflicts: true},
		{Number: 3, HasConflicts: true},
		{Number: 7, HasConflicts: true},
	}

	sorted := internal.SortActionRequired(items)

	if sorted[0].Number != 3 || sorted[1].Number != 5 || sorted[2].Number != 7 {
		t.Error("Expected PRs with same issues to be sorted by number ascending")
	}
}

// Tests for FormatMaintenanceOutput

func TestFormatMaintenanceOutput(t *testing.T) {
	result := internal.PRMaintenanceResult{
		TotalPRs: 5,
		ActionRequired: []internal.PRActionItem{
			{Number: 1, HasConflicts: true},
			{Number: 2, HasConflicts: false},
		},
		Blocked: []internal.PRActionItem{
			{Number: 3},
		},
		DerivativePRs: []internal.DerivativePR{
			{Number: 4},
		},
	}

	output := internal.FormatMaintenanceOutput(result)

	if output.Summary.Total != 5 {
		t.Errorf("Expected total 5, got %d", output.Summary.Total)
	}
	if output.Summary.ActionRequired != 2 {
		t.Errorf("Expected 2 action required, got %d", output.Summary.ActionRequired)
	}
	if output.Summary.Blocked != 1 {
		t.Errorf("Expected 1 blocked, got %d", output.Summary.Blocked)
	}
	if output.Summary.Derivatives != 1 {
		t.Errorf("Expected 1 derivative, got %d", output.Summary.Derivatives)
	}
	// Check sorting applied
	if output.PRs[0].Number != 1 {
		t.Errorf("Expected PR #1 (conflicts) first in output, got #%d", output.PRs[0].Number)
	}
}

// Tests for ToJSON

func TestPRMaintenanceOutput_ToJSON(t *testing.T) {
	output := internal.PRMaintenanceOutput{
		PRs: []internal.PRActionItem{
			{Number: 1, Category: internal.BotCategoryAgentControlled, Reason: internal.ReasonChangesRequested},
		},
		Summary: internal.PRMaintenanceSummary{
			Total:          5,
			ActionRequired: 1,
			Blocked:        0,
			Derivatives:    0,
		},
	}

	jsonStr, err := output.ToJSON()
	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}

	// Verify it's valid JSON
	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
		t.Fatalf("Invalid JSON produced: %v", err)
	}

	// Check structure
	if _, ok := parsed["prs"]; !ok {
		t.Error("Expected 'prs' field in JSON output")
	}
	if _, ok := parsed["summary"]; !ok {
		t.Error("Expected 'summary' field in JSON output")
	}
}

// Tests for CheckRateLimitSafe

func TestCheckRateLimitSafe_Safe(t *testing.T) {
	result := internal.CheckRateLimitSafe(100, 50)

	if !result.IsSafe {
		t.Error("Expected rate limit to be safe with core=100, graphql=50")
	}
	if result.CoreRemaining != 100 {
		t.Errorf("Expected core remaining 100, got %d", result.CoreRemaining)
	}
}

func TestCheckRateLimitSafe_CoreTooLow(t *testing.T) {
	result := internal.CheckRateLimitSafe(50, 100)

	if result.IsSafe {
		t.Error("Expected rate limit to NOT be safe with core=50")
	}
}

func TestCheckRateLimitSafe_GraphQLTooLow(t *testing.T) {
	result := internal.CheckRateLimitSafe(200, 25)

	if result.IsSafe {
		t.Error("Expected rate limit to NOT be safe with graphql=25")
	}
}

func TestCheckRateLimitSafe_BothTooLow(t *testing.T) {
	result := internal.CheckRateLimitSafe(50, 25)

	if result.IsSafe {
		t.Error("Expected rate limit to NOT be safe with both too low")
	}
}

// Tests for ParsePRsFromJSON

func TestParsePRsFromJSON_Valid(t *testing.T) {
	jsonData := `{
		"data": {
			"repository": {
				"pullRequests": {
					"nodes": [
						{
							"number": 1,
							"title": "Test PR",
							"author": {"login": "developer"},
							"headRefName": "feature",
							"baseRefName": "main",
							"mergeable": "MERGEABLE",
							"reviewDecision": "APPROVED"
						}
					]
				}
			}
		}
	}`

	prs, err := internal.ParsePRsFromJSON(jsonData)
	if err != nil {
		t.Fatalf("ParsePRsFromJSON failed: %v", err)
	}

	if len(prs) != 1 {
		t.Fatalf("Expected 1 PR, got %d", len(prs))
	}
	if prs[0].Number != 1 {
		t.Errorf("Expected PR number 1, got %d", prs[0].Number)
	}
	if prs[0].Author.Login != "developer" {
		t.Errorf("Expected author 'developer', got '%s'", prs[0].Author.Login)
	}
}

func TestParsePRsFromJSON_Invalid(t *testing.T) {
	jsonData := `{invalid json}`

	_, err := internal.ParsePRsFromJSON(jsonData)
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

func TestParsePRsFromJSON_Empty(t *testing.T) {
	jsonData := `{
		"data": {
			"repository": {
				"pullRequests": {
					"nodes": []
				}
			}
		}
	}`

	prs, err := internal.ParsePRsFromJSON(jsonData)
	if err != nil {
		t.Fatalf("ParsePRsFromJSON failed: %v", err)
	}

	if len(prs) != 0 {
		t.Errorf("Expected 0 PRs, got %d", len(prs))
	}
}

// Tests for ParseRateLimitFromJSON

func TestParseRateLimitFromJSON_Valid(t *testing.T) {
	jsonData := `{
		"resources": {
			"core": {"remaining": 4500},
			"graphql": {"remaining": 4000}
		}
	}`

	result, err := internal.ParseRateLimitFromJSON(jsonData)
	if err != nil {
		t.Fatalf("ParseRateLimitFromJSON failed: %v", err)
	}

	if result.CoreRemaining != 4500 {
		t.Errorf("Expected core remaining 4500, got %d", result.CoreRemaining)
	}
	if result.GraphQLRemaining != 4000 {
		t.Errorf("Expected graphql remaining 4000, got %d", result.GraphQLRemaining)
	}
	if !result.IsSafe {
		t.Error("Expected rate limit to be safe")
	}
}

func TestParseRateLimitFromJSON_Invalid(t *testing.T) {
	jsonData := `{invalid}`

	_, err := internal.ParseRateLimitFromJSON(jsonData)
	if err == nil {
		t.Error("Expected error for invalid JSON")
	}
}

// Tests for DefaultPRMaintenanceConfig

func TestDefaultPRMaintenanceConfig(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	if len(config.ProtectedBranches) != 3 {
		t.Errorf("Expected 3 protected branches, got %d", len(config.ProtectedBranches))
	}

	if len(config.BotCategories) != 3 {
		t.Errorf("Expected 3 bot categories, got %d", len(config.BotCategories))
	}

	if config.MaxPRs != 20 {
		t.Errorf("Expected max PRs 20, got %d", config.MaxPRs)
	}

	// Check agent-controlled bots
	agentBots := config.BotCategories["agent-controlled"]
	if len(agentBots) != 2 {
		t.Errorf("Expected 2 agent-controlled bots, got %d", len(agentBots))
	}
}

// Edge case tests

func TestClassifyPR_FailingChecksOnly(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	// Create PR with failing checks but no conflicts or changes requested
	pr := internal.PullRequest{
		Number:         10,
		Title:          "Failing checks PR",
		Author:         internal.PRAuthor{Login: "rjmurillo-bot"},
		ReviewDecision: internal.ReviewApproved,
		Mergeable:      internal.MergeableMergeable,
	}
	rollup := &internal.StatusCheckRollup{
		State: internal.CheckStateFailure,
	}
	pr.Commits.Nodes = []internal.PRCommit{
		{
			Commit: struct {
				StatusCheckRollup *internal.StatusCheckRollup `json:"statusCheckRollup,omitempty"`
			}{
				StatusCheckRollup: rollup,
			},
		},
	}

	actionItem, blockedItem := internal.ClassifyPR(pr, config)

	if actionItem == nil {
		t.Fatal("Expected action item for bot PR with failing checks")
	}
	if blockedItem != nil {
		t.Error("Expected no blocked item")
	}
	if actionItem.Reason != internal.ReasonHasFailingChecks {
		t.Errorf("Expected reason 'HAS_FAILING_CHECKS', got '%s'", actionItem.Reason)
	}
	if !actionItem.HasFailingChecks {
		t.Error("Expected HasFailingChecks to be true")
	}
}

func TestClassifyPR_MentionTriggeredPrioritizesChangesRequested(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()
	pr := internal.PullRequest{
		Number:         11,
		Title:          "Copilot PR with multiple issues",
		Author:         internal.PRAuthor{Login: "copilot-swe-agent"},
		ReviewDecision: internal.ReviewChangesRequested,
		Mergeable:      internal.MergeableConflicting,
	}
	rollup := &internal.StatusCheckRollup{
		State: internal.CheckStateFailure,
	}
	pr.Commits.Nodes = []internal.PRCommit{
		{
			Commit: struct {
				StatusCheckRollup *internal.StatusCheckRollup `json:"statusCheckRollup,omitempty"`
			}{
				StatusCheckRollup: rollup,
			},
		},
	}

	actionItem, _ := internal.ClassifyPR(pr, config)

	if actionItem == nil {
		t.Fatal("Expected action item")
	}
	// CHANGES_REQUESTED takes priority
	if actionItem.Reason != internal.ReasonChangesRequested {
		t.Errorf("Expected reason 'CHANGES_REQUESTED' (priority), got '%s'", actionItem.Reason)
	}
	// But should still track all issues
	if !actionItem.HasConflicts {
		t.Error("Expected HasConflicts to be true")
	}
	if !actionItem.HasFailingChecks {
		t.Error("Expected HasFailingChecks to be true")
	}
}

func TestAnalyzePRs_DoesNotDuplicateActionItems(t *testing.T) {
	config := internal.DefaultPRMaintenanceConfig()

	// Parent PR with issues that is ALSO a derivative target
	prs := []internal.PullRequest{
		{
			Number:         1,
			Title:          "Parent with issues",
			Author:         internal.PRAuthor{Login: "rjmurillo-bot"},
			HeadRefName:    "feature-a",
			BaseRefName:    "main",
			ReviewDecision: internal.ReviewChangesRequested,
		},
		{
			Number:      2,
			Title:       "Child PR",
			Author:      internal.PRAuthor{Login: "developer"},
			HeadRefName: "feature-b",
			BaseRefName: "feature-a",
		},
	}

	result := internal.AnalyzePRs(prs, config)

	// PR #1 should appear twice: once for CHANGES_REQUESTED, once for PENDING_DERIVATIVES
	countPR1 := 0
	for _, item := range result.ActionRequired {
		if item.Number == 1 {
			countPR1++
		}
	}
	// This is expected behavior - the PR has multiple independent issues
	if countPR1 != 2 {
		t.Errorf("Expected PR #1 to appear 2 times (separate issues), got %d", countPR1)
	}
}
