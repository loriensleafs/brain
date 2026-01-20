---
type: task
id: TASK-008
title: Remove file cache code and migrate to Brain notes
status: complete
priority: P1
complexity: S
estimate: 2h
related:
  - DESIGN-001
  - REQ-005
blocked_by:
  - TASK-003
  - TASK-005
blocks: []
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - cleanup
  - migration
  - file-cache
---

# TASK-008: Remove File Cache Code and Migrate to Brain Notes

## Design Context

- DESIGN-001: Session state architecture (Brain note persistence eliminates file cache)

## Objective

Remove all file cache code (`session.json` read/write) and ensure all session state persistence uses Brain notes exclusively.

## Scope

**In Scope**:

- Identify and delete file cache read/write code
- Remove `~/.local/state/brain/session.json` references
- Update any code that references file cache
- Add deprecation notice to documentation

**Out of Scope**:

- Migration of existing file cache data to Brain notes (users start fresh)
- Backwards compatibility with file cache

## Acceptance Criteria

- [ ] All file cache read operations removed
- [ ] All file cache write operations removed
- [ ] No references to `~/.local/state/brain/session.json` in code
- [ ] No references to file cache in documentation
- [ ] SessionService uses only BrainSessionPersistence
- [ ] MCP startup does not attempt to load from file cache
- [ ] Code compiles without errors
- [ ] All tests pass after removal

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/src/services/session/*` | Modify | Remove file cache code |
| Documentation | Modify | Remove file cache references |

## Implementation Notes

Search codebase for:

1. `session.json` references
2. File system read/write operations for session state
3. `fs.promises.readFile` / `fs.promises.writeFile` in session service
4. Path.join operations constructing session.json path

Replace all with Brain MCP operations via BrainSessionPersistence.

Example before:

```typescript
// REMOVE THIS
const sessionPath = path.join(stateDir, 'session.json');
const sessionData = await fs.promises.readFile(sessionPath, 'utf-8');
```

Example after:

```typescript
// USE THIS
const session = await persistence.loadSession(sessionId);
```

## Testing Requirements

- [ ] Unit test: Verify no file cache read/write in codebase (grep test)
- [ ] Integration test: MCP startup does not look for session.json
- [ ] Integration test: Session state persists only to Brain notes
- [ ] Regression test: All existing tests pass after file cache removal
