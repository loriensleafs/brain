---
title: ANALYSIS-009-codebase-gap-audit
type: note
permalink: analysis/analysis-009-codebase-gap-audit
tags:
- audit
- multi-tool
- gap-analysis
- phase-1
---

# ANALYSIS-009 Codebase Gap Audit

## Summary

Full inventory of `apps/claude-plugin/` compared against ADR-002 and FEAT-001 planned architecture. Identifies every file, categorizes what ADR-002 accounts for vs gaps requiring new tasks.

## 1. Agents (25 files in agents/)

### Inventory

| Agent | Lines | Model | Claude-Specific Refs | Frontmatter Fields |
|:--|:--|:--|:--|:--|
| orchestrator | 2312 | claude-opus-4-6[1m] | 85 | name, description, model, memory, color, argument-hint, tools, skills |
| pr-comment-responder | 1569 | sonnet | 16 | name, description, model, memory, color, argument-hint, tools, skills |
| retrospective | 1441 | sonnet | 11 | name, description, model, memory, color, argument-hint, tools, skills |
| memory | 808 | claude-opus-4-6[1m] | 41 | name, description, model, memory, color, argument-hint, tools, skills |
| import-memories | 772 | claude-opus-4-6[1m] | 16 | name, description, model (no memory, color, argument-hint) |
| qa | 693 | claude-opus-4-6[1m] | 5 | name, description, model, memory, color, argument-hint, tools, skills |
| planner | 615 | claude-opus-4-6[1m] | 8 | name, description, model, memory, color, argument-hint, tools, skills |
| implementer | 608 | claude-opus-4-6[1m] | 9 | name, description, model, memory, color, argument-hint, tools, skills |
| security | 523 | (missing) | 4 | name, description, memory, argument-hint (missing model, color) |
| critic | 507 | claude-opus-4-6[1m] | 7 | name, description, model, memory, color, argument-hint, tools, skills |
| spec-generator | 502 | claude-opus-4-6[1m] | 10 | name, description, model, memory, color, argument-hint, tools, skills |
| architect | 494 | claude-opus-4-6[1m] | 7 | name, description, model, memory, color, argument-hint, tools, skills |
| technical-writer | 446 | sonnet | 4 | name, description, model, memory, color, tools |
| prompt-builder | 437 | claude-opus-4-6[1m] | 0 | name, description, model, memory, color, tools |
| analyst | 429 | claude-opus-4-6[1m] | 6 | name, description, model, memory, color, argument-hint, tools, skills |
| roadmap | 401 | claude-opus-4-6[1m] | 6 | name, description, model, memory, color, argument-hint, tools, skills |
| explainer | 371 | claude-opus-4-6[1m] | 8 | name, description, model, memory, color, argument-hint, tools, skills |
| task-generator | 348 | claude-opus-4-6[1m] | 9 | name, description, model, memory, color, argument-hint, tools, skills |
| high-level-advisor | 312 | claude-opus-4-6[1m] | 8 | name, description, model, memory, color, argument-hint, tools, skills |
| skillbook | 299 | haiku | 13 | name, description, model, memory, color, argument-hint, tools |
| independent-thinker | 292 | claude-opus-4-6[1m] | 7 | name, description, model, memory, color, argument-hint, tools, skills |
| adr-generator | 250 | claude-opus-4-6[1m] | 7 | name, description, model, memory, color, tools |
| context-retrieval | 248 | sonnet | 11 | name, description, model, memory, color, tools |
| janitor | 128 | haiku | 0 | name, description, model, memory, color, tools |
| debug | 106 | opus | 0 | name, description, model, memory, color, tools |

### Frontmatter Gap Analysis

- [fact] ADR-002 canonical schema defines: name, display_name, description, model, tools, parallel, tags #frontmatter-gap
- [fact] Current agents use fields NOT in canonical schema: memory, color, argument-hint, skills #frontmatter-gap
- [fact] Current agents are MISSING canonical fields: display_name, parallel, tags #frontmatter-gap
- [fact] 298 total Claude-specific API references (mcp__plugin_brain_brain__*, Teammate(), TaskCreate, etc.) across 22 agent bodies #claude-coupling
- [fact] 3 agents missing model field entirely: security (also missing color), import-memories (missing memory, color, argument-hint) #incomplete-frontmatter
- [fact] Model values are Claude-specific strings: claude-opus-4-6[1m], sonnet, haiku, opus #model-coupling

### ADR-002 Coverage

- [decision] ADR-002 Section 2 defines canonical frontmatter transform but does not account for: memory, color, argument-hint, skills fields #gap
- [insight] The `memory` field (per-agent persistent memory path) has no Cursor/Gemini equivalent identified #gap
- [insight] The `skills` field lists agent capabilities; adapters would need to decide whether to map or strip these #gap
- [insight] The `color` field is Claude Code Agent Teams UI; other tools may not have per-agent color support #gap

## 2. Instructions System (4 files, 148KB total)

| File | Lines | Bytes | Claude-Specific Refs |
|:--|:--|:--|:--|
| AGENTS.md | 851 | 40,120 | 36 |
| AGENT-SYSTEM.md | 1,849 | 48,635 | 4 |
| SESSION-PROTOCOL.md | 841 | 39,681 | 10 |
| AGENT-INSTRUCTIONS.md | 731 | 19,635 | 2 |
| **TOTAL** | **4,272** | **148,071** | **52** |

### ADR-002 Coverage

- [fact] ADR-002 Section 4 says: "Instructions: Generate CLAUDE.md from AGENTS.md sections / Generate .cursor/rules/ / Generate GEMINI.md" #covered-conceptually
- [problem] ADR-002 does not address protocols/ subdirectory (3 files, 107KB) at all #gap
- [problem] No task in FEAT-001 addresses splitting/adapting the protocols for Cursor/Gemini #gap
- [insight] AGENTS.md is the main CLAUDE.md -- it references protocols via relative paths. Adapters must either inline or map these references #gap
- [fact] SESSION-PROTOCOL.md references Claude-specific concepts: Validate-SessionProtocol.ps1, .agents/ directory structure, Brain MCP tools #claude-coupling
- [fact] AGENT-SYSTEM.md (48KB) contains the full agent persona catalog with Claude-specific routing patterns #claude-coupling

## 3. Go Binaries (2 binaries, 2 source directories)

### brain-hooks binary (cmd/hooks/)

| File | Lines | Purpose |
|:--|:--|:--|
| main.go | 51 | CLI dispatch (8 subcommands) |
| session_start.go | 670 | Initialize session, bootstrap context, git context |
| gate_check.go | 174 | Mode-based tool gating (coding/analysis/planning) |
| analyze.go | 453 | Step-by-step codebase analysis workflow |
| load_skills.go | 229 | Load SKILL.md files for scenario matching |
| user_prompt.go | 87 | Process user prompt for scenario detection |
| detect_scenario.go | 60 | Delegate scenario detection to validation package |
| pre_tool_use.go | 57 | Check tool allowed in current mode |
| stop.go | 87 | Validate session before ending |
| validate_session.go | 77 | Validate session protocol compliance |
| project_resolve.go | 59 | Resolve Brain project from CWD |
| **Tests** | | |
| session_start_test.go | 1,797 | Session start tests |
| gate_check_test.go | 664 | Gate check tests |
| project_resolve_test.go | 208 | Project resolve tests |

**Subcommands**: session-start, user-prompt, pre-tool-use, stop, detect-scenario, load-skills, analyze, validate-session

**Shared packages imported**:

- `github.com/peterkloss/brain/packages/utils` (project resolution)
- `github.com/peterkloss/brain/packages/validation` (scenario detection, session validation)

**Compiled sizes**: brain-hooks root = 3.3MB, cmd/hooks/hooks = 5.2MB, hooks/scripts/brain-hooks = 5.2MB (symlink target)

### brain-skills binary (cmd/skills/)

| File | Lines | Purpose |
|:--|:--|:--|
| main.go | 46 | CLI dispatch (3 subcommands) |
| incoherence.go | 199 | 22-step incoherence detection workflow |
| decision_critic.go | 162 | 7-step decision criticism workflow |
| fix_fences.go | 219 | Fix malformed markdown fence closings |

**Subcommands**: incoherence, decision-critic, fix-fences

**No shared package imports** (uses only stdlib)

**Compiled size**: brain-skills = 3.5MB

### ADR-002 Coverage

- [fact] ADR-002 Section 3 says "JS/TS hook scripts replace Go brain-hooks binary" #covered
- [problem] ADR-002 does not mention brain-skills binary at all #gap
- [problem] brain-skills has 3 commands (incoherence, decision-critic, fix-fences) that also have Python script equivalents in skills/ -- porting strategy unclear #gap
- [problem] brain-hooks imports packages/utils and packages/validation -- these Go packages would also need TS equivalents for hook port #gap
- [insight] 2,669 lines of test code (3 test files) would need equivalent TS tests #gap
- [fact] hooks/scripts/brain-hooks is a 5.2MB compiled binary copied to hooks directory for runtime use #binary-in-plugin

## 4. Hooks Configuration

- [fact] hooks.json defines 3 Claude Code hook events: UserPromptSubmit, SessionStart, Stop #hooks
- [fact] All hooks invoke `${CLAUDE_PLUGIN_ROOT}/hooks/scripts/brain-hooks` with subcommand #hooks
- [fact] ADR-002 identifies 4 Claude events, 21 Cursor events, 11 Gemini events #hook-mapping
- [problem] hooks.json uses CLAUDE_PLUGIN_ROOT env var -- Claude-specific runtime #claude-coupling
- [fact] pre-tool-use command exists in binary but is not wired in hooks.json #unused-hook

## 5. Commands (9 files)

| Command | Description |
|:--|:--|
| bootstrap.md | Session bootstrap |
| start-session.md | Start new session |
| end-session.md | End session |
| pause-session.md | Pause session |
| resume-session.md | Resume session |
| mode.md | Switch workflow mode |
| planning-agent.md | Launch planning agent |
| research-agent.md | Launch research agent |
| spec.md | Generate spec |

- [fact] ADR-002 Section 4 says commands copy as-is for Claude/Cursor, convert to TOML for Gemini #covered
- [problem] No FEAT-001 task specifically addresses command TOML conversion tooling #gap

## 6. Skills (24 skills + 1 CLAUDE.md)

### Skills with Scripts

| Skill | PowerShell (.ps1/.psm1) | Python (.py) | TypeScript (.ts) |
|:--|:--|:--|:--|
| adr-review | 1 (Detect-ADRChanges.ps1) | - | - |
| decision-critic | - | 1 | - |
| fix-markdown-fences | 1 | 1 | - |
| incoherence | - | 1 | - |
| memory | 7 (.ps1) + 2 (.psm1) | - | 2 |
| planner | - | 2 | - |
| security-detection | 1 | 1 | - |
| session | 1 | - | - |
| slashcommandcreator | 2 + 1 test | - | - |
| steering-matcher | 1 | - | - |
| SkillForge | - | 5 + 1 template | - |
| **TOTALS** | **15 .ps1 + 2 .psm1** | **12** | **2** |

### Skills without Scripts (Markdown-only)

analyze, curating-memories, doc-sync, exploring-knowledge-graph, memory-documentary, pr-comment-responder, programming-advisor, prompt-engineer, research-and-incorporate, serena-code-architecture, session-log-fixer, using-forgetful-memory

### ADR-002 Coverage

- [fact] ADR-002 Section 9 says PowerShell scripts stay as-is for Phase 1-2, evaluate Python/Bash alternatives for Gemini in Phase 3 #covered
- [fact] Open Agent Skills standard (SKILL.md) adopted by all 3 tools per ADR-002 #covered
- [problem] skills/CLAUDE.md (76 lines) is a Claude Code-specific skill development guide -- needs tool-neutral equivalent #gap
- [fact] SkillForge has 13 PNG images (binary assets) -- these move as-is but add to plugin install size #observation

## 7. Plugin Metadata (.claude-plugin/)

| File | Content |
|:--|:--|
| plugin.json | Name "brain emoji", description, author |
| marketplace.json | Name, owner, plugins array with source "./" |

- [fact] ADR-002 Section 7 mentions marketplace registration handled by Claude Code adapter #covered
- [problem] No equivalent registration mechanism defined for Cursor or Gemini in ADR-002 #gap

## 8. MCP Configuration (.mcp.json)

- [fact] Hardcoded absolute path: `/Users/peter.kloss/Dev/brain/apps/mcp/src/index.ts` #hardcoded-path
- [fact] Uses bun runtime with BRAIN_TRANSPORT=stdio env var #mcp
- [fact] ADR-002 Section 4 says each tool gets its own MCP config generation #covered
- [problem] Current .mcp.json has hardcoded user path -- adapter must generate with user's actual paths #gap

## 9. Legacy/Variant Files

| File | Size | Status |
|:--|:--|:--|
| _bootstrap.md | 1KB | Untracked (git status shows ??) |
| _orchestrator.md | 93KB | Untracked, modified |
| instructions/_AGENTS.md | 30KB | Ignore per user |

- [fact] _bootstrap.md and_orchestrator.md appear to be agent-teams mode variants #legacy
- [fact] ADR-002 Section 6 says agent-teams variants move to agents/variants/claude-code/ #covered

## 10. Other Files

| File | Purpose | ADR-002 Status |
|:--|:--|:--|
| go.mod + go.sum | Go module definition for hooks/skills binaries | Removed with binary port |
| .gitignore | Ignores compiled Go binaries | Removed with binary port |
| .DS_Store files (5) | macOS metadata | Not relevant |
| docs/ (empty dir) | Unused directory | Not relevant |
| hooks/scripts/**tests**/integration-test.sh | Hook integration test | Needs TS equivalent |
| skills/memory/scripts/node_modules/ | Installed npm packages for TS scripts | Build artifact |
| skills/memory/scripts/package.json | NPM deps for memory TS scripts | Move to root |
| skills/memory/scripts/tsconfig.json | TS config for memory scripts | Move to root |
| skills/memory/spec/skill-specification.xml | Memory skill XML spec | Move as-is |

## Summary of Gaps (Not Covered by ADR-002 or FEAT-001)

### Critical Gaps

1. **Protocols system** (107KB, 3 files) -- ADR-002 does not address how protocols/ adapts for Cursor/Gemini
2. **brain-skills binary** -- ADR-002 only mentions brain-hooks port, not brain-skills
3. **Agent frontmatter fields** -- memory, color, argument-hint, skills not in canonical schema
4. **Go shared package dependencies** -- packages/utils and packages/validation used by hooks need TS equivalents
5. **2,669 lines of Go test code** -- No task for porting tests to TS

### Moderate Gaps

1. **skills/CLAUDE.md** -- Claude-specific skill dev guide needs tool-neutral version
2. **Command TOML conversion** -- ADR-002 mentions it, no FEAT-001 task for tooling
3. **Plugin registration for Cursor/Gemini** -- marketplace.json equivalent undefined
4. **MCP config path generation** -- Current .mcp.json has hardcoded user path
5. **pre-tool-use hook** -- Exists in binary but not wired in hooks.json

### Minor Gaps

1. **Empty docs/ directory** -- Clean up during extraction
2. **hook integration test** (integration-test.sh) -- Needs TS equivalent
3. **memory skill npm artifacts** (package.json, tsconfig.json, node_modules/) -- Build artifact handling during move

## Observations

- [fact] 25 agents with 14,911 total lines, 298 Claude-specific API references across bodies #agents
- [fact] 148KB instruction system (4 files, 4,272 lines) with 52 Claude-specific references #instructions
- [fact] 2 Go binaries: brain-hooks (8 commands, 5,299 lines source+test) and brain-skills (3 commands, 626 lines) #go-binaries
- [fact] brain-hooks imports packages/utils and packages/validation shared Go packages #dependencies
- [fact] 24 skills with 15 PowerShell scripts, 2 PowerShell modules, 12 Python scripts, 2 TypeScript scripts #skills
- [fact] 9 slash commands in markdown format #commands
- [problem] ADR-002 does not address brain-skills binary (3 commands: incoherence, decision-critic, fix-fences) #gap
- [problem] ADR-002 does not address protocols/ subdirectory (107KB, 3 files) adaptation strategy #gap
- [problem] 4 agent frontmatter fields (memory, color, argument-hint, skills) missing from ADR-002 canonical schema #gap
- [problem] 2,669 lines of Go test code not accounted for in TS port effort #gap
- [problem] Go shared packages (utils, validation) used by hooks would need TS equivalents #gap
- [insight] Agent body content is deeply Claude-coupled: 298 references to MCP tool names, Teammate(), TaskCreate, etc. Adapters must handle body content, not just frontmatter #key-finding
- [insight] skills/CLAUDE.md is a Claude-specific skill development guide that needs a tool-neutral equivalent #gap
- [risk] Protocol files reference Claude-specific constructs (Validate-SessionProtocol.ps1, .agents/ dirs, Brain MCP tools) that have no Cursor/Gemini mapping #adaptation-risk

## Relations

- implements [[ADR-002-multi-tool-compatibility-architecture]]
- relates_to [[FEAT-001-multi-tool-compatibility]]
- extends [[ANALYSIS-006-multi-tool-compatibility-research]]
- relates_to [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
