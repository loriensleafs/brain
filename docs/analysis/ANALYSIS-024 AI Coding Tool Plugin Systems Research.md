---
title: ANALYSIS-024 AI Coding Tool Plugin Systems Research
type: note
permalink: analysis/analysis-024-ai-coding-tool-plugin-systems-research
tags:
- analysis
- ai-tools
- plugin-systems
- installer
- convergence
---

# ANALYSIS-024 AI Coding Tool Plugin Systems Research

## Context

Comprehensive research into how AI coding tools structure their plugin/extension systems, conducted to inform Brain's installer architecture. Covers Claude Code, Cursor, GitHub Copilot CLI, OpenAI Codex CLI, and Google Gemini CLI.

## Observations

- [fact] All 5 major AI coding tools support Agent Skills (SKILL.md) as an open standard for portable skill definitions #convergence
- [fact] All 5 tools support MCP (Model Context Protocol) server configuration with near-identical JSON format #convergence
- [fact] All 5 tools use markdown files for agent/instruction definitions (AGENTS.md, custom .md files) #convergence
- [fact] 4 of 5 tools support hooks/lifecycle events (Claude Code, Cursor, Gemini CLI, Copilot CLI) with JSON configuration #convergence
- [fact] Each tool uses a different directory prefix for config (.claude/, .cursor/, .copilot/, .codex/, .gemini/) but identical internal structure patterns #divergence
- [insight] The convergence on SKILL.md, MCP JSON, and markdown agents means Brain can write once and place to multiple targets with minimal transformation #architecture
- [insight] Plugin packaging differs (Claude uses marketplace.json, Gemini uses extension.json, Copilot uses plugin.json) but component content is nearly identical #architecture
- [decision] Brain should target the shared surface area: SKILL.md skills, MCP config JSON, markdown agents, and hooks JSON #recommendation
- [fact] Agent Skills specification is maintained at agentskills.io with 27+ compatible tools including all 5 researched here #standard
- [fact] Progressive disclosure pattern (metadata at startup, full content on activation) is universal across all skill implementations #pattern

## Relations

- relates_to [[ANALYSIS-011-reference-install-comparison]]
- relates_to [[ADR-002-multi-tool-compatibility-architecture]]
- implements [[SESSION-2026-02-11_01-installer-architecture-research]]
