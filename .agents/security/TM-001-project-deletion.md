# Threat Model: Project Deletion and Note Migration

**TM-001** | **Date**: 2026-01-19 | **Status**: [COMPLETE]

## Executive Summary

This threat model assesses security risks for three features in Milestone 0 of the project deletion plan:

1. **delete_project MCP Tool** - Removes project from config, optionally deletes note files
2. **edit_project Note Migration** - Auto-migrates notes when notes_path changes
3. **create_project Duplicate Prevention** - Validates project uniqueness

**Verdict**: **CONDITIONAL APPROVAL**

Implementation may proceed with documented mitigations. All Critical and High severity findings require implementation before the features can be released.

## Assets

| Asset | Value | Description |
|-------|-------|-------------|
| User Notes | Critical | Markdown files containing knowledge, memories, decisions |
| Configuration Files | High | brain-config.json, config.json - project mappings |
| File System Integrity | High | Prevention of arbitrary file access/modification |
| User Trust | High | Confidence that tool operates within expected boundaries |

## Threat Actors

| Actor | Capability | Motivation |
|-------|------------|------------|
| Malicious Prompt Injection | Medium | Manipulate AI to pass crafted project names or paths |
| Curious User | Low | Test boundaries, accidentally discover vulnerabilities |
| Compromised MCP Client | High | Execute arbitrary tool calls with malicious parameters |

## Attack Surface Analysis

### User-Controlled Inputs

| Input | Tool | Type | Risk Level |
|-------|------|------|------------|
| `project` (name) | delete_project | String | High |
| `delete_notes` | delete_project | Boolean | Medium |
| `notes_path` | edit_project | Enum/Path | Critical |
| `code_path` | edit_project | Path | High |
| `name` | create_project | String | Low |

### Critical Operations

| Operation | Risk | Current Control |
|-----------|------|-----------------|
| `fs.rmSync(recursive: true)` | Critical - can delete entire directories | None (not yet implemented) |
| `fs.cpSync(recursive: true)` | High - can copy sensitive files | None (not yet implemented) |
| Config JSON writes | Medium - can corrupt project state | Existing: JSON.stringify |

## STRIDE Analysis

### S - Spoofing

| Threat ID | Threat | Impact | Likelihood | Mitigation |
|-----------|--------|--------|------------|------------|
| S-001 | Attacker spoofs project name to delete different project | High | Low | Validate project exists before deletion; exact name match required |

**Risk Score**: 3/10 (Low likelihood, existing controls)

### T - Tampering

| Threat ID | Threat | Impact | Likelihood | Mitigation |
|-----------|--------|--------|------------|------------|
| T-001 | Path traversal in project name allows config tampering | Critical | Medium | **REQUIRED**: Reject project names containing `/`, `\`, `..`, or null bytes |
| T-002 | notes_path manipulation overwrites unintended files | Critical | Medium | **REQUIRED**: Validate resolved path is within allowed directories |
| T-003 | Symlink in notes_path points to system directory | Critical | Medium | **REQUIRED**: Resolve symlinks before deletion; validate resolved path |

**Risk Score**: 7/10 (Critical impact, no current controls)

### R - Repudiation

| Threat ID | Threat | Impact | Likelihood | Mitigation |
|-----------|--------|--------|------------|------------|
| R-001 | No audit trail of deletion operations | Medium | High | **RECOMMENDED**: Log all deletion operations with timestamp and parameters |

**Risk Score**: 4/10 (Medium impact, easily mitigated)

### I - Information Disclosure

| Threat ID | Threat | Impact | Likelihood | Mitigation |
|-----------|--------|--------|------------|------------|
| I-001 | Error messages expose internal paths | Low | Medium | Sanitize error messages; don't expose full filesystem paths in errors |
| I-002 | List of available projects exposes project names | Low | Low | Acceptable risk - names needed for UX |

**Risk Score**: 2/10 (Low impact)

### D - Denial of Service

| Threat ID | Threat | Impact | Likelihood | Mitigation |
|-----------|--------|--------|------------|------------|
| D-001 | Concurrent deletions corrupt config file | High | Medium | **REQUIRED**: Implement config file locking during write operations |
| D-002 | Large directory migration blocks operations | Medium | Low | **RECOMMENDED**: Add file count warning for directories > 1000 files |
| D-003 | Failed migration leaves orphaned partial copy | High | Medium | **REQUIRED**: Implement copy-verify-delete with rollback |

**Risk Score**: 5/10 (High impact, medium likelihood)

### E - Elevation of Privilege

| Threat ID | Threat | Impact | Likelihood | Mitigation |
|-----------|--------|--------|------------|------------|
| E-001 | Delete notes owned by different user | Medium | Low | Node.js inherits user permissions; no escalation possible |
| E-002 | Symlink to root-owned files combined with sudo execution | High | Very Low | **REQUIRED**: Resolve symlinks; validate within user home or project |

**Risk Score**: 3/10 (Low likelihood in typical usage)

## Detailed Threat Scenarios

### Scenario 1: Path Traversal via Project Name

**Attack Vector**:

```typescript
// Malicious input
delete_project({ project: "../../../etc", delete_notes: true })
```

**Impact**: Could attempt to delete arbitrary directories if project name is used directly in path construction.

**Current Vulnerability**: PARTIAL - Existing code uses project name as config key lookup, not direct path construction. However, migration feature constructs paths from `notes_path`.

**Required Mitigation (Critical)**:

```typescript
function validateProjectName(name: string): boolean {
  // Reject path separators, traversal sequences, null bytes
  const FORBIDDEN_PATTERNS = /[\/\\]|\.\.|\x00/;
  return !FORBIDDEN_PATTERNS.test(name) && name.length > 0 && name.length <= 255;
}
```

### Scenario 2: Symlink Attack During Deletion

**Attack Vector**:

1. User creates project with notes_path pointing to symlink
2. Symlink points to `/etc` or other sensitive directory
3. User calls delete_project with delete_notes=true
4. Tool follows symlink and deletes system files

**Impact**: Critical - system file destruction

**Required Mitigation (Critical)**:

```typescript
import * as fs from "fs";
import * as path from "path";

function validateDeletePath(notesPath: string): { valid: boolean; error?: string } {
  const resolved = fs.realpathSync(notesPath);
  const homeDir = os.homedir();

  // Must be under user home directory
  if (!resolved.startsWith(homeDir)) {
    return { valid: false, error: "Notes path must be under user home directory" };
  }

  // Must not be home directory itself
  if (resolved === homeDir) {
    return { valid: false, error: "Cannot delete user home directory" };
  }

  // Blocklist critical directories
  const PROTECTED_PATHS = [
    path.join(homeDir, ".ssh"),
    path.join(homeDir, ".gnupg"),
    path.join(homeDir, ".config"),
    path.join(homeDir, ".local"),
    "/etc", "/usr", "/var", "/bin", "/sbin", "/tmp"
  ];

  for (const protected of PROTECTED_PATHS) {
    if (resolved === protected || resolved.startsWith(protected + path.sep)) {
      return { valid: false, error: `Cannot delete protected path: ${protected}` };
    }
  }

  return { valid: true };
}
```

### Scenario 3: Race Condition During Migration

**Attack Vector**:

1. User A starts migration: edit_project with new notes_path
2. User B simultaneously calls delete_project on same project
3. Migration copies files, then deletion removes config
4. Result: orphaned notes at new location, corrupted state

**Impact**: High - data inconsistency, potential data loss

**Required Mitigation (High)**:

Implement file-based locking for config operations:

```typescript
import * as fs from "fs";
import * as path from "path";

const CONFIG_LOCK_PATH = path.join(os.homedir(), ".basic-memory", ".config.lock");

async function withConfigLock<T>(operation: () => Promise<T>): Promise<T> {
  const lockFd = fs.openSync(CONFIG_LOCK_PATH, "wx");
  try {
    return await operation();
  } finally {
    fs.closeSync(lockFd);
    fs.unlinkSync(CONFIG_LOCK_PATH);
  }
}
```

### Scenario 4: Failed Migration with Data Loss

**Attack Vector**:

1. User edits project to change notes_path
2. Migration starts copying files
3. Disk full error occurs mid-copy
4. Source already partially processed
5. User left with incomplete data in both locations

**Impact**: High - partial data loss

**Required Mitigation (High)**:

Copy-Verify-Delete pattern (already in plan):

```typescript
async function migrateNotes(oldPath: string, newPath: string): Promise<MigrationResult> {
  // 1. Verify source exists and get metrics
  const sourceStats = { count: countFiles(oldPath), size: getTotalSize(oldPath) };

  // 2. Copy to new location
  try {
    fs.cpSync(oldPath, newPath, { recursive: true });
  } catch (error) {
    // Rollback: remove partial copy
    if (fs.existsSync(newPath)) {
      fs.rmSync(newPath, { recursive: true, force: true });
    }
    throw new MigrationError("Copy failed", { cause: error });
  }

  // 3. Verify integrity (file count + total size)
  const destStats = { count: countFiles(newPath), size: getTotalSize(newPath) };

  if (sourceStats.count !== destStats.count || sourceStats.size !== destStats.size) {
    // Rollback: remove failed copy
    fs.rmSync(newPath, { recursive: true, force: true });
    throw new MigrationError("Verification failed: file count or size mismatch");
  }

  // 4. Only now delete source
  fs.rmSync(oldPath, { recursive: true, force: true });

  return { success: true, filesMoved: sourceStats.count };
}
```

### Scenario 5: Accidental Data Loss

**Attack Vector**: User runs `delete --delete-notes` without understanding implications

**Impact**: High - permanent data loss

**Required Mitigation (Medium)**:

Double confirmation in CLI (already in plan):

```go
// First confirmation
fmt.Printf("Delete project '%s'? Notes WILL BE DELETED. (y/N): ", project)
if !confirm() { return }

// Second confirmation with path
fmt.Printf("[WARNING] This will permanently delete notes at %s. Continue? (y/N): ", notesPath)
if !confirm() { return }
```

## Required Security Controls

### Critical (Must Implement Before Release)

| ID | Control | Implementation Location | Test Requirement |
|----|---------|------------------------|------------------|
| C-001 | Project name validation | delete_project, edit_project | Unit test: reject `/`, `\`, `..` |
| C-002 | Symlink resolution before deletion | delete_project | Integration test: symlink to protected path |
| C-003 | Protected path blocklist | delete_project | Unit test: reject ~/.ssh, /etc |
| C-004 | Copy-verify-delete migration | edit_project | Integration test: simulate disk full |

### High (Must Implement Before Release)

| ID | Control | Implementation Location | Test Requirement |
|----|---------|------------------------|------------------|
| H-001 | Config file locking | All config operations | Unit test: concurrent writes |
| H-002 | Rollback on migration failure | edit_project | Unit test: partial copy cleanup |
| H-003 | Explicit delete_notes opt-in | delete_project schema | Schema test: default false |

### Medium (Recommended)

| ID | Control | Implementation Location | Test Requirement |
|----|---------|------------------------|------------------|
| M-001 | Audit logging for deletions | delete_project | Log verification |
| M-002 | Large directory warning | edit_project | Unit test: >1000 files warning |
| M-003 | Double confirmation in CLI | CLI delete command | Integration test |

## Security Test Matrix

| Test Case | Category | Priority | Expected Result |
|-----------|----------|----------|-----------------|
| Delete with `../` in name | Path Traversal | P0 | Rejected with error |
| Delete symlink to /etc | Symlink Attack | P0 | Rejected with error |
| Delete ~/.ssh via symlink | Protected Path | P0 | Rejected with error |
| Concurrent delete operations | Race Condition | P1 | Serialized via lock |
| Migration with disk full | Rollback | P1 | Source preserved, partial deleted |
| Delete non-existent project | Validation | P1 | Error with available projects |
| Migration file count mismatch | Verification | P1 | Rollback triggered |
| delete_notes default value | Safety Default | P2 | false |

## Verdict

### Security Assessment Result: **CONDITIONAL APPROVAL**

Implementation may proceed with the following conditions:

#### Blocking Requirements (Must Complete Before M1)

1. **Implement path validation** (C-001)
   - Reject project names containing path separators or traversal sequences
   - Location: Schema validation in `delete/schema.ts`

2. **Implement symlink resolution** (C-002, C-003)
   - Use `fs.realpathSync()` before any deletion
   - Validate resolved path against protected path blocklist
   - Location: New utility function in `projects/utils/pathValidation.ts`

3. **Document security controls in code**
   - Add JSDoc comments explaining security rationale
   - Include CWE references in comments

#### Blocking Requirements (Must Complete Before M3)

1. **Implement copy-verify-delete** (C-004, H-002)
   - File count and size verification
   - Automatic rollback on failure
   - Location: `edit/index.ts` migration logic

2. **Implement config locking** (H-001)
   - File-based lock during config writes
   - Location: `project/config.ts`

#### Non-Blocking Recommendations

- Add audit logging for deletion operations (M-001)
- Add file count warning for large directories (M-002)

### Risk Acceptance

After implementing blocking requirements:

- **Residual Risk**: Low
- **Accepted Risks**:
  - Information disclosure of project names (acceptable for UX)
  - Performance impact of verification checks (acceptable tradeoff for safety)

### Sign-off

**Security Agent Verdict**: CONDITIONAL APPROVAL

**Date**: 2026-01-19

**Conditions**: Implementation MUST NOT proceed to M1 until path validation (C-001) and symlink protection (C-002, C-003) are added to the implementation plan as explicit acceptance criteria.

## References

| ID | Reference |
|----|-----------|
| CWE-22 | Path Traversal |
| CWE-59 | Symlink Following |
| CWE-362 | Race Condition |
| CWE-400 | Uncontrolled Resource Consumption |
| CWE-754 | Improper Check for Unusual Conditions |

## Appendix: Path Validation Implementation Guide

### Recommended Utility Module

Create `/Users/peter.kloss/Dev/brain/apps/mcp/src/utils/security/pathValidation.ts`:

```typescript
/**
 * Path validation utilities for secure file operations.
 *
 * Security controls:
 * - CWE-22: Path traversal prevention
 * - CWE-59: Symlink attack prevention
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface PathValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;
}

/**
 * Protected paths that must never be deleted.
 */
const PROTECTED_PATHS = [
  ".ssh",
  ".gnupg",
  ".config",
  ".local",
  "Library", // macOS
  "AppData", // Windows
];

const SYSTEM_ROOTS = ["/etc", "/usr", "/var", "/bin", "/sbin", "/tmp", "/proc", "/sys"];

/**
 * Validate a project name for security.
 * Rejects names containing path separators or traversal sequences.
 *
 * @param name - Project name to validate
 * @returns Validation result
 */
export function validateProjectName(name: string): PathValidationResult {
  if (!name || name.length === 0) {
    return { valid: false, error: "Project name cannot be empty" };
  }

  if (name.length > 255) {
    return { valid: false, error: "Project name exceeds maximum length (255)" };
  }

  // Check for path separators and traversal
  if (/[\/\\]/.test(name)) {
    return { valid: false, error: "Project name cannot contain path separators" };
  }

  if (name.includes("..")) {
    return { valid: false, error: "Project name cannot contain path traversal sequences" };
  }

  // Check for null bytes
  if (name.includes("\0")) {
    return { valid: false, error: "Project name cannot contain null bytes" };
  }

  return { valid: true };
}

/**
 * Validate a path for safe deletion operations.
 * Resolves symlinks and checks against protected paths.
 *
 * @param targetPath - Path to validate for deletion
 * @returns Validation result with resolved path
 */
export function validateDeletePath(targetPath: string): PathValidationResult {
  const homeDir = os.homedir();

  // Check path exists
  if (!fs.existsSync(targetPath)) {
    return { valid: false, error: "Path does not exist" };
  }

  // Resolve symlinks to get real path
  let resolved: string;
  try {
    resolved = fs.realpathSync(targetPath);
  } catch (error) {
    return { valid: false, error: "Failed to resolve path" };
  }

  // Must be under user home directory
  if (!resolved.startsWith(homeDir + path.sep) && resolved !== homeDir) {
    // Allow if it's a project-specific path that was explicitly configured
    // But reject system paths
    for (const root of SYSTEM_ROOTS) {
      if (resolved.startsWith(root)) {
        return { valid: false, error: `Cannot delete system path: ${root}` };
      }
    }
  }

  // Cannot be home directory itself
  if (resolved === homeDir) {
    return { valid: false, error: "Cannot delete user home directory" };
  }

  // Check against protected paths under home
  for (const protected of PROTECTED_PATHS) {
    const protectedFull = path.join(homeDir, protected);
    if (resolved === protectedFull || resolved.startsWith(protectedFull + path.sep)) {
      return { valid: false, error: `Cannot delete protected path: ${protected}` };
    }
  }

  return { valid: true, resolvedPath: resolved };
}
```

### Integration Points

1. **delete_project handler** (M1):

   ```typescript
   import { validateProjectName, validateDeletePath } from "../../utils/security/pathValidation";

   // At start of handler
   const nameValidation = validateProjectName(args.project);
   if (!nameValidation.valid) {
     return { content: [...], isError: true };
   }

   // Before file deletion
   if (args.delete_notes && notesPath) {
     const pathValidation = validateDeletePath(notesPath);
     if (!pathValidation.valid) {
       return { content: [...], isError: true };
     }
   }
   ```

2. **edit_project migration** (M3):

   ```typescript
   // Before migration
   const oldPathValidation = validateDeletePath(oldNotesPath);
   const newPathValidation = validateDeletePath(newNotesPath);
   ```
