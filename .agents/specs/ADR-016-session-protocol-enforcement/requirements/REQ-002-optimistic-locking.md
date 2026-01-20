---
type: requirement
id: REQ-002
title: Optimistic locking for concurrent session updates
status: accepted
priority: P0
category: non-functional
epic: EPIC-ADR-016-implementation
related:
  - ADR-016
  - REQ-001
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - concurrency
  - optimistic-locking
  - session-state
---

# REQ-002: Optimistic Locking for Concurrent Session Updates

## Requirement Statement

WHEN multiple processes attempt to update session state concurrently
THE SYSTEM SHALL use version-based optimistic locking with automatic retry up to 3 attempts
SO THAT concurrent updates do not corrupt session state or lose workflow history.

## Context

Brain MCP notes do not support atomic operations or database-level locking. When multiple workflows or agents update session state simultaneously (e.g., orchestrator routing and agent completion events), race conditions can occur:

1. Process A reads session state (version 5)
2. Process B reads session state (version 5)
3. Process A writes updated state (version 6)
4. Process B writes updated state (version 6, overwriting A's changes)

This results in lost updates and corrupted workflow history. Optimistic locking detects version conflicts and retries the update operation.

## Acceptance Criteria

- [ ] SessionState interface includes version field (integer)
- [ ] Version increments by 1 on every update
- [ ] updateSessionWithLocking function accepts sessionId, updates, and maxRetries parameter
- [ ] Update operation reads current state and expected version
- [ ] Update operation applies changes and increments version
- [ ] Update operation writes to Brain note
- [ ] Update operation verifies written version matches expected version + 1
- [ ] On version conflict, operation retries up to maxRetries times (default 3)
- [ ] After maxRetries failures, operation throws error with conflict details
- [ ] Version conflicts logged with sessionId and attempt number
- [ ] Successful updates return without error

## Rationale

Optimistic locking provides:

1. **Conflict detection** - Version mismatches indicate concurrent updates
2. **Automatic retry** - Transient conflicts resolved without manual intervention
3. **No distributed locks** - Avoids complexity of distributed locking mechanisms
4. **Performance** - Read and write operations unblocked by locks
5. **Durability** - Brain notes remain source of truth with conflict resolution

The 3-retry limit balances reliability (handle transient conflicts) with failure detection (persistent conflicts surface as errors).

## Dependencies

- Brain MCP for note read/write operations (REQ-005)
- Session state schema with version field (REQ-001)
- JSON serialization for state persistence

## Related Artifacts

- ADR-016: Automatic Session Protocol Enforcement (Resolution 2)
- REQ-001: Session state schema with orchestrator workflow
- REQ-005: Brain note persistence model
- DESIGN-001: Session state architecture
