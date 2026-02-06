---
title: ANALYSIS-001-config-database-sync-bug
type: note
permalink: analysis/analysis-001-config-database-sync-bug
---

# ANALYSIS-001 Config Database Sync Bug

## 1. Objective and Scope

**Objective**: Identify root cause of config_update_project failing to update basic-memory's SQLite database when project paths change.

**Scope**: Translation layer between Brain MCP config and basic-memory, basic-memory's config-to-database synchronization mechanism.

## 2. Context

When `config_update_project` MCP tool updates a project's memories_path (e.g., changing from DEFAULT mode to CODE mode):

1. Brain config file (`~/.config/brain/config.json`) is updated correctly
2. Basic-memory config file (`~/.basic-memory/config.json`) is synced correctly via translation layer
3. BUT: Basic-memory's SQLite database (`~/.basic-memory/memory.db`, table `project`) is NOT updated

This causes notes to be written to the old path because basic-memory reads project paths from its database cache, not the config file.

## Observations

- [fact] Brain MCP uses translation layer to sync config to basic-memory config file at `~/.basic-memory/config.json` #config #architecture
- [fact] Translation layer function `syncConfigToBasicMemory()` only writes to JSON config file, never touches database #root-cause
- [fact] Basic-memory has `ProjectService.synchronize_projects()` method that reconciles config file with database #basic-memory
- [fact] Basic-memory calls `reconcile_projects_with_config()` only during app initialization, not when config changes #initialization
- [fact] Basic-memory MCP server is a subprocess, started once and keeps running with cached database state #subprocess
- [decision] Manual DB update fixed the issue: `UPDATE project SET path = '...' WHERE name = 'brain'` #workaround
- [problem] Config file changes are not detected by running basic-memory subprocess #hot-reload
- [fact] Basic-memory has `ConfigManager._CONFIG_CACHE` module-level cache that never invalidates after initial load #caching
- [fact] Five config tools affected: config_update_project, config_update_global, config_set, config_reset, config_migrate #scope

## 3. Approach

**Methodology**: 
1. Traced code path from `config_update_project` through translation layer
2. Examined basic-memory's config loading and database synchronization code
3. Identified where config-to-database synchronization should occur

**Tools Used**: Code analysis via Read/Grep, basic-memory source code examination

**Limitations**: Could not run basic-memory subprocess tests due to Python version issues. Analysis based on static code review.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|------------|
| Translation layer writes to config.json only | `/apps/mcp/src/config/translation-layer.ts` lines 417-444 | High |
| Basic-memory caches config at module load | `/basic_memory/config.py` lines 258-259, 295-299 | High |
| Project sync runs only at initialization | `/basic_memory/services/initialization.py` lines 41-71 | High |
| ProjectService.synchronize_projects() exists | `/basic_memory/services/project_service.py` lines 339-421 | High |
| subprocess client has no reload mechanism | `/apps/mcp/src/proxy/client.ts` | High |

### Facts (Verified)

- Brain MCP translation layer (`syncConfigToBasicMemory`) writes to `~/.basic-memory/config.json` using atomic write pattern
- Basic-memory reads config once at startup and caches it in `_CONFIG_CACHE` module variable
- Basic-memory only reconciles config with database during `initialize_app()` call
- Basic-memory subprocess stays running indefinitely, never re-reads config
- No mechanism exists to notify running basic-memory process of config changes

### Hypotheses (Unverified)

- Restarting basic-memory subprocess would apply config changes (needs testing)
- basic-memory may have hot-reload capability via watch_project_reload_interval (needs verification)

## 5. Results

### Root Cause

The translation layer syncs Brain config to basic-memory's JSON config file, but basic-memory:
1. Caches config at module load time (`_CONFIG_CACHE`)
2. Only synchronizes config-to-database during `initialize_app()` 
3. Never re-reads config while MCP subprocess is running

### Code Flow

```text
config_update_project handler
    ├── saveBrainConfig() → ~/.config/brain/config.json [PASS]
    └── syncConfigToBasicMemory() → ~/.basic-memory/config.json [PASS]
        └── writeBasicMemoryConfig() → atomic write to JSON [PASS]
            └── MISSING: No signal to basic-memory process
                └── basic-memory continues using cached project path from DB
```

### Affected Tools

All five config tools call `syncConfigToBasicMemory()` and share this bug:

| Tool | File | Line |
|------|------|------|
| config_update_project | `apps/mcp/src/tools/config/update-project.ts` | 397 |
| config_update_global | `apps/mcp/src/tools/config/update-global.ts` | 338 |
| config_set | `apps/mcp/src/tools/config/set.ts` | 185 |
| config_reset | `apps/mcp/src/tools/config/reset.ts` | 142 |
| config_migrate | `apps/mcp/src/config/config-migration.ts` | 538 |

## 6. Discussion
### Why Basic-Memory Doesn't Pick Up Config Changes

Basic-memory is designed for single-process operation where config is read once at startup. The config file is NOT watched for changes. The `watch_project_reload_interval` setting (default 30s) controls how often the watch service checks for new projects, but this runs in a separate process from the MCP server.

### Architecture Gap

Brain MCP assumes config file changes will be picked up by basic-memory. This assumption is incorrect. Basic-memory treats its config as immutable after initialization.

### New Finding: Basic-Memory Has APIs for This (Investigation Update 2026-02-05)

**Key Discovery**: Basic-memory has existing REST API endpoints and service methods that can be called to update project paths in both config AND database atomically.

**Available APIs**:

1. **`POST /projects/config/sync`** (synchronize_projects endpoint)
   - Reconciles config file with database
   - Adds projects from config to DB, removes obsolete ones
   - Available via CLI: `basic-memory project sync-config`
   - Source: `/basic_memory/api/routers/project_router.py:385-406`

2. **`PATCH /projects/{name}`** (update_project endpoint)
   - Updates project path in BOTH config AND database atomically
   - Source: `/basic_memory/api/routers/project_router.py:59-104`
   - Internally calls `ProjectService.move_project()` which updates both stores

3. **`ProjectService.move_project(name, new_path)`** (service method)
   - Updates config file AND database in one operation
   - Source: `/basic_memory/services/project_service.py:423-462`
   - Used by the PATCH endpoint

4. **`ProjectService.synchronize_projects()`** (service method)
   - Full bidirectional sync between config and database
   - Source: `/basic_memory/services/project_service.py:339-421`

**Why These Weren't Being Used**:

Brain's translation layer writes directly to `~/.basic-memory/config.json` bypassing basic-memory's APIs. This is fundamentally wrong architecture. The translation layer should be calling basic-memory's REST API instead.

### Four Fix Approaches (Updated)

**Option A: Call basic-memory's REST API after config changes (RECOMMENDED)**

After writing to Brain config, call basic-memory's `POST /projects/config/sync` endpoint via the subprocess client.

Pros:
- Uses basic-memory's own reconciliation logic
- No direct database access from Brain
- Respects basic-memory's internal architecture
- Single point of truth for sync logic

Cons:
- Requires the basic-memory subprocess to be running
- API call adds latency

Implementation:
```typescript
// In syncConfigToBasicMemory() after writing config.json:
const client = await getBasicMemoryClient();
await client.callTool({
  name: "POST",  // Need to expose this as internal call
  arguments: { endpoint: "/projects/config/sync" }
});
```

**Option B: Add a new MCP tool to basic-memory for sync (CLEAN)**

Create `sync_project_config` MCP tool in basic-memory that wraps the existing `/projects/config/sync` endpoint.

Pros:
- Clean MCP interface
- Could be contributed upstream
- Brain calls MCP tool like any other

Cons:
- Requires basic-memory code change
- May need PR approval

**Option C: Brain MCP updates database directly (WORKAROUND)**

Translation layer also updates basic-memory's SQLite database directly.

Pros:
- Immediate fix, no dependency on basic-memory changes
- Brain already has database path knowledge

Cons:
- Tight coupling between Brain and basic-memory internals
- Risk of schema version mismatch
- Database locking issues if basic-memory is writing
- Duplicates basic-memory's sync logic

**Option D: Restart basic-memory subprocess (SLEDGEHAMMER)**

After config changes, restart the basic-memory MCP subprocess to force re-initialization.

Pros:
- Works with existing basic-memory code
- Forces full reconciliation

Cons:
- Disrupts ongoing operations
- Performance cost of restart
- May lose in-flight requests

### Why Basic-Memory Doesn't Pick Up Config Changes

Basic-memory is designed for single-process operation where config is read once at startup. The config file is NOT watched for changes. The `watch_project_reload_interval` setting (default 30s) controls how often the watch service checks for new projects, but this runs in a separate process from the MCP server.

### Architecture Gap

Brain MCP assumes config file changes will be picked up by basic-memory. This assumption is incorrect. Basic-memory treats its config as immutable after initialization.

### Two Viable Fix Approaches

**Option A: Signal basic-memory to reload (preferred)**

Brain MCP signals the running basic-memory subprocess to invalidate its cache and re-sync. Requires exposing a reload endpoint or mechanism in basic-memory.

Pros:
- Clean separation of concerns
- No direct database manipulation from Brain
- Works with future basic-memory architecture changes

Cons:
- Requires basic-memory code changes
- May not be possible if basic-memory is closed-source or slow to update

**Option B: Brain MCP updates database directly**

Translation layer also updates basic-memory's SQLite database directly using SQL.

Pros:
- Immediate fix, no dependency on basic-memory changes
- Brain already has database path knowledge

Cons:
- Tight coupling between Brain and basic-memory internals
- Risk of schema version mismatch
- Database locking issues if basic-memory is writing

**Option C: Restart basic-memory subprocess**

After config changes, restart the basic-memory MCP subprocess to force re-initialization.

Pros:
- Works with existing basic-memory code
- Forces full reconciliation

Cons:
- Disrupts ongoing operations
- Performance cost of restart
- May lose in-flight requests

## 7. Recommendations
| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|--------|
| P0 | **Option A: Call POST /projects/config/sync** | Uses basic-memory's existing sync logic. Cleanest fix. | 2-3 hours |
| P1 | Option B: Add sync MCP tool to basic-memory | Long-term clean interface. Contribute upstream. | 4-6 hours |
| P2 | Option C: Direct DB update | Only if Options A/B blocked | 2-4 hours |

### Recommended Implementation (Option A)

The fix requires Brain MCP to call basic-memory's REST API after updating config. Two approaches:

**Approach 1: Use httpx to call REST API directly**

Brain can use httpx (already a dependency via basic-memory) to call the local API.

```typescript
// In syncConfigToBasicMemory() after writing config.json:
import { getBasicMemoryClient } from '../proxy/client';

// After writeBasicMemoryConfig(translatedConfig):

// Trigger sync via REST API using ASGI transport (same as basic-memory CLI does)
// This requires exposing an internal function in the proxy client
await triggerProjectConfigSync();
```

**Approach 2: Restart subprocess to trigger init**

```typescript
// In syncConfigToBasicMemory() after writing config.json:
import { closeBasicMemoryClient, getBasicMemoryClient } from '../proxy/client';

// Close existing connection (triggers subprocess restart on next call)
await closeBasicMemoryClient();

// Next tool call will reconnect and basic-memory will run initialize_app()
```

### Implementation Location

The fix should be in `/apps/mcp/src/config/translation-layer.ts` in the `syncConfigToBasicMemory()` function, after `writeBasicMemoryConfig()` completes successfully.

### Testing Requirements

1. Integration test: Update project path via config_update_project, verify notes write to new path
2. Unit test: Mock REST API call in translation layer
3. Manual test: Change DEFAULT to CODE mode, verify immediate effect
### Recommended Implementation (Option B)

Add to `syncConfigToBasicMemory()`:

```typescript
// After writing config.json, also update database
const dbPath = path.join(os.homedir(), '.basic-memory', 'memory.db');
// Use better-sqlite3 or similar to update project table
for (const [projectName, projectPath] of Object.entries(translatedConfig.projects)) {
  await db.execute(
    'UPDATE project SET path = ? WHERE name = ? OR permalink = ?',
    [projectPath, projectName, generatePermalink(projectName)]
  );
}
```

## 8. Conclusion
**Verdict**: Proceed with Option A (call basic-memory's `/projects/config/sync` endpoint)

**Confidence**: High

**Rationale**: Basic-memory already has the exact API we need. The fix is to call it. Direct DB manipulation (Option C) would duplicate basic-memory's sync logic and create tight coupling. The REST API approach respects basic-memory's architecture.

### User Impact

- **What changes for you**: Config changes via MCP tools will immediately take effect without requiring basic-memory restart
- **Effort required**: 2-3 hours implementation, 1 hour testing
- **Risk if ignored**: Users must manually update database or restart basic-memory after every config change

### Implementation Path

1. Add function to call `/projects/config/sync` endpoint via httpx ASGI transport
2. Call this function at end of `syncConfigToBasicMemory()`
3. Handle errors gracefully (log warning, don't fail the config update)
4. Add integration test covering the full flow
### User Impact

- **What changes for you**: Config changes via MCP tools will immediately take effect without requiring basic-memory restart
- **Effort required**: 2-4 hours implementation, 1 hour testing
- **Risk if ignored**: Users must manually update database or restart basic-memory after every config change

## 9. Appendices

### Sources Consulted

- `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/config/update-project.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/config/translation-layer.ts`
- `/Users/peter.kloss/Dev/brain/apps/mcp/src/proxy/client.ts`
- `/Users/peter.kloss/.local/share/uv/tools/basic-memory/lib/python3.14/site-packages/basic_memory/config.py`
- `/Users/peter.kloss/.local/share/uv/tools/basic-memory/lib/python3.14/site-packages/basic_memory/services/project_service.py`
- `/Users/peter.kloss/.local/share/uv/tools/basic-memory/lib/python3.14/site-packages/basic_memory/services/initialization.py`

### Data Transparency

- **Found**: Full code path from config tool to basic-memory config file
- **Found**: Basic-memory's caching mechanism and initialization flow
- **Not Found**: Runtime behavior (unable to test due to Python version issues)
- **Not Verified**: Whether subprocess restart triggers reconciliation

## Relations

- relates_to [[ADR-020 Configuration Architecture Refactoring]]
- caused_by [[Translation Layer Architecture]]


---

## Investigation Update: 2026-02-05

### New Evidence Found

| Finding | Source | Confidence |
|---------|--------|------------|
| Basic-memory exposes `POST /projects/config/sync` REST endpoint | `/basic_memory/api/routers/project_router.py:385-406` | High |
| Basic-memory exposes `PATCH /projects/{name}` for path updates | `/basic_memory/api/routers/project_router.py:59-104` | High |
| `ProjectService.move_project()` updates config AND database | `/basic_memory/services/project_service.py:423-462` | High |
| `ProjectService.synchronize_projects()` reconciles config-to-DB | `/basic_memory/services/project_service.py:339-421` | High |
| Basic-memory CLI has `project sync-config` command using this API | `/basic_memory/cli/commands/project.py:344-366` | High |
| MCP tools use httpx ASGI transport for local API calls | `/basic_memory/mcp/async_client.py:96-102` | High |

### Key Insight

Basic-memory's architecture separates concerns:
- **Config file** (`~/.basic-memory/config.json`): User-editable, source of truth for project definitions
- **Database** (`~/.basic-memory/memory.db`): Runtime cache, synced from config at startup
- **`synchronize_projects()`**: The bridge that reconciles the two

Brain's translation layer only updates the config file. It needs to also trigger `synchronize_projects()` via the REST API to complete the update cycle.

### Why Option A is Best

1. **Uses existing API**: No need to add new code to basic-memory
2. **Respects architecture**: Calls the designed synchronization path
3. **Avoids duplication**: Doesn't recreate sync logic in Brain
4. **Forward compatible**: If basic-memory changes DB schema, sync logic updates automatically

### Additional Observations

- [fact] Basic-memory MCP tools call REST API via ASGI transport (in-process, fast) #architecture
- [fact] `POST /projects/config/sync` endpoint exists and works (used by CLI) #api
- [fact] No MCP tool wraps the sync endpoint currently #gap
- [technique] Brain can use same ASGI transport pattern to call sync endpoint #implementation


---

## Research Update: 2026-02-05 - Basic-Memory Native Capabilities

### Research Objective

Investigate what basic-memory provides natively for config sync before implementing a fix.

### Installed Version vs Latest

| Metric | Value |
|--------|-------|
| Installed version | 0.16.2 |
| Latest PyPI version | 0.18.0 |
| Version gap | 2 minor versions behind |

### Configuration Settings Analysis

Basic-memory provides these configuration options (from [docs.basicmemory.com/reference/configuration](https://docs.basicmemory.com/reference/configuration)):

| Setting | Type | Default | Relevance to Bug |
|---------|------|---------|------------------|
| `sync_changes` | Boolean | true | Controls real-time file sync, NOT config sync |
| `sync_delay` | Integer | 1000ms | Throttles file sync operations |
| `watch_project_reload_interval` | Integer | 30s | Detects NEW projects, does NOT update existing project paths |
| `skip_initialization_sync` | Boolean | false | Skips startup sync for cloud/stateless environments |

**Key Finding**: `sync_changes` and `watch_project_reload_interval` do NOT solve our bug. These settings control:
- `sync_changes`: File content synchronization to knowledge graph
- `watch_project_reload_interval`: Detection of newly added projects

Neither setting triggers re-reading of project path updates from config file.

### Native Reload Capability

**Documentation explicitly states**: "After changing configuration, restart your MCP client for changes to take effect."

**Conclusion**: Basic-memory has NO native hot-reload capability for configuration changes.

### Recent Version Changes (0.16.2 to 0.18.0)

Reviewed [GitHub releases](https://github.com/basicmachines-co/basic-memory/releases):

| Version | Relevant Changes |
|---------|-----------------|
| 0.18.0 | MCP prompt fixes, local cloud mode, wiki link resolution |
| 0.17.9 | default_project config checks in local mode |
| 0.17.8 | Bucket snapshot CLI, database query fixes |
| 0.17.7 | Removed OpenPanel telemetry, MCP registry publication |
| 0.17.5 | CLI exit hang fixes, Python 3.14 compatibility |

**No config sync or reload features added in recent versions.**

### v0.17.3 Config Design Insight

From [CHANGELOG](https://github.com/basicmachines-co/basic-memory/blob/main/CHANGELOG.md):
> "Config file can become stale when users set default project via v2 API"

This confirms the architectural pattern: **Database is source of truth in cloud mode**, config file can become stale. The sync direction is config-to-database during initialization.

### Native APIs for Config Sync (Previously Documented)

Basic-memory has these APIs that CAN be used:

1. **`POST /projects/config/sync`** - Reconciles config file with database
2. **`PATCH /projects/{name}`** - Updates project path in both config and database
3. **`ProjectService.synchronize_projects()`** - Service method for full sync

These exist but are NOT exposed as MCP tools.

### Upgrade Assessment

| Question | Answer |
|----------|--------|
| Should we upgrade? | Yes, recommended |
| Breaking changes? | No major breaking changes 0.16.2 to 0.18.0 |
| Does upgrade solve bug? | No. Upgrade provides other improvements but no config reload feature |
| Migration steps | `uv tool upgrade basic-memory` |

### CLI Commands Available

From web research and documentation:

```bash
basic-memory project list        # List all projects
basic-memory project add         # Add new project
basic-memory project default     # Set default project
basic-memory project info        # Show project details
basic-memory sync                # One-time sync
basic-memory sync --watch        # Real-time file sync
basic-memory cloud sync          # Cloud bidirectional sync
```

**No `basic-memory config reload` or similar command exists.**

### Recommendations Summary

| Priority | Recommendation | Rationale |
|----------|---------------|-----------|
| P0 | **Upgrade to 0.18.0** | Bug fixes, no breaking changes, good hygiene |
| P0 | **Implement Option A** (call `/projects/config/sync`) | Uses existing API, cleanest fix |
| P1 | Consider contributing MCP tool wrapper upstream | Long-term improvement for community |

### Data Transparency

**Found**:
- Comprehensive documentation at docs.basicmemory.com
- All configuration options and their purposes
- Version history and changelogs
- Confirmation that no native reload exists

**Not Found**:
- No hidden config reload mechanism
- No undocumented CLI commands for this purpose
- No GitHub issues requesting this feature (search returned empty)

### Conclusion

Basic-memory does NOT provide a native solution for our config sync bug. The `sync_changes` setting is unrelated. Upgrade is recommended for other reasons but will not fix this bug. Implementation must proceed with Option A (calling REST API after config changes).

## Relations

- relates_to [[ADR-020 Configuration Architecture Refactoring]]
- caused_by [[Translation Layer writes config file only]]
