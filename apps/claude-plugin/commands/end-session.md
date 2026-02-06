# Session End Protocol

Complete ALL mandatory steps before ending a session.

## Primary Method: MCP Session Tool

Use the MCP `session` tool with `operation: complete` to end a session.

```text
mcp__plugin_brain_brain__session
  operation: complete
  sessionId: <session-id>
```

**Parameters:**

| Parameter | Required | Description                                       |
| --------- | -------- | ------------------------------------------------- |
| operation | Yes      | Must be `complete`                                |
| sessionId | Yes      | Session ID (e.g., `SESSION-2026-02-04_01-topic`)  |
| project   | No       | Project name/path to scope the session            |

**Response:**

```json
{
  "success": true,
  "sessionId": "SESSION-2026-02-04_01-feature-implementation",
  "previousStatus": "in_progress",
  "newStatus": "complete"
}
```

**Terminal status:** COMPLETE is a terminal status. A completed session cannot
be resumed. If you need to pause work temporarily, use `/pause-session` instead.

## Alternative: CLI Command

```bash
brain session complete SESSION-2026-02-04_01-feature-implementation
brain session complete SESSION-2026-02-04_01-feature-implementation -p myproject
```

## 1. Session Status Update (BLOCKING)

**CRITICAL**: Update the session status before any other end steps.

```text
mcp__plugin_brain_brain__session
  operation: complete
  sessionId: SESSION-YYYY-MM-DD_NN-topic
```

Verify the update succeeded before continuing.

## 2. Acceptance Criteria Verification

Review the session note's **Acceptance Criteria** section:

- [ ] All criteria checked or documented why incomplete
- [ ] Uncompleted criteria have `[BLOCKED]` or `[DEFERRED]` with reason
- [ ] No uncommitted changes remain

## 3. Session Note Final Update (CRITICAL)

The session note is the **permanent record** of this session. Bring it fully
current before completing. Future agents depend on this for context.

**Finalize these sections:**

1. **Acceptance Criteria**: Check off all met criteria

2. **Work Log**: Check off all completed items, mark remaining as `[deferred]`

3. **Files Touched**: Verify all Brain notes and code files are listed

4. **Observations**: Add final session-end observations

```text
- [outcome] What was accomplished linking to [[produced-artifacts]] #session-end
- [outcome] What was NOT completed and why #session-end
- [decision] Any final decisions made #session-end
```

5. **Relations**: Add any missing links to entities created or modified

6. **Session End Protocol table**: Fill in evidence column

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: replace_section
  section: "Session End Protocol (BLOCKING)"
  content: |
    ## Session End Protocol (BLOCKING)

    | Req Level | Step | Status | Evidence |
    |-----------|------|--------|----------|
    | MUST | Update session status to complete | [x] | session tool confirmed |
    | MUST | Update Brain memory | [x] | Session note finalized |
    | MUST | Run markdownlint | [x] | npx markdownlint-cli2 output clean |
    | MUST | Commit all changes | [x] | SHA: [commit hash] |
```

7. **Update frontmatter**: Set updated date

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: find_replace
  find_text: "updated: YYYY-MM-DD"
  content: "updated: [today's date]"
```

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

Update the Verification Checklist at the top of the session note:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: find_replace
  find_text: "- [ ] Work completed"
  content: "- [x] Work completed"
```

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: find_replace
  find_text: "- [ ] Session end protocol complete"
  content: "- [x] Session end protocol complete"
```

## Critical Reminder

**The next session has ZERO context except Brain notes.**

The session resume capability depends on:

- `status: complete` marking finished sessions
- `status: in_progress` flagging sessions that need resumption
- Clear observations and relations in session notes
- Cross-session context in Brain memory

## Status Lifecycle Reference

```text
              create
                |
                v
         +--------------+
         | IN_PROGRESS  |<----+
         +--------------+     |
            |       |         |
     pause  |       | complete|  resume
            v       |         |
         +--------+ |     +--------+
         | PAUSED |-+---->| COMPLETE|
         +--------+       +--------+
                              ^
                              |
                          (terminal)
```

| Status        | Set By          | Meaning         | Can Transition To     |
| ------------- | --------------- | --------------- | --------------------- |
| `in_progress` | start, resume   | Session active  | PAUSED, COMPLETE      |
| `paused`      | pause           | Suspended       | IN_PROGRESS, COMPLETE |
| `complete`    | end             | Terminal        | None                  |

Sessions with `status: in_progress` or `status: paused` indicate work that
may need resumption. Use `/pause-session` if you need to switch contexts
temporarily. Use `/end-session` when work is truly complete.
