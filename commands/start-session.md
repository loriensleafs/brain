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

| Parameter | Required | Description                            |
| --------- | -------- | -------------------------------------- |
| operation | Yes      | Must be `create`                       |
| topic     | Yes      | Session topic in kebab-case            |
| project   | No       | Project name/path to scope the session |

**Response:**

```json
{
  "success": true,
  "sessionId": "SESSION-2026-02-04_01-feature-implementation",
  "path": "sessions/SESSION-2026-02-04_01-feature-implementation.md",
  "autoPaused": "SESSION-2026-02-04_01-previous-topic"
}
```

**Auto-pause behavior:** If another session is currently IN_PROGRESS, it will be automatically paused before the new session is created.

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
- Use the AskUserQuesitonTool: "Found open session(s). Resume existing or start new?"
- If resuming, use `/resume-session` command instead
- If starting new, the create operation will auto-pause any IN_PROGRESS session

### Step 3: Create Session via MCP Tool

```text
mcp__plugin_brain_brain__session
  operation: create
  topic: <user-provided-topic>
```

The MCP tool creates a minimal session note. After creation, **you MUST update it**

with the full template below using `edit_note` with `replace_section`.

**Session Note Template:**

```markdown
---
title: SESSION-YYYY-MM-DD_NN-topic
permalink: sessions/session-YYYY-MM-DD-NN-topic
type: session
status: IN_PROGRESS
created: YYYY-MM-DD
updated: YYYY-MM-DD
date: YYYY-MM-DD
tags: [session, YYYY-MM-DD, topic-tag]
branch: main
starting-commit: SHA
adr: decisions/adr-NNN-topic (if applicable)
feat: features/FEAT-NNN-topic (if applicable)
---

# SESSION Topic Name

**Status:** IN_PROGRESS
**Branch:** main
**Starting Commit:** SHA message
**Objective:** Brief description linking to [[relevant-entities]]

---

## Acceptance Criteria

- [ ] [Criterion 1 with [[wikilink]] to artifact being produced]
- [ ] [Criterion 2]
- [ ] Session note kept current with inline relations to every touched artifact

---

## Verification Checklist

- [ ] Session start protocol complete
- [ ] Work completed
- [ ] Session end protocol complete

---

## Session Start Protocol (BLOCKING)

| Req Level | Step                     | Status | Evidence |
| --------- | ------------------------ | ------ | -------- |
| MUST      | Initialize Brain MCP     | [ ]    |          |
| MUST      | Create session log       | [ ]    |          |
| SHOULD    | Search relevant memories | [ ]    |          |
| SHOULD    | Verify git status        | [ ]    |          |

---

## Key Decisions

- [decision] Description with [[wikilink]] context #tag

---

## Work Log

Track ALL work with inline observations and wikilinks:

- [x] [category] Description linking to [[entity-touched]] #tag
- [ ] [pending] Remaining work linking to [[entity]] #tag

---

## Files Touched

### Brain Memory Notes

| Action  | Note            | Status |
| ------- | --------------- | ------ |
| created | [[entity-name]] | status |

### Code Files

| File         | Context            |
| ------------ | ------------------ |
| path/to/file | Why it was touched |

---

## Observations

- [fact] Session initialized for topic #session-lifecycle
- [decision] Key decisions made during session #tag
- [insight] Patterns discovered #tag

## Relations

- implements [[ADR-NNN-topic]] (if applicable)
- relates_to [[FEAT-NNN-topic]] (if applicable)
- relates_to [[Previous-Session]] (if continuing work)
- references [[Source-Material]] (if applicable)

---

## Session End Protocol (BLOCKING)

| Req Level | Step                              | Status | Evidence |
| --------- | --------------------------------- | ------ | -------- |
| MUST      | Update session status to complete | [ ]    |          |
| MUST      | Update Brain memory               | [ ]    |          |
| MUST      | Run markdownlint                  | [ ]    |          |
| MUST      | Commit all changes                | [ ]    |          |
```

**After creating the session**, fill in:

1. **Frontmatter**: branch, starting-commit, adr/feat refs
2. **Objective**: With `[[wikilinks]]` to the work being done
3. **Acceptance Criteria**: Checkable gates for session completion
4. **Session Start Protocol**: Check off completed steps with evidence
5. **Relations**: Link to ADRs, FEATs, previous sessions, source material

**During the session**, keep current:

1. **Key Decisions**: Add decisions as they happen
2. **Work Log**: Check off items, add new ones with `[category]` tags and `[[wikilinks]]`
3. **Files Touched**: Track every Brain note and code file
4. **Observations**: Add insights, facts, techniques as they emerge
5. **Relations**: Add links to every new entity created or referenced

The session note acts as a **semantic hub**. Rich `[[wikilinks]]` and `#tags`

throughout enable automatic context rehydration in future sessions.

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

| Status        | Meaning                       | Transitions To        |
| ------------- | ----------------------------- | --------------------- |
| `IN_PROGRESS` | Session active, work ongoing  | PAUSED, COMPLETE      |
| `PAUSED`      | Session suspended, can resume | IN_PROGRESS, COMPLETE |
| `COMPLETE`    | Session ended (terminal)      | None                  |

Sessions start with `status: in_progress`. Use `/pause-session` to pause,

`/resume-session` to resume, or `/end-session` to complete.
