---
type: requirement
id: REQ-001
title: Missing embedding detection on session start
status: implemented
priority: P0
category: functional
epic: embedding-catchup-trigger
related: []
created: 2026-01-20
updated: 2026-01-20
author: spec-generator
tags:
  - embeddings
  - session-start
  - bootstrap-context
---

# REQ-001: Missing Embedding Detection on Session Start

## Requirement Statement

WHEN bootstrap_context is invoked at session start
THE SYSTEM SHALL query for notes lacking embeddings
SO THAT catch-up processing can be triggered for unprocessed notes

## Context

Users with "TON of notes" (hundreds to thousands) may have many notes without embeddings due to:

- Notes created before embedding system implementation
- Prior embedding failures (transient errors)
- Manual note additions outside normal workflow

Session start provides a natural trigger point for automatic catch-up with zero user intervention required.

## Acceptance Criteria

- [ ] Query executes during bootstrap_context invocation
- [ ] Query identifies notes present in basic-memory but absent from brain_embeddings
- [ ] Query execution adds less than 100ms overhead when no missing embeddings exist
- [ ] Query returns note identifiers (permalinks) for notes lacking embeddings
- [ ] Query result is logged with count of missing embeddings

## Rationale

**Trigger Point Selection**: Session start chosen over scheduled cron (see `.agents/analysis/038-catchup-trigger-verdict.md`)

- User initiates session when actively working (Ollama likely running)
- Fire-and-forget pattern prevents blocking user workflow
- Natural retry mechanism (next session if current fails)

**Performance Constraint**: Query must complete quickly to avoid session start latency. Count check before full processing prevents unnecessary work.

## Dependencies

- basic-memory MCP server (note storage)
- brain_embeddings table (embedding storage)
- bootstrap_context tool (session start hook)

## Related Artifacts

- DESIGN-001: Bootstrap context catch-up trigger architecture
- ADR-016: Phase 2 integration decisions
