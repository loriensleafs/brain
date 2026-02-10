## TODO Management

### Context Maintenance (CRITICAL)

**Anti-Pattern:**

```text
Early work:     Following TODO
Extended work:  Stopped referencing TODO, lost context
After pause:    Asking "what were we working on?"
```

**Correct Behavior:**

```text
Early work:     Create TODO and work through it
Mid-session:    Reference TODO by step numbers
Extended work:  Review remaining items after each phase
After pause:    Review TODO list to restore context
```

### Segue Management

When encountering issues requiring investigation:

```markdown
- [x] Step 1: Completed
- [ ] Step 2: Current task <- PAUSED for segue
  - [ ] SEGUE 2.1: {announce_pattern}
  - [ ] SEGUE 2.2: Forward findings to implementer {worker} for fix
  - [ ] SEGUE 2.3: Validate resolution via qa {worker}
  - [ ] RESUME: Complete Step 2
- [ ] Step 3: Future task
```
