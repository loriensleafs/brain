# Session 02: ADR-003 Implementation - Task Prefix for Embeddings

**Date**: 2026-01-20
**Agent**: implementer
**Starting Commit**: 9585567
**Starting Branch**: main

## Objective

Implement ADR-003: Add task type prefixes to embedding methods for nomic-embed-text compliance.

## Session Start Checklist

- [x] Brain MCP initialized
- [x] Read ADR-003 (REVISED with critic approval)
- [x] Read REQ-001 (task type enum)
- [x] Verified branch: main
- [x] Starting commit: 9585567

## Implementation Plan

### TASK-001: Add TaskType and Update Signatures (10 min)

**Files**:
- `apps/mcp/src/services/ollama/types.ts`
- `apps/mcp/src/services/ollama/client.ts`

**Changes**:
1. Add TaskType to types.ts
2. Update `generateEmbedding` signature
3. Verify `generateBatchEmbeddings` compatibility

### TASK-002: Update Call Sites (5 min)

**Files**:
- `apps/mcp/src/tools/embed/index.ts` (use "search_document")
- `apps/mcp/src/services/search/index.ts` (use "search_query")

### TASK-003: Add Unit Tests (5 min)

**File**: `apps/mcp/src/services/ollama/__tests__/client.test.ts`

**Tests**:
1. Test "search_document" prefix
2. Test "search_query" prefix
3. Test default parameter

## Progress Log

### TASK-001: Started

