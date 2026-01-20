---
type: requirement
id: REQ-004
title: Fail-closed behavior for PreToolUse hook gate checks
status: accepted
priority: P0
category: non-functional
epic: EPIC-ADR-016-implementation
related:
  - ADR-016
  - REQ-003
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - security
  - fail-closed
  - gate-check
  - hooks
---

# REQ-004: Fail-Closed Behavior for PreToolUse Hook Gate Checks

## Requirement Statement

WHEN PreToolUse hook cannot read session state OR signature verification fails
THE SYSTEM SHALL block all destructive tools (Edit, Write, Bash) and allow only read-only tools (Read, Glob, Grep, LSP, WebFetch, WebSearch)
SO THAT session protocol violations cannot proceed when gate state is unknown or compromised.

## Context

The current PreToolUse hook implementation fails open when session state is unavailable. This allows users to bypass workflow mode restrictions by:

1. Deleting session state file
2. Stopping MCP server
3. Corrupting session state JSON

Fail-closed behavior ensures that destructive operations are blocked when gate state cannot be verified.

## Acceptance Criteria

- [ ] PerformGateCheck function calls brainCLI.GetSessionState to read session state
- [ ] If GetSessionState returns error, check tool name against read-only tool list
- [ ] Read-only tools (Read, Glob, Grep, LSP, WebFetch, WebSearch) allowed when state unavailable
- [ ] Destructive tools (Edit, Write, Bash, TodoWrite) blocked when state unavailable
- [ ] Block message includes: "Session state unavailable. Blocking {tool}. Use /mode disabled to override."
- [ ] If session state signature verification fails, block all destructive tools
- [ ] Signature failure message includes: "Session state signature invalid - possible tampering"
- [ ] Mode "disabled" bypasses all gate checks (explicit opt-out)
- [ ] Mode "unknown" (error state) allows only read-only tools
- [ ] Mode-based checks apply when state is available and verified
- [ ] isReadOnlyTool function implemented with tool name whitelist

## Rationale

Fail-closed behavior provides:

1. **Security by default** - Destructive operations blocked when state unknown
2. **Explicit opt-out** - Users must deliberately set mode to "disabled" to bypass gates
3. **Graceful degradation** - Read-only tools remain available for investigation
4. **Tamper detection** - Signature failures block destructive operations
5. **Clear error messages** - Users understand why tools are blocked

The read-only tool whitelist enables users to diagnose session state issues without allowing destructive changes.

## Dependencies

- Brain CLI get-state command (REQ-005)
- Session state signature verification (REQ-003)
- PreToolUse hook implementation in Go

## Related Artifacts

- ADR-016: Automatic Session Protocol Enforcement (Resolution 4)
- REQ-003: HMAC-SHA256 signing
- REQ-005: Brain note persistence model
- DESIGN-001: Session state architecture
