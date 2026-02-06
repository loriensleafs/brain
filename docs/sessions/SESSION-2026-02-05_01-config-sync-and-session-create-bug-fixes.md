---
title: SESSION-2026-02-05_01-config-sync-and-session-create-bug-fixes
type: note
permalink: sessions/session-2026-02-05-01-config-sync-and-session-create-bug-fixes
---

# SESSION-2026-02-05_01-config-sync-and-session-create-bug-fixes

## Status

**IN_PROGRESS**

## Topic

config-sync-and-session-create-bug-fixes

## Branch

`main`

## Checklist

- [ ] Session start protocol complete
- [ ] Work completed
- [ ] Session end protocol complete

## Observations

- [problem] config_update_project changed JSON config but basic-memory SQLite kept old cached path #bug
- [fact] basic-memory caches project paths at startup and never re-reads config #root-cause
- [decision] Call closeBasicMemoryClient() after writing config to force subprocess restart #fix
- [fact] Fix implemented in translation-layer.ts line 445 #implementation
- [problem] session create returned success but didn't create files #bug
- [fact] Session service used wrong parameter name: folder instead of directory #root-cause
- [decision] Changed folder to directory in session service write_note calls #fix
- [fact] Upgraded basic-memory from 0.16.2 to 0.18.0 #dependency
- [outcome] Both bugs fixed and verified working #validation

## Changes Made

1. `/apps/mcp/src/config/translation-layer.ts` - Added closeBasicMemoryClient() after config writes
2. `/apps/mcp/src/services/session/index.ts` - Added project resolution, fixed folder→directory

## Relations

- implements [[Config Database Sync Fix]]
- implements [[Session Create Fix]]
