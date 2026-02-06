---
title: ANALYSIS-003-session-create-file-missing
type: note
permalink: analysis/analysis-003-session-create-file-missing
---

# ANALYSIS-003: Session Create MCP Tool Does Not Create Files

## 1. Objective and Scope

**Objective**: Determine why the session create MCP tool returns success but does not create session files on disk.
**Scope**: Session tool handler, session service, project injection, basic-memory integration.

## 2. Context

The `mcp__plugin_brain_brain__session` tool with `operation: create` returns success but no file is created. However, using `write_note` directly DOES create files correctly.

## 3. Approach

**Methodology**: Code tracing, log analysis, configuration review.
**Tools Used**: Read, Grep, Bash, WebSearch for basic-memory documentation.
**Limitations**: Could not directly test basic-memory behavior with undefined project.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|------------|
| Session tool calls createSession without project | /apps/mcp/src/tools/session/index.ts:81 | High |
| createSession passes undefined project to write_note | /apps/mcp/src/services/session/index.ts:678 | High |
| Direct client.callTool bypasses proxy layer | Code analysis | High |
| Proxy layer injects project at line 418 | /apps/mcp/src/tools/index.ts | High |
| basic-memory has default_project_mode: false | ~/.basic-memory/config.json | High |
| Successful writes have project=brain in logs | basic-memory.log | High |
| Session creates show no write_note in basic-memory logs | basic-memory.log | High |

### Facts (Verified)

- [fact] Session tool handler calls `createSession(topic)` without project parameter at line 81 #verified
- [fact] createSession function has optional project parameter defaulting to undefined #verified
- [fact] Session service calls basic-memory directly via `client.callTool` bypassing proxy #verified
- [fact] Proxy layer at tools/index.ts injects project via `injectProject()` at line 418 #verified
- [fact] basic-memory config has `default_project_mode: false` #verified
- [fact] All successful write_note calls in logs have `project=brain` explicitly set #verified
- [fact] Session creates at 15:25:12 and 15:28:45 UTC show no corresponding write_note in basic-memory logs #verified

### Hypotheses (Unverified)

- [hypothesis] basic-memory silently ignores write_note calls with undefined project when default_project_mode is false
- [hypothesis] The MCP client.callTool may return success even if basic-memory rejects the request

## 5. Results

The session create operation fails silently because:

1. The session tool handler does not pass project to createSession
2. createSession calls basic-memory directly with project: undefined
3. basic-memory has default_project_mode: false, requiring explicit project
4. basic-memory does not log or execute the write operation

File creation timestamp analysis confirms the session file was NOT created by the session tool. The file at `/Users/peter.kloss/Dev/brain/docs/sessions/SESSION-2026-02-05_01-config-database-sync-bug-fix.md` was created at 07:29:30 local time via direct write_note call, not by session create.

## 6. Discussion

The Brain MCP has two code paths for write operations:

**Path A - MCP Tool Interface (Works)**:
```
Claude -> Brain MCP -> callProxiedTool() -> injectProject() -> basic-memory
```

**Path B - Internal Service (Broken)**:
```
Session Tool -> Session Service -> client.callTool() -> basic-memory (no project)
```

Path B bypasses the project injection that Path A provides. This is an architectural flaw where internal services assume they can call basic-memory directly without the same preprocessing that external tool calls receive.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|----------------|-----------|--------|
| P0 | Fix session tool to resolve and pass project | Immediate fix for broken feature | Low |
| P0 | Add project injection to session service | Consistent behavior with proxy | Low |
| P1 | Consider enabling default_project_mode in basic-memory | Fallback safety | Low |
| P2 | Add logging to session service write_note calls | Debug visibility | Low |
| P2 | Create shared utility for project-aware basic-memory calls | Prevent similar issues | Medium |

## 8. Conclusion

**Verdict**: Proceed with fix
**Confidence**: High
**Rationale**: Root cause identified with high confidence. The session service bypasses project injection that the proxy layer provides.

### User Impact

- **What changes for you**: Session create tool will work after fix
- **Effort required**: Small code change to inject project in session service
- **Risk if ignored**: Session lifecycle management features remain broken

## 9. Appendices

### Sources Consulted

- [Basic Memory MCP Tools Reference](https://docs.basicmemory.com/guides/mcp-tools-reference/)
- [Basic Memory GitHub](https://github.com/basicmachines-co/basic-memory)
- Code files: tools/session/index.ts, services/session/index.ts, tools/index.ts, proxy/client.ts
- Log files: brain.log, basic-memory.log

### Data Transparency

- **Found**: Complete code path, log evidence, configuration settings
- **Not Found**: Exact basic-memory behavior when project is undefined (requires source code inspection)

## Observations

- [problem] Session create MCP tool returns success without creating file #session #bug
- [fact] Session tool handler at line 81 calls createSession without project parameter #code
- [fact] Session service bypasses proxy layer project injection #architecture
- [fact] basic-memory config has default_project_mode: false requiring explicit project #config
- [decision] Recommend adding project injection to session service #fix
- [technique] Code tracing from tool handler through service to basic-memory call #analysis

## Relations

- relates_to [[SESSION-2026-02-05_01-config-database-sync-bug-fix]]
- implements [[Session Create Bug Investigation]]
