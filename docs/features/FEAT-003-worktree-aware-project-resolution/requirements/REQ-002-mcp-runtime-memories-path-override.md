---
title: REQ-002 MCP Runtime Memories Path Override
type: requirement
status: complete
feature-ref: FEAT-003
permalink: features/feat-003-worktree-aware-project-resolution/requirements/req-002-mcp-runtime-memories-path-override
---

# REQ-002 MCP Runtime Memories Path Override

## Requirement Statement

When a project is resolved via worktree detection and the project uses CODE memories mode, the MCP server MUST override the memories path at runtime to point to the worktree-local `docs/` directory instead of the main worktree's `docs/`. This override happens at the MCP server layer, NOT in the translation layer.

### Override Logic

```text
1. matchCwdToProject resolves project via worktree fallback
   - Returns: { projectName, effectiveCwd, isWorktreeResolved: true }
2. MCP server checks project's memories_mode
   - If CODE: memoriesPath = effectiveCwd + "/docs"
   - If DEFAULT: memoriesPath unchanged (uses configured default location)
   - If CUSTOM: memoriesPath unchanged (uses configured custom path)
3. MCP server passes overridden memoriesPath to basic-memory API calls
```

### Constraints

- Static basic-memory config MUST NOT be modified (still points to main repo docs/)
- Translation layer (`resolveMemoriesPath`) MUST NOT be modified
- Override applies only to the current session's API calls
- effectiveCwd MUST be validated through security checks (REQ-005) before use

## Acceptance Criteria

- [x] [requirement] CODE mode sessions in worktrees read/write memories to worktree-path/docs/ #acceptance
- [x] [requirement] CODE mode sessions in the main worktree continue using main-repo/docs/ #acceptance
- [x] [requirement] DEFAULT mode behavior is unchanged regardless of worktree status #acceptance
- [x] [requirement] CUSTOM mode behavior is unchanged regardless of worktree status #acceptance
- [x] [requirement] Static basic-memory config file is never modified by worktree detection #acceptance
- [x] [requirement] Multiple concurrent sessions in different worktrees operate independently #acceptance
- [x] [requirement] effectiveCwd is validated before constructing the memories path #acceptance

## Observations

- [requirement] Override happens at MCP server layer, not translation layer #architecture
- [decision] Only CODE mode needs runtime override; DEFAULT and CUSTOM use static paths #scope
- [constraint] basic-memory config maps project names to single static paths; no mechanism for per-request overrides #limitation
- [risk] Worktree-local docs/ directory may not exist; MCP server should create it on first write #edge-case
- [insight] Translation layer stays simple; complexity is contained in MCP server #simplicity
- [fact] Depends on REQ-001 for effectiveCwd and REQ-005 for security validation #dependency

## Relations

- part_of [[FEAT-003 Worktree-Aware Project Resolution]]
- implements [[ADR-007 Worktree-Aware Project Resolution]]
- depends_on [[REQ-001 Worktree Detection via git-common-dir]]
- depends_on [[REQ-005 Security Validation of effectiveCwd]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]
- relates_to [[TASK-006 MCP Server Runtime Override]]
