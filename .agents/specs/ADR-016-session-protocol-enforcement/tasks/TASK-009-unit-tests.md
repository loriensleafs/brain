---
type: task
id: TASK-009
title: Write comprehensive unit tests for all components
status: complete
priority: P0
complexity: L
estimate: 8h
related:
  - DESIGN-001
  - REQ-001
  - REQ-002
  - REQ-003
  - REQ-004
  - REQ-005
blocked_by:
  - TASK-001
  - TASK-002
  - TASK-003
  - TASK-004
  - TASK-005
  - TASK-006
  - TASK-007
blocks: []
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - testing
  - unit-tests
---

# TASK-009: Write Comprehensive Unit Tests for All Components

## Design Context

- DESIGN-001: Session state architecture

## Objective

Write unit tests for all session state components to ensure correctness and prevent regressions.

## Scope

**In Scope**:

- Unit tests for types.ts (type validation)
- Unit tests for signing.ts (HMAC signing and verification)
- Unit tests for brain-persistence.ts (Brain note read/write)
- Unit tests for optimistic-locking.ts (version conflict handling)
- Unit tests for compaction.ts (history compaction)
- Unit tests for SessionService (all methods)
- Unit tests for Brain CLI commands
- Unit tests for PreToolUse hook gate logic

**Out of Scope**:

- Integration tests (separate task)
- End-to-end tests (separate task)
- Performance tests (separate task)

## Acceptance Criteria

- [ ] Test file created for each component file
- [ ] All public functions have unit tests
- [ ] Test coverage >= 90% for session state modules
- [ ] Tests use mocking for Brain MCP client
- [ ] Tests use fixtures for sample session state
- [ ] Edge cases tested (null values, missing fields, invalid signatures)
- [ ] Error conditions tested (missing secret, version conflicts, signature failures)
- [ ] All tests pass
- [ ] Tests run in CI pipeline

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/__tests__/types.test.ts` | Create | Type validation tests |
| `apps/mcp/src/services/session/__tests__/signing.test.ts` | Create | HMAC signing tests |
| `apps/mcp/src/services/session/__tests__/brain-persistence.test.ts` | Create | Persistence tests |
| `apps/mcp/src/services/session/__tests__/optimistic-locking.test.ts` | Create | Locking tests |
| `apps/mcp/src/services/session/__tests__/compaction.test.ts` | Create | Compaction tests |
| `apps/mcp/src/services/session/__tests__/index.test.ts` | Create | SessionService tests |
| `apps/cli/src/commands/session/__tests__/get-state.test.ts` | Create | CLI tests |
| `apps/claude-plugin/cmd/hooks/__tests__/pre_tool_use_test.go` | Create | Hook tests (Go) |

## Implementation Notes

### Test Structure

Use Jest for TypeScript tests, Go testing package for hook tests.

Example test structure:

```typescript
import { signSessionState, verifySessionState } from '../signing';

describe('Session State Signing', () => {
  beforeAll(() => {
    process.env.BRAIN_SESSION_SECRET = 'test-secret-32-characters-long';
  });

  describe('signSessionState', () => {
    it('creates HMAC-SHA256 signature', () => {
      const state = createMockSessionState();
      const signed = signSessionState(state);
      expect(signed._signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it('excludes _signature from input', () => {
      const state = { ...createMockSessionState(), _signature: 'old' };
      const signed = signSessionState(state);
      expect(signed._signature).not.toBe('old');
    });
  });

  describe('verifySessionState', () => {
    it('returns true for valid signature', () => {
      const state = createMockSessionState();
      const signed = signSessionState(state);
      expect(verifySessionState(signed)).toBe(true);
    });

    it('returns false for tampered state', () => {
      const state = createMockSessionState();
      const signed = signSessionState(state);
      signed.version = 999; // Tamper
      expect(verifySessionState(signed)).toBe(false);
    });

    it('returns false for missing signature', () => {
      const state = createMockSessionState();
      expect(verifySessionState(state as any)).toBe(false);
    });
  });
});
```

### Mock Fixtures

Create shared fixtures for testing:

```typescript
// apps/mcp/src/services/session/__tests__/fixtures.ts
export function createMockSessionState(): SessionState {
  return {
    sessionId: 'test-session-123',
    currentMode: 'analysis',
    modeHistory: [],
    protocolStartComplete: true,
    protocolEndComplete: false,
    protocolStartEvidence: {},
    protocolEndEvidence: {},
    orchestratorWorkflow: null,
    version: 1,
    createdAt: '2026-01-18T00:00:00Z',
    updatedAt: '2026-01-18T00:00:00Z',
  };
}

export function createMockBrainMCP(): BrainMCPClient {
  return {
    writeNote: jest.fn(),
    readNote: jest.fn(),
  } as any;
}
```

### Test Categories

1. **Happy path tests** - Normal operation succeeds
2. **Edge case tests** - Null values, empty arrays, missing fields
3. **Error condition tests** - Missing secret, invalid signature, version conflict
4. **Boundary tests** - Compaction at exactly 10, 11, 100 invocations
5. **Concurrency tests** - Optimistic locking with simulated conflicts

## Testing Requirements

- [ ] All components have >= 90% test coverage
- [ ] All edge cases tested
- [ ] All error conditions tested
- [ ] Tests pass in CI
- [ ] Tests run in < 30 seconds
