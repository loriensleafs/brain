# Session Resume Protocol

Resume a paused session to continue previous work.

## Primary Method: MCP Session Tool

Use the MCP `session` tool with `operation: resume` to resume a session.

```text
mcp__plugin_brain_brain__session
  operation: resume
  sessionId: <session-id>
```

**Parameters:**

| Parameter | Required | Description                                      |
| --------- | -------- | ------------------------------------------------ |
| operation | Yes      | Must be `resume`                                 |
| sessionId | Yes      | Session ID (e.g., `SESSION-2026-02-04_01-topic`) |
| project   | No       | Project name/path to scope the session           |

**Response:**

```json
{
  "success": true,
  "sessionId": "SESSION-2026-02-04_01-feature-implementation",
  "previousStatus": "paused",
  "newStatus": "in_progress",
  "autoPaused": "SESSION-2026-02-04_02-other-topic"
}
```

**Auto-pause behavior:** If another session is currently IN_PROGRESS, it will be
automatically paused before the target session is resumed. The `autoPaused` field
in the response indicates which session was auto-paused.

## Alternative: CLI Command

```bash
brain session resume SESSION-2026-02-04_01-feature-implementation
brain session resume SESSION-2026-02-04_01-feature-implementation -p myproject
```

## Status Transition

```text
PAUSED --resume--> IN_PROGRESS
```

Only PAUSED sessions can be resumed. Completed sessions cannot be resumed.

## Resume Workflow

### Step 1: Find Paused Sessions

Search for sessions that can be resumed:

```text
mcp__plugin_brain_brain__search
  query: "status: paused type: session"
  folder: "sessions"
  limit: 10
```

### Step 2: Review Session Context

Read the session note to understand where work left off:

```text
mcp__plugin_brain_brain__read_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
```

Look for:

- Work Log entries
- Pause Point documentation
- Next Steps When Resumed

### Step 3: Resume the Session

```text
mcp__plugin_brain_brain__session
  operation: resume
  sessionId: SESSION-YYYY-MM-DD_NN-topic
```

### Step 4: Verify Resume

Confirm the session status changed to IN_PROGRESS.

### Step 5: Continue Work

Resume work where you left off based on session context.

## Error Handling

| Error                     | Meaning               | Resolution            |
| ------------------------- | --------------------- | --------------------- |
| SESSION_NOT_FOUND         | Session ID not found  | Verify session ID     |
| INVALID_STATUS_TRANSITION | Session not PAUSED    | Check current status  |
| AUTO_PAUSE_FAILED         | Could not auto-pause  | Pause active manually |

## Auto-Pause Behavior

When you resume a session while another is IN_PROGRESS:

1. The currently IN_PROGRESS session is automatically paused
2. The target session status changes from PAUSED to IN_PROGRESS
3. The response includes `autoPaused` field with the paused session ID

This ensures only one session is IN_PROGRESS at a time.

## Choosing Which Session to Resume

If multiple paused sessions exist:

1. List all paused sessions
2. Read each session note to understand context
3. Ask user which session to resume
4. Resume the selected session

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

| Status        | Can Resume From | Reason             |
| ------------- | --------------- | ------------------ |
| `in_progress` | No              | Already active     |
| `paused`      | Yes             | Normal resume path |
| `complete`    | No              | Terminal status    |
