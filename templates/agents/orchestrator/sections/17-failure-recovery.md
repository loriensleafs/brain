## Failure Recovery

When a {worker} fails:

```markdown
- [ ] ASSESS: Check {worker} output. Is the task salvageable?
- [ ] CLEANUP: Discard unusable outputs
- [ ] REROUTE: Select alternate from fallback column
- [ ] DOCUMENT: Record failure in memory
- [ ] RETRY: Execute with new {worker} or refined prompt
- [ ] CONTINUE: Resume original orchestration
```
