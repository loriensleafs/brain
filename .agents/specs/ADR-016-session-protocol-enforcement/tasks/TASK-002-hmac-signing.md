---
type: task
id: TASK-002
title: Implement HMAC-SHA256 session state signing
status: complete
priority: P0
complexity: S
estimate: 3h
related:
  - DESIGN-001
  - REQ-003
blocked_by:
  - TASK-001
blocks:
  - TASK-003
  - TASK-006
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - security
  - hmac
  - signing
---

# TASK-002: Implement HMAC-SHA256 Session State Signing

## Design Context

- DESIGN-001: Session state architecture (Component 3: Session State Signing)

## Objective

Implement HMAC-SHA256 signing and verification functions to prevent tampering with session state stored in Brain notes.

## Scope

**In Scope**:

- signSessionState function with canonical JSON serialization
- verifySessionState function with signature comparison
- BRAIN_SESSION_SECRET environment variable validation
- Error handling for missing secret

**Out of Scope**:

- Integration with Brain persistence (TASK-003)
- Hook integration (TASK-006)
- Key rotation mechanism

## Acceptance Criteria

- [ ] File created at `apps/mcp/src/services/session/signing.ts`
- [ ] BRAIN_SESSION_SECRET environment variable checked on module load
- [ ] Module throws error if BRAIN_SESSION_SECRET not set
- [ ] signSessionState function creates HMAC-SHA256 signature
- [ ] Signature excludes _signature field from input
- [ ] JSON serialization uses sorted keys for canonical form
- [ ] Signature stored as hexadecimal string in _signature field
- [ ] verifySessionState function recalculates signature
- [ ] Verification returns true if signatures match, false otherwise
- [ ] Both functions exported
- [ ] Functions handle edge cases (missing fields, null values)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/signing.ts` | Create | HMAC signing implementation |

## Implementation Notes

Use Node.js crypto module's createHmac function. Follow the implementation from DESIGN-001 Component 3.

Key points:

1. Remove _signature field before serialization
2. Sort object keys for canonical JSON
3. Use HMAC-SHA256 with SESSION_SECRET
4. Return hex-encoded signature

Example:

```typescript
import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.BRAIN_SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("BRAIN_SESSION_SECRET environment variable required");
}

export function signSessionState(state: SessionState): SignedSessionState {
  const stateWithoutSignature = { ...state };
  delete (stateWithoutSignature as any)._signature;

  const serialized = JSON.stringify(
    stateWithoutSignature,
    Object.keys(stateWithoutSignature).sort()
  );

  const signature = createHmac('sha256', SESSION_SECRET)
    .update(serialized)
    .digest('hex');

  return { ...state, _signature: signature };
}
```

## Testing Requirements

- [ ] Unit test: signSessionState creates signature
- [ ] Unit test: verifySessionState returns true for valid signature
- [ ] Unit test: verifySessionState returns false for tampered state
- [ ] Unit test: verifySessionState returns false for missing signature
- [ ] Unit test: Canonical serialization (key order doesn't affect signature)
- [ ] Unit test: Module throws error if BRAIN_SESSION_SECRET missing
