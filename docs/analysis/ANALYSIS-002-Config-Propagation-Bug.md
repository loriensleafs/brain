---
title: ANALYSIS-002-Config-Propagation-Bug
type: note
permalink: analysis/analysis-002-config-propagation-bug
---

# Analysis: Brain Config Changes Not Propagating to basic-memory

## 1. Objective and Scope

**Objective**: Identify why Brain config changes do not propagate to the running basic-memory MCP process.

**Scope**: Translation layer, config tools, basic-memory client communication, session creation path, project resolution.

## 2. Context

Brain is a wrapper MCP server around basic-memory. Brain maintains its own config at `~/.config/brain/config.json` and translates it to basic-memory config at `~/.basic-memory/config.json`. The bug manifests when a user changes Brain config (for example, switching a project from CODE mode to CUSTOM mode) and the running basic-memory process continues using the old path.

## 3. Approach

**Methodology**: Static code analysis of config flow, translation layer, client communication, and session creation path.

**Tools Used**: Code analysis via Read, Grep, Glob tools.

**Limitations**: Cannot inspect basic-memory source code (external Python project). Analysis based on Brain MCP TypeScript code only.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|------------|
| Translation layer writes to `~/.basic-memory/config.json` only | `/apps/mcp/src/config/translation-layer.ts` | High |
| No restart/reload signal sent to basic-memory process | Translation layer code | High |
| basic-memory runs as subprocess via stdio transport | `/apps/mcp/src/proxy/client.ts` | High |
| Session creation passes project param to basic-memory | `/apps/mcp/src/services/session/index.ts` | High |
| Project resolution reads from Brain config, not basic-memory | `/packages/utils/src/project-resolver.ts` | High |
| basic-memory reads config at startup only (presumed) | Behavioral observation | Medium |

### Facts (Verified)

1. [fact] `syncConfigToBasicMemory()` writes to `~/.basic-memory/config.json` but does NOT restart or signal basic-memory process. See translation-layer.ts lines 419-446.

2. [fact] Brain MCP communicates with basic-memory via stdio MCP client. The subprocess is spawned once and reused. See proxy/client.ts lines 46-74.

3. [fact] All config tools (`update-project`, `update-global`, `set`, `reset`, `migrate`) call `syncConfigToBasicMemory()` after saving Brain config. See respective tool files.

4. [fact] Session creation calls `write_note` with project parameter. basic-memory looks up project in its config to determine memories path. See session/index.ts lines 671-679.

5. [fact] `resolveProject()` in `@brain/utils` reads from Brain config (`~/.config/brain/config.json`), not basic-memory config. See project-resolver.ts.

6. [fact] `path-resolver.ts` in `@brain/utils` reads from basic-memory config (`~/.basic-memory/config.json`) to resolve memories paths. See config.ts and path-resolver.ts.

### Hypotheses (Unverified)

1. [hypothesis] basic-memory loads its config once at startup and caches it in memory. Config file changes require process restart to take effect.

2. [hypothesis] basic-memory may have a config reload mechanism (file watcher or signal handler) that Brain does not invoke.

## 5. Results

### Config Flow Diagram

```text
User Action
    |
    v
Brain Config Tool (update-project, set, etc.)
    |
    +--> saveBrainConfig() --> ~/.config/brain/config.json
    |
    +--> syncConfigToBasicMemory()
              |
              v
         ~/.basic-memory/config.json  <-- FILE IS UPDATED
              |
              X (no signal/restart)
              |
              v
         basic-memory subprocess  <-- STILL USING OLD IN-MEMORY CONFIG
```

### The Break Point

The break occurs between writing `~/.basic-memory/config.json` and basic-memory actually using the new values. basic-memory was spawned at Brain MCP startup and read its config then. The file update has no effect on the running process.

### Critical Code Paths

1. **Translation Layer** (`/Users/peter.kloss/Dev/brain/apps/mcp/src/config/translation-layer.ts`):
   - `syncConfigToBasicMemory()` (lines 419-446) writes config file but does nothing else
   - No call to restart basic-memory client
   - No call to `closeBasicMemoryClient()` to force reconnection

2. **Client Management** (`/Users/peter.kloss/Dev/brain/apps/mcp/src/proxy/client.ts`):
   - `getBasicMemoryClient()` returns cached client if connected
   - `closeBasicMemoryClient()` exists but is never called after config changes
   - No `restartBasicMemoryClient()` function exists

3. **Session Creation** (`/Users/peter.kloss/Dev/brain/apps/mcp/src/services/session/index.ts`):
   - `createSession()` calls `write_note` with project parameter
   - basic-memory uses its in-memory config to resolve project path
   - Path resolution uses stale config data

## 6. Discussion

The architecture assumes basic-memory will pick up config changes automatically. This is not the case. basic-memory (like most processes) reads config at startup and caches it.

Two approaches exist to fix this:

**Option A: Restart basic-memory subprocess after config changes**

- Simplest implementation
- Call `closeBasicMemoryClient()` after `syncConfigToBasicMemory()`
- Next tool call will spawn fresh subprocess with new config
- Downside: brief interruption, potential in-flight operation issues

**Option B: Send reload signal to basic-memory**

- Requires basic-memory to support config reload (SIGHUP, file watch, or MCP tool)
- More elegant, no interruption
- Requires basic-memory changes (external project)

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | After `syncConfigToBasicMemory()`, call `closeBasicMemoryClient()` | Forces fresh subprocess on next operation | Low (1-2 hours) |
| P1 | Add logging to confirm restart occurred | Debugging aid | Low |
| P2 | Consider adding `restartBasicMemoryClient()` function | Cleaner API | Low |
| P2 | Document that config changes require restart | User awareness | Low |

### Recommended Fix Location

File: `/Users/peter.kloss/Dev/brain/apps/mcp/src/config/translation-layer.ts`

In `syncConfigToBasicMemory()`, after writing the config file, add:

```typescript
// Force basic-memory client reconnection to pick up new config
await closeBasicMemoryClient();
```

This should also be added to:

- `trySyncConfigToBasicMemory()` (lines 457-468)
- Any other code paths that modify basic-memory config

Additionally, update the config watcher (`/Users/peter.kloss/Dev/brain/apps/mcp/src/config/watcher.ts`) to close the client after syncing (line 347, after `syncConfigToBasicMemory` call).

## 8. Conclusion

**Verdict**: Proceed with fix

**Confidence**: High

**Rationale**: The root cause is clear and the fix is straightforward. Closing the basic-memory client after config sync forces a fresh subprocess spawn that reads the updated config file.

### User Impact

- **What changes for you**: Config changes will take effect immediately instead of requiring manual restart
- **Effort required**: Minimal code change (add one function call in two locations)
- **Risk if ignored**: Users will experience confusing behavior where config changes appear to save but have no effect

## 9. Appendices

### Key Files Analyzed

| File | Purpose |
|------|---------|
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/config/translation-layer.ts` | Brain to basic-memory config sync |
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/proxy/client.ts` | basic-memory subprocess management |
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/config/update-project.ts` | Project config updates |
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/config/update-global.ts` | Global config updates |
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/config/set.ts` | Key-value config updates |
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/services/session/index.ts` | Session creation |
| `/Users/peter.kloss/Dev/brain/apps/mcp/src/config/watcher.ts` | Config file watcher |
| `/Users/peter.kloss/Dev/brain/packages/utils/src/project-resolver.ts` | Project resolution |
| `/Users/peter.kloss/Dev/brain/packages/utils/src/path-resolver.ts` | Path resolution |
| `/Users/peter.kloss/Dev/brain/packages/utils/src/config.ts` | basic-memory config reading |

### Data Transparency

- **Found**: Complete Brain MCP config flow, client management, session creation path
- **Not Found**: basic-memory internal config handling (external Python project)

## Observations

- [fact] Translation layer writes config file but does not signal basic-memory process
- [fact] basic-memory client is spawned once and reused until process exit
- [fact] `closeBasicMemoryClient()` exists but is not called after config changes
- [problem] Config changes have no effect on running basic-memory subprocess
- [solution] Call `closeBasicMemoryClient()` after `syncConfigToBasicMemory()` to force restart
- [constraint] Solution depends on basic-memory reading config at startup (verified behavior)

## Relations

- relates_to [[ANALYSIS 001 Sync Changes Clarification]]
- part_of [[Brain MCP Architecture]]
