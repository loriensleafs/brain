---
title: Memory Architecture Clarification
type: analysis
date: 2026-01-21
status: proposal
---

# Memory Architecture Clarification

## Context

User clarification received on 2026-01-21 regarding agent artifact storage:

1. Notes should NOT be written to both `.agents/` and Brain memory
2. Notes do NOT need to be git-versioned by default
3. If a project WANTS git-versioned notes, configure Brain project with `notes_path: "CODE"`
4. Agents should ONLY write to Brain memory

## Current State Analysis

### Brain MCP Storage Modes

From `apps/mcp/src/tools/projects/create/schema.ts`:

| Mode | Storage Location | Git-Versioned |
|------|------------------|---------------|
| DEFAULT | `~/memories/{project-name}/` | No |
| CODE | `{code_path}/docs/` | Yes |
| Custom | Any absolute path | Depends |

### `.agents/` Folder Status

- Contains 100+ files across multiple categories
- Currently 25+ agent files contain `.agents/` path references
- Serves as: session logs, ADRs, analysis, planning, QA, security, specs

### Dual-Write Pattern (DEPRECATED)

Current agents write to:

1. `.agents/` folder (filesystem)
2. Brain memory (via MCP tools)

User clarification: This pattern should be eliminated.

## Decision: Single-Write to Brain Memory

### Storage Model

```text
Agent → Brain MCP → Physical Storage (based on project config)
                    ├── DEFAULT: ~/memories/{project}/
                    ├── CODE: {code_path}/docs/
                    └── Custom: {specified_path}/
```

### Folder Mapping (Brain Memory)

| Legacy `.agents/` Path | Brain Folder | Entity Type |
|------------------------|--------------|-------------|
| `.agents/architecture/` | decisions/ | decision (ADR) |
| `.agents/analysis/` | analysis/ | analysis |
| `.agents/planning/` | planning/ | feature, plan |
| `.agents/critique/` | critique/ | critique |
| `.agents/qa/` | qa/ | test-report |
| `.agents/security/` | security/ | security |
| `.agents/retrospective/` | retrospective/ | retrospective |
| `.agents/roadmap/` | roadmap/ | epic |
| `.agents/sessions/` | sessions/ | session |
| `.agents/skills/` | skills/ | skill |
| `.agents/specs/` | specs/ | requirement, design, task |

## `.agents/` Folder Purpose

### Original Purpose (Legacy)

Before Brain memory existed, `.agents/` was the artifact storage location. This was:

- Git-versioned (always)
- File-based (direct writes)
- Agent-managed (each agent had write permissions)

### Future Purpose (Options)

| Option | Description | Recommendation |
|--------|-------------|----------------|
| A. Migrate All | Move content to Brain, delete folder | High effort |
| B. Freeze Legacy | Keep as read-only, Brain-only forward | **Recommended** |
| C. Delete | Remove folder, start fresh | Risk of lost context |

### Recommendation: Option B - Freeze Legacy

Rationale:

1. Preserves historical context without migration complexity
2. Clean break for new work
3. Gradual deprecation reduces risk
4. Git history preserves content if needed

## Agent Instruction Template (Revised)

### REMOVE Pattern

```markdown
## Output Location

`.agents/architecture/decision/`

- `ADR-NNNN-[decision].md` - Architecture Decision Records

Save to: `.agents/architecture/ADR-NNNN-[decision-name].md`
```

### USE Pattern

```markdown
## Output

Use Brain memory skill to save artifacts:

**For ADRs**:
- Folder: `decisions/`
- Title: `ADR-NNNN [Decision Name]`
- Type: decision

Example:
```text
mcp__plugin_brain_brain__write_note
folder: "decisions"
title: "ADR-001 Database Selection"
content: "[ADR content with frontmatter, observations, relations]"
```

```

### Direct Write (All Agents)

All agents can write directly after completing pre-flight validation:

```text
# All agents can write - no delegation required
# Complete pre-flight validation checklist first
mcp__plugin_brain_brain__write_note
folder: "decisions"
title: "ADR-001 Database Selection"
content: "[ADR content with frontmatter, observations, relations]"
```

**Note**: Per ADR-019, delegation to memory agent is NOT required. All agents retain write access and use validation-based governance.

## Enforcement Approach (Simplified)

### Previous (Complex)

1. Agents write to `.agents/`
2. Also write to Brain memory
3. Validate both locations match
4. CI checks file paths

### New (Simple)

1. Agents write to Brain memory ONLY
2. Physical storage determined by project config
3. No dual-write validation needed
4. No `.agents/` path enforcement needed

### Constraints Update

**Remove from agent instructions**:

- `Save to: .agents/...` patterns
- `Edit only .agents/...` constraints
- File path specifications for artifacts

**Add to agent instructions**:

- `Use Brain memory skill for artifact persistence`
- `Complete pre-flight validation before writes`
- `Physical storage controlled by project configuration`

## Files Requiring Updates

Based on grep analysis, these files contain `.agents/` references:

### High Priority (Agent Definitions)

| File | Reference Count | Update Type |
|------|-----------------|-------------|
| architect.md | 8 | Remove `.agents/` paths |
| planner.md | 6 | Remove `.agents/` paths |
| analyst.md | 3 | Remove `.agents/` paths |
| critic.md | 4 | Remove `.agents/` paths |
| qa.md | 7 | Remove `.agents/` paths |
| security.md | 6 | Remove `.agents/` paths |
| implementer.md | 4 | Remove `.agents/` paths |
| retrospective.md | 5 | Remove `.agents/` paths |
| roadmap.md | 4 | Remove `.agents/` paths |
| orchestrator.md | 25+ | Major update |
| spec-generator.md | 10+ | Remove `.agents/` paths |
| pr-comment-responder.md | 20+ | Major update |

### Medium Priority (Protocols)

| File | Update Type |
|------|-------------|
| SESSION-PROTOCOL.md | Update artifact paths |
| AGENT-SYSTEM.md | Update directory catalog |
| AGENT-INSTRUCTIONS.md | Update file references |

### Low Priority (Prompts/Templates)

| File | Update Type |
|------|-------------|
| SESSION-END-PROMPT.md | Update paths |
| SESSION-START-PROMPT.md | Update paths |
| templates/*.md | Update references |

## Migration Plan

### Phase 1: Document Decision (This Document)

- [x] Clarify storage architecture
- [x] Document folder mapping
- [x] Identify affected files

### Phase 2: Update Agent Instructions

For each agent:

1. Remove `.agents/` output paths
2. Add Brain memory skill usage
3. Add memory agent delegation option
4. Update constraints section

### Phase 3: Update Protocols

1. SESSION-PROTOCOL.md - Remove `.agents/` requirements
2. AGENT-SYSTEM.md - Update directory catalog
3. Validation scripts - Remove `.agents/` checks

### Phase 4: Freeze Legacy

1. Add `.agents/README.md` marking folder as legacy
2. Remove write permissions from agents
3. Keep for historical reference

## Verification

After updates, verify:

1. No agent contains `Save to: .agents/` instructions
2. All agents use Brain memory skill or memory agent delegation
3. SESSION-PROTOCOL does not require `.agents/` writes
4. Validation scripts do not check `.agents/` paths

## Summary

| Aspect | Old Approach | New Approach |
|--------|--------------|--------------|
| Storage | `.agents/` filesystem | Brain memory |
| Git versioning | Always | Project config (CODE mode) |
| Agent writes | Direct file writes | Brain MCP tools |
| Path management | Agents specify paths | Brain project config |
| Dual-write | Yes (filesystem + memory) | No (memory only) |
| Enforcement | Path validation | None needed |
