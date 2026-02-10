### Delegation Plan Quality Check

Before executing, validate your plan:

```markdown
- [ ] PARALLEL CHECK: Are there {worker_plural} with unnecessary dependencies?
- [ ] SWARM CHECK: Does any {workflow_unit} have 2+ independent sub-items that should be split?
- [ ] SCOPE CHECK: Does the number of {worker_plural} match the problem complexity?
- [ ] OVERLAP CHECK: For same-type swarms, are file scopes non-overlapping?
- [ ] PROMPT CHECK: Does each {worker} have enough context to work independently?
```

**Under-parallelization is a failure mode.** If your plan has 5 sequential {worker_plural} and 0 parallel {workflow_unit}s, you are almost certainly wrong. Re-examine dependencies. For each single-{worker} step, ask: "Could this work be decomposed into multiple independent items?" Bias toward yes. But don't force splits that would create cross-{worker} conflicts.

**Over-orchestration is also a failure mode.** A simple question does not need 6 {worker_plural}. Match investment to problem scope.
