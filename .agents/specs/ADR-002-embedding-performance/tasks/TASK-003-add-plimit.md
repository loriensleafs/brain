---
type: task
id: TASK-003
title: Add p-limit dependency for concurrency control
status: complete
priority: P0
complexity: XS
estimate: 30min
related:
  - DESIGN-002
  - REQ-002
blocked_by: []
blocks:
  - TASK-002
assignee: implementer
created: 2026-01-19
updated: 2026-01-19
author: spec-generator
tags:
  - dependencies
  - p-limit
  - concurrency
---

# TASK-003: Add p-limit Dependency for Concurrency Control

## Design Context

- DESIGN-002: p-limit concurrency control architecture

## Objective

Add the p-limit npm package as a dependency to enable queue-based concurrency limiting for embedding operations.

## Scope

**In Scope**:

- Add p-limit to package.json using Bun package manager
- Verify package installation
- Verify Bun compatibility
- Update lockfile (bun.lock)

**Out of Scope**:

- Implementation of concurrency logic (handled in TASK-002)
- Configuration of concurrency limits (handled in TASK-002)
- Testing (handled in TASK-005)

## Acceptance Criteria

- [ ] Command executed: `bun add p-limit`
- [ ] package.json includes p-limit dependency
- [ ] bun.lock updated with p-limit entry
- [ ] Package version: latest stable (currently ~5.0.0)
- [ ] Zero vulnerabilities in dependency tree
- [ ] TypeScript types included (p-limit ships with types)
- [ ] Import succeeds: `import pLimit from 'p-limit'`
- [ ] TypeScript compilation succeeds after import

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/package.json` | Modify | Add p-limit dependency |
| `apps/mcp/bun.lock` | Modify | Update lockfile |

## Implementation Notes

### Step 1: Add Dependency

```bash
cd apps/mcp
bun add p-limit
```

### Step 2: Verify Installation

```bash
# Check package.json
grep p-limit package.json

# Expected output:
# "p-limit": "^5.0.0"

# Verify types are available
bun run tsc --noEmit
```

### Step 3: Test Import

Create temporary test file to verify import:

```typescript
// test-plimit.ts
import pLimit from 'p-limit';

const limit = pLimit(4);

const tasks = [1, 2, 3, 4, 5].map(i =>
  limit(() => {
    console.log(`Task ${i}`);
    return Promise.resolve(i);
  })
);

await Promise.all(tasks);
console.log('All tasks complete');
```

Run test:

```bash
bun run test-plimit.ts
# Should output: Task 1-5 (max 4 concurrent)
```

Delete test file after verification.

## Testing Requirements

- [ ] Package installs without errors
- [ ] No vulnerability warnings from `bun audit`
- [ ] TypeScript compilation succeeds
- [ ] Test import runs successfully
- [ ] Lockfile committed to git

## Dependencies

- Bun package manager installed
- Internet connection for npm registry access
- package.json exists at apps/mcp/package.json

## Package Details

| Property | Value |
|----------|-------|
| **Name** | p-limit |
| **Version** | ~5.0.0 (latest stable) |
| **Size** | 4.3kB (minified) |
| **Dependencies** | 0 (zero dependencies) |
| **License** | MIT |
| **TypeScript** | Yes (included types) |
| **Bun Compatible** | Yes (tested) |
| **Maintainer** | Sindre Sorhus |
| **Weekly Downloads** | 100M+ |

## Related Tasks

- TASK-002: Refactor embed tool (uses p-limit)
- TASK-005: Add tests (tests concurrency behavior)

## Rollback Plan

If p-limit causes issues:

```bash
cd apps/mcp
bun remove p-limit
git checkout package.json bun.lock
```

Alternative implementations:

- Manual Promise pooling (more complex, not recommended)
- async-pool package (similar functionality)
