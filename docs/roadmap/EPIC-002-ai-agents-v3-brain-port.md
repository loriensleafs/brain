---
title: EPIC-002-ai-agents-v3-brain-port
type: epic
permalink: roadmap/epic-002-ai-agents-v3-brain-port
status: IN_PROGRESS
created: 2026-03-11
tags:
- epic
- conversion
- ai-agents
- brain
- port
---

# EPIC-002 ai-agents v3.0 Brain Port

## Objective

Port ai-agents v3.0 agents, skills, hooks, and commands to Brain, replacing half-baked Brain ports with battle-tested ai-agents implementations. Use Brain search/notes/memories as the backend. Convert all Python/PowerShell to pure Bun TypeScript.

## Scope

| Category | Count | Scripts to Convert |
|---|---|---|
| Agents | 18 (16 replace + 2 enhance) | 0 |
| Skills | 32 (13 replace + 11 new + 8 additional) | ~30 |
| Hooks | 25 Python scripts | 25 |
| Hook utilities | 2 Python files | 2 |
| Commands | ~20 | 0 |
| AGENTS.md | 1 complete redesign | 0 |
| Config files | 3 (brain.config.json, mcp.json, tools.config.yaml) | 0 |
| Plugin install fix | Go code | 0 |
| Total | ~100 items | ~57 scripts |

## Prior Art

- Batches 1-2 completed: 3 agents, 8 skills, 14 TypeScript scripts (patterns established)
- All decisions recorded in [[ADR-025-ai-agents-skill-conversion-decisions]]

## Phases

### Phase 0: Setup [COMPLETE]
- Clear/populate staging area with all ai-agents files

### Phase 1: Hook Utilities [COMPLETE]
- Convert guards.py and utilities.py to Bun TypeScript

### Phase 2: Agents (21 total, all converted) [COMPLETE]
- 2A: adr-generator, context-retrieval, critic, devops, explainer
- 2B: high-level-advisor, independent-thinker, backlog-generator, issue-feature-review, skillbook
- 2C: planner, qa, retrospective, roadmap, security
- 2D: spec-generator, task-generator, orchestrator (Agent Teams conditional)
- 2E: memory agent enhancements (4 features), memory skill enhancements (5 features)

### Phase 3: Skills (46 total, all converted) [COMPLETE]
- 3A: Replacements with scripts (7): decision-critic, planner, slashcommandcreator, steering-matcher, session, session-log-fixer, security-detection
- 3B: Replacements without scripts (7): doc-sync, exploring-knowledge-graph, incoherence, curating-memories, memory-documentary, research-and-incorporate, pr-comment-responder
- 3C: New HIGH value (7): buy-vs-build-framework, chestertons-fence, threat-modeling, pre-mortem, reflect, session-init, session-end
- 3D: New MEDIUM value (4): doc-coverage, metrics, style-enforcement, execution-plans
- 3E: Additional from deep analysis (8): git-advanced-workflows, github-url-intercept, merge-resolver, security-scan, taste-lints, analysis-provenance, pipeline-validator, validation-authority
- 3F: Serena skills (3): code-architecture, repo-encoder, code-symbols (rename, swap memory only)
- 3G: SkillForge (1): 5 scripts

### Phase 4: Hooks (25 scripts converted + settings.json) [COMPLETE]
- 4A: SessionStart (4 scripts)
- 4B: PreToolUse (10 scripts)
- 4C: Other lifecycle (6 scripts)
- 4D: New lifecycle events + settings.json (2 scripts + config)
- 4E: Context initialization redesign (bootstrap_context integration)

### Phase 5: Commands (23 files converted) [COMPLETE]
- 5A: Workflow commands (6): 0-init, 1-plan, 2-impl, 3-qa, 4-security, 9-sync
- 5B: Other commands (8+): context-gather, push-pr, pr-review, pr-quality/*, memory-*, research

### Phase 6: AGENTS.md Redesign (277 lines, compact navigation hub) [COMPLETE]
- Complete rewrite as compact navigation hub (200-300 lines)
- @import detail sections
- Agent catalog, skill catalog, hook behavior summary

### Phase 7: Configuration Updates (brain.config.json v2.0 + mcp.json with Serena) [COMPLETE]
- brain.config.json: all agent entries + new skills
- mcp.json: add Serena MCP server
- tools.config.yaml: verify frontmatter fields

### Phase 8: Plugin Installation Fix (version field added, tests pass) [COMPLETE]
- Fix version "unknown" bug in Go installer
- Fix name consistency (🧠)
- Fix directory-source update mechanism

### Phase 9: Integration (364 files, 53K insertions) [COMPLETE]
- Move staging to brain/templates/
- Run brain install
- Verify Claude Code loads correctly
- Full remnant scan

## Key Decisions

See [[ADR-025-ai-agents-skill-conversion-decisions]] for all 65+ decisions.

## Conversion Rules (Established)

1. All Python/PowerShell to pure Bun TypeScript (no Node)
2. All code examples to TypeScript
3. Serena/Memory Router/Forgetful to Brain MCP search/notes
4. ai-agents paths (.agents/, .serena/) to Brain memory folders (decisions/, analysis/, etc.)
5. milestone-planner to planner, task-decomposer to task-generator
6. Agent frontmatter stripped (goes in brain.config.json)
7. Memory skill mandate added to agents that write notes
8. ${CLAUDE_SKILL_DIR} for script paths
9. gh CLI replaces GitHub skill scripts
10. DeepWiki kept as optional, Context7/Perplexity removed

## Observations

- [fact] 57 Python/PowerShell scripts need conversion to Bun TypeScript #scale
- [fact] Established patterns from batches 1-2 apply uniformly to all remaining work #patterns
- [fact] Orchestrator is largest single file (~78KB), needs Agent Teams conditional #orchestrator
- [decision] Brain search/notes/memories is the ONLY backend -- all ai-agents memory mechanisms replaced #architecture
- [decision] ai-agents v3.0 content stays as intact as possible -- only change what's needed for Brain backend #philosophy
- [decision] Hooks: adopt ai-agents architecture (individual scripts per behavior), convert to Bun TypeScript #hooks
- [decision] AGENTS.md: complete redesign as compact navigation hub #agents-md

## Relations

- implements [[ADR-025-ai-agents-skill-conversion-decisions]]
- relates_to [[SESSION-2026-03-11_01-ai-agents-skill-conversion]]