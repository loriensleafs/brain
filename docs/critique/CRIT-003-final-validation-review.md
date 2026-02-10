---
title: CRIT-003-final-validation-review
type: note
permalink: critique/crit-003-final-validation-review
tags:
- critique
- multi-tool
- architecture
- validation
- final-review
---

# CRIT-003: Final Validation Review of Revised ADR-002 and FEAT-001

## Documents Reviewed

- **ADR-002** (revised 2026-02-10, r5): Multi-Tool Compatibility Architecture (660 lines, up from 457)
- **FEAT-001** (unrevised): Multi-Tool Compatibility (202 lines, unchanged since initial creation)
- **ANALYSIS-008**: Community Validation Research (Vercel, AGENTS.md, ecosystem patterns)
- **ANALYSIS-009**: Codebase Gap Audit (full inventory of apps/claude-plugin/)
- **ANALYSIS-010**: Consolidated Validation Brief (3 HIGH, 5 MEDIUM, 3 LOW gaps)
- **CRIT-001**: Original architecture critique (REVISE verdict)
- **CRIT-002**: Revised ADR/plan alignment review (REVISE verdict)
- **ADR-001**: Feature workflow format standard (for FEAT-001 compliance check)

---

## Verdict: REVISE

ADR-002 r5 is substantially improved. It addresses most gaps from the validation brief and prior critiques. However, 3 issues prevent APPROVE: (1) FEAT-001 has NOT been revised to match the new architecture, (2) the ADR has structural duplication from the revision process, and (3) two audit gaps remain unaddressed.

---

## Section 1: Validation Brief Gap Coverage (ANALYSIS-010)

### GAP-H1: Gemini Parallel Execution Requirement Conflict

**Status**: [PASS]

ADR-002 r5 Section 6 now explicitly documents 3 options (descope, Brain-level orchestration, degraded mode) and marks the decision as PENDING USER DECISION. The requirement was reframed from "all tools" to "tools that support it." This satisfies the requirement to surface the contradiction rather than silently downgrade.

### GAP-H2: Claude Code-Specific Agent Content Not Canonicalized

**Status**: [PASS]

ADR-002 r5 adds three mechanisms:

1. `agents/overlays/claude-code/` for per-tool body content overlays (Section 1 tree)
2. Adapter operation "Agent body: Inject Claude-specific overlay" (Section 4 table)
3. Phase 1 now includes "Audit and canonicalize agent definitions" step

The overlay approach (canonical body + tool-specific injection) is a clean solution. However, the FEAT-001 tasks have not been updated to include TASK-002A (canonicalization audit) as recommended by ANALYSIS-010.

### GAP-H3: Missing Canonical Frontmatter Schema Definition

**Status**: [PASS]

ADR-002 r5 Section 2 now includes:

- `adapters/schema/canonical.schema.json` in the directory tree
- `adapters/schema/canonical.ts` for TypeScript type definitions
- Complete field mapping table with rationale for dropped fields (memory, color, argument-hint)
- Model tier mapping (default/large/fast to tool-specific model IDs)
- Tool capability mapping (mcp/file_read/file_edit/terminal/web_search/task_mgmt/messaging)

This is thorough and addresses the gap fully.

### GAP-M1: Emoji Prefix Validation Not Early Enough

**Status**: [PASS]

Phase 0 now includes "Emoji validation spike across all 3 tools -- validate before committing to extraction." This runs with no dependencies as recommended.

### GAP-M2: Agent-Teams Variant Mechanism Incomplete

**Status**: [PASS]

Section 6 now fully documents:

- Which agents have variants (orchestrator, bootstrap)
- Variant directory structure (`agents/variants/claude-code/`)
- Selection mechanism (`brain claude --agent-teams` flag)
- Staging output structure (standard/ vs agent-teams/)
- Migration path from underscore prefix to directory-based

### GAP-M3: Dual Adapter Sync Risk Understated

**Status**: [PASS]

Section 4 adds:

- Explicit parity enforcement via `adapters/__tests__/parity/`
- CI runs both TS and Go adapters against same input corpus
- PENDING DECISION flag for whether to keep dual implementation or single source

### GAP-M4: Hook Migration Scope Understated

**Status**: [PASS]

Section 3 now fully documents both Go binaries:

- brain-hooks (8 subcommands, 3,673 lines + 2,669 test lines)
- brain-skills (3 subcommands, 627 lines)
- Per-script porting plan with test line counts
- Environment variable migration (CLAUDE_PLUGIN_ROOT to BRAIN_PLUGIN_ROOT)

### GAP-M5: Missing TASK-017

**Status**: [FAIL] -- Not addressed in ADR-002 (this is a FEAT-001 issue, and FEAT-001 is unrevised)

### Additional Audit Gaps from ANALYSIS-009

#### brain-skills binary

**Status**: [PASS] -- Section 3 now explicitly lists brain-skills with its 3 subcommands and porting plan

#### Protocols system (107KB, 3 files)

**Status**: [PASS] -- Section 1 adds `instructions/protocols/` directory and Section 4 documents per-tool instruction generation

#### MCP config hardcoded paths

**Status**: [PASS] -- Section 4 adds MCP config templating with `${BRAIN_MCP_COMMAND}` and `${BRAIN_MCP_ARGS}` variables

#### Plugin registration for Cursor/Gemini

**Status**: [PASS] -- Section 4 adapter table adds "Plugin metadata" row for all tools

#### skills/CLAUDE.md (Claude-specific skill dev guide)

**Status**: [WARNING] -- Not explicitly addressed. The skill development guide needs a tool-neutral equivalent. This is a minor gap.

---

## Section 2: ADR-002 r5 Structural Issues

### Issue S1: Duplicate Sections [MUST FIX]

ADR-002 r5 has structural duplication from the revision process. Several sections appear twice with different content:

- **Lines 24-33**: "Current State" section (original)
- **Lines 458-478**: "Current State" section (revised, expanded with inventory table) -- this duplicates and supersedes the original

- **Lines 54-88**: Section 1 "Root-Level Canonical Content" (original)
- **Lines 480-528**: Section 1 "Root-Level Canonical Content" (revised, expanded with instructions/ and overlays) -- this duplicates and supersedes the original

- **Lines 90-123**: Section 2 "Canonical Frontmatter Schema" (original)
- **Lines 530-588**: Section 2 "Canonical Frontmatter Schema" (revised, expanded with dropped fields and mappings) -- this duplicates and supersedes the original

- **Lines 125-147**: Section 3 "Hook Architecture" (original)
- **Lines 590-627**: Section 3 "Hook and Binary Architecture" (revised, expanded with brain-skills) -- this duplicates and supersedes the original

- **Lines 148-170**: Section 4 "Adapter Architecture" (original)
- **Lines 629-661**: Section 4 "Adapter Architecture" (revised, expanded) -- this duplicates and supersedes the original

- **Lines 179-189**: Section 6 "Parallel Agent Execution" (original)
- **Lines 663-681**: Section 6 "Parallel Agent Execution" (revised, expanded) -- this duplicates and supersedes the original

- **Lines 272-300**: Section 8 "Migration Path" (original)
- **Lines 683-733**: Section 8 "Migration Path" (revised, adds Phase 0) -- this duplicates and supersedes the original

- **Lines 303-311**: Section 9 "PowerShell Script Portability" (original)
- **Lines 736-758**: Section 9 "Skill Script Portability" (revised, expanded) -- this duplicates and supersedes the original

The architect appears to have appended revised sections without removing the originals. The ADR must be consolidated to have each section appear once with the revised content. The current state is confusing and makes the document appear unfinished.

### Issue S2: Missing Sections 5, 7, 10, 11 from Revised Content

The revised content adds new sections (1-4, 6, 8, 9) but the following sections from the original ADR are NOT duplicated in the revised section:

- Section 5 (Emoji Prefix Visibility) -- original at lines 171-178
- Section 7 (Install/Uninstall Architecture) -- original at lines 191-270
- Section 10 (Version Compatibility and CI Validation) -- original at lines 313-318
- Section 11 (Agent Body Content Strategy) -- referenced in Section 1 tree as "see Section 11" but no Section 11 exists

Either these sections are unchanged (fine, but the numbering is inconsistent with revised sections) or Section 11 was planned but not written yet.

### Issue S3: Heading Format Inconsistency

The revised sections use double headings:

```
## 1. Root-Level Canonical Content
### 1. Root-Level Canonical Content
```

This creates redundant adjacent headings. The format should be consistent: either `## Section Title` or `### N. Section Title`, not both.

---

## Section 3: FEAT-001 Compliance Check

### Check 3A: ADR-001 Format Compliance

**Status**: [PASS] (current state)

FEAT-001 follows the ADR-001 unified feature artifact structure:

- Feature-centric directory: `features/FEAT-001-multi-tool-compatibility/`
- Index file: `FEAT-001-multi-tool-compatibility.md` with source-refs
- Sub-directories: `requirements/`, `design/`, `tasks/`
- No phase files (phases documented inline in index, which is allowed)
- Proper REQ/DESIGN/TASK prefixes
- Kebab-case filenames throughout

### Check 3B: FEAT-001 Content Alignment with ADR-002 r5

**Status**: [FAIL] -- FEAT-001 has NOT been updated

FEAT-001 was NOT revised to match ADR-002 r5. Specific misalignments:

1. **Missing Phase 0**: FEAT-001 lists 4 phases. ADR-002 r5 adds Phase 0 (Schema and Validation Spikes). FEAT-001 has no Phase 0 tasks.

2. **Missing tasks from ANALYSIS-010 recommendations**:
   - No TASK-000 (Emoji Validation Spike, moved to Phase 0)
   - No TASK-001A (Define Canonical Frontmatter Schema)
   - No TASK-002A (Audit and Canonicalize Agent Definitions)
   - No TASK-006A (Analyze brain-hooks Binary Functionality)
   - No TASK-011A (Testing Infrastructure Spike)
   - No TASK-017 (brain claude Launch Wrapper, filling gap)

3. **Missing tasks from ADR-002 r5 new scope**:
   - No task for brain-skills binary porting (3 commands)
   - No task for instructions/protocols extraction and canonicalization
   - No task for agent body overlay creation
   - No task for MCP config templating
   - No task for plugin metadata generation
   - No task for parity test harness creation
   - No task for CLAUDE.md update (old paths)

4. **Task 17 gap**: Still missing between TASK-016 and TASK-018

5. **Effort estimates**: Not updated to reflect Phase 0 addition, brain-skills porting, canonicalization work, overlay creation

This is the primary blocking issue. Task #6 (Revise FEAT-001) is still pending completion.

### Check 3C: All Filenames Kebab-Case

**Status**: [PASS]

All FEAT-001 artifact files use kebab-case:

- `FEAT-001-multi-tool-compatibility.md`
- `REQ-001-canonical-content-extraction.md` through `REQ-007-parallel-agent-execution.md`
- `DESIGN-001-adapter-architecture.md` through `DESIGN-004-staging-and-manifest.md`
- `TASK-001-create-root-level-directory-scaffold.md` through `TASK-026-documentation-updates.md`

---

## Section 4: Community Best Practices (from ANALYSIS-008)

### Check 4A: Skills Zero-Transform

**Status**: [PASS]

ADR-002 r5 Section 4 adapter table confirms skills "Copy as-is (SKILL.md universal)" for all tools. The Open Agent Skills standard is correctly identified as the cross-tool portability layer.

### Check 4B: Vercel Findings Incorporated

**Status**: [PASS]

ADR-002 r5 references community patterns (Section 1, line 483: "Vercel agent-skills, AGENTS.md standard with 60,000+ project adoption"). The root-level canonical content approach aligns with Vercel's skill structure and the AGENTS.md standard's recommendation.

### Check 4C: Community consensus on hybrid staging

**Status**: [PASS]

ADR-002 r5 Section 7 preserves the hybrid staging + adaptive write approach validated by ANALYSIS-008 Q10 (npx skills, skills-supply, Skills Hub all use this pattern).

---

## Section 5: Backward Compatibility Check

### Check 5A: No backward compat references remain

**Status**: [PASS]

ADR-002 r5 consistently enforces clean break:

- "Clean break. No migration from old structure." (Section 8)
- "brain plugin install and brain plugin uninstall are removed" (Section 7)
- "apps/claude-plugin/ is REMOVED" (Section 1)
- No aliases, shims, or migration paths documented

---

## Section 6: Open Questions (Inherited from ANALYSIS-010)

### DECISION-1: Gemini Parallel Execution

**Status**: Properly surfaced as PENDING USER DECISION in Section 6

### DECISION-2: Dual Adapter Implementation vs Single Source

**Status**: Properly surfaced as PENDING DECISION in Section 4

### DECISION-3: Agent Body Canonicalization Strategy

**Status**: [RESOLVED] -- ADR-002 r5 chose option (c): separate overlay files per tool (`agents/overlays/{tool}/`). This is a good choice as it keeps canonical bodies clean and makes tool-specific content explicit and auditable.

### DECISION-4: Codex CLI Future

**Status**: Deferred (kept as-is per ADR-002 Scope section)

---

## Final Verdict: REVISE

### Blocking Issues (Must Fix Before Implementation)

1. **FEAT-001 not revised** (Check 3B): FEAT-001 does not reflect ADR-002 r5 architecture. Missing Phase 0, 7+ new tasks, effort estimate updates. Task #6 must complete.

2. **ADR-002 structural duplication** (Issue S1): 8 sections appear twice (original + revised). Must consolidate into a single coherent document. The current state is an in-progress work product, not a finished ADR.

3. **Missing Section 11** (Issue S2): Section 1 directory tree references "see Section 11" for agent body content strategy, but Section 11 does not exist.

### Recommended Revisions (Should Fix)

1. **skills/CLAUDE.md gap** (Section 1): Need a tool-neutral skill development guide or at least document the gap in FEAT-001.

2. **Heading format cleanup** (Issue S3): Remove duplicate `## N.` / `### N.` heading pairs throughout revised sections.

3. **Section 5, 7, 10 status**: Clarify whether these original sections are unchanged or need revision to match the expanded content in other sections.

### What is Working Well

- Canonical frontmatter schema is complete and well-designed (Section 2 revised)
- Binary porting scope is now fully documented for both brain-hooks and brain-skills (Section 3 revised)
- Agent overlay mechanism cleanly separates canonical from tool-specific content (Section 1/4 revised)
- Phase 0 addition correctly front-loads validation spikes before extraction work
- Community alignment is strong (root-level content, hybrid staging, Open Agent Skills)
- Security section remains comprehensive
- All 3 HIGH gaps from ANALYSIS-010 are addressed
- All 5 MEDIUM gaps from ANALYSIS-010 are addressed (except TASK-017 which is a FEAT-001 issue)

### Path to APPROVE

1. Architect consolidates ADR-002 (remove duplicate sections, add Section 11, fix headings)
2. Planner completes FEAT-001 revision (add Phase 0 tasks, new tasks from audit, fill TASK-017 gap, update effort estimates)
3. Final review of consolidated ADR-002 + revised FEAT-001

## Observations

- [decision] REVISE verdict: ADR-002 r5 content is sound but document has structural issues from revision process #verdict
- [fact] ADR-002 grew from 457 to 660 lines (r4 to r5) addressing 8 of 11 validation brief gaps #coverage
- [fact] FEAT-001 remains unchanged at 202 lines -- has not been revised by planner yet #blocking
- [fact] 8 sections appear twice in ADR-002 r5 (original + revised appended) creating duplication #structural
- [risk] Section 11 (agent body content strategy) referenced but does not exist in ADR-002 #missing
- [insight] The overlay approach for agent body content (agents/overlays/{tool}/) is a clean architectural choice #positive
- [insight] Phase 0 correctly front-loads validation spikes that would otherwise block Phase 1 #positive
- [fact] All 3 HIGH-severity gaps from ANALYSIS-010 are addressed in ADR-002 r5 #coverage
- [fact] All 5 MEDIUM-severity gaps from ANALYSIS-010 are addressed in ADR-002 r5 #coverage
- [problem] ADR-002 r5 is an in-progress document not yet consolidated into final form #structural

## Relations

- reviews [[ADR-002-multi-tool-compatibility-architecture]]
- reviews [[FEAT-001 Multi-Tool Compatibility]]
- follows_up [[CRIT-002-revised-adr-plan-review]]
- follows_up [[CRIT-001-multi-tool-architecture-critique]]
- validates [[ANALYSIS-010 Consolidated Validation Brief]]
- validates [[ANALYSIS-009-codebase-gap-audit]]
- validates [[ANALYSIS-008-community-validation-research]]
