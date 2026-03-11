---
description: Auto-generate session documentation and sync workflow artifacts. Always the last command in a workflow sequence.
model: sonnet
---

# /9-sync - Documentation Sync

Capture session work into structured documentation. Queries agent execution history and synthesizes a workflow summary. Always the last command in a workflow sequence.

## Actions

1. **Query agent history** - Retrieve all agent invocations from the current session
2. **Generate workflow diagram** - Sequence of agents invoked and their outcomes
3. **Extract decisions** - Document key decisions made during the session
4. **List artifacts** - Files created, modified, or deleted
5. **Append to session log** - Write structured entry to Brain `sessions/` folder
6. **Update Brain memory** - Persist cross-session context for the next session
7. **Suggest retrospective learnings** - Identify patterns worth capturing as memories

## MCP Integration

Maps to Agent Orchestration MCP (ADR-013): `agents://history` resource and Session State MCP (ADR-011): `session://state` resource. Fallback: parse session log and Git history.

## Session Log Format

```markdown
## Session [YYYY-MM-DD-NN]

**Date**: YYYY-MM-DD
**Branch**: feature/xxx
**Duration**: ~Xh

### Workflow Sequence

/0-init -> /1-plan -> /2-impl -> /3-qa -> /9-sync

### Agents Invoked

| # | Agent | Duration | Result |
|---|-------|----------|--------|
| 1 | planner | ~5m | Plan created |
| 2 | implementer | ~15m | 4 files changed |
| 3 | qa | ~8m | All tests pass |

### Decisions Made

- [Decision 1]: Chose X over Y because Z
- [Decision 2]: ...

### Artifacts

- Created: `src/auth.ts`
- Modified: `src/routes/user.ts`
- Created: `tests/auth.test.ts`

### Retrospective Suggestions

- Pattern: [description of reusable pattern]
- Learning: [insight to persist as memory]
```

## Brain Memory Update

Write a session summary note to Brain memory:

```text
Use mcp__plugin_brain_brain__write_note to create session summary with:
- What was done
- What remains in progress
- Any blockers
- Recommended next steps
```

## Output

- **Session log entry** - Written to Brain `sessions/` folder
- **Brain memory update** - Cross-session context preserved
- **Workflow diagram** - Visual sequence of agent invocations
- **Retrospective suggestions** - Learnings to capture as memories

## Sequence Position

```text
/0-init -> /1-plan -> /2-impl -> /3-qa -> /4-security -> > /9-sync
```

## References

- ADR-011: Session State MCP
- ADR-013: Agent Orchestration MCP

## Examples

```text
/9-sync
/9-sync Generate session documentation and update Brain memory
```
