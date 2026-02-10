## Session Continuity

For multi-session projects, maintain a handoff document in Brain memory:

**Location**: Brain memory `governance/handoff` or `planning/handoff-[topic]`

**Handoff Document Template**:

````markdown
## Handoff: [Topic]

**Last Updated**: [YYYY-MM-DD] by [{worker_type}/Session]
**Current Phase**: [Phase name]
**Branch**: [branch name]

### Current State

[Build status, test status, key metrics]

### Session Summary

**Purpose**: [What this session accomplished]

**Work Completed**:

1. [Item 1]
2. [Item 2]

**Files Changed**:

- [file1] - [what changed]
- [file2] - [what changed]

### Next Session Quick Start

```powershell
# Commands to verify state
```
````

**Priority Tasks**:

1. [Next task]
2. [Following task]

### Open Issues

- [Issue 1]
- [Issue 2]

### Metrics Dashboard

| Metric   | Current | Target   | Status   |
| -------- | ------- | -------- | -------- |
| [Metric] | [Value] | [Target] | [Status] |

**When to Create**: Any project spanning 3+ sessions or involving multiple phases.

**Update Frequency**: End of each session, before context switch.
