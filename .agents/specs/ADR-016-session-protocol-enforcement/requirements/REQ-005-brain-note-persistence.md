---
type: requirement
id: REQ-005
title: Brain note persistence model for session state
status: accepted
priority: P0
category: functional
epic: EPIC-ADR-016-implementation
related:
  - ADR-016
  - REQ-001
  - REQ-002
  - REQ-003
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - persistence
  - brain-mcp
  - session-state
---

# REQ-005: Brain Note Persistence Model for Session State

## Requirement Statement

WHEN session state is created or updated
THE SYSTEM SHALL persist the signed state to Brain MCP notes at `sessions/session-{sessionId}` and update the current session pointer at `sessions/current-session`
SO THAT session state survives MCP server restarts, conversation compactions, and system reboots.

## Context

The original ADR-016 design used JSON file cache (`~/.local/state/brain/session.json`) for session state persistence. This approach had several problems:

1. **Dual storage** - Session state duplicated in file cache AND Brain notes
2. **Synchronization issues** - File cache and Brain notes could diverge
3. **Architectural inconsistency** - Brain MCP designed for persistent storage, yet session state used separate file cache

ADR-016 corrects this by using Brain notes as the single source of truth for session state. File cache is eliminated entirely.

## Acceptance Criteria

- [ ] Session state persisted to Brain note at path `sessions/session-{sessionId}`
- [ ] Session note content is JSON serialized with signature (SignedSessionState)
- [ ] Session note category is "sessions"
- [ ] Current session pointer persisted to Brain note at path `sessions/current-session`
- [ ] Current session pointer content is plain text sessionId
- [ ] BrainSessionPersistence class implements saveSession, loadSession, getCurrentSession methods
- [ ] saveSession writes state to Brain note via brainMCP.writeNote
- [ ] loadSession reads state from Brain note via brainMCP.readNote
- [ ] getCurrentSession reads pointer then loads session via loadSession
- [ ] MCP startup calls getCurrentSession to load active session into memory cache
- [ ] File cache code (`session.json` read/write) removed entirely
- [ ] Brain specialist agent context stored in separate notes: `session-{sessionId}-agent-{agent}`
- [ ] Agent context notes have category "session-agents"

## Rationale

Brain note persistence provides:

1. **Single source of truth** - Brain notes are canonical storage, no file cache
2. **Durability** - Brain notes survive MCP restart and system reboot
3. **Architectural consistency** - Everything uses Brain MCP for persistent storage
4. **Synchronization elimination** - No dual storage to keep synchronized
5. **Knowledge graph integration** - Session state participates in Brain wikilinks and search

The current session pointer pattern enables fast lookup without scanning all session notes.

## Dependencies

- Brain MCP with writeNote and readNote support
- JSON serialization for SessionState
- Session state signature (REQ-003)
- In-memory cache for performance

## Related Artifacts

- ADR-016: Automatic Session Protocol Enforcement (Correct Architecture Diagram)
- REQ-001: Session state schema
- REQ-003: HMAC-SHA256 signing
- DESIGN-001: Session state architecture
