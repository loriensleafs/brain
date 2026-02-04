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

## Status Transition

```text
IN_PROGRESS --pause--> PAUSED
```

A paused session can be:

- Resumed with `/resume-session` (PAUSED -> IN_PROGRESS)
- Completed with `/end-session` (PAUSED -> COMPLETE)

## Pause Workflow

### Step 1: Identify Current Session

Search for the active session:

```text
mcp__plugin_brain_brain__search
  query: "status: in_progress type: session"
  folder: "sessions"
  limit: 1
```

### Step 2: Document Current State

Before pausing, update the session note with current progress:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: append
  content: |
    ## Pause Point - [timestamp]

    **Current State:**
    - [What was being worked on]
    - [Where you left off]

    **Next Steps When Resumed:**
    - [What to do next]
```

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
