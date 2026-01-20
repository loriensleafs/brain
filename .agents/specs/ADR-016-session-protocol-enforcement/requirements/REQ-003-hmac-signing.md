---
type: requirement
id: REQ-003
title: HMAC-SHA256 signing for session state integrity
status: accepted
priority: P0
category: non-functional
epic: EPIC-ADR-016-implementation
related:
  - ADR-016
  - REQ-001
  - REQ-002
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - security
  - integrity
  - hmac
  - signing
---

# REQ-003: HMAC-SHA256 Signing for Session State Integrity

## Requirement Statement

WHEN session state is persisted to Brain notes
THE SYSTEM SHALL sign the state using HMAC-SHA256 with a server-side secret key
SO THAT tampering with session state files is detectable and workflow gates cannot be bypassed.

## Context

Brain notes are plaintext markdown files stored in the file system. Without integrity protection, users can tamper with session state to bypass workflow mode gates:

1. User modifies `sessions/session-{id}.md` to set `protocolStartComplete: true`
2. PreToolUse hook reads tampered state
3. Tools are allowed despite protocol steps not executing
4. Session protocol requirements are bypassed

HMAC-SHA256 signing ensures tampering is detected before session state is used for gate decisions.

## Acceptance Criteria

- [ ] BRAIN_SESSION_SECRET environment variable required on MCP startup
- [ ] MCP startup fails with error if BRAIN_SESSION_SECRET not set
- [ ] SignedSessionState interface extends SessionState with _signature field
- [ ] signSessionState function creates HMAC-SHA256 signature of state (excluding _signature field)
- [ ] Signature input is JSON serialized with sorted keys (canonical form)
- [ ] Signature stored in _signature field as hexadecimal string
- [ ] verifySessionState function recalculates signature and compares with stored signature
- [ ] Verification returns true if signatures match, false otherwise
- [ ] PreToolUse hook calls verifySessionState before using state for gate decisions
- [ ] PreToolUse hook blocks all tools if signature verification fails
- [ ] Signature verification failure logged with sessionId and warning
- [ ] Brain CLI get-state command verifies signature before returning state

## Rationale

HMAC-SHA256 signing provides:

1. **Integrity protection** - Detect tampering with session state files
2. **Security gate enforcement** - Prevent bypass of workflow mode restrictions
3. **Audit trail** - Log signature failures for security monitoring
4. **Server-side secret** - Users cannot forge valid signatures
5. **Canonical serialization** - Sorted keys prevent signature variance from key order

Using HMAC (not asymmetric signatures) avoids key management complexity while providing sufficient integrity protection for local file tampering.

## Dependencies

- Node.js crypto module (HMAC-SHA256 implementation)
- BRAIN_SESSION_SECRET environment variable (32+ character random string)
- Brain note persistence (REQ-005)
- Session state schema (REQ-001)

## Related Artifacts

- ADR-016: Automatic Session Protocol Enforcement (Resolution 3)
- REQ-001: Session state schema
- REQ-004: Fail-closed hook behavior
- REQ-005: Brain note persistence model
- DESIGN-001: Session state architecture
