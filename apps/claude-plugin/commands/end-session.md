# Session End Protocol

Complete ALL mandatory steps before ending a session.

## 1. Session Status Update (BLOCKING)

**CRITICAL**: Update the session note status before any other end steps.

Use `edit_note` to change status from `in_progress` to `complete`:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: find_replace
  find: "status: in_progress"
  replace: "status: complete"
```

Verify the update succeeded before continuing.

## 2. Task Completion Verification

- [ ] All attempted tasks marked in PROJECT-PLAN.md:
  - `[x]` for completed
  - `[ ]` with note for incomplete (document why)
- [ ] Acceptance criteria validated for completed tasks
- [ ] No uncommitted changes remain

## 3. Documentation Updates

Update the session note with final observations:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: append
  content: |
    ## Session Outcomes

    - [outcome] [Description of what was accomplished] #session-end
    - [decision] [Any decisions made] #session-end

    ## Session End Checklist

    | Step | Status | Evidence |
    |------|--------|----------|
    | Status updated to complete | [x] | edit_note confirmed |
    | Brain memory updated | [ ] | |
    | Markdown lint passed | [ ] | |
    | Changes committed | [ ] | SHA: |
```

Additional updates:

- [ ] Brain notes capture cross-session context
- [ ] PROJECT-PLAN.md metrics updated (if applicable)

## 4. Retrospective (For Significant Sessions)

Invoke retrospective agent for sessions with:

- Major feature completions
- Significant challenges overcome
- Process improvements discovered
- Patterns worth documenting

```text
@orchestrator

Route to retrospective agent for session analysis:

## Session Summary
- Session: SESSION-YYYY-MM-DD_NN-topic
- Tasks attempted: [List]
- Outcomes: [Success/Partial/Blocked]

## Analysis Request
1. What patterns emerged during this session?
2. What should be added to skillbook?
3. What process improvements are needed?

Save findings to: .agents/retrospective/RETRO-YYYY-MM-DD_topic.md
```

- [ ] Retrospective document created (if applicable)
- [ ] Skills extracted and documented

## 5. Linting and Validation

Run BEFORE final commit:

```bash
# Fix markdown formatting
npx markdownlint-cli2 --fix "**/*.md"
```

- [ ] Markdown lint passes
- [ ] No broken cross-references

## 6. Git Operations

```bash
# Stage changes
git add [specific files]

# Commit with conventional message
git commit -m "feat(scope): description"

# Push branch
git push origin [branch-name]
```

- [ ] All changes staged
- [ ] Commit message follows conventional format
- [ ] Branch pushed to remote

## 7. Final Session Note Update

Update the session end checklist in the Brain note:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: replace_section
  section: "Session End Checklist"
  content: |
    ## Session End Checklist

    | Step | Status | Evidence |
    |------|--------|----------|
    | Status updated to complete | [x] | edit_note confirmed |
    | Brain memory updated | [x] | Cross-session context written |
    | Markdown lint passed | [x] | Tool output clean |
    | Changes committed | [x] | SHA: [commit SHA] |
```

## Critical Reminder

**The next session has ZERO context except Brain notes.**

The session resume capability depends on:

- `status: complete` marking finished sessions
- `status: in_progress` flagging sessions that need resumption
- Clear observations and relations in session notes
- Cross-session context in Brain memory

## Status Lifecycle Reference

| Status        | Set By        | Meaning               |
|---------------|---------------|-----------------------|
| `in_progress` | start-session | Session active        |
| `complete`    | end-session   | Session ended normally|

Sessions with `status: in_progress` indicate work that was interrupted and
may need resumption.
