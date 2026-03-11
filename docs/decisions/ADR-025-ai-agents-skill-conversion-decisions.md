---
title: ADR-025-ai-agents-skill-conversion-decisions
type: decision
permalink: decisions/adr-025-ai-agents-skill-conversion-decisions
status: accepted
date: 2026-03-11
tags:
- decision
- conversion
- ai-agents
- brain
- typescript
- bun
---

# ADR-025 AI Agents Skill Conversion Decisions

## Context and Problem Statement

Converting agents and skills from the ai-agents codebase to Brain-compatible format. The ai-agents codebase uses Python scripts, Serena MCP for memory, .NET/C# code examples, and ai-agents-specific paths. Brain uses Bun TypeScript, Brain MCP for memory, and a different folder structure.

## Observations

- [decision] Rule 1: All Python/PowerShell scripts must be pure Bun TypeScript, no Node APIs #conversion-rule
- [decision] Rule 2: All code examples in markdown must be Bun TypeScript #conversion-rule
- [decision] Rule 3: All non-brain source references must be identified and swapped #conversion-rule
- [decision] Rule 4: Memory/search implementation swapped from Serena/Memory Router to Brain MCP #conversion-rule
- [decision] Teaching code examples (calibration, refactoring, CVA patterns) converted to TypeScript, not left multi-language #q1
- [decision] DeepWiki MCP installed (free, zero-config, unique value); Context7 and Perplexity removed, replaced with WebSearch/WebFetch #q2
- [decision] GitHub skill scripts replaced entirely with inline `gh` CLI commands (scripts were thin wrappers around `gh`) #q3
- [decision] `.agents/analysis/` save paths replaced with Brain memory notes using `ANALYSIS-{NNN}-{topic}` in `analysis/` folder #q4
- [decision] Serena symbol extraction replaced with Claude Code native LSP tool (`documentSymbol`, `findReferences`) #q5
- [decision] Missing CVA scripts created as new Bun TypeScript (generate-cva-template.ts and export-cva-matrix.ts) #q6
- [decision] All hardcoded skill paths replaced with `${CLAUDE_SKILL_DIR}` Claude Code variable #q7
- [decision] XML SKILL_SPEC.md kept with light touch-up (Python to Bun/TS dependency reference) #q8
- [decision] `argument-hint` kept in agent frontmatter (valid Claude Code field, Brain uses it) #q9
- [decision] `user-invocable: true` kept where present (valid Claude Code field, default is true) #q10
- [decision] `agents` field populated by deep-reading each file body for referenced agents #q11
- [decision] `js-tiktoken` (npm, official OpenAI port) chosen as Bun replacement for Python tiktoken #q13
- [decision] implementer.md: all .NET sections (Qwiq, BCL, dotnet commands, C# examples) stripped and converted to TypeScript/Bun #q14
- [decision] pytest tests converted to `bun:test` (not removed) #q12
- [decision] `rjmurillo/ai-agents` repo references removed from gh commands (auto-detect from remote) #q15
- [decision] Empty claude-mem CLAUDE.md stubs removed (Brain does not use claude-mem) #q16
- [decision] `milestone-planner` renamed to `planner` everywhere #naming
- [decision] `model: claude-opus-4-6` updated to `claude-opus-4-6[1m]` for all agents #frontmatter
- [decision] `Task(subagent_type=...)` replaced with `Agent(subagent_type=...)` everywhere #tools
- [decision] ADR save paths: `.agents/architecture/ADR-NNNN-*.md` replaced with Brain `decisions/ADR-{NNN}-{topic}` #naming
- [decision] `view` in allowed-tools replaced with `Read` (correct Claude Code tool name) #frontmatter
- [decision] `noUncheckedIndexedAccess` disabled in tsconfig (too aggressive for CLI scripts) #tooling
- [decision] Brain canonical skill frontmatter: name, description, license: MIT, agents: [...], model, metadata #frontmatter
- [decision] Brain canonical agent frontmatter: name, description, model: claude-opus-4-6[1m], argument-hint (optional) #frontmatter

## Relations

- implements [[SESSION-2026-03-11_01-ai-agents-skill-conversion]]
- relates_to [[Brain MCP tools]]

- [decision] Agent template files must have NO frontmatter -- installer injects it from brain.config.json #agent-frontmatter
- [decision] brain.config.json agent entries updated with richer descriptions from converted versions #agent-frontmatter
- [decision] argument_hint field added to all 3 converted agents in brain.config.json #agent-frontmatter
- [decision] skills: ["memory"] added to agents in brain.config.json so agents use Brain MCP tools via memory skill #agent-frontmatter

- [decision] Memory skill added ONLY to agents that write notes, not universally -- prevents unintended write access #memory-skill
- [decision] Explicit BLOCKING mandate added to agent markdown body requiring all Brain note operations go through memory skill #memory-skill

- [decision] Analyze skill keeps Brain's hook-based invocation mechanism (brain-hooks analyze), only update the analysis logic/content -- do not replace with standalone CLI script #analyze-skill

- [decision] fix-markdown-fences agents list: keep `janitor` from Brain version (not `qa` from conversion) -- janitor is the cleanup specialist #fix-markdown-fences

- [decision] Include skillbook agent (453 lines) from ai-agents v3.0 -- institutional knowledge curator with atomicity scoring, deduplication, retirement #agent-scope

- [decision] Keep Brain's memory agent (789 lines) as base -- it's more complete and Brain-native #memory-agent
- [decision] Cherry-pick 4 features from ai-agents memory agent into Brain's: (1) Create vs Update decision flowchart, (2) Skill Citation Protocol, (3) Source tracking with dated timestamps for traceability, (4) Freshness update triggers table (ai-agents version is cleaner) #memory-agent

- [decision] Use ai-agents v3.0 orchestrator as base with minimal changes -- only swap delegation mechanism to Agent Teams when CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1, otherwise use standard Agent() delegation. All routing logic, classification, workflows, frameworks stay as-is from ai-agents #orchestrator
- [decision] Drop Cursor support -- single-file orchestrator, no composite multi-file build #orchestrator

- [decision] exploring-knowledge-graph: replace Brain version with converted ai-agents v3.0 version (swap Forgetful for Brain MCP, get better docs) #skill-scope

- [decision] doc-sync: replace Brain version with converted ai-agents v3.0 version (better trigger organization) #skill-scope

- [decision] research-and-incorporate: replace Brain version with converted ai-agents v3.0 version (swap Serena/Forgetful for Brain MCP) #skill-scope

- [decision] curating-memories: replace Brain version with ai-agents v3.0 version -- keep ai-agents concepts/approach/patterns intact, only swap memory backend to Brain MCP search/notes #skill-scope

- [decision] memory-documentary: replace Brain version with ai-agents v3.0 version, Brain search/notes as backend #skill-scope

- [decision] security-detection: replace Brain version with ai-agents v3.0 version, Python script converted to pure Bun TypeScript #skill-scope

- [decision] Install Serena MCP as auto-managed server via Brain MCP config (uvx command, auto-starts with Claude Code) #serena
- [decision] Keep all 3 Serena skills, rename to remove "serena": code-architecture, repo-encoder, code-symbols #serena
- [decision] Swap only memory parts to Brain MCP, keep Serena symbol operations as-is #serena
- [decision] assess.ts stays on native Claude Code LSP tool (simpler, less coupling for basic symbol counts) #serena

- [decision] session-log-fixer: replace Brain version with ai-agents v3.0 version, scripts to Bun TypeScript #skill-scope

- [decision] using-brain-memory: keep Brain's version, add trigger table, anti-patterns table, and skill cross-references from ai-agents #skill-scope

- [decision] SkillForge: replace Brain version with ai-agents v3.0 version, scripts to Bun TypeScript #skill-scope

- [decision] pr-comment-responder: replace Brain version with ai-agents v3.0 version (handle feedback on your PRs) #skill-scope
- [decision] pr-review command: include from ai-agents v3.0 (review others' PRs) #command-scope

- [decision] memory skill: keep Brain's version as base, cherry-pick 5 features from ai-agents: (1) Memory-First as Chesterton's Fence section, (2) Context Engineering section, (3) Decision Tree, (4) Size validation thresholds, (5) Related Skills cross-references #skill-scope

- [decision] Hooks: adopt ai-agents v3.0 hook BEHAVIORS and individual-script-per-behavior ARCHITECTURE, convert all 25 Python scripts to Bun TypeScript. Drop Brain's 4-entry-point router pattern. Add all 7 lifecycle events (SessionStart, PreToolUse, UserPromptSubmit, PostToolUse, Stop, SubagentStop, PermissionRequest). Only thing kept from Brain is the language (Bun TypeScript) #hooks

- [decision] Commands: replace all Brain commands with ai-agents v3.0 equivalents where they overlap, port all new ai-agents commands. Drop Brain-only commands (mode, pause-session, resume-session, spec) since never used. Bootstrap should be handled by SessionStart hook, not a manual command #commands

- [decision] Context initialization redesign: fix during hook conversion, not as separate effort. SessionStart hook should call bootstrap_context automatically, use git state for smart context loading, support rehydration after compaction. ai-agents hook behaviors + Brain bootstrap_context MCP = proper bridge #context-init
- [decision] Memory commands (explore, list, save, search): port from ai-agents, adapt to Brain MCP #commands
- [decision] Drop Brain bootstrap command -- SessionStart hook handles it automatically #commands

- [decision] AGENTS.md: complete redesign. Compact to 200-300 lines max as navigation hub. Use @import for detail sections. Add skill catalog + hook behavior summary. Move orchestrator details to orchestrator agent, memory details to memory skill, session protocol to hooks+session skill. Full creative latitude given. #agents-md

- [decision] taste-lints: include and ENHANCE during conversion -- make it project-config-aware. Read from biome.json, eslint.config, .editorconfig, tsconfig.json, .prettierrc, etc. when available, fall back to sensible defaults when not. Agent-readable remediation is the core value. #skill-scope
- [decision] 8 additional skills added to scope: git-advanced-workflows, github-url-intercept, merge-resolver, security-scan, taste-lints, analysis-provenance, pipeline-validator, validation-authority #skill-scope

- [decision] Fix plugin installation: name consistency (🧠 stays), version "unknown" bug, installer Go code fix, update mechanism for directory-sourced plugins. Added as phase in execution plan. #plugin-install
