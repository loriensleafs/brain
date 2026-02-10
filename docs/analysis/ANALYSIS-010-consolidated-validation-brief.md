---
title: ANALYSIS-010 Consolidated Validation Brief
type: analysis
permalink: analysis/analysis-010-consolidated-validation-brief-1
tags:
- analysis
- validation
- multi-tool
- architecture
- consolidated
---

# ANALYSIS-010 Consolidated Validation Brief

## Purpose

Unified validation of ADR-002 (Multi-Tool Compatibility Architecture) and FEAT-001 (Multi-Tool Compatibility) based on:

- ANALYSIS-006: Multi-tool compatibility research (5-agent parallel reconnaissance)
- ANALYSIS-007: Install staging strategy research (community patterns, symlink analysis)
- CRIT-001: Architecture and implementation plan critique (6-agent debate)
- Direct codebase audit of `apps/claude-plugin/` against ADR-002 proposed structure
- Community pattern analysis (AGENTS.md standard, Vercel agent-skills, Open Agent Skills)

---

## 1. Architecture Validation Verdict

**VERDICT: SOUND WITH GAPS**

The ADR-002 architecture is fundamentally correct. The core decisions are well-supported by community patterns and technical evidence:

- [decision] Root-level canonical content is the right call -- aligns with community patterns (Vercel agent-skills, open-source AI agent projects) and eliminates turbo workspace overhead for static content #validated
- [decision] Adapter-per-tool pattern correctly separates concerns -- pure function transforms are testable and maintainable #validated
- [decision] Hybrid staging + adaptive write (symlinks for Claude Code, copy for Cursor/Gemini) is the industry-standard approach (GNU Stow, Homebrew, Nix, npx skills) #validated
- [decision] JS/TS hook scripts replacing Go binary is correct for portability across tool runtimes #validated
- [decision] charmbracelet/huh v2 over gum binary eliminates external dependency while preserving identical UX primitives #validated
- [decision] XDG-compliant staging at ~/.local/share/brain/plugins/{tool}/ follows platform conventions #validated
- [decision] Clean break from apps/claude-plugin/ avoids migration ambiguity and treats all tools as equal consumers #validated

**Additional validation from ANALYSIS-008 (community research):**

- [fact] AGENTS.md standard has 60,000+ project adoption and 20+ native tool support -- strongest evidence for root-level canonical content #ecosystem
- [fact] Vercel Skills CLI supports 40+ tools with zero content transforms -- validates "author once" principle #ecosystem
- [fact] Vercel evals show passive context (AGENTS.md, always-loaded) achieves 100% pass rate vs active retrieval (skills, on-demand) at 79% -- validates AGENTS.md-at-root strategy #evidence
- [fact] Codex also does not follow symlinks (issue #8369, Jan 2026) -- 3 of 4 tools have symlink problems, further validating hybrid approach #blocker
- [insight] Brain's tool API adapter layer is genuinely novel -- no ecosystem framework handles tool-specific API instructions. Most frameworks assume tool-agnostic content. This justifies the adapter pattern but raises over-engineering risk #novel
- [risk] Ecosystem consensus is "simplicity wins" (AGENTS.md, Vercel Skills succeed through format simplicity). Brain's adapter complexity must continuously justify itself against convergence toward simpler universal formats #convergence

**However, there are 6 HIGH-severity gaps and 6 MEDIUM-severity gaps that must be addressed before implementation.**

---

## 2. Complete Gap List

### HIGH Severity

#### GAP-H1: Gemini Parallel Execution Requirement Conflict

- **Source**: CRIT-001 R2/R5, ANALYSIS-006
- **Issue**: User requirement states "parallel subagent execution MUST work on all supported tools." Gemini CLI has no native parallel agent execution. ADR-002 silently downgrades this to "for tools that support it" without explicit user sign-off.
- **Impact**: Nonnegotiable requirement contradiction. Cannot proceed without resolution.
- **Recommendation**: Surface to user with 3 options: (a) descope Gemini from orchestration support, (b) implement Brain-level parallel orchestration for Gemini (launch N sequential processes), (c) redefine requirement with explicit user sign-off on Gemini degraded mode.

#### GAP-H2: Claude Code-Specific Agent Content Not Canonicalized

- **Source**: ANALYSIS-009 codebase audit, direct codebase audit
- **Issue**: Agent definitions in `apps/claude-plugin/agents/` contain heavy Claude Code-specific references. ANALYSIS-009 found 298 total Claude-specific API references across 22 of 25 agents. The orchestrator alone has 85 Claude-specific references (2,312 lines). The body content references MCP tool names (mcp__plugin_brain_brain__*), Teammate(), TaskCreate, SendMessage, and other Claude Code Agent Teams APIs. These cannot be moved to root-level canonical content without canonicalization.
- **Impact**: Extraction tasks (TASK-002) underestimate effort. Moving files without canonicalization produces "canonical" content that only works with Claude Code.
- **Recommendation**: Add a TASK-002A "Audit and canonicalize agent definitions" before TASK-002. Define the canonical frontmatter schema (from ADR-002 section 2) as a machine-readable schema file, not just documentation. Each agent needs a tool-neutral body with tool-specific sections handled by adapters.

#### GAP-H3: Missing Canonical Frontmatter Schema Definition

- **Source**: CRIT-001 Section 3E item 1, ANALYSIS-009 frontmatter gap analysis
- **Issue**: ADR-002 Section 2 describes a canonical frontmatter schema in prose but there is no machine-readable schema file, no validation tooling, and no mapping specification for how each canonical field maps to each tool's native format. ANALYSIS-009 confirmed the current agent frontmatter has 4 fields not in the canonical schema (memory, color, argument-hint, skills) and is missing 3 canonical fields (display_name, parallel, tags). Additionally, 3 agents have incomplete frontmatter: security (missing model, color), import-memories (missing memory, color, argument-hint), and model values are Claude-specific strings (claude-opus-4-6[1m], sonnet, haiku, opus) with no canonical model abstraction.
- **Recommendation**: Create a JSON Schema or TypeScript type definition for canonical frontmatter. Add as TASK-001A before content extraction begins. This schema becomes the contract between canonical content and adapters. Must define how memory, color, argument-hint, skills map to canonical equivalents or are marked as tool-specific extensions.

#### GAP-H4: brain-skills Binary Not Addressed by ADR-002

- **Source**: ANALYSIS-009 Section 3
- **Issue**: ADR-002 only addresses brain-hooks binary port. A second Go binary, brain-skills (3 commands: incoherence, decision-critic, fix-fences; 626 lines source), is completely unmentioned. These commands also have Python script equivalents in skills/ -- the porting/consolidation strategy is undefined.
- **Impact**: Extraction will leave an unaccounted binary. Commands may be duplicated between Python scripts and Go binary with no clear canonical version.
- **Recommendation**: Add to ADR-002 scope. Determine whether brain-skills commands consolidate into the JS/TS hook scripts, remain as Python scripts, or get a separate porting task.

#### GAP-H5: Protocols Subdirectory Not Addressed

- **Source**: ANALYSIS-009 Section 2
- **Issue**: The instructions/protocols/ subdirectory contains 3 files totaling 107KB (AGENT-SYSTEM.md, AGENT-INSTRUCTIONS.md, SESSION-PROTOCOL.md). ADR-002 Section 4 says "Generate CLAUDE.md from AGENTS.md sections" but does not address how these protocols adapt for Cursor/Gemini. The protocols contain 16 Claude-specific references including Session Protocol validation scripts, .agents/ directory structures, and Brain MCP tool references.
- **Impact**: No FEAT-001 task addresses splitting or adapting protocols for non-Claude tools. 107KB of instruction content has no adaptation strategy.
- **Recommendation**: Add protocols adaptation strategy to ADR-002. Add a TASK specifically for protocol content analysis and tool-neutral extraction.

#### GAP-H6: Go Shared Package Dependencies for Hook Port

- **Source**: ANALYSIS-009 Section 3
- **Issue**: brain-hooks imports packages/utils (project resolution) and packages/validation (scenario detection, session validation). Porting hooks to JS/TS also requires porting these Go shared packages to TS, or finding TS equivalents. Additionally, 2,669 lines of Go test code (3 test files) would need TS equivalents. TASK-006 (Port brain-hooks to JS/TS) does not account for this dependency chain.
- **Impact**: TASK-006 effort estimate (16h human / 6h AI) likely needs 50-100% increase to account for shared package porting and test migration.
- **Recommendation**: Add TASK-006B for shared package TS port. Update TASK-006 effort estimate and add dependency on TASK-006B.

### MEDIUM Severity

#### GAP-M1: Emoji Prefix Validation Not Early Enough

- **Source**: CRIT-001 R1, ANALYSIS-006
- **Issue**: TASK-009 (Emoji Validation Spike) exists but depends on TASK-007 (TS Claude Code Adapter). Emoji rendering across Cursor and Gemini tool UIs should be validated before committing to extraction, not after. Claude Code already mangles emoji in cache paths.
- **Recommendation**: Move TASK-009 to have no dependencies -- it should run in parallel with TASK-001 as a Phase 0 spike.

#### GAP-M2: Agent-Teams Variant Mechanism Incomplete

- **Source**: CRIT-001 Section 2D, direct audit
- **Issue**: ADR-002 proposes `agents/variants/claude-code/` for agent-teams variants but does not define: (a) which agents have variants, (b) what differs between standard and variant, (c) how `brain install` handles variant selection, (d) how this interacts with Cursor's native parallel agents. The existing `_orchestrator.md` and `_bootstrap.md` files in `apps/claude-plugin/` appear to be variant files (underscore prefix pattern) but this is undocumented.
- **Recommendation**: Document variant mechanism in ADR-002. Add acceptance criteria to TASK-002 covering variant identification and migration.

#### GAP-M3: Dual Adapter Sync Risk Understated

- **Source**: CRIT-001 Section 2B, ANALYSIS-007
- **Issue**: ADR-002 requires TS adapters (CI/test) and Go adapters (install-time) to produce identical output. Golden file parity tests are specified but the mechanism for keeping two implementations in sync is not defined. This is a known maintenance burden in projects with dual implementations.
- **Recommendation**: Consider making TS adapters the single source of truth and having the Go CLI invoke them via embedded JS runtime (e.g., goja) or by shelling out to bun/node only during `brain install`. If dual implementation is retained, add a TASK specifically for building the parity test harness.

#### GAP-M4: Hook Migration Scope Understated

- **Source**: Direct audit
- **Issue**: The `brain-hooks` Go binary in `apps/claude-plugin/` is a compiled binary (3.3MB). The hooks use `${CLAUDE_PLUGIN_ROOT}` environment variable for path resolution. The hook scripts directory contains the Go source (`cmd/hooks/`). ADR-002 says "port to JS/TS" but TASK-006 estimates 16h human / 6h AI-assisted. Given the binary size and the fact that hook logic includes scenario detection and skill loading, this estimate may be aggressive.
- **Recommendation**: TASK-006 should include a subtask for analyzing the Go binary's actual functionality before porting. The hooks.json references `brain-hooks user-prompt`, `brain-hooks session-start`, and `brain-hooks stop` -- each is a subcommand that needs independent porting.

#### GAP-M5: Missing TASK-017 (No Gap in Numbering Explained)

- **Source**: Direct audit of FEAT-001
- **Issue**: FEAT-001 task list jumps from TASK-016 to TASK-018. TASK-017 is missing with no explanation. This could be a deleted task or a numbering error but it creates confusion in the task tracker.
- **Recommendation**: Either add TASK-017 or document why it was skipped.

### LOW Severity

#### GAP-M6: Over-Engineering Risk from Ecosystem Divergence

- **Source**: ANALYSIS-008 Q9, community consensus
- **Issue**: The ecosystem (AGENTS.md, Vercel Skills, skills-supply) succeeds through simplicity -- identical content to all tools, no transforms. Brain is the only framework requiring per-tool content adaptation because its agent definitions contain tool-specific API references (Agent Teams, MCP config). As tools converge on AGENTS.md and Open Agent Skills, tool-specific content may shrink, making the adapter layer increasingly expensive relative to its value.
- **Recommendation**: Design adapters to be removable. If 80% of content needs no transformation, consider separating "universal content" (direct placement, no adapter) from "tool-specific content" (adapter-transformed). This reduces the adapter surface area and aligns with ecosystem simplicity.

#### GAP-L1: PowerShell Script Portability Deferred Too Long

- **Source**: ADR-002 Section 9
- **Issue**: 8 skills contain PowerShell scripts (.ps1/.psm1). ADR-002 defers portability evaluation to Phase 3 (Gemini). Cursor users on non-Windows platforms may also lack pwsh. This should be flagged during Phase 2 (Cursor support).
- **Recommendation**: Add a note to TASK-012 (Cursor adapter) to document which skills depend on PowerShell and whether they degrade gracefully.

#### GAP-L2: Testing Strategy Lacks Specifics

- **Source**: CRIT-001 Section 3C
- **Issue**: No specification for how to test tool detection (mocking PATH, config directories), how to test install flow across macOS/Linux, or how to generate golden files. CI testing of all 3 tools requires access to all 3 tool environments.
- **Recommendation**: Add a testing infrastructure spike task early in Phase 1.

#### GAP-L3: CLAUDE.md Update Task Missing

- **Source**: CRIT-001 Section 3E item 3
- **Issue**: The current CLAUDE.md references paths like `apps/claude-plugin/agents/` that will change after extraction. No task exists to update CLAUDE.md for the new structure.
- **Recommendation**: Add to TASK-026 (Documentation Updates) or create a separate task.

---

## 3. Recommended Changes to ADR-002

### Must Change

1. **Add Gemini parallel execution decision record** (GAP-H1): Include an explicit decision section for Gemini's degraded mode. Surface the 3 options with pros/cons. Mark as PENDING USER DECISION. Do not silently downgrade the requirement.

2. **Define canonical frontmatter schema formally** (GAP-H3): Add a machine-readable schema (JSON Schema or TypeScript interface) to ADR-002 Section 2. Map every current field (name, description, model, memory, color, argument-hint, tools, skills) to canonical equivalents or document them as tool-specific extensions. Address 3 agents with incomplete frontmatter and Claude-specific model string mapping.

3. **Add Claude Code-specific content canonicalization strategy** (GAP-H2): ADR-002 Section 1 assumes content can be "moved" to root. ANALYSIS-009 found 298 Claude-specific API references across 22 of 25 agents. Add a subsection on how tool-specific content in agent bodies is handled (options: conditional sections, adapter-injected sections, or separate tool-specific overlays).

4. **Add brain-skills binary to scope** (GAP-H4): ADR-002 only addresses brain-hooks port. brain-skills (3 commands: incoherence, decision-critic, fix-fences; 626 lines) is not mentioned. Define whether these consolidate into hook scripts, remain as Python, or get a separate task.

5. **Add protocols adaptation strategy** (GAP-H5): ADR-002 does not address how the 107KB protocols subdirectory (AGENT-SYSTEM.md, AGENT-INSTRUCTIONS.md, SESSION-PROTOCOL.md) adapts for Cursor/Gemini. These contain 16 Claude-specific references.

6. **Account for Go shared package dependencies in hook port** (GAP-H6): brain-hooks imports packages/utils and packages/validation. Porting hooks to JS/TS requires porting these Go packages too, plus 2,669 lines of Go test code. Update TASK-006 scope and effort.

### Should Change

1. **Reorder TASK-009 dependencies** (GAP-M1): Move emoji validation spike to Phase 0 / no dependencies.

2. **Document agent-teams variant mechanism** (GAP-M2): Add subsection to ADR-002 Section 6 defining variant file structure, selection mechanism, and interaction with `brain install`.

3. **Address dual adapter sync mechanism** (GAP-M3): Either specify the parity testing approach in detail or consider single-implementation alternatives.

4. **Expand hook migration analysis** (GAP-M4): Add a subtask for analyzing brain-hooks binary functionality before porting.

---

## 4. Recommended Changes to FEAT-001

### Must Add Tasks

1. **TASK-001A: Define Canonical Frontmatter Schema** -- Create JSON Schema and TypeScript types for canonical agent/skill/command frontmatter. Map current Claude Code fields to canonical equivalents. This must complete before any extraction task. Effort: T1, 4h human / 1.5h AI.

2. **TASK-002A: Audit and Canonicalize Agent Definitions** -- Analyze all 25 agents for Claude Code-specific references. Categorize each reference as: (a) canonical (keep as-is), (b) tool-neutral (rename/rewrite), (c) tool-specific (move to adapter overlay). Produce a canonicalization report. Effort: T2, 8h human / 3h AI.

3. **TASK-000: Emoji Validation Spike** -- Move TASK-009 to run with no dependencies as the first task. Test emoji rendering in Cursor agent listing, Gemini CLI listing, and Claude Code listing. Report pass/fail/workaround for each. Effort: T2, 4h human / 2h AI.

### Should Add Tasks

1. **TASK-006A: Analyze brain-hooks Binary Functionality** -- Document all 8 subcommands (session-start, user-prompt, pre-tool-use, stop, detect-scenario, load-skills, analyze, validate-session). Map each to JS/TS equivalent. Note: pre-tool-use exists in binary but is not wired in hooks.json. Effort: T1, 2h human / 1h AI.

2. **TASK-006B: Port Go Shared Packages to TS** -- packages/utils (project resolution) and packages/validation (scenario detection, session validation) are imported by brain-hooks. TS equivalents needed for hook port. Plus 2,669 lines of Go test code needing TS equivalents. Effort: T2, 12h human / 4h AI.

3. **TASK-006C: brain-skills Binary Consolidation** -- Determine strategy for brain-skills binary (3 commands: incoherence, decision-critic, fix-fences). Each has a Python equivalent in skills/. Decide: consolidate to Python only, port to JS/TS, or keep both. Effort: T1, 4h human / 1.5h AI.

4. **TASK-005A: Protocols Adaptation Analysis** -- Analyze AGENT-SYSTEM.md (48KB), AGENT-INSTRUCTIONS.md (19KB), SESSION-PROTOCOL.md (39KB) for Cursor/Gemini adaptation. Document which sections are tool-neutral, which need adaptation, which are Claude-only. Effort: T2, 6h human / 2h AI.

5. **TASK-017: brain claude Launch Wrapper** -- Fill the gap in numbering. Effort: T1, 3h human / 1h AI.

6. **TASK-011A: Testing Infrastructure Spike** -- Establish golden file generation tooling, tool detection mocking, and adapter parity test harness. Must complete before TASK-011 (CI Validation). Effort: T2, 6h human / 2h AI.

### Should Modify Tasks

1. **TASK-002 (Move Canonical Agent Definitions)**: Add dependency on TASK-001A and TASK-002A. Increase effort estimate from T1/4h to T2/8h to account for canonicalization.

2. **TASK-006 (Port brain-hooks to JS/TS)**: Add dependency on TASK-006A. Consider increasing estimate given 3.3MB binary complexity.

3. **TASK-009 (Emoji Validation Spike)**: Remove dependency on TASK-007. Make it a Phase 0 task with no blockers.

---

## 5. Open Questions Needing User Decision

### DECISION-1: Gemini Parallel Execution [BLOCKING]

Gemini CLI has no native parallel agent execution. Options:

- (a) Descope Gemini from orchestration support (install-only, no orchestrator agent)
- (b) Implement Brain-level parallel orchestration for Gemini (N sequential processes coordinated by Go CLI)
- (c) Accept Gemini as degraded-mode target with documented limitations

**Impact**: Affects scope of Phase 3 and the "parallel on all supported tools" requirement.

### DECISION-2: Dual Adapter Implementation vs Single Source

ADR-002 requires both TS (CI/test) and Go (install-time) adapters. Options:

- (a) Keep dual implementation with golden file parity tests (current plan)
- (b) Single TS implementation; Go CLI shells out to bun/node at install time
- (c) Single TS implementation; Go CLI uses embedded JS runtime (goja)
- (d) Single Go implementation; TS tests import Go via WASM

**Impact**: Affects maintenance burden and user dependency requirements.

### DECISION-3: Agent Body Canonicalization Strategy

11 of 25 agents contain Claude Code-specific API references in their body text. Options:

- (a) Conditional sections in Markdown (tool-specific blocks, adapter strips irrelevant ones)
- (b) Adapter-injected sections (minimal canonical body, adapter appends tool-specific instructions)
- (c) Separate overlay files per tool (agents/overlays/claude-code/orchestrator.md)

**Impact**: Affects complexity of content extraction and adapter implementation.

### DECISION-4: Codex CLI Future

ADR-002 defers Codex. Should we:

- (a) Keep deferred indefinitely (current plan)
- (b) Add as Phase 4 with minimal scope (AGENTS.md + MCP only)
- (c) Remove from scope entirely

**Impact**: Minor. Codex extensibility is minimal.

---

## Summary Assessment

| Dimension | Rating | Notes |
|---|---|---|
| Architecture soundness | PASS | Core decisions validated by community patterns and technical evidence |
| Requirement coverage | FAIL | Gemini parallel execution requirement contradicted |
| Task completeness | FAIL | 3 must-add tasks, 6 should-add tasks, 3 should-modify tasks. brain-skills binary and protocols subdirectory completely unaccounted for |
| Risk identification | WARNING | 5+ risks not in current register (canonicalization, hook binary scope, schema drift, over-engineering, shared package deps) |
| Effort estimates | FAIL | TASK-002 and TASK-006 significantly underestimated. TASK-006 misses 2,669 lines of test code and 2 shared Go package dependencies |
| Scope completeness | FAIL | brain-skills binary (626 lines, 3 commands) and protocols/ (107KB, 3 files) not in ADR-002 scope |
| Phasing strategy | PASS | 4 phases independently shippable, risk correctly front-loaded |
| Community alignment | PASS | Root-level structure, Open Agent Skills, hybrid staging all align with industry patterns (AGENTS.md: 60K+ projects, Vercel Skills: 40+ tools) |

**Overall: REVISE before implementation. The architecture is sound but the implementation plan has significant gaps -- 6 HIGH-severity items including 3 entirely unscoped components (brain-skills binary, protocols adaptation, Go shared package dependencies). Proceeding without addressing these will cause substantial rework.**

## Observations

- [decision] Architecture verdict is SOUND WITH GAPS -- core approach validated, implementation plan needs revision #verdict
- [fact] 22 of 25 agents contain Claude Code-specific references: 298 total API references across agent bodies (ANALYSIS-009) #audit
- [fact] Orchestrator agent has 85 Claude-specific references across 2,312 lines -- the most coupled agent #audit
- [fact] brain-hooks Go binary has 8 subcommands (session-start, user-prompt, pre-tool-use, stop, detect-scenario, load-skills, analyze, validate-session), 5,299 lines source+test #audit
- [fact] brain-skills Go binary (3 commands: incoherence, decision-critic, fix-fences; 626 lines) completely missing from ADR-002 #audit
- [fact] Instructions system is 148KB across 4 files with 52 Claude-specific references; protocols/ (107KB) has no adaptation strategy #audit
- [fact] brain-hooks imports packages/utils and packages/validation; TS equivalents needed for port #audit
- [fact] 2,669 lines of Go test code not accounted for in TASK-006 port estimate #audit
- [fact] AGENTS.md standard has 60,000+ project adoption and 20+ native tool support (ANALYSIS-008) #ecosystem
- [fact] Vercel Skills CLI supports 40+ tools with zero content transforms (ANALYSIS-008) #ecosystem
- [fact] FEAT-001 task numbering has a gap at TASK-017 #gap
- [risk] Agent extraction without canonicalization produces Claude Code-only "canonical" content #blocking
- [risk] Emoji rendering untested in Cursor and Gemini -- should be Phase 0 not Phase 1 dependency #priority
- [risk] Dual adapter sync (TS + Go) maintenance burden not mitigated by specified testing approach #maintenance
- [insight] The 3 HIGH-severity gaps all relate to insufficient analysis of WHAT is being moved, not HOW it is moved #pattern
- [insight] ADR-002 excels at structural architecture but underestimates content transformation complexity #pattern
- [constraint] Gemini parallel execution decision MUST be resolved by user before Phase 3 planning #blocking

## Relations

- consolidates [[ANALYSIS-008-community-validation-research]]
- consolidates [[ANALYSIS-009-codebase-gap-audit]]
- consolidates [[ANALYSIS-006-multi-tool-compatibility-research]]
- consolidates [[ANALYSIS-007-install-staging-strategy-research]]
- consolidates [[CRIT-001-multi-tool-architecture-critique]]
- validates [[ADR-002-multi-tool-compatibility-architecture]]
- validates [[FEAT-001 Multi-Tool Compatibility]]
- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
