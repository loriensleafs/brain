---
type: requirement
id: REQ-003a
title: Log catch-up trigger events
status: implemented
priority: P1
category: non-functional
epic: embedding-catchup-trigger
related:
  - REQ-001
  - REQ-002
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - observability
  - logging
  - debugging
---

# REQ-003a: Log Catch-up Trigger Events

## Requirement Statement

WHEN catch-up processing is triggered
THE SYSTEM SHALL log structured trigger event with relevant metrics
SO THAT operators can monitor when catch-ups start and track initial conditions

## Context

Background batch processing lacks user-facing feedback. Structured trigger logging provides visibility for:

- Debugging catch-up failures (transient Ollama errors, connection issues)
- Monitoring catch-up initiation (project context, note count)
- Performance analysis (query time, decision to trigger)

## Acceptance Criteria

- [ ] Log event when missing embeddings query executes (count, query time)
- [ ] Log event when catch-up trigger fires (note count, project)
- [ ] Log event when catch-up batch starts processing (timestamp)
- [ ] All logs include structured fields (project, noteCount, queryTime)
- [ ] Log levels follow existing conventions (info for trigger, debug for query)

## Rationale

**Structured Logging**: Enables programmatic analysis and alerting

- JSON-formatted logs with typed fields
- Query-friendly for log aggregation tools
- Consistent with existing logger usage in codebase

**Info Level for Trigger**: Operator visibility

- Trigger events are significant operational events
- Help diagnose why catch-up did/didn't run
- Distinguish from routine query execution (debug level)

## Dependencies

- REQ-001 (query execution)
- REQ-002 (catch-up trigger decision)
- Existing `logger` utility (`src/utils/internal/logger.ts`)

## Related Artifacts

- DESIGN-001: Bootstrap context catch-up trigger architecture
- `src/services/embedding/triggerEmbedding.ts` (existing logging pattern)
- REQ-003b: Completion event logging
