# Design: Unified Projects Tool Architecture

**Date**: 2026-01-19
**Status**: Proposed
**Architect**: architect agent

## Executive Summary

Consolidate 4 separate project management tools into a unified, coherent interface with consistent behavior across MCP tools, CLI commands, and internal resolution logic.

**Impact**: Reduces tool fragmentation, improves UX consistency, establishes clear data ownership boundaries.

**Complexity**: Medium (cross-cutting architectural change affecting MCP server, CLI, and hooks).

## Problem Statement

The current project management system has fragmented responsibilities across 4 tools with overlapping concerns:

| Current Tool | Primary Responsibility | Issues |
|--------------|----------------------|--------|
| `set_project` | Set active project (session state) | Single responsibility, works well |
| `get_project` | Get project state + list all projects | Violates SRP, mixes queries |
| `clear_project` | Clear active project | Single responsibility, works well |
| `configure_code_path` | Manage code path mappings | Isolated concern, works well |

**Core Issues**:

1. `get_project` violates Single Responsibility Principle by returning:
   - Active project state
   - Resolved project (from hierarchy)
   - Resolution hierarchy (debugging info)
   - Code path mappings (configuration)
   - Available projects (from basic-memory)

2. No unified CLI interface (CLI commands planned but not implemented)

3. Inconsistent data ownership between Brain MCP and basic-memory:
   - Brain MCP manages: active project (session), code paths (config)
   - basic-memory manages: project metadata, notes, embeddings

4. No clear way to edit project metadata (name, notes_path, code_path)

## Decision Drivers

- **Cohesion**: Related operations should be grouped logically
- **Single Responsibility**: Each tool should do one thing well
- **Discoverability**: Tools should have intuitive names matching user intent
- **Backward Compatibility**: Existing integrations must continue to work
- **Data Ownership**: Clear boundaries between Brain MCP and basic-memory concerns

## Proposed Architecture

### Tool Consolidation

Replace 4 tools with a new unified structure under `tools/projects/`:

```
tools/
└── projects/
    ├── index.ts          # Tool registration and routing
    ├── schema.ts         # Shared types and schemas
    ├── handlers/
    │   ├── active.ts     # active_project handler
    │   ├── list.ts       # list_projects handler
    │   ├── get.ts        # get_project handler (new semantics)
    │   └── edit.ts       # edit_project handler (new)
    └── utils/
        ├── validation.ts # Shared validation logic
        └── formatting.ts # Shared response formatting
```

### New Tool Interface

#### 1. `active_project(project?: string)` - Get/Set Active Project

**Purpose**: Single tool for active project management (replaces `set_project` + `clear_project`)

**Arguments**:

```typescript
{
  project?: string  // If provided: set active; if null: clear; if omitted: get current
}
```

**Behavior**:

- `active_project()` → Returns current active project (or null)
- `active_project({ project: "myproject" })` → Sets active project
- `active_project({ project: null })` → Clears active project

**Returns**:

```typescript
{
  active_project: string | null,
  resolution_hierarchy: string[],  // Debug info
  resolved_via: string              // "session" | "env" | "cwd" | "none"
}
```

**Rationale**: Unified interface reduces cognitive load. Single tool for single concern (active project lifecycle).

#### 2. `list_projects()` - List All Projects

**Purpose**: Retrieve all available projects from basic-memory

**Arguments**: None

**Returns**:

```typescript
{
  projects: Array<{
    name: string,
    notes_path: string,
    created_at: string,
    note_count?: number
  }>
}
```

**Rationale**: Extracted from `get_project` to follow SRP. This is a basic-memory query, not a Brain MCP concern.

#### 3. `get_project(project: string)` - Get Project Details

**Purpose**: Retrieve detailed information about a specific project

**Arguments**:

```typescript
{
  project: string  // Required: project name
}
```

**Returns**:

```typescript
{
  name: string,
  notes_path: string,
  code_path?: string,      // From brain-config.json if configured
  created_at: string,
  note_count?: number,
  last_modified?: string
}
```

**Rationale**: Focused query for single project. Merges Brain MCP config (code_path) with basic-memory metadata.

#### 4. `edit_project(project: string, updates: ProjectUpdates)` - Edit Project Metadata

**Purpose**: Update project metadata (NEW capability)

**Arguments**:

```typescript
{
  project: string,          // Required: project to edit
  name?: string,            // Rename project
  notes_path?: string,      // Update notes directory
  code_path?: string | null // Update code path (null to remove)
}
```

**Returns**:

```typescript
{
  updated_fields: string[],
  project: { /* full project details */ }
}
```

**Behavior**:

- `name`: Delegates to basic-memory (renames project)
- `notes_path`: Delegates to basic-memory (updates storage location)
- `code_path`: Updates brain-config.json (Brain MCP concern)

**Rationale**: Fills gap in current architecture. Provides consistent interface for all project mutations.

### Brain CLI Interface

Map tools to intuitive CLI commands:

```bash
# Active project management
brain projects active                    # Show active project
brain projects active myproject          # Set active project
brain projects active --clear            # Clear active project

# Project listing and details
brain projects list                      # List all projects
brain projects myproject                 # Show project details

# Project editing
brain projects myproject --name newname                # Rename
brain projects myproject --notes-path ~/notes/new      # Update notes path
brain projects myproject --code-path ~/code/myproject  # Set code path
brain projects myproject --code-path=                  # Remove code path
```

**Implementation**: Cobra commands in `apps/tui/cmd/projects.go`

### Data Model

#### Project Metadata Structure

```typescript
interface ProjectMetadata {
  // Basic-memory concerns (stored in basic-memory database)
  name: string              // Project identifier
  notes_path: string        // Where notes are stored
  created_at: string        // ISO timestamp
  note_count?: number       // Computed from database
  last_modified?: string    // Last note modification

  // Brain MCP concerns (stored in brain-config.json)
  code_path?: string        // CWD resolution mapping (optional)
}
```

#### Active Project Storage

**Where**: In-memory (per-process session state)

**How**:

- TypeScript: Module-level variable in `project/resolve.ts`
- Go: Hook-level variable in `cmd/hooks/project_resolve.go`

**Persistence**:

- Session-only (intentionally ephemeral)
- Set `BM_PROJECT` env var for cross-session persistence
- CWD resolution provides automatic context-based activation

**Rationale**: Active project is session state, not durable configuration. Avoids stale active project issues when switching contexts.

#### Code Path Mappings Storage

**Where**: `~/.basic-memory/brain-config.json`

**Structure**:

```json
{
  "code_paths": {
    "project1": "/absolute/path/to/code",
    "project2": "/another/absolute/path"
  }
}
```

**Rationale**: Existing storage location. Separate from basic-memory to avoid conflicts. Brain-specific configuration concern.

### Resolution Hierarchy (Unchanged)

Project resolution follows 6-level hierarchy (no changes):

1. Explicit parameter (highest priority)
2. Session state (in-memory `activeProject`)
3. `BM_PROJECT` env var
4. `BM_ACTIVE_PROJECT` env var (legacy)
5. CWD match against code_paths (deepest first)
6. `null` → Caller prompts user

## Migration Strategy

### Phase 1: Non-Breaking Additions

**Goal**: Add new tools without removing old ones

**Actions**:

1. Implement new tools under `tools/projects/`
2. Register new tools alongside existing tools
3. Add CLI commands (new functionality, no conflicts)
4. Update documentation to recommend new tools

**Timeline**: 1-2 days
**Risk**: Low (additive only)

### Phase 2: Deprecation Warnings

**Goal**: Signal intent to remove old tools

**Actions**:

1. Update old tool descriptions with deprecation notice:

   ```typescript
   description: "⚠️ DEPRECATED: Use active_project() instead.
   This tool will be removed in a future release."
   ```

2. Log deprecation warnings when old tools are called
3. Update all internal code to use new tools
4. Update agent instructions to use new tools

**Timeline**: 1 week (allow for integration updates)
**Risk**: Low (tools still work)

### Phase 3: Removal (Optional)

**Goal**: Remove deprecated tools to reduce maintenance burden

**Actions**:

1. Remove old tool registrations
2. Remove old tool directories
3. Clean up imports

**Timeline**: After 2-4 weeks of deprecation
**Risk**: Medium (breaks any external integrations still using old tools)

**Decision Point**: Assess if removal is worth breaking change vs. maintaining legacy tools indefinitely.

## Validation Rules

### Project Name Validation

```typescript
const PROJECT_NAME_REGEX = /^[a-z0-9][a-z0-9-]*$/
const MAX_PROJECT_NAME_LENGTH = 64

function validateProjectName(name: string): { valid: boolean, error?: string } {
  if (!name) {
    return { valid: false, error: "Project name is required" }
  }
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    return { valid: false, error: `Project name exceeds ${MAX_PROJECT_NAME_LENGTH} characters` }
  }
  if (!PROJECT_NAME_REGEX.test(name)) {
    return { valid: false, error: "Project name must start with lowercase letter or digit, contain only lowercase letters, digits, and hyphens" }
  }
  return { valid: true }
}
```

### Path Validation

```typescript
function validatePath(path: string, type: "notes" | "code"): { valid: boolean, error?: string } {
  if (!path) {
    return { valid: false, error: `${type} path is required` }
  }

  // Expand ~ to home directory
  const expanded = path.startsWith("~")
    ? join(os.homedir(), path.slice(1))
    : path

  // Resolve to absolute path
  const absolute = resolve(expanded)

  // Check if path exists (warning, not error)
  if (!existsSync(absolute)) {
    // Allow non-existent paths (may be created later)
    // But warn user
    return { valid: true, warning: `Path does not exist: ${absolute}` }
  }

  return { valid: true }
}
```

## Error Handling

### Consistent Error Format

```typescript
interface ToolError {
  content: [{
    type: "text",
    text: string  // Error message
  }],
  isError: true
}

function formatError(error: Error | string, context?: Record<string, unknown>): ToolError {
  const message = error instanceof Error ? error.message : error
  const contextStr = context ? `\n\nContext: ${JSON.stringify(context, null, 2)}` : ""

  return {
    content: [{
      type: "text",
      text: `🧠 Error: ${message}${contextStr}`
    }],
    isError: true
  }
}
```

### Error Categories

| Error Type | HTTP Status Equivalent | Example |
|------------|----------------------|---------|
| Validation Error | 400 Bad Request | Invalid project name format |
| Not Found | 404 Not Found | Project does not exist |
| Conflict | 409 Conflict | Project name already exists (rename) |
| Permission Error | 403 Forbidden | Cannot write to notes_path |
| Internal Error | 500 Internal Server Error | Database connection failed |

## Backward Compatibility

### Tool Mapping (Deprecation Phase)

Old tools will delegate to new tools:

```typescript
// tools/set-project/index.ts (deprecated wrapper)
export async function handler(args: SetProjectArgs): Promise<CallToolResult> {
  logger.warn("set_project is deprecated, use active_project instead")

  // Delegate to new tool
  return activeProjectHandler({ project: args.project })
}
```

### CLI Compatibility

No CLI compatibility concerns (CLI commands are new functionality).

### Hook Compatibility

Go hooks (`cmd/hooks/project_resolve.go`) remain unchanged. They provide resolution logic used by MCP tools.

## Testing Strategy

### Unit Tests

```typescript
// handlers/active.test.ts
describe("active_project", () => {
  it("returns null when no project is active", async () => {
    const result = await activeProjectHandler({})
    expect(result.active_project).toBe(null)
  })

  it("sets active project when project parameter provided", async () => {
    const result = await activeProjectHandler({ project: "test" })
    expect(result.active_project).toBe("test")
  })

  it("clears active project when project is null", async () => {
    await activeProjectHandler({ project: "test" })
    const result = await activeProjectHandler({ project: null })
    expect(result.active_project).toBe(null)
  })
})
```

### Integration Tests

```typescript
// projects.integration.test.ts
describe("Projects Tools Integration", () => {
  it("workflow: list -> get -> edit -> active", async () => {
    // 1. List projects
    const listResult = await callTool("list_projects", {})
    expect(listResult.projects).toBeArray()

    // 2. Get project details
    const project = listResult.projects[0]
    const getResult = await callTool("get_project", { project: project.name })
    expect(getResult.name).toBe(project.name)

    // 3. Edit code path
    const editResult = await callTool("edit_project", {
      project: project.name,
      code_path: "/tmp/test"
    })
    expect(editResult.updated_fields).toContain("code_path")

    // 4. Set as active
    const activeResult = await callTool("active_project", { project: project.name })
    expect(activeResult.active_project).toBe(project.name)
  })
})
```

### CLI Tests

```go
// apps/tui/cmd/tests/projects_test.go
func TestProjectsActiveCommand(t *testing.T) {
  tests := []struct{
    name string
    args []string
    want string
  }{
    {"show active", []string{"projects", "active"}, "No active project"},
    {"set active", []string{"projects", "active", "test"}, "Active project: test"},
    {"clear active", []string{"projects", "active", "--clear"}, "Active project cleared"},
  }

  for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
      // Test implementation
    })
  }
}
```

## Security Considerations

### Path Traversal Prevention

```typescript
function sanitizePath(path: string): string {
  // Resolve to absolute path (prevents relative path attacks)
  const resolved = resolve(path)

  // Ensure path is not attempting to escape user's home directory
  // (unless explicitly allowed for system paths)
  const home = os.homedir()
  if (!resolved.startsWith(home) && !resolved.startsWith("/opt/") && !resolved.startsWith("/usr/local/")) {
    throw new Error("Path must be within user home directory or approved system paths")
  }

  return resolved
}
```

### Project Name Injection Prevention

Project names are validated against strict regex before use in:

- File system operations
- Database queries
- Environment variable setting

No raw string concatenation with project names in shell commands or SQL.

## Performance Considerations

### Caching Strategy

**Active Project**: In-memory (no cache needed, direct variable access)

**Code Paths**: Loaded from disk on each access (acceptable - small file, infrequent reads)

- **Optimization opportunity**: Cache in memory, invalidate on write

**Project List**: Delegated to basic-memory (caching handled there)

**Project Details**: Delegated to basic-memory (caching handled there)

### Response Time Targets

| Tool | Target | Rationale |
|------|--------|-----------|
| `active_project` (get) | <10ms | In-memory read |
| `active_project` (set) | <50ms | In-memory write + env var set |
| `list_projects` | <100ms | basic-memory database query |
| `get_project` | <100ms | basic-memory query + config file read |
| `edit_project` | <200ms | basic-memory update + config file write |

## Open Questions

### Q1: Should `edit_project` support bulk updates?

**Context**: Current design allows updating multiple fields in one call.

**Options**:

1. Keep current design (multiple fields per call)
2. Single field per call (simpler, more granular)

**Recommendation**: Keep current design. Users benefit from atomic multi-field updates.

---

### Q2: Should old tools be removed or maintained indefinitely?

**Context**: Breaking change vs. maintenance burden.

**Options**:

1. Remove after deprecation period (clean architecture, breaking change)
2. Maintain forever (no breaking change, technical debt)
3. Keep as thin wrappers (compromise - low maintenance, no breaking change)

**Recommendation**: Option 3 (thin wrappers). Minimal maintenance cost, zero breaking change risk.

---

### Q3: Should CLI support JSON output for scripting?

**Context**: CLI currently designed for human readability.

**Options**:

1. Add `--json` flag to all commands
2. Human-readable only
3. Separate `brain projects json` subcommand

**Recommendation**: Option 1 (`--json` flag). Standard practice for modern CLIs.

---

### Q4: Should project resolution be exposed as a standalone tool?

**Context**: Resolution logic is currently embedded in other tools.

**Options**:

1. Add `resolve_project(cwd?)` tool for debugging
2. Keep resolution logic internal

**Recommendation**: Option 1. Valuable for debugging and testing. Low implementation cost.

---

## Implementation Checklist

### Phase 1: Core Implementation

- [ ] Create `tools/projects/` directory structure
- [ ] Implement `schema.ts` with shared types
- [ ] Implement `handlers/active.ts` (active_project tool)
- [ ] Implement `handlers/list.ts` (list_projects tool)
- [ ] Implement `handlers/get.ts` (get_project tool - new semantics)
- [ ] Implement `handlers/edit.ts` (edit_project tool)
- [ ] Implement `utils/validation.ts`
- [ ] Implement `utils/formatting.ts`
- [ ] Register new tools in `tools/index.ts`
- [ ] Write unit tests for all handlers
- [ ] Write integration tests

### Phase 2: CLI Implementation

- [ ] Create `apps/tui/cmd/projects.go`
- [ ] Implement `brain projects active` command
- [ ] Implement `brain projects list` command
- [ ] Implement `brain projects <project>` command
- [ ] Implement `brain projects <project> --name/--notes-path/--code-path` command
- [ ] Add `--json` flag support
- [ ] Write CLI tests

### Phase 3: Deprecation

- [ ] Add deprecation warnings to old tools
- [ ] Update agent instructions
- [ ] Update documentation
- [ ] Monitor usage of old vs. new tools

### Phase 4: Optional Removal

- [ ] Assess breaking change impact
- [ ] If approved: Remove old tool directories
- [ ] Update tool registry
- [ ] Update tests

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tool count reduction | 4 → 4 (same, but unified) | Count of top-level tool exports |
| SRP compliance | 100% | Each tool has single, clear responsibility |
| CLI usability | <3 seconds to complete task | Time to set active project via CLI |
| Adoption rate (new tools) | >80% after 2 weeks | Usage logs (new vs. old tools) |
| Backward compatibility | 0 breaking changes in Phase 1-2 | Integration test suite passes |

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing integrations | Low (Phase 1-2) | High | Phased rollout, deprecation warnings |
| Performance regression | Low | Medium | Performance tests, response time targets |
| Data inconsistency (brain-config vs. basic-memory) | Medium | High | Clear ownership boundaries, validation |
| User confusion (two ways to do same thing) | High (during deprecation) | Low | Clear documentation, migration guide |

## References

- Existing implementation: `apps/mcp/src/tools/{set-project,get-project,clear-project,configure-code-path}/`
- Project resolution logic: `apps/mcp/src/project/resolve.ts`, `apps/claude-plugin/cmd/hooks/project_resolve.go`
- Configuration storage: `apps/mcp/src/project/config.ts`
- Tool registry: `apps/mcp/src/tools/index.ts`

## Appendix: Tool Usage Examples

### Example 1: First-Time Setup

```typescript
// Claude agent setting up a new project

// 1. Check if project exists
const projects = await callTool("list_projects", {})
const exists = projects.projects.some(p => p.name === "myapp")

if (!exists) {
  // Project doesn't exist - create via basic-memory first
  await callTool("create_memory_project", {
    name: "myapp",
    notes_path: "~/notes/myapp"
  })
}

// 2. Configure code path for automatic resolution
await callTool("edit_project", {
  project: "myapp",
  code_path: "~/code/myapp"
})

// 3. Activate project
await callTool("active_project", { project: "myapp" })

// Now all subsequent operations use "myapp" automatically via CWD resolution
```

### Example 2: Debugging Resolution Issues

```bash
# User reports: "Why is Brain using the wrong project?"

# 1. Check current active project and resolution
brain projects active
# Output:
# Active project: old-project
# Resolved via: session state
#
# Resolution hierarchy:
# 1. Explicit parameter: none
# 2. Session state: old-project ✓ (matched here)
# 3. BM_PROJECT env: none
# 4. BM_ACTIVE_PROJECT env: none
# 5. CWD match: would match "new-project"

# 2. Clear stale session state
brain projects active --clear

# 3. Verify CWD resolution now works
brain projects active
# Output:
# Active project: new-project
# Resolved via: cwd match
```

### Example 3: Migrating Project Location

```bash
# User is moving project to new directory

# 1. Get current project details
brain projects myproject --json
# {
#   "name": "myproject",
#   "notes_path": "/old/path/notes",
#   "code_path": "/old/path/code"
# }

# 2. Move files (outside Brain)
mv /old/path /new/path

# 3. Update Brain configuration
brain projects myproject --notes-path /new/path/notes --code-path /new/path/code

# 4. Verify update
brain projects myproject
# Output:
# Project: myproject
# Notes: /new/path/notes
# Code: /new/path/code
```

---

**End of Design Document**

**Next Steps**:

1. Review this design with critic agent for validation
2. If approved, create implementation plan with task breakdown
3. Implement Phase 1 (non-breaking additions)
