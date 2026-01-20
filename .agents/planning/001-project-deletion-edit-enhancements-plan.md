# Plan: Project Deletion and Edit Enhancements

## Overview

Add comprehensive project deletion capability and note migration during path updates. This plan addresses safe file deletion operations with recovery mechanisms and automatic note migration when project paths change.

## Objectives

- [ ] Enable safe deletion of projects with configurable note removal
- [ ] Prevent duplicate project creation with clear user guidance
- [ ] Auto-migrate notes when notes_path changes during edit
- [ ] Provide recovery procedures for accidental deletions
- [ ] Maintain consistency across brain-config.json and basic-memory config.json

## Scope

### In Scope

- MCP delete_project tool (TypeScript)
- Brain CLI delete subcommand (Go)
- edit_project enhancement for note migration
- create_project duplicate detection
- Comprehensive test coverage for destructive operations
- Recovery documentation

### Out of Scope

- Soft delete (trash/recycle bin) - deferred to future enhancement
- Bulk project operations
- Interactive deletion wizard (CLI remains scriptable)
- Automatic backup creation (user responsibility)

## Clarifications from Critic Review

### Security Review Timing

**Answer**: Security review happens BEFORE implementation (Milestone 0 - BLOCKING gate). No implementation work begins until threat assessment is complete and mitigations are documented.

### Coverage Target for delete_project

**Answer**: 100% coverage target for delete_project specifically due to destructive nature. Acceptance criteria updated in M1 to reflect this requirement.

### delete_project Test Location

**Answer**: `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/delete/__tests__/delete.test.ts` (co-located with implementation following existing pattern from create/edit tools).

### delete_notes Double Confirmation

**Answer**: YES. When `--delete-notes` flag is used, CLI requires TWO confirmations:

1. First prompt: "Delete project 'X'? Notes WILL BE DELETED. (y/N)"
2. Second prompt: "[WARNING] This will permanently delete notes at [path]. Continue? (y/N)"

This prevents accidental data loss from muscle memory or scripting errors.

### Migration Verification Strategy

**Answer**: File count + size check (not hashing). Rationale:

- **File count**: Detects incomplete copies (missing files)
- **Size check**: Detects truncated files or corrupted transfers
- **No hashing**: Performance cost too high for large note directories (1000+ files), size check provides sufficient integrity verification for typical use cases
- **Trade-off**: Accepts theoretical risk of same-size corruption for practical performance

Verification algorithm: `countFiles(path)` + `getTotalSize(path)` for both source and destination.

## Milestones

### Milestone 0: Security Threat Assessment (BLOCKING)

**Status**: [PENDING]
**Goal**: Complete security review of file deletion operations BEFORE implementation begins
**Estimated Effort**: 2 hours
**Blocking**: Milestones 1-4 cannot start until M0 complete

**Deliverables**:

- [ ] Threat model document: `.agents/security/TM-001-project-deletion.md`
- [ ] Security acceptance criteria documented
- [ ] Path traversal attack vectors identified and mitigations defined
- [ ] Data loss scenarios catalogued with prevention strategies
- [ ] Race condition risks assessed (concurrent operations)
- [ ] Permission escalation risks evaluated

**Acceptance Criteria** (quantified):

- [ ] **Threat Coverage**: Minimum 5 threat scenarios documented (path traversal, data loss, race conditions, permission issues, symlink attacks)
- [ ] **Mitigation Strategy**: Each threat has documented mitigation with implementation guidance
- [ ] **Attack Surface**: Document all user-controlled inputs (project name, notes_path, delete_notes flag)
- [ ] **Security Controls**: Define input validation requirements (absolute path enforcement, directory traversal prevention, symlink resolution)
- [ ] **Approval Gate**: Security agent provides APPROVED verdict before M1 begins

**Threat Categories to Assess**:

| Threat Category | Example Scenario | Required Mitigation |
|-----------------|------------------|---------------------|
| **Path Traversal** | User provides `../../etc/passwd` as notes_path | Validate all paths are absolute, reject relative paths |
| **Symlink Attacks** | notes_path is symlink to system directory | Resolve symlinks, validate resolved path is in allowed directories |
| **Race Conditions** | Concurrent delete operations on same project | Config locking, atomic operations |
| **Data Loss** | Accidental deletion without backups | Double confirmation for --delete-notes, clear warnings |
| **Permission Escalation** | Delete operation affects files outside user scope | Validate file ownership before deletion |

**Dependencies**: None (MUST complete first)

**Security Review Handoff**:

After M0 complete, planner routes to:

1. **Security agent** for threat assessment
2. **Critic** for mitigation validation
3. **Orchestrator** receives APPROVED verdict before authorizing M1-M4 to begin

### Milestone 1: delete_project MCP Tool

**Status**: [PENDING]
**Goal**: Create safe project deletion capability in MCP server
**Estimated Effort**: 3-4 hours based on create_project complexity (Session 05 took 2h, deletion adds safety logic)

**Deliverables**:

- [ ] `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/delete/index.ts`
- [ ] `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/delete/schema.ts`
- [ ] `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/delete/__tests__/delete.test.ts`
- [ ] Update `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/index.ts` to register tool

**Acceptance Criteria** (quantified):

- [ ] **Safety**: Two-stage deletion (config first, then files) prevents orphaned projects
- [ ] **Validation**: Project existence check before deletion (test case: non-existent project returns error)
- [ ] **Config cleanup**: Removes entries from both brain-config.json (code_paths) and basic-memory config.json (projects)
- [ ] **File deletion**: When delete_notes=true, recursively deletes notes directory (test case: verify fs.rmSync called with recursive option)
- [ ] **Response structure**: Returns JSON with {project, deleted_config, deleted_notes, notes_path} (schema validation required)
- [ ] **Error handling**: Returns isError=true for non-existent projects with available_projects list
- [ ] **Test coverage**: 100% coverage requirement for delete_project (destructive operations demand complete test coverage). Minimum 8 test cases: exists check, config-only deletion, full deletion, non-existent project error, path traversal rejection, symlink handling, concurrent safety, rollback on failure
- [ ] **Atomic operations**: Config updates commit before file deletion (rollback on file deletion failure)

**Dependencies**: None

**Security Considerations**:

- Path traversal prevention: Validate notes_path is absolute and within expected directories
- No deletion of code_path directory (data loss prevention)
- Require explicit delete_notes=true flag (default: false, safety by default)

### Milestone 2: Brain CLI delete Subcommand

**Status**: [PENDING]
**Goal**: Provide user-friendly CLI interface for project deletion
**Estimated Effort**: 2 hours based on create subcommand pattern

**Deliverables**:

- [ ] Add `projectsDeleteCmd` to `/Users/peter.kloss/Dev/brain/apps/tui/cmd/projects.go`
- [ ] CLI flags: `--project` (required), `--delete-notes` (optional boolean)
- [ ] Update `/Users/peter.kloss/Dev/brain/apps/tui/cmd/projects.go` init() to register delete subcommand
- [ ] Unit tests at `/Users/peter.kloss/Dev/brain/apps/tui/cmd/tests/projects_delete_test.go`

**Acceptance Criteria** (quantified):

- [ ] **Interactive confirmation**: CLI prompts "Delete project 'X'? Notes will [not] be deleted. (y/N)" before proceeding
- [ ] **Double confirmation for --delete-notes**: When --delete-notes flag used, require TWO confirmations:
  - First: "Delete project 'X'? Notes WILL BE DELETED. (y/N)"
  - Second: "[WARNING] This will permanently delete notes at [path]. Continue? (y/N)"
  - Prevents accidental data loss from muscle memory or automation errors
- [ ] **Safety defaults**: Confirmation defaults to No, --delete-notes defaults to false
- [ ] **Output formatting**: Displays deleted project name, config status, notes status (if applicable)
- [ ] **Error handling**: Non-existent project shows available projects list (matching create_project pattern)
- [ ] **Test coverage**: 4 test scenarios (successful deletion, user cancellation, non-existent project, notes deletion variant)
- [ ] **Flag validation**: Returns usage error if --project not provided

**Dependencies**: Milestone 1 (delete_project tool must exist)

**User Experience**:

```bash
$ brain projects delete --project myproject
Delete project 'myproject'? Notes will NOT be deleted. (y/N): y
[PASS] Deleted project: myproject
       Config removed: brain-config.json, basic-memory config.json
       Notes preserved: /Users/user/memories/myproject

$ brain projects delete --project myproject --delete-notes
Delete project 'myproject'? Notes WILL BE DELETED. (y/N): y
[WARNING] This will permanently delete notes at /Users/user/memories/myproject
Continue? (y/N): y
[PASS] Deleted project: myproject
       Config removed: brain-config.json, basic-memory config.json
       Notes deleted: /Users/user/memories/myproject (42 files removed)
```

### Milestone 3: edit_project Note Migration

**Status**: [PENDING]
**Goal**: Auto-migrate notes when notes_path changes during project edit
**Estimated Effort**: 4 hours (file operations complexity + rollback logic)

**Deliverables**:

- [ ] Enhance `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/edit/index.ts`
- [ ] Add migration logic with rollback on failure
- [ ] Update `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/edit/__tests__/edit.test.ts`

**Acceptance Criteria** (quantified):

- [ ] **Migration trigger**: When notes_path parameter changes AND old notes directory exists
- [ ] **File operations**: Use fs.cpSync (recursive copy) followed by fs.rmSync (recursive delete) on source
- [ ] **Safety verification**: Verify destination directory integrity using TWO checks before deleting source:
  - File count match: `countFiles(oldPath) === countFiles(newPath)`
  - Total size match: `getTotalSize(oldPath) === getTotalSize(newPath)`
  - Rationale: File count detects missing files, size check detects truncated/corrupted files
  - Trade-off: No cryptographic hashing due to performance cost for large directories (1000+ files)
- [ ] **Rollback capability**: On copy failure, delete partial destination and restore original config
- [ ] **Response reporting**: JSON includes {migrated: true, files_moved: N, old_path: string, new_path: string}
- [ ] **Error handling**: Copy failure returns isError=true with rollback confirmation
- [ ] **Test coverage**: 5 scenarios (successful migration, rollback on copy failure, no migration when paths identical, empty directory migration, migration with nested directories)
- [ ] **Performance**: Log warning if migration exceeds 1000 files (suggest manual migration)

**Dependencies**: None (enhancement to existing tool)

**Migration Algorithm**:

1. Detect notes_path change (oldPath !== newPath)
2. Verify old path exists and contains files
3. Create new path directory (recursive)
4. Copy all files from old to new (fs.cpSync with recursive: true)
5. Verify integrity using TWO checks (safety verification):
   - Check 1: File count match (`countFiles(oldPath) === countFiles(newPath)`)
   - Check 2: Total size match (`getTotalSize(oldPath) === getTotalSize(newPath)`)
   - Fail migration if either check fails
6. Delete old directory (fs.rmSync with recursive: true)
7. Update config atomically
8. On any failure: delete new directory, restore old config, return error

### Milestone 4: create_project Duplicate Prevention

**Status**: [PENDING]
**Goal**: Prevent duplicate project creation with clear error messaging
**Estimated Effort**: 1 hour (already partially implemented, needs enhancement)

**Deliverables**:

- [ ] Enhance error message in `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/create/index.ts`
- [ ] Update `/Users/peter.kloss/Dev/brain/apps/mcp/src/tools/projects/create/__tests__/create.test.ts`

**Acceptance Criteria** (quantified):

- [ ] **Detection**: Check both brain-config.json code_paths AND basic-memory config.json projects
- [ ] **Error response**: Returns {error: "Project 'X' already exists", suggestion: "Use edit_project to update configuration", existing_notes_path: string, existing_code_path: string}
- [ ] **Test coverage**: 2 test cases (duplicate in basic-memory config, duplicate in brain-config)
- [ ] **Consistency**: Error format matches edit_project error pattern

**Dependencies**: None

**Current Implementation Status**: Duplicate check exists at line 135-154 in create/index.ts, needs enhanced error message only.

### Milestone 5: Pre-PR Validation

**Status**: [PENDING]
**Goal**: Comprehensive validation before PR creation
**Estimated Effort**: 2 hours

**Deliverables**:

- [ ] All unit tests pass with coverage >80%
- [ ] Integration test: create → edit (with migration) → delete workflow
- [ ] Documentation: recovery procedures in README or TROUBLESHOOTING.md
- [ ] Validation script execution

**Acceptance Criteria** (quantified):

- [ ] **Cross-cutting concerns**: No hardcoded paths, all environment variables defined
- [ ] **Fail-safe design**: Default delete_notes=false, confirmation prompts required
- [ ] **Test coverage**: Overall coverage ≥80% for new tools, 100% for destructive operations
- [ ] **CI simulation**: Tests pass with GITHUB_ACTIONS=true
- [ ] **Documentation**: Recovery section includes "Restore from Git" and "Manual config repair" procedures

**Dependencies**: Milestones 1-4

**Validation Tasks**:

1. No hardcoded values audit
2. Fail-safe defaults verification (delete_notes=false, confirmation=required)
3. Test parameter alignment check
4. Edge case coverage (empty directories, symlinks, permission errors)

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Path traversal attacks** | Medium | Critical | **M0 BLOCKING gate**: Security threat assessment BEFORE implementation. Validate absolute paths, reject relative paths, resolve symlinks |
| **Accidental data loss during deletion** | Medium | Critical | Double confirmation for --delete-notes, clear warnings, exit code validation tests |
| Accidental data loss during migration | Medium | High | Two-stage copy-verify-delete with dual integrity checks (file count + size), rollback on failure |
| Concurrent deletion conflicts | Low | Medium | Config update before file deletion, atomic operations where possible |
| Permission errors during file operations | Medium | Medium | Wrap all fs operations in try-catch, return clear error messages, document recovery in Scenario 5 |
| Orphaned config entries | Low | Low | Delete from both configs in single transaction, test coverage |
| Large note directories timeout | Low | Medium | Add file count check, log warning >1000 files, recommend manual migration |
| Cross-platform path handling | Medium | Medium | Use path.join/resolve consistently, test on Windows/Linux/macOS |

## Dependencies

**External**:

- Node.js fs module (existing)
- basic-memory MCP server (existing)
- Go client.CallTool (existing)

**Internal**:

- Milestone 0 is BLOCKING (no other work begins until M0 complete with APPROVED verdict)
- Milestone 1 depends on Milestone 0
- Milestone 2 depends on Milestone 1
- Milestone 3 depends on Milestone 0
- Milestone 4 depends on Milestone 0
- Milestone 5 depends on Milestones 1-4

**Parallelization Opportunities**:

- Milestone 0 MUST complete first (BLOCKING security gate)
- After M0 approval: Milestones 1, 3, and 4 can be developed in parallel (different files)
- Milestone 2 MUST wait for Milestone 1 (depends on MCP tool)
- Milestone 5 MUST be sequential after all others (integration testing)

## Technical Approach

### Architecture Patterns

**Two-Stage Deletion**:

```typescript
// Stage 1: Config cleanup (reversible)
removeFromBrainConfig(project);
removeFromBasicMemoryConfig(project);

// Stage 2: File deletion (irreversible, only if delete_notes=true)
if (delete_notes && notesPath) {
  fs.rmSync(notesPath, { recursive: true, force: true });
}
```

**Migration Safety**:

```typescript
// Copy-Verify-Delete pattern
const oldPath = getCurrentNotesPath(project);
const newPath = resolveNotesPathOption(notes_path, project, code_path);

if (oldPath !== newPath && fs.existsSync(oldPath)) {
  try {
    // 1. Copy to new location
    fs.cpSync(oldPath, newPath, { recursive: true });

    // 2. Verify integrity (dual-check approach)
    const oldCount = countFiles(oldPath);
    const newCount = countFiles(newPath);
    const oldSize = getTotalSize(oldPath);
    const newSize = getTotalSize(newPath);

    if (oldCount !== newCount) {
      throw new Error(`Migration verification failed: ${oldCount} files vs ${newCount} files`);
    }

    if (oldSize !== newSize) {
      throw new Error(`Migration verification failed: ${oldSize} bytes vs ${newSize} bytes`);
    }

    // 3. Delete old location
    fs.rmSync(oldPath, { recursive: true, force: true });

    return { migrated: true, files_moved: oldCount };
  } catch (error) {
    // Rollback: delete partial copy
    if (fs.existsSync(newPath)) {
      fs.rmSync(newPath, { recursive: true, force: true });
    }
    throw error;
  }
}
```

### Testing Strategy

**Destructive Operation Test Requirements**:

1. Mock filesystem operations (fs.rmSync, fs.cpSync)
2. Test rollback scenarios (copy failure, verification failure)
3. Test concurrent operations (config lock simulation)
4. Test edge cases (empty directories, single file, nested directories)
5. Test error paths (permission denied, disk full simulation)

**Integration Test Workflow**:

```bash
# Full lifecycle test
brain projects create --name test-lifecycle --code-path ~/test
brain projects test-lifecycle --notes-path ~/new-location  # Triggers migration
brain projects delete --project test-lifecycle --delete-notes
```

### Recovery Procedures

**User-Actionable Recovery Steps**:

#### Scenario 1: Accidental Config-Only Deletion (notes preserved)

**Symptoms**: Project not listed in `brain projects list` but notes directory still exists

**Recovery Steps**:

1. Locate your notes directory (typically `~/.basic-memory/[project-name]/` or custom path)
2. Recreate project with original paths:

   ```bash
   brain projects create \
     --name [project-name] \
     --code-path [original-code-path] \
     --notes-path [path-to-existing-notes]
   ```

3. Verify restoration: `brain projects list`
4. Test note access: `brain list [project-name]`

**Expected Outcome**: Project restored with all existing notes intact

#### Scenario 2: Full Deletion with Notes Lost (--delete-notes used)

**Symptoms**: Project not in list AND notes directory deleted

**Recovery Steps**:

1. **From Git backup** (if notes were committed):

   ```bash
   cd [notes-directory-parent]
   git checkout HEAD~1 -- [project-name]/
   ```

2. **From filesystem backup** (Time Machine, etc.):
   - Restore `~/.basic-memory/[project-name]/` from backup
3. **From manual backup**:
   - Restore notes from your backup location
4. Recreate project (see Scenario 1 steps 2-4)

**Expected Outcome**: Notes restored from backup, project re-registered

**Prevention**: Always maintain external backups. Consider `.gitignore` exemption for critical notes.

#### Scenario 3: Failed Migration (partial copy)

**Symptoms**: Error during `brain projects edit`, old notes missing, new location incomplete

**Recovery Steps**:

1. Check if old notes preserved (migration rollback):

   ```bash
   ls [old-notes-path]
   ```

2. If old path still exists:
   - Migration rolled back automatically
   - No action needed, old notes intact
3. If old path deleted but new path corrupted:
   - Follow Scenario 2 recovery (restore from backup)
   - File bug report with error message

**Expected Outcome**: Rollback mechanism preserved old notes; if not, restore from backup

#### Scenario 4: Config Corruption (JSON malformed)

**Symptoms**: `brain` commands fail with JSON parse errors

**Recovery Steps**:

**Option A - Git Restore** (if configs in version control):

```bash
cd ~/.basic-memory
git status
git diff config.json brain-config.json
git checkout HEAD -- config.json brain-config.json
```

**Option B - Manual Repair**:

1. Open config files in text editor:

   ```bash
   code ~/.basic-memory/config.json
   code ~/.basic-memory/brain-config.json
   ```

2. Validate JSON syntax: Use [jsonlint.com](https://jsonlint.com) or:

   ```bash
   cat ~/.basic-memory/config.json | python -m json.tool
   ```

3. Fix common issues:
   - Missing commas between entries
   - Trailing commas before closing braces
   - Unescaped backslashes in Windows paths (use `\\` or `/`)
4. Verify structure matches template:

   ```json
   {
     "projects": {
       "project-name": "/path/to/notes"
     }
   }
   ```

**Option C - Nuclear Reset** (last resort):

```bash
# Backup existing configs
cp ~/.basic-memory/config.json ~/.basic-memory/config.json.backup
cp ~/.basic-memory/brain-config.json ~/.basic-memory/brain-config.json.backup

# Reinitialize
rm ~/.basic-memory/config.json ~/.basic-memory/brain-config.json
brain projects create --name recovery --code-path ~/temp

# Manually re-add other projects using create command
```

**Expected Outcome**: Config files repaired, all commands functional

#### Scenario 5: Permission Errors During Deletion

**Symptoms**: Deletion fails with "EACCES" or "EPERM" errors

**Recovery Steps**:

1. Check file ownership:

   ```bash
   ls -la [notes-path]
   ```

2. Fix permissions if owned by current user:

   ```bash
   chmod -R u+w [notes-path]
   brain projects delete --project [name] --delete-notes
   ```

3. If owned by different user (e.g., sudo-created):

   ```bash
   sudo chown -R $(whoami) [notes-path]
   brain projects delete --project [name] --delete-notes
   ```

4. If unable to fix permissions:
   - Delete config only: `brain projects delete --project [name]` (without --delete-notes)
   - Manually remove notes: `rm -rf [notes-path]` (or with sudo)

**Expected Outcome**: Permissions corrected, deletion completes

### Recovery Documentation Location

All user-facing recovery procedures will be documented in:

- **Primary**: `README.md` (Projects section → Troubleshooting subsection)
- **Secondary**: `docs/TROUBLESHOOTING.md` (detailed reference)

**Documentation Deliverables** (Milestone 5):

- [ ] Add "Troubleshooting" section to README.md
- [ ] Create docs/TROUBLESHOOTING.md with all 5 scenarios
- [ ] Include recovery commands in CLI help text (`brain projects delete --help`)

## Success Criteria

Plan completion verified when:

- [ ] All 5 milestones completed and acceptance criteria met
- [ ] Unit test coverage ≥80% for new tools
- [ ] Integration test passes: create → edit (migration) → delete
- [ ] Recovery documentation published
- [ ] Pre-PR validation passes (Milestone 5)
- [ ] Critic review APPROVED

## Work Breakdown

### Parallelization Matrix

| Milestone | Can Start After | Can Parallelize With | Estimated Duration |
|-----------|-----------------|---------------------|-------------------|
| M0: Security review | Immediately | None (BLOCKING gate) | 2 hours |
| M1: delete_project MCP | M0 complete | M3, M4 | 3-4 hours |
| M2: CLI delete | M1 complete | None (depends on M1) | 2 hours |
| M3: Note migration | M0 complete | M1, M4 | 4 hours |
| M4: Duplicate prevention | M0 complete | M1, M3 | 1 hour |
| M5: Pre-PR validation | M1-M4 complete | None (integration) | 2 hours |

**Critical Path**: M0 → M1 → M2 → M5 (11 hours minimum)
**Parallel Track 1**: M0 → M3 (6 hours)
**Parallel Track 2**: M0 → M4 (3 hours)

**Optimal Implementation Order**:

1. **Wave 1 (Sequential BLOCKING)**: Complete M0 (security review) FIRST
2. **Wave 2 (Parallel)**: After M0 approved, start M1, M3, M4 simultaneously
3. **Wave 3 (Sequential)**: Start M2 after M1 completes
4. **Wave 4 (Sequential)**: Start M5 after all previous complete

**Total Estimated Time**: 13-15 hours (with parallelization after M0 gate)

### Task Assignments

| Milestone | Recommended Agent | Reasoning |
|-----------|------------------|-----------|
| M0 | security | Threat modeling expertise, file deletion risk assessment |
| M1 | implementer | TypeScript code, follows create_project pattern |
| M2 | implementer | Go code, follows create subcommand pattern |
| M3 | implementer | Complex file operations, rollback logic |
| M4 | implementer | Minor enhancement to existing code |
| M5 | qa | Validation and integration testing |

**Agent Handoff Sequence**:

1. Planner → Orchestrator (plan ready for security review)
2. Orchestrator → Security (M0: threat assessment)
3. Security → Orchestrator (threat model complete)
4. Orchestrator → Critic (validate mitigations)
5. Critic → Orchestrator (APPROVED or needs revision)
6. Orchestrator → Implementer (M1-M4 authorized to begin)
7. Implementer → Orchestrator (implementation complete)
8. Orchestrator → QA (M5: pre-PR validation)
9. QA → Orchestrator (validation complete)

### Pre-PR Validation Work Package

**Assignee**: QA Agent
**Blocking**: PR creation
**Estimated Effort**: 2 hours

#### Tasks

##### Task 1: Cross-Cutting Concerns Audit

- [ ] Verify no hardcoded paths (all use path.join/resolve)
- [ ] Verify all error messages include context
- [ ] Verify no TODO/FIXME/XXX placeholders
- [ ] Verify test-only code isolated from production

##### Task 2: Fail-Safe Design Verification

**Confirmation Prompt Testing**:

- [ ] Test 1: Run `brain projects delete --project testproj` → verify single confirmation prompt appears → verify "N" is default
- [ ] Test 2: Run `brain projects delete --project testproj --delete-notes` → verify FIRST confirmation prompt → verify message includes "Notes WILL BE DELETED"
- [ ] Test 3: After first "y" response → verify SECOND confirmation prompt with "[WARNING]" prefix → verify path shown
- [ ] Test 4: Respond "n" to first prompt → verify operation cancelled, no deletion occurs
- [ ] Test 5: Respond "y" to first, "n" to second → verify operation cancelled, config preserved

**Exit Code Verification**:

- [ ] Test 6: Successful deletion → verify exit code 0
- [ ] Test 7: User cancels operation → verify exit code 1 (or non-zero)
- [ ] Test 8: Non-existent project → verify exit code 1 with error message

**Fail-Safe Pattern Verification**:

- [ ] Verify delete_notes defaults to false in MCP tool schema
- [ ] Verify CLI --delete-notes flag defaults to false
- [ ] Verify config deletion happens BEFORE file deletion (two-stage)
- [ ] Verify rollback on migration failure (partial copy cleanup)

##### Task 3: Test-Implementation Alignment

- [ ] Verify test parameters match implementation
- [ ] Verify mock fs operations cover all destructive calls
- [ ] Verify edge cases covered (empty dir, permission errors, etc.)
- [ ] Verify code coverage meets 80% threshold

##### Task 4: CI Environment Simulation

- [ ] Run tests with NODE_ENV=test
- [ ] Verify all tests pass
- [ ] Verify no test pollution (cleanup after each test)
- [ ] Document any platform-specific behavior

##### Task 5: Recovery Documentation Completeness

- [ ] Verify recovery procedures documented
- [ ] Verify config file locations documented
- [ ] Verify backup recommendations included
- [ ] Verify manual repair steps clear

#### Acceptance Criteria

- All 5 validation tasks complete
- QA agent provides validation evidence
- Orchestrator receives APPROVED verdict
- No blocking issues identified

#### Dependencies

- Blocks: PR creation
- Depends on: Implementation completion (Milestones 1-4)

## Impact Analysis Summary

**Consultation Status**: [PENDING]
**Blocking Issues**: Security review MUST complete before implementation (M0 gate)

**Consultations Required**:

- [x] Planner - Plan created with M0 security gate (this document)
- [ ] **Security - MANDATORY pre-implementation threat assessment (M0 BLOCKING gate)**
- [ ] Critic - Validate security mitigations and plan completeness
- [ ] Implementer - Code impact (TypeScript + Go) - CANNOT START until M0 APPROVED
- [ ] QA - Test strategy for destructive operations (M5)
- [ ] Architect - Pattern alignment with existing tools (optional, low complexity)

**Cross-Domain Risks**: None identified (no architecture changes, isolated feature addition)

**Overall Complexity Assessment**:

- **Code**: Medium (file operations with rollback logic)
- **Security**: High (file deletion = data loss risk, path traversal vectors, requires M0 BLOCKING gate)
- **Operations**: Low (no CI/CD changes)
- **Quality**: High (destructive operations require 100% test coverage)
- **Overall**: High (Security + Quality concerns elevate from Medium to High)

## Metrics

**Planning Checkpoints**:

- Analysis Started: 2026-01-19 (Session 03)
- Consultations Complete: [PENDING]
- Plan Finalized: [PENDING]

**Scope Metrics**:

- Milestones: 6 (M0-M5, including M0 BLOCKING security gate)
- New Tools: 1 (delete_project)
- Enhanced Tools: 2 (edit_project, create_project)
- New CLI Subcommands: 1 (delete)
- Test Files: 4 (delete.test.ts, edit.test.ts updates, create.test.ts updates, projects_delete_test.go)
- Documentation Files: 3 (TM-001-project-deletion.md, README.md updates, docs/TROUBLESHOOTING.md)
- Security Artifacts: 1 (threat model M0)

## Notes

**Session Context**: This plan created during Session 03 following Session 05's successful project tools refactor. Project management tools now have consistent patterns (create/edit/list/details), deletion capability is logical next step.

**Design Decisions**:

1. **Two-stage deletion**: Config before files prevents orphaned projects
2. **Copy-verify-delete migration**: Safety over performance
3. **Explicit delete_notes flag**: Safety by default (preserve notes unless explicitly requested)
4. **CLI confirmation prompts**: Prevent accidental deletions
5. **No soft delete**: Deferred to future enhancement, adds complexity without clear use case

**Deferred Enhancements**:

- Soft delete with trash/recycle bin
- Bulk operations (delete multiple projects)
- Interactive deletion wizard
- Automatic backup creation before deletion
- Project archive/export capability

---

## Plan Revision Summary

**Revision Date**: 2026-01-19
**Reason**: Critic validation identified 4 blocking issues requiring plan updates

### Changes Made

**1. Added Milestone 0: Security Threat Assessment (BLOCKING)**

- New M0 milestone with 2-hour estimate
- Requires security agent threat modeling BEFORE implementation
- Blocks M1-M4 until APPROVED verdict received
- Documents 5 threat categories: path traversal, symlink attacks, race conditions, data loss, permission escalation
- Updated parallelization matrix and dependencies to reflect BLOCKING gate

**2. Expanded Pre-PR Validation (M5) with Fail-Safe Test Steps**

- Added 8 specific confirmation prompt tests (Test 1-5)
- Added 3 exit code verification tests (Test 6-8)
- Documented expected behavior for each test scenario
- Clarified double confirmation requirement for --delete-notes flag

**3. Enhanced Migration Verification with Size Checks**

- Updated M3 acceptance criteria with dual integrity check (file count + total size)
- Added rationale for rejecting cryptographic hashing (performance vs. sufficient integrity)
- Updated migration algorithm (Step 5) with two-check verification
- Updated code example in Technical Approach section

**4. Added Comprehensive Rollback Documentation**

- Created 5 user-facing recovery scenarios with actionable steps
- Scenario 1: Config-only deletion (notes preserved)
- Scenario 2: Full deletion with notes lost (backup restoration)
- Scenario 3: Failed migration (rollback verification)
- Scenario 4: Config corruption (Git restore, manual repair, nuclear reset)
- Scenario 5: Permission errors (ownership fixes)
- Documented deliverables in M5 (README.md, docs/TROUBLESHOOTING.md, CLI help)

**5. Answered 5 Critic Clarification Questions**

- Security review timing: BEFORE implementation (M0 BLOCKING)
- Coverage target: 100% for delete_project (destructive operations)
- Test location: Co-located in `__tests__/delete.test.ts`
- Double confirmation: YES for --delete-notes (two prompts)
- Verification strategy: File count + size check (not hashing)

### Impact on Plan

| Metric | Original | Revised | Change |
|--------|----------|---------|--------|
| **Milestones** | 5 (M1-M5) | 6 (M0-M5) | +1 (security gate) |
| **Estimated Time** | 12-14 hours | 13-15 hours | +1 hour (M0) |
| **Critical Path** | M1→M2→M5 (9h) | M0→M1→M2→M5 (11h) | +2 hours |
| **Test Cases (M1)** | 6 minimum | 8 minimum | +2 (security tests) |
| **Coverage Target** | 80% | 100% for delete_project | Higher bar |
| **Overall Complexity** | Medium | High | Security + quality elevation |
| **Documentation Files** | 1 | 3 | +2 (threat model, troubleshooting) |
| **Blocking Gates** | 0 | 1 (M0) | Security mandatory |

### Next Steps

1. Route revised plan to **critic** for re-validation
2. If APPROVED, route to **security agent** for M0 threat assessment
3. Security completes threat model (`.agents/security/TM-001-project-deletion.md`)
4. Critic validates mitigations
5. Orchestrator authorizes M1-M4 implementation only after M0 APPROVED
