package internal

import (
	"encoding/json"
	"regexp"
	"sort"
	"strings"
)

// PRMaintenanceConfig holds configuration for PR maintenance.
type PRMaintenanceConfig struct {
	ProtectedBranches []string            `json:"protectedBranches"`
	BotCategories     map[string][]string `json:"botCategories"`
	MaxPRs            int                 `json:"maxPRs"`
}

// DefaultPRMaintenanceConfig returns the default configuration.
func DefaultPRMaintenanceConfig() PRMaintenanceConfig {
	return PRMaintenanceConfig{
		ProtectedBranches: []string{"main", "master", "develop"},
		BotCategories: map[string][]string{
			"agent-controlled":  {"rjmurillo-bot", "rjmurillo[bot]"},
			"mention-triggered": {"copilot-swe-agent", "copilot-swe-agent[bot]", "copilot", "app/copilot-swe-agent"},
			"review-bot":        {"coderabbitai", "coderabbitai[bot]", "cursor[bot]", "gemini-code-assist", "gemini-code-assist[bot]"},
		},
		MaxPRs: 20,
	}
}

// BotCategory represents the classification of a bot author.
type BotCategory string

const (
	BotCategoryAgentControlled  BotCategory = "agent-controlled"
	BotCategoryMentionTriggered BotCategory = "mention-triggered"
	BotCategoryReviewBot        BotCategory = "review-bot"
	BotCategoryHuman            BotCategory = "human"
)

// PRActionReason represents why a PR requires action.
type PRActionReason string

const (
	ReasonChangesRequested PRActionReason = "CHANGES_REQUESTED"
	ReasonHasConflicts     PRActionReason = "HAS_CONFLICTS"
	ReasonHasFailingChecks PRActionReason = "HAS_FAILING_CHECKS"
	ReasonPendingDerivs    PRActionReason = "PENDING_DERIVATIVES"
	ReasonMention          PRActionReason = "MENTION"
)

// MergeableState represents the mergeable state of a PR.
type MergeableState string

const (
	MergeableMergeable   MergeableState = "MERGEABLE"
	MergeableConflicting MergeableState = "CONFLICTING"
	MergeableUnknown     MergeableState = "UNKNOWN"
)

// ReviewDecision represents the review decision on a PR.
type ReviewDecision string

const (
	ReviewApproved         ReviewDecision = "APPROVED"
	ReviewChangesRequested ReviewDecision = "CHANGES_REQUESTED"
	ReviewReviewRequired   ReviewDecision = "REVIEW_REQUIRED"
)

// CheckState represents the state of a status check.
type CheckState string

const (
	CheckStateSuccess CheckState = "SUCCESS"
	CheckStateFailure CheckState = "FAILURE"
	CheckStateError   CheckState = "ERROR"
	CheckStatePending CheckState = "PENDING"
)

// CheckConclusion represents the conclusion of a check run.
type CheckConclusion string

const (
	ConclusionSuccess CheckConclusion = "SUCCESS"
	ConclusionFailure CheckConclusion = "FAILURE"
	ConclusionNeutral CheckConclusion = "NEUTRAL"
	ConclusionSkipped CheckConclusion = "SKIPPED"
)

// PRAuthor represents the author of a PR.
type PRAuthor struct {
	Login string `json:"login"`
}

// ReviewRequest represents a review request on a PR.
type ReviewRequest struct {
	RequestedReviewer struct {
		Login string `json:"login,omitempty"`
		Name  string `json:"name,omitempty"`
	} `json:"requestedReviewer"`
}

// StatusCheckContext represents a status check context.
type StatusCheckContext struct {
	Name       string          `json:"name,omitempty"`
	Context    string          `json:"context,omitempty"`
	Conclusion CheckConclusion `json:"conclusion,omitempty"`
	Status     string          `json:"status,omitempty"`
	State      CheckState      `json:"state,omitempty"`
}

// StatusCheckRollup represents the status check rollup.
type StatusCheckRollup struct {
	State    CheckState `json:"state"`
	Contexts struct {
		Nodes []StatusCheckContext `json:"nodes"`
	} `json:"contexts"`
}

// PRCommit represents a commit in a PR.
type PRCommit struct {
	Commit struct {
		StatusCheckRollup *StatusCheckRollup `json:"statusCheckRollup,omitempty"`
	} `json:"commit"`
}

// PullRequest represents a GitHub pull request.
type PullRequest struct {
	Number         int            `json:"number"`
	Title          string         `json:"title"`
	Author         PRAuthor       `json:"author"`
	HeadRefName    string         `json:"headRefName"`
	BaseRefName    string         `json:"baseRefName"`
	Mergeable      MergeableState `json:"mergeable"`
	ReviewDecision ReviewDecision `json:"reviewDecision"`
	ReviewRequests struct {
		Nodes []ReviewRequest `json:"nodes"`
	} `json:"reviewRequests"`
	Commits struct {
		Nodes []PRCommit `json:"nodes"`
	} `json:"commits"`
}

// BotAuthorInfo contains information about whether an author is a bot.
type BotAuthorInfo struct {
	IsBot    bool        `json:"isBot"`
	Category BotCategory `json:"category"`
	Name     string      `json:"name"`
}

// PRActionItem represents a PR that requires action.
type PRActionItem struct {
	Number            int            `json:"number"`
	Category          BotCategory    `json:"category"`
	HasConflicts      bool           `json:"hasConflicts"`
	HasFailingChecks  bool           `json:"hasFailingChecks,omitempty"`
	Reason            PRActionReason `json:"reason"`
	Author            string         `json:"author"`
	Title             string         `json:"title"`
	HeadRefName       string         `json:"headRefName,omitempty"`
	BaseRefName       string         `json:"baseRefName,omitempty"`
	RequiresSynthesis bool           `json:"requiresSynthesis,omitempty"`
	Derivatives       []int          `json:"derivatives,omitempty"`
}

// DerivativePR represents a PR that targets a non-protected branch.
type DerivativePR struct {
	Number       int    `json:"number"`
	Title        string `json:"title"`
	Author       string `json:"author"`
	TargetBranch string `json:"targetBranch"`
	SourceBranch string `json:"sourceBranch"`
}

// ParentWithDerivatives represents a parent PR with pending derivatives.
type ParentWithDerivatives struct {
	ParentPR     int    `json:"parentPR"`
	ParentTitle  string `json:"parentTitle"`
	ParentBranch string `json:"parentBranch"`
	Derivatives  []int  `json:"derivatives"`
}

// PRMaintenanceResult contains the results of PR maintenance analysis.
type PRMaintenanceResult struct {
	TotalPRs               int                     `json:"totalPRs"`
	ActionRequired         []PRActionItem          `json:"actionRequired"`
	Blocked                []PRActionItem          `json:"blocked"`
	DerivativePRs          []DerivativePR          `json:"derivativePRs"`
	ParentsWithDerivatives []ParentWithDerivatives `json:"parentsWithDerivatives"`
	Errors                 []PRError               `json:"errors,omitempty"`
}

// PRError represents an error during PR processing.
type PRError struct {
	PR    int    `json:"pr"`
	Error string `json:"error"`
}

// PRMaintenanceOutput represents the JSON output for workflow consumption.
type PRMaintenanceOutput struct {
	PRs     []PRActionItem       `json:"prs"`
	Summary PRMaintenanceSummary `json:"summary"`
}

// PRMaintenanceSummary contains summary statistics.
type PRMaintenanceSummary struct {
	Total          int `json:"total"`
	ActionRequired int `json:"actionRequired"`
	Blocked        int `json:"blocked"`
	Derivatives    int `json:"derivatives"`
}

// RateLimitInfo represents GitHub API rate limit information.
type RateLimitInfo struct {
	CoreRemaining    int  `json:"coreRemaining"`
	GraphQLRemaining int  `json:"graphqlRemaining"`
	IsSafe           bool `json:"isSafe"`
}

// GetBotAuthorInfo determines if an author is a bot and its category.
func GetBotAuthorInfo(authorLogin string, config PRMaintenanceConfig) BotAuthorInfo {
	for category, bots := range config.BotCategories {
		for _, bot := range bots {
			if strings.EqualFold(authorLogin, bot) {
				return BotAuthorInfo{
					IsBot:    true,
					Category: BotCategory(category),
					Name:     authorLogin,
				}
			}
			// Check if author starts with bot name (for app/copilot-swe-agent pattern)
			pattern := regexp.MustCompile(`(?i)^` + regexp.QuoteMeta(bot))
			if pattern.MatchString(authorLogin) {
				return BotAuthorInfo{
					IsBot:    true,
					Category: BotCategory(category),
					Name:     authorLogin,
				}
			}
		}
	}
	return BotAuthorInfo{
		IsBot:    false,
		Category: BotCategoryHuman,
		Name:     authorLogin,
	}
}

// IsBotReviewer checks if any reviewer is an agent-controlled bot.
func IsBotReviewer(reviewRequests []ReviewRequest, config PRMaintenanceConfig) bool {
	for _, request := range reviewRequests {
		login := request.RequestedReviewer.Login
		if login == "" {
			continue
		}
		botInfo := GetBotAuthorInfo(login, config)
		if botInfo.IsBot && botInfo.Category == BotCategoryAgentControlled {
			return true
		}
	}
	return false
}

// PRHasConflicts checks if a PR has merge conflicts.
func PRHasConflicts(pr PullRequest) bool {
	return pr.Mergeable == MergeableConflicting
}

// PRHasFailingChecks checks if a PR has failing CI checks.
func PRHasFailingChecks(pr PullRequest) bool {
	if len(pr.Commits.Nodes) == 0 {
		return false
	}
	commit := pr.Commits.Nodes[0]
	if commit.Commit.StatusCheckRollup == nil {
		return false
	}
	rollup := commit.Commit.StatusCheckRollup

	// Check overall state
	if rollup.State == CheckStateFailure || rollup.State == CheckStateError {
		return true
	}

	// Check individual contexts
	for _, ctx := range rollup.Contexts.Nodes {
		if ctx.Conclusion == ConclusionFailure || ctx.State == CheckStateFailure {
			return true
		}
	}
	return false
}

// GetDerivativePRs identifies PRs that target non-protected branches.
func GetDerivativePRs(prs []PullRequest, config PRMaintenanceConfig) []DerivativePR {
	var derivatives []DerivativePR
	protectedSet := make(map[string]bool)
	for _, b := range config.ProtectedBranches {
		protectedSet[b] = true
	}

	for _, pr := range prs {
		if !protectedSet[pr.BaseRefName] {
			derivatives = append(derivatives, DerivativePR{
				Number:       pr.Number,
				Title:        pr.Title,
				Author:       pr.Author.Login,
				TargetBranch: pr.BaseRefName,
				SourceBranch: pr.HeadRefName,
			})
		}
	}
	return derivatives
}

// GetPRsWithPendingDerivatives finds parent PRs that have pending derivative PRs.
func GetPRsWithPendingDerivatives(prs []PullRequest, derivatives []DerivativePR) []ParentWithDerivatives {
	// Map headRefName to PR for quick lookup
	branchToPR := make(map[string]PullRequest)
	for _, pr := range prs {
		branchToPR[pr.HeadRefName] = pr
	}

	// Group derivatives by parent
	parentMap := make(map[int]*ParentWithDerivatives)
	for _, d := range derivatives {
		parentPR, exists := branchToPR[d.TargetBranch]
		if !exists {
			continue
		}
		if existing, ok := parentMap[parentPR.Number]; ok {
			existing.Derivatives = append(existing.Derivatives, d.Number)
		} else {
			parentMap[parentPR.Number] = &ParentWithDerivatives{
				ParentPR:     parentPR.Number,
				ParentTitle:  parentPR.Title,
				ParentBranch: parentPR.HeadRefName,
				Derivatives:  []int{d.Number},
			}
		}
	}

	var result []ParentWithDerivatives
	for _, p := range parentMap {
		result = append(result, *p)
	}
	return result
}

// ClassifyPR classifies a single PR and returns action items.
func ClassifyPR(pr PullRequest, config PRMaintenanceConfig) (actionItem *PRActionItem, blockedItem *PRActionItem) {
	authorLogin := pr.Author.Login
	botInfo := GetBotAuthorInfo(authorLogin, config)
	isAgentControlledBot := botInfo.IsBot && botInfo.Category == BotCategoryAgentControlled
	isMentionTriggeredBot := botInfo.IsBot && botInfo.Category == BotCategoryMentionTriggered
	isBotReviewer := IsBotReviewer(pr.ReviewRequests.Nodes, config)
	hasChangesRequested := pr.ReviewDecision == ReviewChangesRequested
	hasConflicts := PRHasConflicts(pr)
	hasFailingChecks := PRHasFailingChecks(pr)

	// Priority 1: Agent-controlled bot as author or reviewer
	if isAgentControlledBot || isBotReviewer {
		if hasChangesRequested {
			return &PRActionItem{
				Number:           pr.Number,
				Category:         BotCategoryAgentControlled,
				HasConflicts:     hasConflicts,
				HasFailingChecks: hasFailingChecks,
				Reason:           ReasonChangesRequested,
				Author:           authorLogin,
				Title:            pr.Title,
				HeadRefName:      pr.HeadRefName,
				BaseRefName:      pr.BaseRefName,
			}, nil
		}
		if hasConflicts {
			return &PRActionItem{
				Number:           pr.Number,
				Category:         BotCategoryAgentControlled,
				HasConflicts:     true,
				HasFailingChecks: hasFailingChecks,
				Reason:           ReasonHasConflicts,
				Author:           authorLogin,
				Title:            pr.Title,
				HeadRefName:      pr.HeadRefName,
				BaseRefName:      pr.BaseRefName,
			}, nil
		}
		if hasFailingChecks {
			return &PRActionItem{
				Number:           pr.Number,
				Category:         BotCategoryAgentControlled,
				HasConflicts:     false,
				HasFailingChecks: true,
				Reason:           ReasonHasFailingChecks,
				Author:           authorLogin,
				Title:            pr.Title,
				HeadRefName:      pr.HeadRefName,
				BaseRefName:      pr.BaseRefName,
			}, nil
		}
		return nil, nil
	}

	// Priority 2: Mention-triggered bot (copilot-swe-agent)
	if isMentionTriggeredBot {
		if hasChangesRequested || hasConflicts || hasFailingChecks {
			reason := ReasonChangesRequested
			if !hasChangesRequested && hasConflicts {
				reason = ReasonHasConflicts
			} else if !hasChangesRequested && !hasConflicts && hasFailingChecks {
				reason = ReasonHasFailingChecks
			}
			return &PRActionItem{
				Number:            pr.Number,
				Category:          BotCategoryMentionTriggered,
				HasConflicts:      hasConflicts,
				HasFailingChecks:  hasFailingChecks,
				Reason:            reason,
				Author:            authorLogin,
				Title:             pr.Title,
				HeadRefName:       pr.HeadRefName,
				BaseRefName:       pr.BaseRefName,
				RequiresSynthesis: true,
			}, nil
		}
		return nil, nil
	}

	// Priority 3: Human-authored PRs (blocked)
	if hasChangesRequested {
		return nil, &PRActionItem{
			Number:       pr.Number,
			Category:     BotCategory("human-blocked"),
			HasConflicts: hasConflicts,
			Reason:       ReasonChangesRequested,
			Author:       authorLogin,
			Title:        pr.Title,
		}
	}
	if hasConflicts {
		return nil, &PRActionItem{
			Number:       pr.Number,
			Category:     BotCategory("human-blocked"),
			HasConflicts: true,
			Reason:       ReasonHasConflicts,
			Author:       authorLogin,
			Title:        pr.Title,
		}
	}
	if hasFailingChecks {
		return nil, &PRActionItem{
			Number:           pr.Number,
			Category:         BotCategory("human-blocked"),
			HasConflicts:     false,
			HasFailingChecks: true,
			Reason:           ReasonHasFailingChecks,
			Author:           authorLogin,
			Title:            pr.Title,
		}
	}
	return nil, nil
}

// AnalyzePRs performs PR maintenance analysis on a list of PRs.
func AnalyzePRs(prs []PullRequest, config PRMaintenanceConfig) PRMaintenanceResult {
	result := PRMaintenanceResult{
		TotalPRs:               len(prs),
		ActionRequired:         []PRActionItem{},
		Blocked:                []PRActionItem{},
		DerivativePRs:          []DerivativePR{},
		ParentsWithDerivatives: []ParentWithDerivatives{},
		Errors:                 []PRError{},
	}

	// Detect derivative PRs
	derivatives := GetDerivativePRs(prs, config)
	result.DerivativePRs = derivatives

	if len(derivatives) > 0 {
		parentsWithDerivatives := GetPRsWithPendingDerivatives(prs, derivatives)
		result.ParentsWithDerivatives = parentsWithDerivatives

		for _, p := range parentsWithDerivatives {
			result.ActionRequired = append(result.ActionRequired, PRActionItem{
				Number:       p.ParentPR,
				Category:     BotCategory("has-derivatives"),
				HasConflicts: false,
				Reason:       ReasonPendingDerivs,
				Author:       "N/A",
				Title:        p.ParentTitle,
				Derivatives:  p.Derivatives,
			})
		}
	}

	// Classify each PR
	for _, pr := range prs {
		actionItem, blockedItem := ClassifyPR(pr, config)
		if actionItem != nil {
			result.ActionRequired = append(result.ActionRequired, *actionItem)
		}
		if blockedItem != nil {
			result.Blocked = append(result.Blocked, *blockedItem)
		}
	}

	return result
}

// SortActionRequired sorts action required PRs by priority.
// Conflicts first, then failing checks, then by PR number.
func SortActionRequired(items []PRActionItem) []PRActionItem {
	sorted := make([]PRActionItem, len(items))
	copy(sorted, items)
	sort.Slice(sorted, func(i, j int) bool {
		// Conflicts have highest priority
		if sorted[i].HasConflicts != sorted[j].HasConflicts {
			return sorted[i].HasConflicts
		}
		// Failing checks next
		if sorted[i].HasFailingChecks != sorted[j].HasFailingChecks {
			return sorted[i].HasFailingChecks
		}
		// Then by PR number ascending
		return sorted[i].Number < sorted[j].Number
	})
	return sorted
}

// FormatMaintenanceOutput formats the result for workflow consumption.
func FormatMaintenanceOutput(result PRMaintenanceResult) PRMaintenanceOutput {
	sortedPRs := SortActionRequired(result.ActionRequired)
	return PRMaintenanceOutput{
		PRs: sortedPRs,
		Summary: PRMaintenanceSummary{
			Total:          result.TotalPRs,
			ActionRequired: len(result.ActionRequired),
			Blocked:        len(result.Blocked),
			Derivatives:    len(result.DerivativePRs),
		},
	}
}

// ToJSON converts the output to JSON string.
func (o PRMaintenanceOutput) ToJSON() (string, error) {
	bytes, err := json.Marshal(o)
	if err != nil {
		return "", err
	}
	return string(bytes), nil
}

// CheckRateLimitSafe determines if API rate limits are sufficient.
// Returns true if core >= 100 and graphql >= 50.
func CheckRateLimitSafe(coreRemaining, graphqlRemaining int) RateLimitInfo {
	isSafe := coreRemaining >= 100 && graphqlRemaining >= 50
	return RateLimitInfo{
		CoreRemaining:    coreRemaining,
		GraphQLRemaining: graphqlRemaining,
		IsSafe:           isSafe,
	}
}

// ParsePRsFromJSON parses PR data from GitHub GraphQL API response.
func ParsePRsFromJSON(jsonData string) ([]PullRequest, error) {
	var response struct {
		Data struct {
			Repository struct {
				PullRequests struct {
					Nodes []PullRequest `json:"nodes"`
				} `json:"pullRequests"`
			} `json:"repository"`
		} `json:"data"`
	}
	if err := json.Unmarshal([]byte(jsonData), &response); err != nil {
		return nil, err
	}
	return response.Data.Repository.PullRequests.Nodes, nil
}

// ParseRateLimitFromJSON parses rate limit data from GitHub API response.
func ParseRateLimitFromJSON(jsonData string) (RateLimitInfo, error) {
	var response struct {
		Resources struct {
			Core struct {
				Remaining int `json:"remaining"`
			} `json:"core"`
			GraphQL struct {
				Remaining int `json:"remaining"`
			} `json:"graphql"`
		} `json:"resources"`
	}
	if err := json.Unmarshal([]byte(jsonData), &response); err != nil {
		return RateLimitInfo{}, err
	}
	return CheckRateLimitSafe(
		response.Resources.Core.Remaining,
		response.Resources.GraphQL.Remaining,
	), nil
}
