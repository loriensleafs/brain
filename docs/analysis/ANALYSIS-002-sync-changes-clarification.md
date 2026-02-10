---
title: ANALYSIS-002-sync-changes-clarification
type: note
permalink: analysis/analysis-002-sync-changes-clarification
---

# Analysis: What sync_changes Actually Syncs in basic-memory

## 1. Objective and Scope

**Objective**: Determine whether `sync_changes` in basic-memory controls only markdown file synchronization or includes configuration changes.
**Scope**: basic-memory configuration architecture, sync behavior, config reload mechanisms.

## 2. Context

The basic-memory docs state:
> sync_changes: When `false`, changes are not automatically synced to the database.

This created ambiguity about whether "changes" includes config file changes (project paths, etc.) or only markdown content.

## 3. Approach

**Methodology**: Source code analysis via GitHub, documentation review, configuration architecture examination.
**Tools Used**: WebSearch, WebFetch on GitHub raw files and docs.basicmemory.com
**Limitations**: Could not access all source files due to 404 errors on some paths.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|------------|
| sync_changes controls markdown file sync only | config.py source code | High |
| Config uses module-level caching, not hot-reload | config.py analysis | High |
| Config changes require MCP client restart | docs.basicmemory.com | High |
| save_config() invalidates cache but does not trigger reload | config.py source | High |

### Facts (Verified)

- [fact] `sync_changes` is defined as: "Whether to sync changes in real time. default (True)" in config.py
- [fact] This setting controls real-time synchronization of markdown file modifications only
- [fact] Configuration uses `_CONFIG_CACHE` module-level caching pattern
- [fact] `load_config()` returns cached config if available - no file watching
- [fact] `save_config()` sets `_CONFIG_CACHE = None` to invalidate cache
- [fact] No active file watching or automatic reloading of configuration changes exists
- [fact] Documentation states: "Changes to the config file require restarting Claude Desktop"

### Related Sync Settings

| Setting | Default | Purpose |
|---------|---------|---------|
| sync_changes | true | Enable/disable real-time markdown sync |
| sync_delay | 1000ms | Debounce delay before syncing |
| sync_thread_pool_size | 4 | Thread pool for file I/O |
| sync_max_concurrent_files | 10 | Max concurrent file processing |
| watch_project_reload_interval | 300s | Project list reload frequency |
| skip_initialization_sync | false | Skip initial reconciliation |

## 5. Results

**sync_changes controls ONLY markdown file content synchronization.** It does not affect configuration changes.

Configuration changes (project paths, settings) are handled through a separate mechanism:

1. Config is loaded once and cached at module level
2. No hot-reload mechanism exists for config.json
3. MCP client restart is required for config changes to take effect

## 6. Discussion

The naming creates confusion. "sync_changes" suggests it might sync all changes, but the architecture separates concerns:

- **File sync system**: Watches markdown files, controlled by sync_changes
- **Config system**: Loaded once at startup, uses module-level cache

The `watch_project_reload_interval` (default 300s) reloads the project LIST but does not reload project paths or other config settings from config.json.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P1 | Restart MCP client after config changes | Required by architecture | Low |
| P2 | Document this distinction in Brain docs | Prevents future confusion | Low |

## 8. Conclusion

**Verdict**: Investigation complete
**Confidence**: High
**Rationale**: Source code analysis confirms sync_changes controls only markdown file sync. Config changes require restart.

### User Impact

- **What changes for you**: When updating project paths in config.json, you must restart the MCP client (Claude Code, Claude Desktop, etc.) for changes to take effect
- **Effort required**: None beyond restart
- **Risk if ignored**: Config changes will not be picked up; basic-memory will continue using cached config

## 9. Appendices

### Sources Consulted

- [basic-memory config.py source](https://github.com/basicmachines-co/basic-memory/blob/main/src/basic_memory/config.py)
- [Basic Memory User Guide](https://docs.basicmemory.com/user-guide/)
- [Basic Memory Getting Started](https://docs.basicmemory.com/getting-started/)
- [Basic Memory GitHub Repository](https://github.com/basicmachines-co/basic-memory)

### Data Transparency

- **Found**: Complete sync configuration schema, config caching mechanism, restart requirements
- **Not Found**: Exact watch_service.py implementation (404 on fetch)

## Observations

- [fact] sync_changes controls markdown file sync only, not config changes #basic-memory #config
- [fact] basic-memory uses module-level config caching with no hot-reload #architecture
- [decision] Config changes require MCP client restart to take effect #requirement
- [technique] save_config() invalidates cache but next load_config() needed to read new values #pattern

## Relations

- relates_to [[ADR-020 Configuration Architecture]]
- relates_to [[Brain MCP Integration]]
