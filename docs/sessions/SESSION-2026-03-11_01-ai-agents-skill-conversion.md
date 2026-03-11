---
title: SESSION-2026-03-11_01-ai-agents-skill-conversion
type: session
permalink: sessions/session-2026-03-11-01-ai-agents-skill-conversion
status: IN_PROGRESS
created: 2026-03-11
updated: 2026-03-11
date: 2026-03-11
tags:
- session
- '2026-03-11'
- conversion
- ai-agents
- bun
- typescript
branch: feat/ai-agents-skill-conversion
starting-commit: c13bfb0
---

# SESSION-2026-03-11_01 AI Agents Skill Conversion

**Status:** IN_PROGRESS
**Branch:** feat/ai-agents-skill-conversion
**Starting Commit:** c13bfb0 Merge pull request #35
**Objective:** Convert agents and skills from ai-agents codebase to Brain-compatible format: Python to Bun TypeScript, Serena/Memory Router to Brain MCP, .NET to TypeScript, ai-agents paths to Brain memory note paths. Decisions tracked in [[ADR-025-ai-agents-skill-conversion-decisions]].

---

## Acceptance Criteria

- [x] All Python scripts converted to pure Bun TypeScript (no Node)
- [x] All Serena/Memory Router references replaced with Brain MCP tools
- [x] All .NET/C#/PowerShell code examples converted to TypeScript
- [x] All agent/skill frontmatter aligned to Brain/Claude Code canonical format
- [x] All save paths updated from `.agents/` to Brain memory note folders
- [x] All dead references removed or fixed
- [x] Zero TypeScript errors, zero Python files remaining
- [x] ADR capturing all conversion decisions written to Brain memory
- [ ] Agent frontmatter stripped, brain.config.json updated with descriptions/argument_hint/skills
- [ ] Memory skill mandate language added to all 3 agent markdown bodies
- [ ] Converted files moved into brain repo and committed
- [ ] Session note kept current

---

## Session Start Protocol (BLOCKING)

| Req Level | Step | Status | Evidence |
|-----------|------|--------|----------|
| MUST | Initialize Brain MCP | [x] | bootstrap_context called |
| MUST | Create session log | [x] | This note |
| SHOULD | Search relevant memories | [x] | No prior conversion work found |
| SHOULD | Verify git status | [x] | Branch: feat/ai-agents-skill-conversion, Commit: c13bfb0 |

---

## Key Decisions

See [[ADR-025-ai-agents-skill-conversion-decisions]] for full decision record.

---

## Work Log

### Batch 1: 5 Skills + 1 Agent (COMPLETE)

- [x] [converted] `analyst.md` -- Serena to Brain MCP, GitHub scripts to gh CLI #agent
- [x] [converted] 4 Python scripts to Bun TypeScript (analyze, assess, validate-cva-matrix, classify) #scripts
- [x] [created] 2 new TypeScript scripts (generate-cva-template, export-cva-matrix) #scripts
- [x] [converted] 5 SKILL.md files (analyze, cynefin, prompt-engineer, code-qualities, cva-analysis) #skills
- [x] [converted] 7 reference docs (calibration-examples, refactoring-patterns, pattern-mapping, matrix-examples, DEVELOPMENT, SKILL_SPEC, README) #references

### Batch 2: 2 Agents + 3 Skills (COMPLETE)

- [x] [converted] `architect.md` -- Memory/paths/naming to Brain #agent
- [x] [converted] `implementer.md` -- .NET to TS (1113 to 992 lines) #agent
- [x] [converted] `adr-review/` -- 6 markdown files + 1 script + 1 test #skill
- [x] [decision] analyze skill keeps Brain hook-based invocation, only content updated #analyze
- [x] [decision] skillbook agent included from ai-agents v3.0 #agent-scope
- [x] [decision] Keep Brain's memory agent, cherry-pick 4 features from ai-agents #memory-agent
- [x] [decision] Orchestrator: ai-agents v3.0 base, Agent Teams when env var set, standard Agent() otherwise #orchestrator
- [x] [converted] `fix-markdown-fences/` -- Python to TS, PowerShell removed #skill
- [x] [converted] `context-optimizer/` -- 5 Python scripts to TS, tiktoken to js-tiktoken #skill

### Infrastructure

- [x] [setup] tsconfig.json + @types/bun + js-tiktoken #tooling
- [x] [fix] js-tiktoken API corrections #bugfix
- [x] [merged] PR #34 feat/registry-based-installer into main #git
- [x] [config] Repo git email set to pkloss@gmail.com #git

---

## Files Touched

### Brain Memory Notes

| Action | Note | Status |
|--------|------|--------|
| created | [[SESSION-2026-03-11_01-ai-agents-skill-conversion]] | IN_PROGRESS |
| created | [[ADR-025-ai-agents-skill-conversion-decisions]] | PENDING |

### Staging Area: /Users/peter.kloss/Desktop/convert-to-brain/

46 files total, 0 Python, 0 TypeScript errors. 3 agents, 8 skills, 14 TypeScript scripts.

---

## Observations

- [fact] 46 total files, 0 Python remaining, 0 TypeScript errors #verification
- [fact] 14 Python scripts converted + 2 new scripts created #scale
- [insight] Claude Code native LSP tool replaces Serena for symbol extraction #tool-discovery
- [insight] DeepWiki MCP: free, zero-config, unique value for repo understanding #tool-discovery
- [insight] js-tiktoken uses camelCase API, no .free() method #api-difference
- [decision] noUncheckedIndexedAccess disabled in tsconfig for CLI scripts #tooling

## Relations

- relates_to [[ADR-025-ai-agents-skill-conversion-decisions]]

---

## Session End Protocol (BLOCKING)

| Req Level | Step | Status | Evidence |
|-----------|------|--------|----------|
| MUST | Update session status to COMPLETE | [ ] | |
| MUST | Update Brain memory with learnings | [ ] | |
| MUST | Run markdownlint | [ ] | |
| MUST | Commit all changes | [ ] | |