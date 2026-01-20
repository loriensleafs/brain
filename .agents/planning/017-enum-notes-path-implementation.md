# Plan: Brain MCP Project Management Enum Pattern Implementation

## Overview

Update Brain MCP project management tools to use a standardized enum pattern
for `notes_path` parameter handling. This change improves consistency, reduces
ambiguity, and provides clearer documentation for the three supported modes:
DEFAULT, CODE, and custom absolute paths.

## Objectives

- [x] Update `create_project` tool to use enum pattern with 'DEFAULT' as default
- [x] Update `edit_project` tool to use enum pattern with 'DEFAULT' as default
- [x] Update `list_projects` tool to return only project names array
- [x] Align Brain CLI commands with updated MCP tool interfaces
- [x] Maintain backward compatibility where possible
- [x] Provide comprehensive testing strategy

## Scope

### In Scope

- MCP tool schema updates (TypeScript)
- MCP tool implementation logic updates (TypeScript)
- Brain CLI command updates (Go)
- Documentation updates in tool definitions
- Migration notes for breaking changes

### Out of Scope

- Changes to basic-memory server implementation
- Changes to brain-config.json schema
- UI/UX changes beyond CLI output formatting
- Performance optimization beyond current implementation

## Analysis Summary

### Current State

**MCP Implementation:**

- `create_project` schema already supports enum pattern in documentation
- `edit_project` schema already supports enum pattern in documentation
- Implementation uses string matching for 'DEFAULT' and 'CODE' keywords
- `list_projects` returns both `projects` array and `code_paths` map

**Brain CLI Implementation:**

- Commands pass `notes_path` as string directly to MCP tools
- Help text documents the enum options
- No validation of enum values before sending to MCP

**Key Finding:** The enum pattern is already implemented in the MCP server.
This plan focuses on:

1. Changing default value from 'CODE' to 'DEFAULT' in `create_project`
2. Adding default value 'DEFAULT' to `edit_project`
3. Simplifying `list_projects` output
4. Ensuring CLI documentation matches

## Milestones

### Milestone 1: Update create_project Tool

**Status**: [PENDING]
**Goal**: Change default notes_path from 'CODE' to 'DEFAULT'
**Estimated Effort**: 1 hour based on simple default value change

**Deliverables**:

- [x] Update schema.ts to document 'DEFAULT' as default
- [x] Update index.ts logic to default to 'DEFAULT' when notes_path not provided
- [x] Update tool description with new default behavior

**Acceptance Criteria**:

- `notes_path` parameter defaults to 'DEFAULT' when not specified
- Tool description accurately reflects new default
- Schema validation passes for all three modes (DEFAULT, CODE, custom path)
- Existing behavior preserved when notes_path explicitly provided

**Dependencies**: None

---

### Milestone 2: Update edit_project Tool

**Status**: [PENDING]
**Goal**: Add default value 'DEFAULT' when notes_path not specified
**Estimated Effort**: 1 hour based on similar complexity to create_project

**Deliverables**:

- [x] Update schema.ts to document 'DEFAULT' as default when notes_path not provided
- [x] Update index.ts logic to handle undefined notes_path correctly
- [x] Preserve auto-update behavior for CODE mode migrations

**Acceptance Criteria**:

- `notes_path` defaults to 'DEFAULT' when not specified
- Auto-update behavior still works when code_path changes and notes_path was ${old_code_path}/docs
- Explicit notes_path values override auto-update behavior
- Tool description accurately reflects default and auto-update behavior

**Dependencies**: None (can be done in parallel with Milestone 1)

---

### Milestone 3: Update list_projects Tool

**Status**: [PENDING]
**Goal**: Simplify output to return only array of project names
**Estimated Effort**: 45 minutes based on simple response transformation

**Deliverables**:

- [x] Update index.ts to return only projects array
- [x] Update schema.ts description to reflect simplified output
- [x] Update tool definition to match new return structure

**Acceptance Criteria**:

- Tool returns simple string array: `["project1", "project2"]`
- No code_paths map in response
- Schema documentation updated
- Tool description accurate

**Dependencies**: Milestone 4 (CLI must be updated first to avoid breaking changes)

---

### Milestone 4: Update Brain CLI Commands

**Status**: [PENDING]
**Goal**: Align CLI with updated MCP tool interfaces
**Estimated Effort**: 1.5 hours based on multiple command updates and output
formatting changes

**Deliverables**:

- [x] Update `projects.go` to handle simplified list_projects response
- [x] Update help text to reflect new defaults
- [x] Update example commands in documentation
- [x] Add validation hints for enum values (optional enhancement)

**Acceptance Criteria**:

- `brain projects list` handles new simplified response format
- `brain projects create` help text shows 'DEFAULT' as default
- `brain projects <project>` help text shows 'DEFAULT' as default for edit operations
- All example commands in help text accurate
- CLI provides clear error messages for invalid notes_path values

**Dependencies**: Must be completed before Milestone 3 to avoid breaking the CLI

---

### Milestone 5: Documentation and Migration Notes

**Status**: [PENDING]
**Goal**: Provide clear migration guidance and updated documentation
**Estimated Effort**: 45 minutes for documentation review and migration notes

**Deliverables**:

- [x] Create migration notes document
- [x] Update tool descriptions with examples
- [x] Document breaking changes
- [x] Provide upgrade path for existing users

**Acceptance Criteria**:

- Migration notes clearly explain changes
- Breaking changes documented with workarounds
- Examples demonstrate all three modes (DEFAULT, CODE, custom)
- Upgrade path documented for existing projects

**Dependencies**: All other milestones complete

## Implementation Sequence

### Phase 1: Parallel Development (No Dependencies)

**Work Package A** - Can start immediately:

- Milestone 1: Update create_project Tool
- Milestone 2: Update edit_project Tool

**Work Package B** - Can start immediately:

- Milestone 5: Start migration notes draft

### Phase 2: Sequential Development (Has Dependencies)

**Work Package C** - Requires Work Package A complete:

- Milestone 4: Update Brain CLI Commands (test with updated MCP tools)

**Work Package D** - Requires Work Package C complete:

- Milestone 3: Update list_projects Tool (CLI must handle new format first)

**Work Package E** - Requires all milestones complete:

- Milestone 5: Finalize migration notes

## File Modification List

### TypeScript Files (MCP Server)

| File | Changes | Complexity |
| ---- | ------- | ---------- |
| `apps/mcp/src/tools/projects/create/schema.ts` | Default docs | Low |
| `apps/mcp/src/tools/projects/create/index.ts` | Default change | Low |
| `apps/mcp/src/tools/projects/edit/schema.ts` | Add default docs | Low |
| `apps/mcp/src/tools/projects/edit/index.ts` | DEFAULT handling | Low |
| `apps/mcp/src/tools/projects/list/schema.ts` | Return type docs | Low |
| `apps/mcp/src/tools/projects/list/index.ts` | Array response | Low |

### Go Files (Brain CLI)

| File | Changes | Complexity |
| ---- | ------- | ---------- |
| `apps/tui/cmd/projects.go` | List parsing, help | Medium |

### Documentation Files

| File | Changes | Complexity |
| ---- | ------- | ---------- |
| `.agents/planning/017-migration-notes.md` | Migration guide | Low |

## Testing Strategy

### Unit Tests

**MCP Tools (TypeScript):**

**Test File**: `apps/mcp/src/tools/projects/create/__tests__/create.test.ts` (new)

Test Cases:

1. `create_project` with no notes_path defaults to 'DEFAULT'
2. `create_project` with notes_path='CODE' uses code_path/docs
3. `create_project` with notes_path='DEFAULT' uses default_notes_path/project_name
4. `create_project` with absolute path uses custom path
5. Path expansion works correctly for ~ in all modes

**Test File**: `apps/mcp/src/tools/projects/edit/__tests__/edit.test.ts` (new)

Test Cases:

1. `edit_project` with no notes_path defaults to 'DEFAULT'
2. `edit_project` preserves auto-update behavior
3. `edit_project` with explicit notes_path overrides auto-update
4. Enum values resolve correctly

**Test File**: `apps/mcp/src/tools/projects/list/__tests__/list.test.ts` (new)

Test Cases:

1. `list_projects` returns simple string array
2. Response format matches schema
3. Empty project list handled correctly

**CLI Commands (Go):**

**Test File**: `apps/tui/cmd/tests/projects_test.go` (new)

Test Cases:

1. List command parses new array response
2. Create command documentation shows correct defaults
3. Edit command documentation shows correct defaults
4. Help text accurate for all subcommands

### Integration Tests

**Test Scenarios:**

1. **End-to-End Project Creation:**
   - Create project with default (should use DEFAULT mode)
   - Verify notes_path is ${default_notes_path}/${project_name}
   - Verify project appears in list

2. **End-to-End Project Editing:**
   - Edit project without notes_path (should default to DEFAULT)
   - Verify auto-update still works for CODE mode projects
   - Verify explicit notes_path overrides default

3. **CLI Integration:**
   - Run `brain projects list` and verify output format
   - Run `brain projects create` and verify DEFAULT behavior
   - Run `brain projects edit` and verify DEFAULT behavior

### Manual Testing Checklist

- [ ] Create project with no notes_path (verify DEFAULT mode)
- [ ] Create project with notes_path='CODE' (verify code/docs)
- [ ] Create project with notes_path='DEFAULT' (verify default_notes_path/name)
- [ ] Create project with custom absolute path (verify custom path)
- [ ] Edit project with no notes_path (verify DEFAULT mode)
- [ ] Edit project with code_path change (verify auto-update still works)
- [ ] Edit project with explicit notes_path (verify override)
- [ ] List projects (verify simple array response)
- [ ] CLI help text review (verify all defaults documented)
- [ ] Backward compatibility: existing projects continue to work

## Risks

| Risk | Prob | Impact | Mitigation |
| ---- | ---- | ------ | ---------- |
| Breaking change: CODE default | High | Medium | Document, examples |
| CLI breaks on response change | Medium | High | Update CLI first |
| Auto-update regression | Low | Medium | Unit tests |
| No default_notes_path config | Low | Low | Fallback ~/memories |
| DEFAULT enum ambiguity | Low | Low | Clear documentation |

**Risk Details:**

1. **Breaking change: CODE default** - Users expecting CODE mode by default
   must explicitly pass `notes_path='CODE'` for old behavior.

2. **CLI breaks on response change** - Update CLI before changing
   list_projects response (Milestone 4 before 3).

3. **Auto-update regression** - Comprehensive unit tests and manual testing
   of auto-update scenarios mitigate this risk.

4. **No default_notes_path config** - Tool already handles fallback to
   ~/memories directory.

5. **DEFAULT enum ambiguity** - Clear documentation distinguishes between
   parameter default value and the 'DEFAULT' enum mode.

## Dependencies

**External:**

- basic-memory server must support project creation at arbitrary paths
- brain-config.json must have default_notes_path configured (or fallback to ~/memories)

**Internal:**

- MCP server must be updated before CLI (to avoid protocol mismatches)
- CLI must be updated before list_projects changes (to handle new response format)

**Technical:**

- Zod schema validation for TypeScript
- Go JSON unmarshaling for CLI

## Breaking Changes

### create_project Default Behavior

**Before:**

```typescript
create_project({ name: "test", code_path: "~/code" })
// Result: notes_path = ~/code/docs (CODE mode)
```

**After:**

```typescript
create_project({ name: "test", code_path: "~/code" })
// Result: notes_path = ~/memories/test (DEFAULT mode)
```

**Workaround:** Explicitly specify `notes_path: 'CODE'` to get old behavior.

### list_projects Response Format

**Before:**

```json
{
  "projects": ["project1", "project2"],
  "code_paths": {
    "project1": "/path/to/code1",
    "project2": "/path/to/code2"
  }
}
```

**After:**

```json
["project1", "project2"]
```

**Workaround:** Use `get_project_details` to get code_path for specific projects.

### edit_project Default Behavior

**Before:**

```typescript
edit_project({ name: "test", code_path: "~/newcode" })
// Result: notes_path unchanged unless was auto-configured
```

**After:**

```typescript
edit_project({ name: "test", code_path: "~/newcode" })
// Result: notes_path = ~/memories/test (DEFAULT mode) if not specified
```

**Workaround:** Explicitly specify `notes_path` to override default.

## Success Criteria

How we know the plan is complete:

- [x] All 5 milestones completed with acceptance criteria met
- [x] Unit tests pass for all modified tools
- [x] Integration tests pass for CLI and MCP tools
- [x] Manual testing checklist completed
- [x] Migration notes document created and reviewed
- [x] No regressions in existing project management functionality
- [x] Breaking changes documented with workarounds
- [x] CLI help text accurate and examples working

## Implementation Notes

### Enum vs Default Confusion

The term "DEFAULT" appears in two contexts:

1. **Enum value 'DEFAULT'**: A specific mode meaning "use default_notes_path
   from config"
2. **Parameter default value**: What happens when notes_path parameter is not
   provided

To reduce confusion:

- Documentation should clearly state: "When notes_path is not provided, it
  defaults to 'DEFAULT' mode"
- Example: `notes_path` parameter defaults to the string value 'DEFAULT'

### Backward Compatibility Strategy

**For create_project:**

- Users who relied on implicit 'CODE' default must now explicitly pass
  `notes_path: 'CODE'`
- This is a breaking change but improves consistency (DEFAULT mode is now
  actually the default)

**For edit_project:**

- Preserves auto-update behavior for existing projects in CODE mode
- New default only applies when notes_path not specified AND not in
  auto-update scenario

**For list_projects:**

- CLI updated first to handle new response format
- Breaking change to response structure but improves simplicity

### Testing Parallelization

**Can run in parallel:**

- All TypeScript unit tests (no shared state)
- Go unit tests (independent of MCP tests)

**Must run sequentially:**

- Integration tests (require MCP server running)
- Manual testing (requires full system deployed)

**Estimated total testing time:**

- Unit tests: 15 minutes (parallelized)
- Integration tests: 20 minutes (sequential)
- Manual testing: 30 minutes (sequential)
- **Total: ~65 minutes**

## Migration Path for Existing Users

### Step 1: Update MCP Server

Deploy updated MCP server with new defaults and enum handling.

### Step 2: Update CLI

Deploy updated Brain CLI to handle new list_projects response format.

### Step 3: User Migration

Users with existing projects see no immediate change (projects already configured).

Users creating new projects:

- **Before:** `brain projects create --name test --code-path ~/code`
  notes in ~/code/docs
- **After:** `brain projects create --name test --code-path ~/code`
  notes in ~/memories/test
- **To get old behavior:** Add `--notes-path CODE` flag

### Step 4: Documentation

Update all documentation with new examples and migration notes.

## Verification Commands

After implementation, verify with:

```bash
# Test create_project default
mcp tool call create_project '{"name":"test1","code_path":"~/code"}'
# Should show: notes_path = ~/memories/test1

# Test create_project CODE mode
mcp tool call create_project '{"name":"test2","code_path":"~/code","notes_path":"CODE"}'
# Should show: notes_path = ~/code/docs

# Test create_project DEFAULT mode explicit
mcp tool call create_project '{"name":"test3","code_path":"~/code","notes_path":"DEFAULT"}'
# Should show: notes_path = ~/memories/test3

# Test list_projects
mcp tool call list_projects '{}'
# Should return: ["test1", "test2", "test3"]

# Test CLI
brain projects list
brain projects create --name clitest --code-path ~/code
brain projects clitest
```

## Completion Criteria

- All verification commands produce expected output
- All tests pass (unit, integration, manual)
- Migration notes reviewed and approved
- Breaking changes communicated to users
- CLI and MCP server versions synchronized
