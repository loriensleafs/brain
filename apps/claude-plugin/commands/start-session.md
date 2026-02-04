# Session Start Protocol

Initialize a new session with proper context and tracking.

## Blocking Gate: Complete Before ANY Work

### Step 1: Initialize Brain MCP

```text
mcp__plugin_brain_brain__bootstrap_context with project path
```

### Step 2: Search for In-Progress Sessions

Check for sessions that need resumption:

```text
mcp__plugin_brain_brain__search
  query: "status: in_progress type: session"
  folder: "sessions"
  limit: 5
```

If in-progress sessions exist:

- Read each session note to understand context
- Ask user: "Found in-progress session(s). Resume or start new?"
- If resuming, skip to Step 5 with existing session

### Step 3: Create Session Note in Brain

Use `write_note` to create the session with status tracking:

```text
mcp__plugin_brain_brain__write_note
  title: SESSION-YYYY-MM-DD_NN-topic
  folder: sessions
  content: [see template below]
```

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

| Status        | Meaning                      |
|---------------|------------------------------|
| `in_progress` | Session active, work ongoing |
| `complete`    | Session ended normally       |

Sessions start with `status: in_progress`. The end-session command updates
to `complete`.
