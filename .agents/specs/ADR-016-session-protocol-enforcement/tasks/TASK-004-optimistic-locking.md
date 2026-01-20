---
type: task
id: TASK-004
title: Implement optimistic locking for concurrent updates
status: complete
priority: P0
complexity: M
estimate: 4h
related:
  - DESIGN-001
  - REQ-002
blocked_by:
  - TASK-003
blocks:
  - TASK-005
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - concurrency
  - optimistic-locking
---

# TASK-004: Implement Optimistic Locking for Concurrent Updates

## Design Context

- DESIGN-001: Session state architecture (Component 4: Optimistic Locking)

## Objective

Implement version-based optimistic locking to prevent concurrent session state updates from corrupting data.

## Scope

**In Scope**:

- updateSessionWithLocking function with retry logic
- Version conflict detection via expected vs. actual version comparison
- Automatic retry up to maxRetries (default 3)
- Error throwing after max retries
- Logging of version conflicts

**Out of Scope**:

- Session service integration (TASK-005)
- Distributed locking mechanisms
- Key-based locking

## Acceptance Criteria

- [ ] File created at `apps/mcp/src/services/session/optimistic-locking.ts`
- [ ] updateSessionWithLocking function accepts sessionId, updates, maxRetries
- [ ] Function reads current session state
- [ ] Function applies updates and increments version by 1
- [ ] Function writes updated state via BrainSessionPersistence
- [ ] Function verifies written version matches expected version + 1
- [ ] On version mismatch, function retries up to maxRetries times
- [ ] Version conflicts logged with sessionId and attempt number
- [ ] After max retries, function throws error with details
- [ ] Function exported
- [ ] Default maxRetries is 3

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/optimistic-locking.ts` | Create | Optimistic locking implementation |

## Implementation Notes

Follow DESIGN-001 Component 4. Key algorithm:

```
for attempt in 1..maxRetries:
  current = loadSession(sessionId)
  expectedVersion = current.version

  updated = { ...current, ...updates, version: expectedVersion + 1 }
  saveSession(updated)

  verification = loadSession(sessionId)
  if verification.version == expectedVersion + 1:
    return SUCCESS

  log conflict, continue retry loop

throw error after maxRetries
```

Example structure:

```typescript
export async function updateSessionWithLocking(
  sessionId: string,
  updates: Partial<SessionState>,
  maxRetries: number = 3
): Promise<void> {
  const persistence = new BrainSessionPersistence(brainMCP);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const current = await persistence.loadSession(sessionId);
    if (!current) throw new Error(`Session ${sessionId} not found`);

    const expectedVersion = current.version;
    const updated = {
      ...current,
      ...updates,
      version: expectedVersion + 1,
      updatedAt: new Date().toISOString(),
    };

    await persistence.saveSession(updated);

    const verification = await persistence.loadSession(sessionId);
    if (verification && verification.version === expectedVersion + 1) {
      return;
    }

    console.warn(`Version conflict on session ${sessionId}, attempt ${attempt + 1}`);
  }

  throw new Error(`Failed to update session ${sessionId} after ${maxRetries} attempts`);
}
```

## Testing Requirements

- [ ] Unit test: Successful update on first attempt
- [ ] Unit test: Retry on version conflict, succeed on second attempt
- [ ] Unit test: Throw error after max retries
- [ ] Unit test: Version increments correctly
- [ ] Unit test: updatedAt field updated
- [ ] Integration test: Concurrent updates cause conflicts
- [ ] Integration test: Verify logging of conflict attempts
