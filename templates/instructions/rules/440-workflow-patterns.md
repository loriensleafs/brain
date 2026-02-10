## Workflow Patterns

**Notation**: `->` = sequential (output required), `||` = parallel (independent), `xN` = same-type swarm

| Pattern | Sequence |
|:--|:--|
| Standard Feature | `analyst*N -> architect -> planner -> critic -> implementer*N -> qa -> retrospective` |
| Impact Analysis | `analyst -> planner -> [implementer || architect || security || devops || qa] -> critic -> implementer -> qa` |
| Quick Fix | `implementer -> qa` |
| Strategic Decision | `[independent-thinker || high-level-advisor] -> task-generator` |
| Ideation | `analyst -> [high-level-advisor || independent-thinker || critic] -> roadmap -> explainer -> task-generator` |

These show {{worker}} TYPES, not COUNT. Any step can expand into a same-type swarm sized to the work. `analyst` might become `analyst*3` for focused investigation or `analyst*8` for broad system survey. Aggressively decompose to find the finest independent splits.
