---
type: task
id: TASK-003
title: Integrate catch-up trigger into bootstrap_context
status: todo
priority: P0
complexity: XS
estimate: 0.5h
related:
  - DESIGN-001
  - REQ-002
blocked_by:
  - TASK-001
  - TASK-002
blocks:
  - TASK-004
assignee: implementer
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - integration
  - bootstrap-context
---

# TASK-003: Integrate Catch-up Trigger into Bootstrap Context

## Design Context

- DESIGN-001: Bootstrap context catch-up trigger architecture

## Objective

Add catch-up trigger invocation to bootstrap_context tool at session start. Trigger fires after context building completes, before returning to user.

## Scope

**In Scope**:

- Import catch-up trigger functions
- Add trigger invocation after context building
- Ensure non-blocking (fire-and-forget)

**Out of Scope**:

- Conditional logic (always attempt query)
- Configuration (no enable/disable flag)

## Acceptance Criteria

- [ ] Catch-up trigger invoked after context building completes
- [ ] Trigger invocation is fire-and-forget (not awaited)
- [ ] Bootstrap_context response time unchanged (no blocking)
- [ ] Trigger only fires when project is resolved (not on error path)
- [ ] Integration does not affect existing bootstrap_context functionality

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `src/tools/bootstrap-context/index.ts` | Modify | Add catch-up trigger invocation |

## Implementation Notes

**Integration Point**: After context building, before return

```typescript
// Existing imports...
import { triggerCatchUpIfNeeded } from "./catchupTrigger";

export async function handler(args: BootstrapContextArgs): Promise<CallToolResult> {
  const project = args.project || resolveProject();

  if (!project) {
    return {
      content: [{ type: "text" as const, text: "..." }],
      isError: true,
    };
  }

  // ... existing context building logic ...

  try {
    // ... existing queries and context building ...

    const structuredContent = buildStructuredOutput({ ... });
    setCachedContext(cacheOptions, structuredContent);

    const formattedOutput = buildFormattedOutputWithLimits(...);

    // NEW: Trigger catch-up in background (fire-and-forget)
    triggerCatchUpIfNeeded(project);

    logger.info({ ... }, "Bootstrap context built successfully...");

    return {
      content: [{ type: "text" as const, text: formattedOutput }],
    };
  } catch (error) {
    // Error path - do NOT trigger catch-up
    logger.error({ project, error }, "Failed to build bootstrap context");
    return { content: [...], isError: true };
  }
}
```

**Helper Function** (in catchupTrigger.ts):

```typescript
export function triggerCatchUpIfNeeded(project: string): void {
  findNotesWithoutEmbeddings(project)
    .then((missingNotes) => {
      if (missingNotes.length > 0) {
        logger.info(
          { project, count: missingNotes.length },
          "Triggering embedding catch-up"
        );
        triggerBatchEmbeddings(missingNotes);
      } else {
        logger.debug({ project }, "No missing embeddings, skipping catch-up");
      }
    })
    .catch((error) => {
      logger.warn({ project, error }, "Catch-up query failed");
    });
}
```

**Key Properties**:

- Fire-and-forget: `triggerCatchUpIfNeeded` does not return Promise
- Non-blocking: Called after main response prepared, does not delay return
- Error isolation: Catch-up errors logged but do not affect bootstrap_context success

## Testing Requirements

- [ ] Test bootstrap_context returns without blocking on catch-up
- [ ] Test catch-up trigger fires when missing embeddings exist
- [ ] Test catch-up does not fire when no missing embeddings
- [ ] Test catch-up failure does not cause bootstrap_context failure
- [ ] Test catch-up does not fire on error path (no project)
- [ ] Test integration preserves existing bootstrap_context behavior

## Dependencies

- TASK-001 (`findNotesWithoutEmbeddings`)
- TASK-002 (`triggerBatchEmbeddings`)
- Existing bootstrap_context infrastructure
