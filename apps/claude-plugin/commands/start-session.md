# Session Start Protocol

Initialize a new session with proper context and tracking.

## Primary Method: MCP Session Tool

Use the MCP `session` tool with `operation: create` to create a new session.

```text
mcp__plugin_brain_brain__session
  operation: create
  topic: <session-topic>
```

**Parameters:**

| Parameter | Required | Description                             |
| --------- | -------- | --------------------------------------- |
| operation | Yes      | Must be `create`                        |
| topic     | Yes      | Session topic in kebab-case             |
| project   | No       | Project name/path to scope the session  |

**Response:**

```json
{
  "success": true,
  "sessionId": "SESSION-2026-02-04_01-feature-implementation",
  "path": "sessions/SESSION-2026-02-04_01-feature-implementation.md",
  "autoPaused": "SESSION-2026-02-04_01-previous-topic"
}
```

**Auto-pause behavior:** If another session is currently IN_PROGRESS, it will be
automatically paused before the new session is created.

## Alternative: CLI Command

```bash
brain session create --topic "feature-implementation"
brain session create --topic "bugfix" -p myproject
```

## Blocking Gate: Complete Before ANY Work

### Step 1: Initialize Brain MCP

```text
mcp__plugin_brain_brain__bootstrap_context with project path
```

### Step 2: Search for Open Sessions

Check for sessions that need resumption:

```text
mcp__plugin_brain_brain__search
  query: "status: in_progress OR status: paused type: session"
  folder: "sessions"
  limit: 5
```

If open sessions exist:

- Read each session note to understand context
- Ask user: "Found open session(s). Resume existing or start new?"
- If resuming, use `/resume-session` command instead
- If starting new, the create operation will auto-pause any IN_PROGRESS session

### Step 3: Create Session via MCP Tool

```text
mcp__plugin_brain_brain__session
  operation: create
  topic: <user-provided-topic>
```

The MCP tool creates a session note with this structure:

**Session Note Template:**

```markdown
---
title: SESSION-YYYY-MM-DD_NN-topic
type: session
status: in_progress
date: YYYY-MM-DD
tags: [session, YYYY-MM-DD]
---

# Session NN - YYYY-MM-DD

## Session Info

- **Date**: YYYY-MM-DD
- **Session**: NN
- **Branch**: [current branch]
- **Starting Commit**: [SHA and message]
- **Objective**: [brief description]

## Protocol Compliance

### Session Start (BLOCKING)

| Req Level | Step | Status | Evidence |
|-----------|------|--------|----------|
| MUST | Initialize Brain MCP | [ ] | |
| MUST | Create session log | [ ] | |
| SHOULD | Search relevant memories | [ ] | |
| SHOULD | Verify git status | [ ] | |

### Session End (BLOCKING)

| Req Level | Step | Status | Evidence |
|-----------|------|--------|----------|
| MUST | Update session status to complete | [ ] | |
| MUST | Update Brain memory | [ ] | |
| MUST | Run markdownlint | [ ] | |
| MUST | Commit all changes | [ ] | |

## Work Log

[Document work as it progresses]

## Observations

- [fact] Session initialized with status: in_progress #session-lifecycle

## Relations

- part_of [[Brain Project]]
```

### Step 4: Verify Git Status

```bash
git branch --show-current
git log -1 --oneline
git status --short
```

Document branch and starting commit in session note.

### Step 5: Load Context

1. Read `.agents/AGENT-SYSTEM.md` for agent catalog
2. Read `.agents/AGENT-INSTRUCTIONS.md` for task protocol
3. Search Brain notes for cross-session context
4. Read PROJECT-PLAN.md if applicable

## Session Naming Convention

Format: `SESSION-YYYY-MM-DD_NN-topic`

- `YYYY-MM-DD`: Date (ISO 8601)
- `_NN`: Sequence number with underscore separator (01, 02, etc.)
- `topic`: Brief kebab-case description

Examples:

- `SESSION-2026-02-04_01-feature-implementation`
- `SESSION-2026-02-04_02-bug-fix-validation`

## Status Lifecycle

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

| Status        | Meaning                       | Transitions To         |
| ------------- | ----------------------------- | ---------------------- |
| `in_progress` | Session active, work ongoing  | PAUSED, COMPLETE       |
| `paused`      | Session suspended, can resume | IN_PROGRESS, COMPLETE  |
| `complete`    | Session ended (terminal)      | None                   |

Sessions start with `status: in_progress`. Use `/pause-session` to pause,
`/resume-session` to resume, or `/end-session` to complete.
