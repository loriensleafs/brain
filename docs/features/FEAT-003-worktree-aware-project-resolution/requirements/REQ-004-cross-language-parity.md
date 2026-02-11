---
title: REQ-004 Cross-Language Parity
type: requirement
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/requirements/req-004-cross-language-parity
---

# REQ-004 Cross-Language Parity

## Requirement Statement

The worktree detection and project resolution changes MUST be implemented identically across all three language implementations that run in production:

| Implementation | Location | Runtime |
|----------------|----------|---------|
| TypeScript | `packages/utils/src/project-resolver.ts` | MCP server |
| Go | `packages/utils/internal/project_resolver.go` | CLI tools |
| Bun hooks | `templates/hooks/scripts/project-resolve.ts` | Git hooks |

All three implementations MUST:

1. Use the same detection algorithm (REQ-001)
2. Apply the same opt-out logic (REQ-003)
3. Return equivalent result types
4. Handle the same edge cases identically
5. Use the same 3-second timeout for git subprocess
6. Perform the same fast `.git` pre-check

### Internal API Change

The `matchCwdToProject` internal return type changes from `string | null` to a structured result type across all 3 implementations:

```typescript
// TypeScript / Bun
interface CwdMatchResult {
  projectName: string;
  effectiveCwd: string;       // The CWD used for matching (may differ from actual CWD)
  isWorktreeResolved: boolean; // true if matched via worktree fallback
}

// Go equivalent struct
type CwdMatchResult struct {
  ProjectName        string
  EffectiveCwd       string
  IsWorktreeResolved bool
}
```

The public `resolveProject` API continues returning `string | null` for backward compatibility. A new `resolveProjectWithContext` function exposes full worktree context for callers that need it.

## Acceptance Criteria

- [x] [requirement] All three implementations pass identical test scenarios #acceptance
- [x] [requirement] Cross-language parity test suite covers worktree detection, opt-out, and edge cases #acceptance
- [x] [requirement] matchCwdToProject return type updated consistently across all 3 implementations #acceptance
- [x] [requirement] resolveProject public API behavior unchanged (returns string or null) #acceptance
- [x] [requirement] New resolveProjectWithContext exposed in all 3 implementations #acceptance
- [x] [requirement] Bun hooks implementation handles the known divergence in resolution hierarchy #acceptance

## Observations

- [requirement] Three implementations exist due to different runtime contexts, not redundancy #architecture
- [decision] Internal return type changes from string|null to CwdMatchResult; public API preserved #backward-compatible
- [fact] Bun hooks resolution hierarchy already diverges slightly from TypeScript and Go #risk
- [constraint] Cross-language parity tests must cover all edge cases to prevent drift #testing
- [insight] P0-4 from the debate log identified the return type change as an internal API break #provenance

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[CRIT-005 ADR-007 Debate Log]]
- depends_on [[REQ-001 Worktree Detection via git-common-dir]]
- depends_on [[REQ-003 Two-Level Opt-Out Mechanism]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]
- relates_to [[TASK-007 Cross-Language Parity Tests]]
