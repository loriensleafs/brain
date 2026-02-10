# Session Pause Protocol

Pause an active session to switch contexts or take a break.

## Primary Method: MCP Session Tool

Use the MCP `session` tool with `operation: pause` to pause a session.

```text
mcp__plugin_brain_brain__session
  operation: pause
  sessionId: <session-id>
```

**Parameters:**

| Parameter | Required | Description                                      |
| --------- | -------- | ------------------------------------------------ |
| operation | Yes      | Must be `pause`                                  |
| sessionId | Yes      | Session ID (e.g., `SESSION-2026-02-04_01-topic`) |
| project   | No       | Project name/path to scope the session           |

**Response:**

```json
{
  "success": true,
  "sessionId": "SESSION-2026-02-04_01-feature-implementation",
  "previousStatus": "in_progress",
  "newStatus": "paused"
}
```

## Alternative: CLI Command

```bash
brain session pause SESSION-2026-02-04_01-feature-implementation
brain session pause SESSION-2026-02-04_01-feature-implementation -p myproject
```

## When to Pause vs Complete

| Situation                               | Action   | Command          |
| --------------------------------------- | -------- | ---------------- |
| Switching to different work temporarily | Pause    | `/pause-session` |
| Taking a break, will resume later       | Pause    | `/pause-session` |
| Work is done, session complete          | Complete | `/end-session`   |
| Context switching to urgent issue       | Pause    | `/pause-session` |

## Pause Workflow

### Step 1: Identify Current Session

Search for the active session:

```text
mcp__plugin_brain_brain__search
  query: "status: in_progress type: session"
  folder: "sessions"
  limit: 1
```

### Step 2: Update Session Note (CRITICAL)

Before pausing, bring the session note fully current. The session note is the
**only context** available when resuming. Anything not captured here is lost.

**Update these sections:**

1. **Work Log**: Check off completed items, add any new work done since last update

```text
- [x] [completed] Description of finished work linking to [[entity]] #tag
- [ ] [in-progress] Where you left off on [[current-task]] #tag
```

1. **Acceptance Criteria**: Check off any criteria met during this segment

2. **Observations**: Add any new insights, decisions, or facts

```text
- [insight] Discovery made while working on [[entity]] #tag
- [decision] Choice made about [[topic]] and why #tag
```

1. **Relations**: Add links to any new entities created or referenced

```text
- created [[New-Entity-Name]]
- modified [[Existing-Entity]]
```

1. **Files Touched**: Update tables with any new notes or code files

2. **Append a Pause Point**:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: append
  content: |
    ### Pause Point - YYYY-MM-DD

    **Pausing because:** [reason for pause]
    **Last working on:** [[entity-in-progress]] - [what was being done]
    **Resume from:** [specific next step]

    **Context to reload on resume:**
    - [context] Read [[entity-1]] for [reason] #resume
    - [context] Read [[entity-2]] for [reason] #resume
    - [context] Check status of [[pending-item]] #resume
```

The "Context to reload" list is what makes resume efficient. Be specific about
what the agent needs to read to reconstruct working state.

### Step 3: Pause the Session

```text
mcp__plugin_brain_brain__session
  operation: pause
  sessionId: SESSION-YYYY-MM-DD_NN-topic
```

### Step 4: Verify Pause

Confirm the session status changed to PAUSED.

## Error Handling

| Error                     | Meaning                   | Resolution           |
| ------------------------- | ------------------------- | -------------------- |
| SESSION_NOT_FOUND         | Session ID does not exist | Verify session ID    |
| INVALID_STATUS_TRANSITION | Session not IN_PROGRESS   | Check current status |

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

| Status        | Transitions From | Transitions To        |
| ------------- | ---------------- | --------------------- |
| `in_progress` | create, resume   | PAUSED, COMPLETE      |
| `paused`      | pause            | IN_PROGRESS, COMPLETE |
| `complete`    | complete         | None (terminal)       |
