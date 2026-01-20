---
type: task
id: TASK-016
title: Integrate Validate-Consistency into Enforcement
status: complete
priority: P0
complexity: M
estimate: 4h
related:
  - REQ-006
  - TASK-015
blocked_by:
  - TASK-015
blocks: []
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - integration
  - wasm
  - inngest
---

# TASK-016: Integrate Validate-Consistency into Enforcement

## Design Context

- REQ-006: Cross-Document Consistency Validation
- TASK-015: Implement Validate-Consistency in Go

## Objective

Integrate Go-based consistency validator into session protocol enforcement system via WASM and Inngest workflows.

## Scope

**In Scope**:

- WASM build for consistency validator
- Inngest function registration
- Enforcement point integration in session end workflow
- Test coverage for integration

**Out of Scope**:

- Validator implementation (covered by TASK-015)
- Changes to validation logic

## Acceptance Criteria

- [ ] WASM build succeeds for validate-consistency.go
- [ ] Inngest function registered for consistency validation
- [ ] Session end workflow calls consistency validator
- [ ] Validator results propagate to session state
- [ ] Integration tests verify WASM invocation
- [ ] Error handling for validator failures
- [ ] Performance metrics logged (execution time)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `packages/validation/wasm/main.go` | Modify | Register consistency validator |
| `apps/session-protocol/inngest/functions/validate-consistency.ts` | Create | Inngest function wrapper |
| `apps/session-protocol/inngest/workflows/session-end.ts` | Modify | Add consistency check step |
| `apps/session-protocol/tests/integration/consistency.test.ts` | Create | Integration tests |

## Implementation Notes

**WASM Export**:

```go
//export validateConsistency
func validateConsistency(featuresPtr *C.char, checkpointPtr *C.char) *C.char {
    // Implementation
}
```

**Inngest Function**:

```typescript
export const validateConsistency = inngest.createFunction(
  { id: "validate-consistency" },
  { event: "session/validate-consistency" },
  async ({ event, step }) => {
    // Load WASM module
    // Call validator
    // Return results
  }
);
```

## Testing Requirements

- [ ] Test WASM compilation and loading
- [ ] Test Inngest function invocation
- [ ] Test validator result propagation
- [ ] Test error handling (WASM panic, invalid input)
- [ ] Test performance metrics collection
