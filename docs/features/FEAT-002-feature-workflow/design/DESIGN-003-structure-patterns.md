---
title: DESIGN-003-structure-patterns
type: design
status: draft
permalink: features/feat-002-feature-workflow/design/design-003-structure-patterns
feature-ref: FEAT-002
req-refs:
- REQ-001
- REQ-002
created-by: planner
tags:
- design
- feature-workflow
- patterns
- best-practices
---

# DESIGN-003: Structure Patterns and Best Practices

## Overview

This document captures common patterns, anti-patterns, and practical guidance for working with the ADR-001 unified artifact structure.

## Common Patterns

### Pattern 1: Requirements to Implementation
```text
FEAT-NNN (feature overview)
├── REQ-NNN (what must be true)
│   └── implements <- TASK-NNN (how to build it)
├── DESIGN-NNN (technical approach)
│   └── implements <- TASK-NNN
└── TASK-NNN (execution)
```

### Pattern 2: Sequential Task Dependencies
Tasks numbered in execution order with blocked_by/enables relations:
```text
TASK-001 (foundation)
├── enables -> TASK-002
│   ├── enables -> TASK-003
│   └── enables -> TASK-004
```
TASK-001 blocks all subsequent tasks; numbers match execution order.

### Pattern 3: Multiple Designs for One Requirement
```text
REQ-NNN (single requirement)
├── relates_to -> DESIGN-001 (Option A: faster, less robust)
├── relates_to -> DESIGN-002 (Option B: slower, more correct)
└── satisfied_by -> TASK-NNN (using DESIGN-001)
```

### Pattern 4: Shared Design Between Requirements
```text
DESIGN-NNN (shared technical pattern)
├── satisfies -> REQ-001
├── satisfies -> REQ-002
└── satisfies -> REQ-003
```

## Anti-Patterns

### Avoid: Circular Dependencies
**Bad**: TASK-A `blocked_by` TASK-B, TASK-B `blocked_by` TASK-A
**Fix**: Break into smaller tasks or use `related_to` instead of `blocked_by`

### Avoid: Task Numbers Not Matching Execution Order
**Bad**: TASK-001 blocked_by TASK-005 (lower blocked by higher)
**Fix**: Renumber tasks so TASK-001 executes first, TASK-002 second, etc.

### Avoid: Vague Acceptance Criteria
**Bad**: "Task is done when it works"
**Good**: "Feature passes all 47 test cases and load test at 1000 req/sec"

### Avoid: Missing Requirement-to-Task Traceability
**Bad**: TASK created without clear link to requirement
**Good**: TASK has `implements` link to REQ-NNN and DESIGN-NNN

### Avoid: Status Drift
**Bad**: TASK marked "done" but implementation is incomplete
**Good**: "done" means Definition of Done checklist is 100% complete

### Avoid: Over-Granular Tasks
**Bad**: 50 tasks of 5 minutes each (creates overhead)
**Good**: 5-8 tasks per feature, 1-8 hours effort each

## Observations

- [pattern] Task numbering must match execution order per ADR-001 #sequencing
- [pattern] Relations document dependencies but numbers are authoritative #ordering
- [anti-pattern] Lower-numbered tasks blocked by higher numbers indicates wrong sequencing #violation
- [guidance] 5-8 tasks per feature is optimal granularity #sizing
- [guidance] Observations section preserves decision rationale for future readers #documentation

## Relations

- implements [[FEAT-002-feature-workflow]]
- satisfies [[REQ-001-agent-prompts-output-to-unified-structure]]
- satisfies [[REQ-002-mandatory-relations-section]]
- complements [[DESIGN-002-artifact-mapping]]
- derives_from [[ADR-001-feature-workflow]]
