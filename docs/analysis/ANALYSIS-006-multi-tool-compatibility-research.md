---
title: ANALYSIS-006-multi-tool-compatibility-research
type: note
permalink: analysis/analysis-006-multi-tool-compatibility-research
tags:
- analysis
- multi-tool
- cursor
- gemini
- codex
- compatibility
---

# ANALYSIS-001 Multi-Tool Compatibility Research

## Context

Research findings from 5 parallel reconnaissance agents exploring how Brain can become compatible with Claude Code, Cursor IDE/CLI, Gemini CLI, and Codex CLI.

## Observations

- [fact] All 4 tools converge on Open Agent Skills standard (SKILL.md with progressive disclosure) #convergence
- [fact] All 4 tools support MCP servers with stdio transport #convergence
- [fact] All 4 tools support hierarchical instruction files (CLAUDE.md, AGENTS.md, GEMINI.md) #convergence
- [fact] Cursor 2.4 auto-discovers skills from .claude/skills/ and .codex/skills/ directories #cross-tool
- [fact] AGENTS.md is an open standard by Agentic AI Foundation under Linux Foundation #standard
- [fact] Cursor has 21 hook events vs Claude Code 4 vs Gemini 11 vs Codex 1 #hooks-gap
- [fact] Parallel subagents: Cursor (GA, 3 mechanisms), Claude Code (Agent Teams experimental), Gemini (none), Codex (none native) #parallel-gap
- [constraint] Brain emoji prefix visibility across all tools is nonnegotiable #user-requirement
- [constraint] Parallel subagent execution mandatory for all supported tools #user-requirement
- [insight] Shared content package with per-tool adapters is the natural architecture #architecture
- [decision] Cursor is the highest-priority second target after Claude Code (GA parallel agents, MCP, hooks, skills) #priority

## Relations

- part_of [[SESSION-2026-02-09_01-multi-tool-compatibility-restructure]]
- relates_to [[Brain CLI Architecture]]
