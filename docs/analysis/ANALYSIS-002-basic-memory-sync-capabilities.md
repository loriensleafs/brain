---
title: ANALYSIS-002-basic-memory-sync-capabilities
type: note
permalink: analysis/analysis-002-basic-memory-sync-capabilities
---

# Analysis: Basic-Memory Sync Capabilities Deep Dive

## 1. Objective and Scope

**Objective**: Comprehensively document ALL sync capabilities in basic-memory and determine if hot config reload is possible.
**Scope**: CLI commands, MCP tools, API endpoints, source code architecture, config caching mechanisms.

## 2. Context

Basic-memory v0.18.0 has multiple sync-related commands and APIs. This analysis maps all sync capabilities and investigates hot config reload.

## 3. Key Finding

**Hot config reload is NOT natively supported in basic-memory v0.18.0.**

The architecture caches configuration at startup in an immutable container pattern.

## 4. Complete Sync Command Map

| Command | Purpose | Scope |
|---------|---------|-------|
| basic-memory sync | One-way sync: local files -> database | File content |
| basic-memory sync --watch | Real-time file monitoring | File content |
| basic-memory status | Show sync status between files and database | Diagnostic |
| basic-memory project sync-config | Sync config.json <-> database | Project list |
| basic-memory project sync | One-way cloud sync: local -> cloud | Cloud storage |
| basic-memory project bisync | Two-way sync: local <-> cloud | Cloud storage |
| basic-memory project check | Verify file integrity local vs cloud | Verification |
| basic-memory cloud sync | Bidirectional cloud sync | Cloud storage |

## 5. What project sync-config Actually Does

Calls /v2/projects/config/sync which invokes ProjectService.synchronize_projects():

1. Normalizes project names to permalinks
2. Creates projects in DB that exist in config.json but not DB
3. Deletes projects from DB that were removed from config.json
4. Enforces single default project constraint
5. Treats config.json as source of truth

CRITICAL: This syncs project list metadata between config.json and database. It does NOT reload config into the running MCP process memory.

## 6. Config Change Pipeline

User edits config.json -> basic-memory project sync-config (syncs to database) -> Database updated -> Watch service sees new projects in DB (within 30s) -> BUT: MCP process still has old config in memory -> REQUIRED: Restart MCP client

## 7. Recommendations

| Priority | Recommendation | Rationale |
|----------|---------------|-----------|
| P0 | Always restart MCP client after config changes | Required by architecture |
| P1 | Use project sync-config after manual config.json edits | Ensures DB consistency |
| P2 | Wait 30s after sync-config for project list updates | Watch service poll interval |

## 8. Conclusion

Hot config reload NOT possible without MCP client restart. Source code confirms immutable container pattern and module-level caching with no runtime invalidation mechanism.

## Observations

- [fact] basic-memory v0.18.0 has no hot config reload capability #architecture
- [fact] project sync-config syncs config.json to database, not to running process #sync
- [fact] MCP container is immutable singleton created at startup #pattern
- [fact] Watch service reloads project list from DB every 30s #sync
- [decision] Config changes require MCP client restart to take effect #requirement

## Relations

- supersedes [[ANALYSIS-001-sync-changes-clarification]]
- relates_to [[ADR-020 Configuration Architecture]]
