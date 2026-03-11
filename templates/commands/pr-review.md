---
allowed-tools: Bash(git:*), Bash(gh:*), Agent, Skill, Read, Write, Edit, Glob, Grep
argument-hint: <PR_NUMBERS> [--parallel] [--cleanup] [--dry-run]
description: Use when responding to PR review comments for specified pull request(s)
---

# PR Review Command

> **Note**: This command uses extended thinking (`ultrathink`) for deep PR analysis.

ultrathink

Respond to PR review comments for the specified pull request(s): $ARGUMENTS

## Context

- Current branch: !`git branch --show-current`
- Repository: !`gh repo view --json nameWithOwner -q '.nameWithOwner'`
- Authenticated as: !`gh api user -q '.login'`

## Arguments

Parse the input: `$ARGUMENTS`

| Argument | Description | Default |
|----------|-------------|---------|
| `PR_NUMBERS` | Comma-separated PR numbers (e.g., `53,141,143`) or `all-open` | Required |
| `--parallel` | Use git worktrees for parallel execution | false |
| `--cleanup` | Clean up worktrees after completion | true |
| `--dry-run` | Preview planned actions without executing (JSON output) | false |

## Workflow

### Dry-Run Mode (--dry-run)

When `--dry-run` is specified, the command gathers all planned actions without executing any GitHub mutations.

**What happens in dry-run mode:**

1. Parse and validate PR numbers (same as normal)
2. Gather PR context, comments, and check status (read-only API calls)
3. Analyze what actions would be taken
4. Output planned actions as JSON to stdout

**What does NOT happen in dry-run mode:**

- No comments are posted
- No reactions are added
- No labels are applied
- No threads are resolved
- No commits are made
- No git push operations

**JSON Output Format:**

```json
{
  "dry_run": true,
  "timestamp": "2026-01-19T12:00:00Z",
  "prs": [
    {
      "number": 123,
      "branch": "feat/example",
      "state": "OPEN",
      "mergeable": "MERGEABLE",
      "planned_actions": {
        "comments_to_post": [
          {
            "thread_id": "PRRT_xxx",
            "reply_body": "Addressed in commit abc1234",
            "resolve_thread": true
          }
        ],
        "reactions_to_add": [
          {
            "comment_id": "IC_abc123",
            "reaction": "eyes"
          }
        ],
        "labels_to_apply": ["needs-review"],
        "status_updates": [
          {
            "action": "resolve_thread",
            "thread_id": "PRRT_yyy"
          }
        ]
      },
      "unaddressed_comments": [
        {
          "id": "IC_abc123",
          "author": "reviewer",
          "body": "Please fix this issue",
          "domain": "Bug",
          "priority": "P1"
        }
      ],
      "failing_checks": [
        {
          "name": "AI Quality Gate",
          "conclusion": "FAILURE",
          "suggested_action": "Address code quality findings"
        }
      ]
    }
  ],
  "summary": {
    "total_prs": 1,
    "total_comments_to_address": 3,
    "total_planned_replies": 2,
    "total_threads_to_resolve": 2
  }
}
```

**Dry-run workflow:**

```bash
# Step 1: Parse PR numbers (same as normal)
# Step 2: For each PR, gather read-only context

for pr in pr_numbers; do
    # Get PR context (read-only)
    context=$(gh pr view $pr --json title,body,state,mergeable,headRefName,baseRefName,reviewDecision,statusCheckRollup)

    # Get all comments (read-only)
    comments=$(gh api repos/{owner}/{repo}/pulls/$pr/comments)

    # Get review threads (read-only)
    threads=$(gh api graphql -f query='query { repository(owner:"{owner}",name:"{repo}") { pullRequest(number:'$pr') { reviewThreads(first:100) { nodes { id isResolved comments(first:10) { nodes { body author { login } } } } } } } }')

    # Get failing checks (read-only)
    checks=$(gh pr checks $pr --json name,state,conclusion)

    # Analyze and collect planned actions (no mutations)
    # Output JSON with planned actions
done

# Output consolidated JSON to stdout
```

**Usage examples:**

```bash
# Preview actions for a single PR
/pr-review 123 --dry-run

# Preview actions for multiple PRs
/pr-review 123,456,789 --dry-run

# Preview all open PRs
/pr-review all-open --dry-run
```

**Exit after dry-run:** When `--dry-run` is specified, output the JSON and exit. Do not proceed to actual execution steps.

### Step 1: Parse and Validate PRs

For `all-open`, query: `gh pr list --state open --json number,reviewDecision`

For each PR number, validate using:

```bash
gh pr view {number} --json state,mergeable,headRefName
```

Verify: PR exists, is open (state != MERGED, CLOSED), targets current repo.

**CRITICAL - Verify PR Merge State (pr-review-007-merge-state-verification)**:

Before proceeding with review work, verify PR has not been merged via GraphQL (source of truth):

```bash
# Check merge state via GraphQL
gh api graphql -f query='query { repository(owner:"{owner}",name:"{repo}") { pullRequest(number:{number}) { merged mergedAt state } } }'

# If merged=true, skip this PR
```

**Why this matters**: `gh pr view --json state` may return stale "OPEN" for recently merged PRs, leading to wasted effort.

### Step 1.5: Comprehensive PR Status Check (REQUIRED)

Before addressing comments, gather full PR context:

**1. Review ALL Comments** (review comments + PR comments):

```bash
# Get review threads with resolution status
gh api graphql -f query='query { repository(owner:"{owner}",name:"{repo}") { pullRequest(number:{number}) { reviewThreads(first:100) { nodes { id isResolved comments(first:10) { nodes { body author { login } } } } } } } }'

# Get unresolved review threads
gh api graphql -f query='query { repository(owner:"{owner}",name:"{repo}") { pullRequest(number:{number}) { reviewThreads(first:100) { nodes { id isResolved comments(first:10) { nodes { body } } } } } } }' | jq '.data.repository.pullRequest.reviewThreads.nodes | map(select(.isResolved == false))'

# Get PR comments
gh api repos/{owner}/{repo}/issues/{number}/comments

# Get full PR context including comments
gh pr view {number} --json title,body,state,mergeable,headRefName,baseRefName,comments,reviews
```

**2. Check Merge Eligibility with Base Branch**:

```bash
# Get PR context including merge state
gh pr view {number} --json mergeable,mergeStateStatus
# Check: "mergeable" should be "MERGEABLE"
# Check: "mergeStateStatus" for conflicts

# Verify PR is not already merged
gh api graphql -f query='query { repository(owner:"{owner}",name:"{repo}") { pullRequest(number:{number}) { merged } } }'
```

**3. Review ALL Failing Checks**:

```bash
# Get all checks with conclusions
gh pr checks {number} --json name,state,conclusion

# For each failing check, investigate:
# - If session validation: Use session-log-fixer skill
# - If AI reviewer: Check for infrastructure vs code quality issues
# - If tests: Run tests locally to verify
# - If linting: Run npx markdownlint-cli2 --fix
```

**Action on failures**:

| Check Type | Failure Action |
|------------|----------------|
| Session validation | Invoke `session-log-fixer` skill |
| AI reviewer (infra) | May be transient; note and continue |
| AI reviewer (code quality) | Address findings or acknowledge |
| Tests | Run locally, fix failures |
| Markdown lint | Run `npx markdownlint-cli2 --fix` |
| PR title validation | Update title to conventional commit format |

### Step 2: Create Worktrees (if --parallel)

For parallel execution:

```bash
branch=$(gh pr view {number} --json headRefName -q '.headRefName')
git worktree add "../worktree-pr-{number}" "$branch"
```

### Step 3: Launch Agents

**Sequential (default):**

```
for pr in pr_numbers:
    # Pass session context path for state continuity
    Skill(skill="pr-comment-responder", args=f"{pr}")
```

**Parallel (--parallel):**

```
agents = []
for pr in pr_numbers:
    agent = Agent(
        subagent_type="pr-comment-responder",
        prompt=f"""PR #{pr}

Check for existing session state before starting. If previous session exists:
1. Load existing comment map
2. Check for NEW comments only
3. Skip to verification if no new comments

Completion requires ALL criteria:
- All comments [COMPLETE] or [WONTFIX]
- No new comments after 45s wait post-commit
- All CI checks pass (including AI Quality Gate)
- Commits pushed to remote
""",
        run_in_background=True
    )
    agents.append(agent)

for agent_id in agents:
    AgentOutput(agent_id=agent_id, block=True, timeout=600000)
```

### Step 4: Verify and Push

For each worktree:

```bash
cd "../worktree-pr-{number}"
if [[ -n "$(git status --short)" ]]; then
    git add .
    git commit -m "chore(pr-{number}): finalize review response session"
    git push origin "$branch"
fi
```

### Step 5: Cleanup Worktrees (if --cleanup)

```bash
cd "{main_repo}"
for pr in pr_numbers; do
    worktree_path="../worktree-pr-${pr}"
    cd "$worktree_path"
    status="$(git status --short)"
    if [[ -z "$status" ]]; then
        cd "{main_repo}"
        git worktree remove "$worktree_path"
    else
        echo "WARNING: worktree-pr-${pr} has uncommitted changes"
    fi
done
```

### Step 6: Generate Summary

Output:

```markdown
## PR Review Summary

| PR | Branch | Comments | Acknowledged | Implemented | Commit | Status |
|----|--------|----------|--------------|-------------|--------|--------|
| #53 | feat/xyz | 4 | 4 | 3 | abc1234 | COMPLETE |
| #141 | fix/auth | 7 | 7 | 5 | def5678 | COMPLETE |

### Statistics
- **PRs Processed**: N
- **Comments Reviewed**: N
- **Fixes Implemented**: N
- **Commits Pushed**: N
- **Worktrees Cleaned**: N
```

## Error Recovery

| Scenario | Action |
|----------|--------|
| PR not found | Log warning, skip PR, continue |
| Branch conflict | Log error, skip PR, continue |
| Agent timeout | Log partial status, force cleanup |
| Push rejection | Detect concurrent updates (fetch and compare remote). If no concurrent changes, retry with `--force-with-lease`; otherwise, log rejection and require manual resolution (do not force push in parallel scenarios). |
| Merge conflict | Log conflict, skip cleanup, report for manual resolution |

## Critical Constraints (MUST)

When using `--parallel` with worktrees:

1. **Worktree Isolation**: ALL changes MUST be contained within the assigned worktree
2. **Working Directory**: Agents MUST set working directory to their worktree before file operations
3. **Path Validation**: All file paths MUST be relative to worktree root
4. **Git Operations**: Git commands MUST be executed from within the worktree directory
5. **Verification Gate**: Before cleanup, verify no files were written outside worktrees

## Completion Criteria

**ALL criteria must be true before claiming PR review complete**:

| Criterion | Verification | Required |
|-----------|--------------|----------|
| All review comments addressed | Each review thread has reply + resolution | Yes |
| All PR comments acknowledged | Each PR comment has acknowledgment (reply or reaction) | Yes |
| No new comments | Re-check after 45s wait returned 0 new | Yes |
| CI checks pass | `gh pr checks` AllPassing = true (or failures acknowledged) | Yes |
| No unresolved threads | GraphQL query for unresolved reviewThreads = 0 | Yes |
| Merge eligible | `mergeable=MERGEABLE`, no conflicts with base | Yes |
| PR not merged | GraphQL merged=false | Yes |
| Commits pushed | `git status` shows "up to date with origin" | Yes |

**If ANY criterion fails**: Do NOT claim completion. The agent must loop back to address the issue.

**Failure handling by type**:

| Failure Type | Action |
|--------------|--------|
| Session validation fails | Use `session-log-fixer` skill to diagnose and fix |
| AI reviewer fails (infra) | Note as infrastructure issue; may be transient |
| AI reviewer fails (code quality) | Address findings or document acknowledgment |
| Merge conflicts | Resolve conflicts or merge base branch |
| Behind base branch | Merge base or rebase as appropriate |

### Verification Command

```bash
# Run after each PR to verify completion
for pr in "${pr_numbers[@]}"; do
    echo "=== PR #$pr Completion Check ==="

    # Get CI check status
    checks=$(gh pr checks "$pr" --json name,state,conclusion)
    all_passing=$(echo "$checks" | jq -r 'all(.[]; .conclusion == "SUCCESS" or .conclusion == "NEUTRAL" or .conclusion == "SKIPPED" or .conclusion == null)')
    if [ "$all_passing" != "true" ]; then
        echo "$checks" | jq -r '.[] | select(.conclusion != "SUCCESS" and .conclusion != "NEUTRAL" and .conclusion != "SKIPPED" and .conclusion != null) | "  FAIL: \(.name) - \(.conclusion)"'
    fi

    # Check for unresolved threads
    gh api graphql -f query='query { repository(owner:"{owner}",name:"{repo}") { pullRequest(number:'$pr') { reviewThreads(first:100) { nodes { isResolved } } } } }' | jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length'
done
```

## Thread Resolution Protocol

### Overview (pr-review-004-thread-resolution-single, pr-review-005-thread-resolution-batch)

**CRITICAL**: Replying to a review comment does NOT automatically resolve the thread. Thread resolution requires a separate GraphQL mutation.

### Single Thread Resolution (pr-review-004-thread-resolution-single)

After replying to a review comment, resolve the thread:

```bash
# Step 1: Reply to thread
gh api graphql -f query='mutation { addPullRequestReviewThread(input: {pullRequestReviewThreadId: "PRRT_xxx", body: "Response text"}) { comment { id } } }'

# Step 2: Resolve thread (REQUIRED separate step)
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "PRRT_xxx"}) { thread { id isResolved } } }'
```

**Why this matters**: Replying to a comment does NOT automatically resolve the thread. Thread resolution requires a separate GraphQL mutation. Unresolved threads block PR merge per branch protection rules.

### Batch Thread Resolution (pr-review-005-thread-resolution-batch)

For 2+ threads, use GraphQL batch mutation for maximum efficiency (1 API call):

```bash
# Resolve multiple threads efficiently
gh api graphql -f query='
mutation {
  t1: resolveReviewThread(input: {threadId: "PRRT_xxx"}) { thread { id isResolved } }
  t2: resolveReviewThread(input: {threadId: "PRRT_yyy"}) { thread { id isResolved } }
  t3: resolveReviewThread(input: {threadId: "PRRT_zzz"}) { thread { id isResolved } }
}'
```

**Benefits**:

- 1 API call instead of N calls
- Reduced network latency (1 round trip vs N)
- Atomic operation (all succeed or all fail)

## Related Memories

When reviewing PRs, consult Brain memories for context:

| Memory | Purpose |
|--------|---------|
| `pr-review-007-merge-state-verification` | GraphQL source of truth for merge state |
| `pr-review-004-thread-resolution-single` | Single thread resolution via GraphQL |
| `pr-review-005-thread-resolution-batch` | Batch thread resolution efficiency |
| `pr-review-008-session-state-continuity` | Session context for multi-round reviews |
| `ai-quality-gate-failure-categorization` | Infrastructure vs code quality failures |
| `session-log-fixer` (skill) | Diagnose and fix session protocol failures |
