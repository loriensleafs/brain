---
title: SEC-001 ADR-007 Worktree Security Review
type: note
permalink: security/sec-001-adr-007-worktree-security-review-1
tags:
- security
- review
- worktree
- adr-007
- path-validation
- threat-model
---

# SEC-001 ADR-007 Worktree Security Review

## Observations

- [fact] Review scope: ADR-007 Worktree-Aware Project Resolution security assessment #security #review
- [decision] VOTE: Accept with conditions (D&C) -- no blocking issues, two P1 items need implementation-time mitigations #verdict
- [insight] The design's graceful-degradation-on-failure approach is inherently conservative and security-positive #architecture
- [risk] P1: Malicious .git file content could contain path traversal payloads that survive dirname() extraction #path-traversal
- [risk] P1: TOCTOU gap between worktree detection and memories path write could be exploited on multi-user systems #race-condition
- [fact] P2: Command injection via CWD is mitigated because git -C accepts a directory path, not a shell-interpolated string #command-injection
- [fact] P2: 3-second timeout provides adequate DoS protection for local git operations #dos
- [insight] Existing path-validator.ts already blocks system paths and traversal in validatePath(), but worktree-resolved effectiveCwd bypasses this because it enters resolveMemoriesPath as a trusted internal value, not user input #gap
- [fact] The design correctly uses git plumbing commands (rev-parse) rather than porcelain, reducing attack surface from output format changes #detection

## Relations

- relates_to [[ADR-007 Worktree-Aware Project Resolution]]
- relates_to [[DESIGN-001 Git Worktree Project Resolution]]
- relates_to [[ANALYSIS-019 Project Resolution Codebase Research]]
- relates_to [[ANALYSIS-020 Git Worktree Internals Research]]

---

## Threat Model

### Attack Surface

The proposed change introduces ONE new external input into the resolution chain: the output of `git rev-parse --git-common-dir` when CWD direct matching fails. This output is used to:

1. Match against configured project code_paths (identity lookup)
2. Derive `effectiveCwd` for CODE mode memories_path computation

The attacker model: a local user or process that can craft filesystem state (`.git` files, symlinks, worktree metadata) in directories that Brain might operate from.

### P0 Issues (Blocking)

**None identified.** The design does not introduce any P0 security issues.

### P1 Issues (Must Mitigate at Implementation Time)

#### P1-1: Malicious .git File Path Traversal

**Threat**: In a secondary worktree, `.git` is a plain file containing `gitdir: <path>`. An attacker who controls a directory structure could craft a `.git` file with a malicious `gitdir` pointer (e.g., `gitdir: /etc/shadow`). When `git rev-parse --git-common-dir` runs from this directory, git itself resolves the gitdir path. However, if git is compromised or a future git bug causes unexpected output, the `dirname()` operation on the common-dir result could produce an attacker-controlled path.

**Actual Risk**: LOW-MEDIUM. Git's own path resolution is well-tested. The attacker needs local filesystem write access in a directory the user runs Brain from. The `dirname()` on `git-common-dir` output still must match a configured `code_path` exactly, so the project identity lookup is constrained. However, in CODE mode, the `effectiveCwd` (original CWD, not the git output) becomes the base for `docs/` path derivation.

**Mitigation**: Validate the `effectiveCwd` path through the existing `validatePath()` function from `path-validator.ts` before passing it to `resolveMemoriesPath()`. This catches system paths, traversal sequences, and null bytes. The design already states "Symlinked worktree path: path.normalize + fs.realpathSync resolve symlinks before matching" -- ensure this also applies to the effectiveCwd value, not just the main worktree path.

**Implementation requirement**: Add `validatePath(effectiveCwd)` call before using effectiveCwd in memories path derivation. All three implementations (TypeScript, Go, Bun) must include this check.

#### P1-2: TOCTOU Gap in Worktree Detection to Path Use

**Threat**: Between the time `detectWorktreeMainPath(cwd)` runs and when `effectiveCwd` is used for memories_path derivation, the filesystem state could change. A malicious process could:

1. Present a valid worktree structure when detection runs
2. Replace the worktree root or its `docs/` directory with a symlink to a sensitive path before Brain writes memories there

**Actual Risk**: LOW. Requires concurrent local process manipulation, attacker knowledge of Brain's timing, and only affects CODE mode. The window is milliseconds.

**Mitigation**: Use `fs.realpathSync()` on the final resolved memories_path immediately before directory creation or write operations (not just during resolution). This is a defense-in-depth measure, not critical path.

**Implementation requirement**: Ensure the write-time path is re-validated, not just the resolution-time path.

### P2 Issues (Accept as Low Risk)

#### P2-1: Command Injection via CWD

**Threat**: Could a crafted CWD path inject commands into the `git -C {cwd} rev-parse ...` invocation?

**Analysis**: SAFE. The design uses:

- TypeScript: `execSync` with the CWD as an argument to `git -C`, not interpolated into a shell string
- Go: `exec.Command("git", "-C", cwd, ...)` which passes arguments as an array, not shell-interpolated
- Bun: `Bun.spawn(["git", "-C", cwd, ...])` which also uses array arguments

All three implementations use argument-array invocation, not shell string interpolation. Git's `-C` flag accepts a literal directory path. No injection vector exists here.

#### P2-2: Symlink-Based Identity Confusion

**Threat**: Could a symlinked `.git` file trick detection into resolving to an unintended project?

**Analysis**: ACCEPTABLE. The design states symlinks are resolved via `path.normalize + fs.realpathSync`. The resolved main worktree path must then exactly match a configured `code_path`. Even if a symlink tricks git into returning an unexpected common-dir, it must match a project in the user's own config file. The blast radius is limited to switching between the user's own configured projects.

#### P2-3: DoS via Slow Git Operations

**Threat**: Network-mounted repos or broken git installations could cause `git rev-parse` to hang.

**Analysis**: MITIGATED. 3-second timeout is sufficient. `git rev-parse` is a local plumbing command that never contacts remotes. It only hangs if the filesystem itself is unresponsive (NFS, broken mount). 3 seconds is generous for local operations and appropriate for network filesystem edge cases. Graceful degradation to "no match" is correct behavior.

#### P2-4: Bare Repository Handling

**Threat**: Could operating from inside a bare repository produce unexpected behavior?

**Analysis**: HANDLED. The design explicitly checks `--is-bare-repository` and returns null if true. This is correct.

### Security Properties Preserved

1. **Project identity is config-bounded**: The main worktree path MUST match a configured `code_path`. Attackers cannot create arbitrary project identities.

2. **Existing validation pipeline is intact**: `validatePath()` in `path-validator.ts` already blocks system paths, traversal, and null bytes. The recommendation is to route worktree-resolved paths through this same validation.

3. **Failure mode is conservative**: Any git failure, timeout, or unexpected output causes `detectWorktreeMainPath` to return null, which means "no worktree detected" and existing behavior continues unchanged.

4. **No new user-facing input**: The CWD is already trusted at the same level it is today. The only new external data source is git's own output, which is already trusted for repository identity.

### Existing Security Infrastructure Adequacy

The codebase has strong path validation (`apps/mcp/src/config/path-validator.ts` and `apps/mcp/src/utils/security/pathValidation.ts`):

- `containsTraversal()`: Blocks `..` sequences including encoded variants
- `containsNullBytes()`: Blocks null byte injection (CWE-158)
- `isBlockedSystemPath()`: Blocks `/etc`, `/usr`, `/var`, etc.
- `validateDeletePath()`: Resolves symlinks via `realpathSync` before checking

These controls are sufficient IF the worktree-resolved `effectiveCwd` is routed through `validatePath()` before use. The current design doc does not explicitly mandate this validation step, which is the gap identified in P1-1.

### Recommendations Summary

| ID | Priority | Issue | Mitigation | Implementation Cost |
|----|----------|-------|------------|---------------------|
| P1-1 | P1 | effectiveCwd bypasses path validation | Route through validatePath() | Low (one function call per implementation) |
| P1-2 | P1 | TOCTOU between detection and write | realpathSync at write time | Low (defense-in-depth) |
| P2-1 | P2 | Command injection via CWD | Already mitigated by array arguments | None needed |
| P2-2 | P2 | Symlink identity confusion | Already mitigated by config matching | None needed |
| P2-3 | P2 | DoS via slow git | Already mitigated by 3-second timeout | None needed |
| P2-4 | P2 | Bare repository edge case | Already handled in design | None needed |

## Verdict

**VOTE: Accept with conditions (Disagree and Commit)**

The ADR is architecturally sound with a conservative failure model. No P0 blocking issues. Two P1 items require explicit mitigation at implementation time:

1. Route `effectiveCwd` through existing `validatePath()` before use in memories_path derivation
2. Re-validate resolved memories_path at write time (not just resolution time) to close the TOCTOU gap

These are implementation details, not architectural problems. The design document should add a "Security Considerations" section documenting P1-1 and P1-2 mitigations as implementation requirements.
