---
title: CRIT-004-final-validation-rewrite
type: note
permalink: critique/crit-004-final-validation-rewrite
tags:
- critique
- multi-tool
- architecture
- validation
- final-review
- approve
---

# CRIT-004: Final Validation of Rewritten ADR-002 and FEAT-001

## Documents Reviewed

- **ADR-002** (rewritten 2026-02-10): Cross-Platform Plugin Architecture (409 lines, clean rewrite)
- **FEAT-001**: Not yet rewritten (task #21 pending). Review covers ADR-002 only.
- **Cross-platform proposal** (/Users/peter.kloss/Downloads/brain-cross-platform-proposal.md)
- **ANALYSIS-008 through ANALYSIS-014**: Full research corpus
- **ANALYSIS-009**: Codebase audit (25 agents, 298 Claude-specific refs, 2 Go binaries)

---

## Verdict: APPROVE (ADR-002) / PENDING (FEAT-001)

ADR-002 is a strong, clear, implementable decision record. One filing issue must be fixed (filename). FEAT-001 review deferred until task #21 completes.

---

## Section 1: 14 Confirmed Decisions Check

Based on session decisions and the cross-platform proposal:

| # | Decision | Reflected in ADR? | Section |
|:--|:--|:--|:--|
| 1 | Scope to Claude Code + Cursor only; Gemini descoped | YES | Scope, Section 8, Alt A |
| 2 | Root-level canonical content | YES | Section 1 |
| 3 | Two orchestrator agents (CC Agent Teams + Cursor hub-and-spoke) | YES | Section 3 |
| 4 | Specialist agents portable; only frontmatter differs | YES | Section 3, 4 |
| 5 | brain.config.json with explicit per-agent per-tool values | YES | Section 5 |
| 6 | Hook normalization shim (normalize.ts) | YES | Section 6 |
| 7 | Phase 4: move hook logic to MCP tools | YES | Migration Phase 4 |
| 8 | Clean break from apps/claude-plugin/ | YES | Section 2, Migration |
| 9 | Go adapters for install-time, TS for CI only. No dual parity | YES | Section 2, Alt B |
| 10 | protocols/ at root; AGENTS.md generated | YES | Section 7 |
| 11 | Claude Code: plugin install via symlinks | YES | Section 2 |
| 12 | Cursor: file sync via copy (symlinks broken) | YES | Section 2 |
| 13 | charmbracelet/huh v2 for install TUI | YES | Section 2 |
| 14 | Codex CLI deferred | YES | Scope |

**Result**: [PASS] All 14 confirmed decisions are reflected.

---

## Section 2: Proposal Practical Style Check

| Criterion | Status |
|:--|:--|
| No over-engineering | [PASS] -- No abstract model tiers, no overlay directories, no XDG staging |
| brain.config.json is explicit and readable | [PASS] -- Direct values, null for skipped tools |
| "85% portable" framing preserved | [PASS] -- Context section and Consequences reference it |
| Feature matrix included | [PASS] -- Verified Feb 2026 table |
| Hook event mapping table | [PASS] -- Complete with blocking semantics |
| "What stays platform-specific" section | [PASS] -- Section 8 |
| Migration phases are incremental | [PASS] -- 4 phases, each independently shippable |

**Result**: [PASS] Practical, proposal-inspired style maintained throughout.

---

## Section 3: Audit Gaps Addressed

| Gap (from ANALYSIS-009/010) | Addressed? | Location |
|:--|:--|:--|
| brain-hooks binary (8 cmds, 3,673 LOC + 2,669 tests) | YES | Section 6, Migration Phase 1 |
| brain-skills binary (3 cmds, 627 LOC) | YES | Section 6, Migration Phase 1 |
| Go shared packages (utils, validation) need TS equivalents | YES | Section 6 last paragraph |
| 174KB instructions/protocols migration | YES | Section 7 |
| 298 Claude-specific refs in agent bodies | YES | Section 3, Migration Phase 1 |
| skills/CLAUDE.md (Claude-specific skill dev guide) | NOT ADDRESSED | Minor gap |
| TASK-017 numbering gap | N/A | FEAT-001 concern, not ADR |

**Result**: [PASS] All critical audit gaps addressed. One minor gap (skills/CLAUDE.md) acceptable.

---

## Section 4: Issues Found

### MUST FIX

**F1: Filename not kebab-case.** The file is named `ADR-002 Cross-Platform Plugin Architecture.md` (spaces). Per CLAUDE.md entity naming rules, it MUST be `ADR-002-cross-platform-plugin-architecture.md`. This breaks Brain memory lookups and validation scripts.

### SHOULD FIX

**F2: Status says ACCEPTED.** The ADR status is "ACCEPTED (2026-02-10)" but this review is the validation gate. Consider "PROPOSED" until the user explicitly accepts after critique review.

**F3: No effort estimate.** Previous ADR-002 versions had 75-115h / 29-52h estimates. The Consequences section says "closer to 60-90h" but no per-phase breakdown. FEAT-001 may cover this, but the ADR itself should at least ballpark the phases.

### OBSERVATIONS (No Fix Needed)

**O1: brain.config.json example is incomplete.** Only shows 2 agents and 3 hooks. The full config will have 25+ agents. This is fine for an ADR example but the actual config file will be substantial.

**O2: protocols/ directory is new vs proposal.** The proposal used AGENTS.md directly. The ADR adds protocols/ as a source directory for generated AGENTS.md. This is a good addition for managing 174KB of content.

**O3: No Security Considerations for Cursor file copy.** The ADR mentions Cursor uses file copy (avoiding TOCTOU) but does not address how file copy handles atomicity or partial writes. Minor concern given it is a development tool writing to local directories.

---

## Section 5: Structural Quality

- Clean structure: 8 numbered decision sections, alternatives, consequences, observations, relations
- No duplicate sections (unlike ADR-002 r5)
- No missing section references
- Heading format consistent throughout
- Observations well-categorized with tags
- Relations properly formatted with wikilinks
- Security section present
- Reversibility section present

**Result**: [PASS] Structurally sound.

---

## Section 6: FEAT-001 Status

## Section 6: FEAT-001 Review

### Check 6A: ADR-001 Feature Workflow Format

**Status**: [PASS]

- Feature-centric directory: `features/FEAT-001-cross-platform-portability/`
- Index file: `FEAT-001-cross-platform-portability.md` with source-refs: [ADR-002]
- No phase files (phases documented inline)
- Proper REQ (5), DESIGN (4), TASK (20) sub-file references
- All task file references use kebab-case
- Continuous task numbering TASK-001 through TASK-020 (no gaps)

### Check 6B: Task Coverage of ADR-002 Migration Phases

**Status**: [PASS]

| ADR-002 Phase | FEAT-001 Tasks | Coverage |
|:--|:--|:--|
| Phase 1: Extract and Canonicalize | TASK-001 through TASK-013 (13 tasks) | Complete |
| Phase 2: Add Cursor Target | TASK-014 through TASK-017 (4 tasks) | Complete |
| Phase 3: Hook Normalization | TASK-018 through TASK-020 (3 tasks) | Complete |
| Phase 4: MCP Migration | Not included | Correct -- Phase 4 is strategic/future, not part of initial feature |

### Check 6C: Audit Gaps in Tasks

**Status**: [PASS]

| Audit Gap | Task Coverage |
|:--|:--|
| brain-hooks (8 cmds, 3,673 LOC) | TASK-008 Port brain-hooks to JS/TS (16h/8h) |
| brain-skills (3 cmds, 627 LOC) | TASK-009 Consolidate brain-skills Binary (3h/1h) |
| 174KB instructions/protocols | TASK-004 Extract Protocols to Root (6h/2h) |
| 298 Claude-specific refs in agents | TASK-005 Canonicalize Agent Definitions (8h/3h) |
| Two orchestrators needed | TASK-006 Create Two Orchestrator Agents (8h/4h) |
| brain.config.json | TASK-007 Create brain.config.json and AGENTS.md (4h/2h) |
| Go shared package deps (utils, validation) | Implicit in TASK-008 -- should be explicit |

### Check 6D: Kebab-Case Filenames

**Status**: [PASS]

All file references use kebab-case throughout. Directory name `FEAT-001-cross-platform-portability` is correct.

### Check 6E: Effort Estimates

**Status**: [PASS]

50-80h human / 25-45h AI-assisted across 20 tasks. Realistic given scope reduction (2 tools vs 3, no dual adapter parity). Individual task estimates are reasonable. TASK-008 (brain-hooks port at 16h/8h) is the largest single task, correctly reflecting the audit finding.

### Check 6F: Issues Found

**F4 (SHOULD FIX): Observation line 137 contradicts ADR-002.** FEAT-001 says "TS-only adapters; Go CLI shells out to bun at install time." ADR-002 Section 2 says "Go adapters in apps/tui/pkg/adapters/ perform transforms at install time so users do not need bun/Node.js installed." These are contradictory. ADR-002 is authoritative -- the FEAT-001 observation should match.

**F5 (MINOR): Go shared package TS equivalents not explicit.** TASK-008 covers brain-hooks porting but the dependency on packages/utils and packages/validation TS equivalents is not called out as a sub-task or separate task. The audit (ANALYSIS-009) flagged this. Could be implicit in TASK-008 scope but worth making explicit in the task description.

**F6 (MINOR): No Phase 4 strategic tasks.** ADR-002 describes Phase 4 (Move Hook Logic to MCP) as a strategic direction. FEAT-001 omits it entirely, which is reasonable for an implementation feature but could include a placeholder TASK for "Research MCP-based hook replacement" to maintain traceability.

## Final Verdict

## Final Verdict: APPROVE

### ADR-002: APPROVE (with F1 filename fix required)

The rewritten ADR-002 is clear, practical, and implementable. All 14 user-confirmed decisions reflected. All critical audit gaps addressed. Proposal's practical style maintained. One required fix: rename file to kebab-case.

### FEAT-001: APPROVE (with F4 fix recommended)

The rewritten FEAT-001 is well-structured, covers all 4 ADR-002 phases (3 implementation + Phase 4 omitted as strategic), has 20 properly scoped tasks with realistic effort estimates, and follows ADR-001 format. One recommended fix: correct the "TS-only adapters" observation to match ADR-002's Go adapter decision.

### Combined Assessment

| Dimension | ADR-002 | FEAT-001 |
|:--|:--|:--|
| Decisions coverage | 14/14 | N/A |
| Audit gaps covered | All critical | All critical |
| Format compliance | [PASS] (except filename) | [PASS] |
| Kebab-case | [FAIL] (spaces in filename) | [PASS] |
| No backward compat refs | [PASS] | [PASS] |
| Practical style | [PASS] | [PASS] |
| Effort estimates | Ballpark only | Per-task breakdown |

### Required Fixes

1. **F1**: Rename `ADR-002 Cross-Platform Plugin Architecture.md` to `ADR-002-cross-platform-plugin-architecture.md`

### Recommended Fixes

1. **F4**: Fix FEAT-001 observation "TS-only adapters; Go CLI shells out to bun" to match ADR-002 "Go adapters at install-time, no bun required"
2. **F2**: Consider changing ADR-002 status from ACCEPTED to PROPOSED until user formally accepts
3. **F5**: Make Go shared package TS equivalents explicit in TASK-008 description
4. **F6**: Consider adding a Phase 4 placeholder task for MCP hook replacement research

### ADR-002: APPROVE (with F1 fix required)

The rewritten ADR-002 is a clear, practical, implementable decision record. It successfully merges the cross-platform proposal's simplicity with the codebase audit's thoroughness. All 14 user-confirmed decisions are reflected. All critical audit gaps are addressed.

**Fix F1 (filename kebab-case) and this ADR is ready.**

### FEAT-001: PENDING

Cannot review -- task #21 not yet complete.

## Observations

- [decision] APPROVE verdict for rewritten ADR-002 with one filename fix required #verdict
- [fact] All 14 confirmed decisions reflected in ADR-002 #coverage
- [fact] ADR-002 reduced from 660 lines (r5, with duplicates) to 409 lines (rewrite) while covering more ground #quality
- [fact] Practical style from cross-platform proposal successfully maintained -- no over-engineering #style
- [fact] Both Go binaries fully scoped with LOC counts and subcommand lists #audit
- [fact] Instructions/protocols migration addressed with protocols/ directory strategy #audit
- [problem] Filename uses spaces instead of kebab-case: must be ADR-002-cross-platform-plugin-architecture.md #naming
- [insight] Two-orchestrator approach is architecturally cleaner than overlay/adapter-based single-orchestrator #architecture
- [insight] brain.config.json with explicit values is more maintainable than abstract model tier mapping #config

## Relations

- reviews [[ADR-002 Cross-Platform Plugin Architecture]]
- follows_up [[CRIT-003-final-validation-review]]
- validates [[ANALYSIS-009-codebase-gap-audit]]
- validates [[ANALYSIS-010 Consolidated Validation Brief]]
