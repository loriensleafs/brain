# Analysis: Brain Note Path Structure and Project Scoping

## Objective

Verify how Brain MCP organizes notes and determine the correct session state path for brain-persistence.ts (line 40).

**User Insight**: "Brain notes are already project-scoped, so we don't need `sessions/{project}/state` - that's redundant."

## Evidence Gathered

### 1. Brain MCP Project System

Basic-memory uses a **project-based architecture** where each project has:

- **Project Name**: Logical identifier (e.g., "brain", "memory")
- **Project Path**: Physical storage location (e.g., `~/memories/mcps/brain`)

**Configured Projects** (from `basic-memory project list`):

| Project | Path |
|---------|------|
| brain | ~/memories/mcps/brain |
| memory | ~/memories/mcps/memory |
| shared | ~/memories/shared |

### 2. Brain MCP Tool Signature

From `brain-persistence.ts` lines 178-195:

```typescript
await client.callTool({
  name: "write_note",
  arguments: {
    path: notePath,           // Note path within project
    content: JSON.stringify(session, null, 2),
    project: this.projectPath, // Project identifier
  },
});
```

**Key Insight**: The `project` parameter tells Brain MCP **which project to write to**, not a subdirectory within the note path.

### 3. Actual File Storage

Brain MCP stores notes at: `{project_physical_path}/{note_path}.md`

**Example**:

```text
Tool Call:
  write_note(
    path="sessions/session-abc123",
    project="/Users/peter.kloss/Dev/brain/apps/mcp"
  )

Physical File:
  ~/memories/mcps/brain/sessions/session-abc123.md
                       ^^^^^^^^^^ (from project mapping)
                                 ^^^^^^^^^^^^^^^^^^^^^^^^ (from path argument)
```

**Evidence**: Session logs stored at `~/memories/mcps/brain/.agents/sessions/` confirm this structure.

### 4. Project Resolution Hierarchy

From `resolve.ts` lines 27-68, Brain MCP resolves project using 5-level hierarchy:

1. Explicit parameter (highest priority)
2. Session state (in-memory `activeProject`)
3. `BM_PROJECT` env var
4. `BM_ACTIVE_PROJECT` env var (legacy)
5. CWD match against configured code paths
6. null → prompt user

**Current Implementation**: `brain-persistence.ts` passes `this.projectPath` (defaults to `process.cwd()`) which gets matched to project "brain" via CWD resolution.

## Analysis: Why Project Parameter is NOT Redundant

### Current Code (brain-persistence.ts:40)

```typescript
const SESSION_PATH_PREFIX = "sessions/session-";
```

### User's Concern

> "Brain notes are already project-scoped, so we don't need `sessions/{project}/state`"

### Verdict: User is CORRECT

The `project` parameter in Brain MCP tool calls **does not create a subdirectory**. It selects which project's storage to use.

**Redundant Pattern** (INCORRECT):

```typescript
// This would create: ~/memories/mcps/brain/sessions/brain/state.md
path: `sessions/${project}/state`
project: projectPath
```

**Correct Pattern** (CURRENT):

```typescript
// This creates: ~/memories/mcps/brain/sessions/state.md
path: "sessions/state"
project: projectPath
```

## Conclusion

**Finding**: Brain MCP handles project scoping via the `project` tool parameter, NOT via the note path.

**Current Implementation Status**: [CORRECT]

The current paths in `brain-persistence.ts` are correct:

| Constant | Value | Physical Path (for project "brain") |
|----------|-------|-------------------------------------|
| `SESSION_PATH_PREFIX` | `"sessions/session-"` | `~/memories/mcps/brain/sessions/session-{id}.md` |
| `CURRENT_SESSION_PATH` | `"sessions/current-session"` | `~/memories/mcps/brain/sessions/current-session.md` |

**No changes required**. The user's insight confirms the implementation is already following best practices by avoiding redundant project identifiers in paths.

## Recommendations

1. **Document this pattern** in code comments to prevent future confusion
2. **Add validation** that project parameter matches expected project name
3. **Consider** adding project name to note metadata (for verification)

## Data Transparency

**Found**:

- Brain MCP project configuration via `basic-memory project list`
- Actual file storage structure at `~/memories/mcps/brain/`
- Tool call signatures in brain-persistence.ts
- Project resolution hierarchy in resolve.ts

**Not Found**:

- Explicit documentation of path vs project parameter semantics
- Validation that project parameter matches expected project
