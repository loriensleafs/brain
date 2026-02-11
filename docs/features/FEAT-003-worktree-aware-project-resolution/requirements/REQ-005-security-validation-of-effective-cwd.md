---
title: REQ-005 Security Validation of effectiveCwd
type: requirement
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/requirements/req-005-security-validation-of-effective-cwd
---

# REQ-005 Security Validation of effectiveCwd

## Requirement Statement

The `effectiveCwd` path derived from worktree detection MUST be validated through the existing `path-validator.ts` security infrastructure before being used for memories path derivation or any filesystem operations. This prevents path traversal attacks where a maliciously crafted git worktree configuration could redirect memories to arbitrary filesystem locations.

### Validation Checks

```text
1. Path normalization: resolve to absolute path, eliminate . and .. components
2. Path traversal guard: effectiveCwd must not escape expected directory boundaries
3. Null byte injection: reject paths containing \0
4. Symlink resolution: resolve symlinks and validate the resolved path
5. Length limit: reject unreasonably long paths (platform-specific limits)
```

### TOCTOU Mitigation

A Time-of-Check-Time-of-Use gap exists between worktree detection and memories write. The following mitigations SHOULD be applied:

- Validate effectiveCwd immediately after detection (before any use)
- Use atomic file operations for memories writes where possible
- Log a warning if the resolved path changes between detection and first use

## Acceptance Criteria

- [x] [requirement] effectiveCwd is validated through path-validator.ts before any filesystem use #acceptance
- [x] [requirement] Paths containing .. traversal components are rejected after normalization #acceptance
- [x] [requirement] Paths containing null bytes are rejected #acceptance
- [x] [requirement] Symlinks in effectiveCwd are resolved and the final path is validated #acceptance
- [x] [requirement] Validation failure causes graceful fallback (worktree detection returns null) #acceptance
- [x] [requirement] Validation errors are logged at WARN level #acceptance
- [x] [requirement] The validation is applied in all 3 language implementations #acceptance

## Observations

- [requirement] Security validation must happen before effectiveCwd is used for path construction #defense-in-depth
- [risk] TOCTOU gap between detection and write is a known concern from the security review #toctou
- [technique] Reuse existing path-validator.ts rather than creating new validation logic #reuse
- [constraint] All 3 language implementations need equivalent validation #parity
- [fact] SEC-001 security review flagged path validation as a P1 requirement #provenance

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[SEC-001 ADR-007 Worktree Security Review]]
- depends_on [[REQ-001 Worktree Detection via git-common-dir]]
- relates_to [[REQ-002 MCP Runtime Memories Path Override]]
- relates_to [[TASK-008 Integration Tests With Real Worktree]]
