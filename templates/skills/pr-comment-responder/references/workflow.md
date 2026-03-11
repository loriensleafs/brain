# PR Comment Responder Workflow

Full phase-by-phase workflow for PR comment response.

## Phase -1: Context Inference (BLOCKING)

Extract PR number and repository context from the user prompt before any API calls.

**Principle**: Infer discoverable context from the prompt. Never prompt for information already provided.

### Step -1.1: Extract GitHub Context

Extract PR number from user prompt text (patterns: `PR 806`, `PR #806`, `#806`, `github.com/owner/repo/pull/123`).

If the PR number cannot be parsed from the prompt, use `gh pr view` to get the current branch's PR.

### Step -1.2: Validate Context

```bash
# Infer owner/repo from git remote
owner=$(gh repo view --json owner -q '.owner.login')
repo=$(gh repo view --json name -q '.name')

# If PR number not parsed from prompt, get from current branch
pr_number=$(gh pr view --json number -q '.number')
```

### Supported Patterns

| Pattern Type | Examples | Extracted |
|--------------|----------|-----------|
| Text: "PR N" | `PR 806`, `PR #806`, `pr 123` | PRNumbers: [806] or [123] |
| Text: "pull request" | `pull request 123`, `Pull Request #456` | PRNumbers: [123] or [456] |
| Text: "#N" | `#806` (standalone) | PRNumbers: [806] |
| Text: "issue N" | `issue 45`, `issue #45` | IssueNumbers: [45] |
| URL: PR | `github.com/owner/repo/pull/123` | PRNumbers: [123], Owner, Repo |
| URL: Issue | `github.com/owner/repo/issues/456` | IssueNumbers: [456], Owner, Repo |

### Autonomous Execution Mode

When running autonomously (no user interaction possible):

- Use `-RequirePR` flag to fail fast if PR cannot be inferred
- Never prompt for clarification
- Error message must be actionable: include what patterns are supported

```bash
# Autonomous execution - fail if PR context missing
pr_number=$(gh pr view --json number -q '.number' 2>/dev/null)
if [ -z "$pr_number" ]; then
  echo "Cannot determine PR number. Provide explicit PR number or URL."
  exit 1
fi
```

## Phase 0: Memory Initialization (BLOCKING)

Load relevant memories before any triage decisions.

```python
# Search Brain memory for PR review patterns
mcp__plugin_brain_brain__search({
  "query": "pr-comment-responder review patterns",
  "mode": "semantic",
  "limit": 5
})

# Read specific notes if found
mcp__plugin_brain_brain__read_note({
  "identifier": "pr-comment-responder-skills"
})
```

Verify core memory loaded:

- [ ] Memory content appears in context
- [ ] Reviewer signal quality table visible
- [ ] Triage heuristics available

## Phase 1: Context Gathering

### Step 1.0: Session State Check

```bash
SESSION_DIR=".agents/pr-comments/PR-[number]"

if [ -d "$SESSION_DIR" ]; then
  echo "[CONTINUATION] Previous session found"
  PREVIOUS_COMMENTS=$(grep -c "^### Comment" "$SESSION_DIR/comments.md" 2>/dev/null || echo 0)
  CURRENT_COMMENTS=$(gh api repos/{owner}/{repo}/pulls/[number]/comments --jq 'length')

  if [ "$CURRENT_COMMENTS" -gt "$PREVIOUS_COMMENTS" ]; then
    echo "[NEW COMMENTS] $((CURRENT_COMMENTS - PREVIOUS_COMMENTS)) new comments"
  fi
fi
```

### Step 1.1: Fetch PR Metadata

```bash
gh pr view [number] --json title,body,state,author,baseRefName,headRefName,additions,deletions,files
```

### Step 1.2: Enumerate All Reviewers

```bash
gh pr view [number] --json reviewRequests,reviews
```

### Step 1.2a: Load Reviewer-Specific Memories

```python
# Search Brain memory for reviewer-specific patterns
for reviewer in ALL_REVIEWERS:
    if reviewer == "cursor[bot]":
        mcp__plugin_brain_brain__search({
          "query": "cursor bot review patterns",
          "limit": 3
        })
    elif reviewer == "copilot-pull-request-reviewer":
        mcp__plugin_brain_brain__search({
          "query": "copilot PR review patterns",
          "limit": 3
        })
```

### Step 1.3: Retrieve ALL Comments

```bash
# Fetch review comments and issue comments
gh api repos/{owner}/{repo}/pulls/[number]/comments
gh api repos/{owner}/{repo}/issues/[number]/comments
```

## Phase 2: Comment Map Generation

### Step 2.1: Acknowledge All Comments (Batch)

```bash
# Get all comment IDs and batch acknowledge with eyes reaction
gh api repos/{owner}/{repo}/pulls/[number]/comments --jq '.[].id' | while read -r id; do
  gh api repos/{owner}/{repo}/pulls/comments/${id}/reactions -f content=eyes
done
```

### Step 2.2: Generate Comment Map

Save to: `.agents/pr-comments/PR-[number]/comments.md`

Each comment gets:

- ID, Author, Type, Path/Line, Status, Priority, Plan Ref
- Full context (diff_hunk)
- Analysis placeholder

## Phase 3: Analysis (Delegate to Orchestrator)

For each comment, delegate to orchestrator with full context:

```python
Agent(subagent_type="orchestrator", prompt="""
[Context from Step 3.1]

After analysis, save plan to: `.agents/pr-comments/PR-[number]/[comment_id]-plan.md`

Return:
- Classification: [Quick Fix / Standard / Strategic]
- Priority: [Critical / Major / Minor / Won't Fix / Question]
- Action: [Implement / Reply Only / Defer / Clarify]
- Rationale: [Why this classification]
""")
```

## Phase 4: Task List Generation

Save to: `.agents/pr-comments/PR-[number]/tasks.md`

Priority groups:

- Critical: Implement immediately
- Major: Implement in order
- Minor: Implement if time permits
- Won't Fix: Reply with rationale
- Question: Reply and wait

## Phase 4.5: Copilot Follow-Up Handling

Detect Copilot follow-up PRs:

- Branch: `copilot/sub-pr-{original_pr_number}`
- Target: Original PR's base branch

Categories:

- DUPLICATE: Same changes already applied -> Close
- SUPPLEMENTAL: Additional issues -> Evaluate merge
- INDEPENDENT: Unrelated -> Close with note

## Phase 5: Immediate Replies

Reply to Won't Fix, Questions, Clarification Needed before implementation.

```bash
# In-thread reply
gh api repos/{owner}/{repo}/pulls/[number]/comments/[id]/replies -f body="[response]"
```

## Phase 6: Implementation

For each task, delegate to orchestrator:

```python
Agent(subagent_type="orchestrator", prompt="""
Implement this PR comment fix:
[Task details]
[Comment details]
[Plan]
""")
```

After implementation:

1. Commit with conventional message
2. Reply with resolution (commit hash)
3. Resolve conversation thread
4. Update task list

## Phase 7: PR Description Update

Review changes and update PR description if:

- New features documented
- Breaking changes noted
- Scope accuracy

## Phase 8: Completion Verification

See [gates.md](gates.md) for full verification.

## Phase 9: Memory Storage (BLOCKING)

Update Brain memory with session statistics:

```python
# Update existing note or create new one
mcp__plugin_brain_brain__edit_note({
  "identifier": "pr-comment-responder-skills",
  "operation": "append",
  "content": "\n\n### PR-[number] Session\n\n- Date: YYYY-MM-DD\n- Total comments: N\n- Resolved: N\n- Won't fix: N\n- New patterns: [any new reviewer patterns discovered]"
})
```
