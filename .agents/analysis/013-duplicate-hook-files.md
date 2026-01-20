# Analysis: Duplicate Hook Files Investigation

## 1. Objective and Scope

**Objective**: Identify which hook files are duplicates and recommend which should be deleted.

**Scope**: Two sets of duplicate files in the hooks directory:

- Session start implementation
- Gate check implementation

## 2. Context

The hooks directory contains duplicate implementations where code has been refactored from flat files into subpackages, but the original files were not deleted.

**Current Structure**:

```
cmd/hooks/
├── main.go
├── session_start.go        # WRAPPER + SHARED UTILITIES
├── sessionstart/
│   └── sessionstart.go     # IMPLEMENTATION (206 lines)
├── gate_check.go           # STUB (12 lines, comments only)
└── gatecheck/
    └── gatecheck.go        # IMPLEMENTATION (178 lines)
```

## 3. Approach

**Methodology**:

1. Read main.go to identify which implementations are imported
2. Read all four files to compare their content
3. Check git history to understand the refactoring timeline
4. Search for all references to these files in the codebase
5. Analyze test imports to confirm which packages are actively tested
6. Verify utility function usage across hooks

**Tools Used**: Read, Grep, Bash (git)

**Limitations**: All files were added in the initial monorepo commit (1f920cd), so git history does not show the refactoring evolution. Refactoring occurred before monorepo creation.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
|---------|--------|-----------|
| session_start.go imports sessionstart package | main.go + session_start.go:9 | High |
| session_start.go contains shared utility functions | File content + grep | High |
| resolveSkillsPath() used by load_skills.go | load_skills.go:51 | High |
| containsAny() used by user_prompt.go | user_prompt.go:77 | High |
| sessionstart/sessionstart.go contains session logic (206 lines) | File content | High |
| gate_check.go is a stub comment file (12 lines) | File content | High |
| gatecheck/gatecheck.go contains full implementation (178 lines) | File content | High |
| Tests import sessionstart and gatecheck subpackages | tests/*.go | High |
| No code references gate_check.go | Grep search | High |

### Facts (Verified)

**Session Start Files**:

- `session_start.go` (62 lines total):
  - `RunSessionStart()` wrapper (8 lines) - calls `sessionstart.BuildSessionOutput()`
  - `getPluginRoot()` utility (14 lines) - used by resolveSkillsPath()
  - `resolveSkillsPath()` utility (12 lines) - **USED by load_skills.go**
  - `containsAny()` utility (8 lines) - **USED by user_prompt.go**
- Imports: `"github.com/peterkloss/brain/apps/claude-plugin/cmd/hooks/sessionstart"`
- `sessionstart/sessionstart.go` (206 lines): Session-specific implementation
  - Functions: `IdentifyProject()`, `GetGitContext()`, `GetBootstrapContext()`, `LoadWorkflowState()`, `BuildSessionOutput()`
  - Testable package design with dependency injection

**Gate Check Files**:

- `gate_check.go` (12 lines): Empty stub with comment: "Gate check logic has been moved to the gatecheck subpackage. This file is kept for backward compatibility..."
- Contains NO implementation, only documentation
- `gatecheck/gatecheck.go` (178 lines): Full implementation
  - Exports: `SessionState`, `GateCheckResult`, `IsReadOnlyTool()`, `CheckToolBlocked()`, `PerformGateCheck()`

**Utility Function Usage** (Verified):

```
getPluginRoot()
  └─> resolveSkillsPath()
        └─> load_skills.go:51

containsAny()
  └─> user_prompt.go:77
```

**Gate Check Usage**:

- `pre_tool_use.go` imports `gatecheck` package directly
- No references to `gate_check.go` found

### Pattern Analysis

**Refactoring Pattern**: Extract business logic into testable subpackages while keeping shared utilities in main package.

```
session_start.go:
  - RunSessionStart() wrapper → calls sessionstart package
  - Shared utilities → used by other hooks (load_skills, user_prompt)

gate_check.go:
  - Empty stub → logic fully in gatecheck package
  - No shared utilities
```

**Key Distinction**: session_start.go serves dual purpose (wrapper + shared utilities), while gate_check.go is purely a documentation stub.

## 5. Results

**Duplication Assessment**:

| File | Lines | Status | Purpose |
|------|-------|--------|---------|
| `session_start.go` | 62 | ACTIVE | Wrapper + shared utilities (used by other hooks) |
| `sessionstart/sessionstart.go` | 206 | CANONICAL | Session-specific implementation |
| `gate_check.go` | 12 | STALE STUB | Documentation only, no code |
| `gatecheck/gatecheck.go` | 178 | CANONICAL | Gate check implementation |

**Cross-File Dependencies**:

- `load_skills.go` → `resolveSkillsPath()` in session_start.go
- `user_prompt.go` → `containsAny()` in session_start.go

## 6. Discussion

The refactoring followed best practices:

1. Move domain-specific logic to testable subpackages
2. Keep shared utilities in main package for cross-hook usage
3. Use dependency injection for testability

**Why session_start.go Contains Utilities**:

The utility functions are NOT orphaned - they are shared across multiple hooks:

- `resolveSkillsPath()`: Used by load_skills hook for skill directory resolution
- `containsAny()`: Used by user_prompt hook for keyword detection
- `getPluginRoot()`: Supporting function for resolveSkillsPath()

This is proper code organization: domain-agnostic utilities belong in the main package where all hooks can access them.

**Why gate_check.go Should Be Removed**:

Unlike session_start.go, gate_check.go serves no purpose:

- Contains only comments explaining refactoring
- No wrapper function (pre_tool_use.go imports gatecheck directly)
- No shared utilities
- Tests import gatecheck package directly

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
|----------|---------------|-----------|---------|
| P0 | DELETE `gate_check.go` | Stub file with no code, serves no purpose | 1 minute |
| P1 | KEEP `session_start.go` AS-IS | Contains active shared utilities used by other hooks | N/A |
| P2 | OPTIONALLY rename to `hooks_common.go` | Better reflects its dual purpose | 5 minutes |

### Specific Actions

**IMMEDIATE (P0)**:

```bash
# Delete gate_check.go - it's a stub with no code
rm cmd/hooks/gate_check.go

# Verify no references exist
grep -r "gate_check" cmd/hooks/
```

**KEEP (P1)**:

```bash
# DO NOT DELETE session_start.go
# It contains shared utilities used by:
# - load_skills.go (resolveSkillsPath)
# - user_prompt.go (containsAny)
```

**OPTIONAL (P2)** - Improve naming clarity:

```bash
# Rename to better reflect dual purpose
mv cmd/hooks/session_start.go cmd/hooks/hooks_common.go

# Update main.go import if needed
```

If renaming, add comment at top:

```go
// Package main provides shared utilities for all hooks.
// Domain-specific implementations are in subpackages:
//   - sessionstart: Session initialization logic
//   - gatecheck: Mode-based tool access control
package main
```

## 8. Conclusion

**Verdict**: DELETE gate_check.go ONLY. KEEP session_start.go (contains active shared utilities).

**Confidence**: High

**Rationale**:

- gate_check.go is a stub with no code or utility functions
- session_start.go serves as a shared utility module used by multiple hooks
- Deleting session_start.go would break load_skills.go and user_prompt.go

### User Impact

**What changes for you**:

- Cleaner codebase with one fewer stub file
- No functionality changes
- Future developers see clear separation: subpackages for domain logic, main package for shared utilities

**Effort required**: 1 minute (delete gate_check.go)

**Risk if ignored**:

- Low: Code continues to work
- Maintenance confusion: Future developers read empty stub file expecting code

## 9. Appendices

### Verification Steps

After deletion:

```bash
# 1. Delete stub file
rm cmd/hooks/gate_check.go

# 2. Verify no references
grep -r "gate_check\.go" cmd/hooks/

# 3. Check tests still pass
cd cmd/hooks/tests
go test -v

# 4. Verify imports resolve
cd cmd/hooks
go build
```

### Files to Keep

| File | Justification |
|------|---------------|
| `session_start.go` | Wrapper + shared utilities (resolveSkillsPath, containsAny, getPluginRoot) used by other hooks |
| `sessionstart/sessionstart.go` | Canonical session implementation |
| `gatecheck/gatecheck.go` | Canonical gate check implementation |

### Files to Delete

| File | Justification |
|------|---------------|
| `gate_check.go` | Empty stub with no code, only comments. No wrapper function, no utilities. |

### Shared Utility Usage Map

```
session_start.go utilities:
├── getPluginRoot()
│   └── (internal support for resolveSkillsPath)
├── resolveSkillsPath()
│   └── load_skills.go:51
└── containsAny()
    └── user_prompt.go:77
```

### Data Transparency

**Found**:

- Import statements confirming subpackage usage
- Test files importing subpackages
- Stub comment in gate_check.go explaining refactoring
- Wrapper + utilities pattern in session_start.go
- **Active usage of utilities by load_skills.go and user_prompt.go**

**Not Found**:

- Git history showing when refactoring occurred (pre-monorepo)
- Any code importing gate_check.go
- Any usage of gate_check.go functions (file contains none)
