---
title: CRIT-001-multi-tool-architecture-critique
type: note
permalink: critique/crit-001-multi-tool-architecture-critique
tags:
- critique
- multi-tool
- architecture
- planning
- review
---

# CRIT-001: Multi-Tool Architecture and Implementation Plan Critique

## Documents Reviewed

- **ADR-002**: Multi-Tool Compatibility Architecture (by architect)
- **PLAN-001**: Multi-Tool Compatibility Implementation Plan (by planner)

## Verdict: REVISE

The architecture is fundamentally sound and the plan is well-structured, but there are critical gaps in two nonnegotiable user requirements that must be resolved before implementation can proceed.

---

## Section 1: User Requirements Evaluation

### R1. Brain Emoji Prefix Identical Across All Tools

**Verdict**: [WARNING]

**Strengths**: ADR-002 introduces a `display_name` field with emoji prefix and a CI validation check. The adapter pattern correctly maps this to each tool's listing-visible field.

**Gaps**:

- [risk] The ADR does not address how the brain emoji character is rendered across terminals and tool UIs. Claude Code is known to mangle the emoji in cache paths (`cache/brain/--/unknown/`). Cursor and Gemini may have similar rendering issues. The ADR documents the problem for Claude Code but does not investigate whether Cursor or Gemini have analogous path-encoding issues. **Severity: MEDIUM**.
- [risk] The `display_name` field is a new canonical concept but the ADR does not define its schema, validation rules, or how it interacts with each tool's `name` field. For example, does Cursor's `name` field accept emoji characters? Does Gemini's TOML format properly encode Unicode emoji? These are untested assumptions. **Severity: MEDIUM**.
- [insight] The CI validation for emoji prefix is listed in PLAN-001 task 1.8 but depends on task 1.7 (adapter refactor). This means emoji validation is the very last thing validated in Phase 1, when it should be validated early via a unit test in task 1.1 or 1.2.

**Recommendation**: Add an explicit validation spike to Phase 1 (before task 1.2) that tests emoji rendering in Cursor and Gemini tool listings. If emoji is mangled in any tool, the team needs to know before extracting content.

### R2. Parallel Subagent Execution on All Supported Tools

**Verdict**: [FAIL]

**Critical Issue**: The user requirement states "parallel subagent execution MUST work on all supported tools." Gemini CLI has no native parallel agent execution. The ADR proposes "single-agent mode with sequential orchestration" and flags it as a limitation.

This is a fundamental contradiction: the user's nonnegotiable requirement says ALL tools, the ADR says Gemini gets sequential-only. This was explicitly called out by the user in the task brief: "Gemini CLI has NO parallel subagent execution yet - how does this affect the requirement?"

The ADR answers this with "flag as limitation in docs" and "revisit when Gemini adds parallel support." This does not satisfy the user requirement. The options are:

1. **Descope Gemini CLI** from "supported tools" until it gains parallel agent support, making it an install-only (no orchestrator) target
2. **Implement a Brain-level parallel orchestration layer** for Gemini (e.g., launch N sequential Gemini CLI processes, each handling one subtask, coordinated by Brain's Go CLI)
3. **Redefine the requirement** by acknowledging Gemini as a degraded-mode target with documented limitations, requiring explicit user sign-off

The ADR must not silently downgrade a nonnegotiable requirement. **Severity: HIGH**.

**Recommendation**: The team lead must surface this decision to the user. ADR-002 should include an explicit decision record for the Gemini parallel limitation, not just a table note. This likely requires requirement relaxation from the user.

### R3. Claude Code Plugin Install Path Preserved

**Verdict**: [PASS]

Both documents correctly preserve the existing `brain plugin install` and `brain claude` flows. PLAN-001 task 1.7 has specific acceptance criteria verifying backward compatibility. Task 2.4 adds deprecation aliases. The existing symlink strategy, marketplace registration, and `--agent-teams` variant swap are all documented as preserved.

### R4. Install/Uninstall Using gum + bubbletea Inline

**Verdict**: [PASS]

ADR-002 section 6 clearly specifies the gum multiselect + confirm flow and bubbletea inline progress bars. PLAN-001 tasks 2.2 and 2.3 break this down with proper acceptance criteria. The approach correctly uses gum for selection/confirmation (non-fullscreen) and bubbletea inline for progress display.

One minor observation: neither document specifies the bubbletea inline rendering mode (`tea.WithOutput(os.Stderr)` or `tea.WithInput(nil)` patterns). This is an implementation detail but should be flagged in task 2.2 acceptance criteria.

### R5. Gemini Parallel Gap (User's Explicit Question)

**Verdict**: [FAIL]

Same as R2 above. The user explicitly asked "how does this affect the requirement?" and the ADR's answer of "flag as limitation in docs" is insufficient. This needs an explicit decision record with user input.

---

## Section 2: Architecture Evaluation

### 2A. Shared Content Package (`packages/plugin-content/`)

**Verdict**: [PASS]

The shared content package is the correct architectural choice. It avoids N-way duplication, uses the existing turbo workspace infrastructure, and correctly identifies that skills are the most portable component. The canonical-plus-adapter pattern mirrors browser extension frameworks and is well-proven.

**Minor concern**: The ADR does not specify how the shared package handles content that is inherently tool-specific (e.g., Claude Code's `brain-hooks` Go binary, the variant swap mechanism). It says these stay in the adapter app, but the boundary is not clearly documented. Task 1.6 in PLAN-001 partially addresses this.

### 2B. Adapter-Per-Tool Pattern

**Verdict**: [PASS]

Good separation of concerns. Each adapter handles frontmatter transformation, format conversion, and config generation independently. The alternatives analysis correctly rejects monolithic and symlink-based approaches.

**Minor concern**: The plan does not specify whether adapters are runtime (invoked at `brain install` time) or build-time (invoked as part of `turbo build`). ADR-002 says "build/install time" but the alternatives section rejects "runtime adaptation" in favor of "adapter apps." The distinction matters for development workflow and CI. PLAN-001 should clarify whether adapters produce static output checked into the repo or generate output dynamically.

### 2C. Migration Phasing

**Verdict**: [PASS]

Three-phase migration with each phase independently shippable is correct. Phase 1 is the highest-risk and correctly identified as such. The dependency graph in PLAN-001 is accurate.

### 2D. Agent-Teams Variant Pattern

**Verdict**: [WARNING]

The ADR moves variant files to `apps/claude-plugin/variants/` and keeps the symlink swap mechanism. This is fine for Claude Code. However, as Cursor has native parallel agents (GA), there may be a future need for Cursor-specific variants. The architecture should anticipate this by making the variant mechanism generic (per-adapter variants) rather than Claude-specific.

---

## Section 3: Plan Evaluation

### 3A. Task Granularity and Dependencies

**Verdict**: [PASS]

Tasks are well-sized with clear dependencies. The 5-way parallel opportunity for tasks 1.2-1.6 is correctly identified. Task 1.7 (Claude adapter refactor) is correctly identified as the critical path bottleneck.

### 3B. Risk Register

**Verdict**: [WARNING]

The risk register covers tool API stability but misses several risks:

1. **Missing risk**: Content extraction may reveal that some agents or skills have implicit Claude Code dependencies (e.g., references to `CLAUDE.md`, Claude-specific tool names like `Task(subagent_type=...)`, Claude Code UI concepts). These would need to be canonicalized or stripped during extraction. **Severity: MEDIUM**.
2. **Missing risk**: The `display_name` brain emoji prefix may cause character encoding issues in TOML (Gemini commands), JSON (MCP configs), or YAML (Cursor rules). Each serialization format handles Unicode differently. **Severity: LOW-MEDIUM**.
3. **Missing risk**: The bubbletea inline mode integration with gum in the same CLI session is relatively uncommon. These are both Charm ecosystem tools but combining them in a single command flow (gum for selection, then bubbletea for progress) needs a prototype to validate they do not conflict. **Severity: LOW**.

### 3C. Testing Strategy

**Verdict**: [WARNING]

The testing strategy lists 5 categories but lacks specifics:

- No mention of how to test tool detection (mocking PATH, config directories)
- No mention of how to test the symlink/copy install flow across macOS and Linux
- Snapshot tests need golden file generation tooling (not specified)
- Manual validation across 3 tools requires access to all 3 tools in CI (how?)

**Recommendation**: Add a testing spike to Phase 1 that establishes the test harness, golden file generation, and mock tool detection before adapter work begins.

### 3D. Acceptance Criteria Quality

**Verdict**: [PASS]

Acceptance criteria are specific, measurable, and verifiable. Each task has clear definition of done.

### 3E. Missing Tasks

1. **Missing**: No task for creating the canonical frontmatter schema documentation. Task 1.2 mentions "create frontmatter schema documentation" as a sub-requirement but this needs to be its own task since it is shared across all extraction tasks.
2. **Missing**: No task for validating that extracted canonical content can round-trip through all 3 adapters and produce valid tool-specific output. This should be an end-to-end validation task in Phase 1, not deferred to Phase 4.
3. **Missing**: No task for updating CLAUDE.md (project instructions) to reflect the new package structure. The current CLAUDE.md references paths like `apps/claude-plugin/agents/` that will change.
4. **Missing**: No task for the Gemini parallel execution decision (see R2 above). This is a blocking decision that must happen before Phase 3 planning is finalized.
5. **Missing**: No task addressing how the existing `brain claude --agent-teams` flag interacts with the new install flow. If a user runs `brain install` for Claude Code, does it install the standard or agent-teams variant? The current `brain claude` command handles this at launch time, but `brain install` (which populates the plugin directory) needs to handle it too.

---

## Section 4: Alternatives Not Considered

1. **Tool detection via config directories vs binary**: The ADR mentions checking binary signatures in PATH but Cursor and Gemini CLI may be installed via different mechanisms (Cursor as an Electron app, Gemini via npm/pip). Config directory presence may be more reliable than binary detection. Neither document evaluates this.

2. **Incremental adapter development**: Instead of building full adapters upfront, consider a minimal viable adapter that only handles skills (which need no transformation) and MCP (which is universal). This would give all 3 tools Brain MCP access with minimal effort, deferring the complex frontmatter/command/instruction transformation.

3. **Content validation during extraction**: The plan assumes extraction is a move-and-transform operation. An alternative is to build the canonical schema first, validate all existing content against it, fix non-conforming content, then extract. This reduces risk in task 1.7 (Claude adapter refactor).

---

## Final Verdict: REVISE

### Blocking Issues (Must Fix)

1. **Gemini parallel execution gap** (R2/R5): The nonnegotiable requirement conflict must be surfaced to the user for decision. ADR-002 must include an explicit decision record, not a silent downgrade.

### Recommended Revisions (Should Fix)

1. **Emoji validation spike**: Add a Phase 0/early Phase 1 spike to test emoji rendering across all 3 tool UIs before committing to the `display_name` approach.
2. **Missing tasks**: Add tasks for canonical schema documentation, round-trip validation, CLAUDE.md update, Gemini parallel decision, and agent-teams interaction with install flow.
3. **Risk register gaps**: Add the 3 missing risks identified in section 3B.
4. **Adapter build vs runtime clarification**: ADR-002 should clearly state whether adapters produce static artifacts or dynamic output.
5. **Testing harness spike**: Add Phase 1 task for establishing test infrastructure before adapter work.

## Observations

- [decision] REVISE verdict due to nonnegotiable requirement conflict on Gemini parallel execution #verdict
- [risk] Gemini CLI lacks parallel agent execution, contradicting user requirement #blocking
- [risk] Emoji prefix rendering untested across Cursor and Gemini tool UIs #validation-gap
- [risk] Agent-teams variant interaction with `brain install` flow is undefined #gap
- [insight] Architecture is sound but plan needs 5 additional tasks for completeness #planning
- [insight] Content extraction may reveal implicit Claude Code dependencies in agent/skill definitions #extraction-risk
- [fact] ADR-002 correctly identifies skills as lowest-risk extraction target (Open Agent Skills standard) #strength
- [fact] PLAN-001 correctly identifies task 1.7 (Claude adapter refactor) as critical path #strength
- [fact] Both documents preserve backward compatibility for existing Claude Code users #strength

## Relations

- reviews [[ADR-002-multi-tool-compatibility-architecture]]
- reviews [[PLAN-001-multi-tool-compatibility-implementation-plan]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
- relates_to [[ANALYSIS-006-multi-tool-compatibility-research]]
