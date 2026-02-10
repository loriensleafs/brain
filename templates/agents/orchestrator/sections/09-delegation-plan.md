### Consistency Checkpoint (Pre-Critic)

Before routing to critic {worker}, you ({lead_role}) MUST validate cross-document consistency.

**Checkpoint Location**: After task-generator completes, before critic review.

**Validation Checklist**:

```markdown
- [ ] Epic scope matches PRD scope (no scope drift)
- [ ] All PRD requirements have corresponding tasks
- [ ] Task estimates align with PRD complexity assessment
- [ ] Naming conventions followed (EPIC-NNN, ADR-NNN patterns)
- [ ] Cross-references between documents are valid (paths exist)
- [ ] No orphaned tasks (all tasks trace to PRD requirements)
- [ ] Memory entities updated with current state
```

**Failure Action**: If validation fails, {route_back} with specific inconsistencies:

```markdown
## Consistency Validation Failed

**Checkpoint**: Pre-critic validation
**Status**: FAILED

### Inconsistencies Found

| Document   | Issue                    | Required Action |
| ---------- | ------------------------ | --------------- |
| [doc path] | [specific inconsistency] | [what to fix]   |

### Routing Decision

Return to: planner {worker}
Reason: [explanation]
```

**Pass Action**: If validation passes, route to critic {worker} with confirmation:

```markdown
## Consistency Validation Passed

**Checkpoint**: Pre-critic validation
**Status**: PASSED

### Validated Artifacts

- Epic: [path]
- PRD: [path]
- Tasks: [path]

### Routing Decision

Continue to: critic {worker}
```

**Automation**: Run `scripts/Validate-Consistency.ps1 -Feature "[name]"` for automated validation.
