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

### Step 2: Read Session Note (CRITICAL)

Read the full session note to reconstruct working context:

```text
mcp__plugin_brain_brain__read_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
```

**Extract from the session note:**

1. **Objective**: What this session is working toward
2. **Acceptance Criteria**: What remains unchecked
3. **Pause Point**: Where work stopped and what to do next
4. **Context to reload**: Specific entities to read for state recovery
5. **Work Log**: What was completed vs what is pending
6. **Relations**: All entities this session touches

### Step 3: Rehydrate Context

Follow the "Context to reload" list from the Pause Point. Read each referenced
entity to rebuild working state:

```text
mcp__plugin_brain_brain__read_note
  identifier: [each entity from Context to reload list]
```

Also read:

- Any `[[wikilinked]]` entities from unchecked Acceptance Criteria
- The ADR/FEAT referenced in frontmatter (if applicable)
- Recent entries in the Work Log that have `[in-progress]` status

### Step 4: Resume the Session

```text
mcp__plugin_brain_brain__session
  operation: resume
  sessionId: SESSION-YYYY-MM-DD_NN-topic
```

### Step 5: Verify Resume and Update Note

Confirm the session status changed to IN_PROGRESS, then update the session note:

```text
mcp__plugin_brain_brain__edit_note
  identifier: SESSION-YYYY-MM-DD_NN-topic
  operation: find_replace
  find_text: "updated: YYYY-MM-DD"
  content: "updated: [today's date]"
```

Add a resume entry to the Work Log:

```text
- [x] [resumed] Session resumed from [[Pause Point]] #session-lifecycle
```

### Step 6: Continue Work

Pick up from the "Resume from" instruction in the Pause Point. The session note
should have all the context needed to continue without asking the user to repeat
themselves.

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
2. Read each session note - check Objective and Acceptance Criteria
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
