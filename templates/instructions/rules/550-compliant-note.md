### Example: Compliant Note

```markdown
---
title: ADR-019 Memory Governance
type: decision
tags: [memory, governance, enforcement]
---

# ADR-019 Memory Governance

## Observations

- [decision] Validation-based governance selected #architecture
- [fact] All agents retain direct write access #one-level-delegation
- [requirement] Pre-flight validation MUST pass before writes #blocking

## Relations

- supersedes [[Ad-hoc Memory Writing]]
- implements [[ADR-007 Memory-First Architecture]]
```
