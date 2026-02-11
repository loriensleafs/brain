---
title: DESIGN-001 Implementation Plan
type: design
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/design/design-001-implementation-plan
---

# DESIGN-001 Implementation Plan

## Summary

FEAT-003 implements ADR-007 (Worktree-Aware Project Resolution) to enhance the Brain project resolution chain with git worktree detection. The design adds a fallback within CWD matching (level 5) that uses `git rev-parse --git-common-dir` to map worktree paths back to the main repo path. The MCP server layer applies runtime overrides for CODE mode sessions.

## Technical Approach

### Three-Phase Delivery

Phase 1 (Foundation) builds the detection primitive across all three language runtimes. Phase 2 (Integration) wires the detection into the resolution chain and MCP server. Phase 3 (Validation) ensures cross-language parity and integration correctness.

### Phase 1: Foundation

1. Update config schema to add `disableWorktreeDetection` boolean (TASK-001)
2. Implement `detectWorktreeMainPath` in TypeScript (TASK-002)
3. Implement `detectWorktreeMainPath` in Go (TASK-003)
4. Implement `detectWorktreeMainPath` in Bun hooks (TASK-004)

### Phase 2: Integration

1. Add worktree fallback to `matchCwdToProject` in all 3 implementations (TASK-005)
2. Implement MCP server runtime override for CODE mode (TASK-006)

### Phase 3: Validation

1. Cross-language parity tests (TASK-007)
2. Integration tests with real git worktree fixtures (TASK-008)

### Resolution Chain (Enhanced)

```text
Level 1: Explicit parameter        (unchanged)
Level 2: Brain CLI active-project   (unchanged)
Level 3: BRAIN_PROJECT env          (unchanged)
Level 4: BM_PROJECT env             (unchanged)
Level 5: CWD matching               (ENHANCED)
         +-- Direct path match      (existing behavior)
         +-- Worktree fallback      (NEW - when direct match fails)
             +-- Check opt-out      (env var > config > default)
             +-- Fast pre-check     (.git exists?)
             +-- detectWorktreeMainPath()
             +-- Validate effectiveCwd (security)
             +-- Match main path against code_paths
Level 6: null                       (unchanged)
```

### MCP Server Override (CODE Mode)

When `matchCwdToProject` returns `isWorktreeResolved: true`, the MCP server checks the project's `memories_mode`. For CODE mode, the memories path is overridden to use the actual worktree CWD (`actualCwd + "/docs"`), not `effectiveCwd`, because CODE mode intends worktree-local documentation.

```text
matchCwdToProject returns isWorktreeResolved: true
     |
     +-- Check memories_mode for project
     |   +-- DEFAULT --> no override needed (shared memory location)
     |   +-- CUSTOM  --> no override needed (explicit path)
     |   +-- CODE    --> override memoriesPath
     |
     +-- CODE mode: memoriesPath = actualCwd + "/docs"
         (NOT effectiveCwd + "/docs", because we want worktree-local docs/)
```

## Interfaces and APIs

### CwdMatchResult (Internal API)

```typescript
interface CwdMatchResult {
  projectName: string;
  effectiveCwd: string;
  isWorktreeResolved: boolean;
}
```

- [decision] `CwdMatchResult` adds `effectiveCwd` and `isWorktreeResolved` fields to the existing return type. All three implementations (TypeScript, Go, Bun) must synchronize this change. #api #parity

### Data Flow

```text
CWD: /home/user/feature-branch-worktree/
     |
     +-- Direct match fails (path not in any code_path)
     |
     +-- Opt-out check passes (detection enabled)
     |
     +-- .git file exists (it's a worktree)
     |
     +-- git rev-parse --> commonDir=/home/user/main-repo/.git
     |
     +-- mainWorktreePath = dirname(commonDir) = /home/user/main-repo
     |
     +-- path-validator validates /home/user/main-repo
     |
     +-- /home/user/main-repo matches config code_path for "my-project"
     |
     +-- Returns: { projectName: "my-project",
                    effectiveCwd: "/home/user/main-repo",
                    isWorktreeResolved: true }
```

### File Changes

| File | Change | Language |
|------|--------|----------|
| `packages/validation/schemas/config/brain-config.schema.json` | Add `disableWorktreeDetection` boolean | JSON Schema |
| `packages/utils/src/project-resolver.ts` | Add `detectWorktreeMainPath`, update `matchCwdToProject` | TypeScript |
| `packages/utils/src/worktree-detector.ts` | New file: worktree detection logic | TypeScript |
| `packages/utils/internal/project_resolver.go` | Add `detectWorktreeMainPath`, update `matchCwdToProject` | Go |
| `packages/utils/internal/worktree_detector.go` | New file: worktree detection logic | Go |
| `templates/hooks/scripts/project-resolve.ts` | Add worktree fallback | Bun/TypeScript |
| MCP server (location TBD) | Add CODE mode runtime override | TypeScript |

## Trade-offs

- [decision] MCP server runtime override chosen over translation layer modification because the translation layer runs at config sync time (not request time), making per-request path overrides impossible #trade-off
- [decision] Separate `worktree-detector` module rather than inline logic keeps detection testable in isolation #trade-off #modularity
- [decision] CODE mode uses actualCwd (not effectiveCwd) for worktree-local docs, diverging from other resolution paths but matching CODE mode intent #trade-off #code-mode
- [decision] Path validation runs after detection but before use to catch malicious paths without overhead on the common case #trade-off #security

## Observations

- [design] Three-phase approach: foundation (detection), integration (resolution chain), validation (tests) #phases
- [decision] Separate worktree-detector module keeps detection testable in isolation #modularity
- [decision] CODE mode uses actualCwd (not effectiveCwd) for worktree-local docs/ #code-mode
- [insight] MCP server override is the only viable integration point since translation layer runs at config time #architecture
- [constraint] Internal API change (CwdMatchResult) must be synchronized across all 3 implementations #parity

## Relations

- implements [[FEAT-003 Worktree-Aware Project Resolution]]
- satisfies [[REQ-001 Worktree Detection via Git Common Dir]]
- satisfies [[REQ-002 MCP Runtime Memories Path Override]]
- derives_from [[ADR-007 Worktree-Aware Project Resolution]]
- informed_by [[ANALYSIS-019 Project Resolution Codebase Research]]
- informed_by [[ANALYSIS-020 Git Worktree Internals Research]]
