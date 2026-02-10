---
title: ANALYSIS-016-agents-md-section-comparison
type: note
permalink: analysis/analysis-016-agents-md-section-comparison
tags:
- agents-md
- composable-rules
- analysis
- agent-teams
- instructions
---

# ANALYSIS-016 AGENTS.md Section Comparison

## Observations

- [fact] Both AGENTS.md files share approximately 80% identical content by section count, higher than the orchestrator files (70%) #agents-md #composable-rules
- [fact] Standard AGENTS.md is 669 lines, Agent Teams AGENTS.md is 852 lines -- the AT version adds 183 lines of team-specific content #line-count
- [fact] 19 sections are SHARED (identical content), 8 sections are SIMILAR (same concept with tool-specific wording), 5 sections are TOOL-SPECIFIC (unique to one version) #analysis
- [insight] The AGENTS.md files have HIGHER content overlap than the orchestrator files because they are summaries of the same underlying rules, with tool-specific variation only in delegation mechanics and session management #key-finding
- [insight] The entire Memory Architecture section (150+ lines) is byte-for-byte identical across both files, making it the single largest extraction candidate #memory-architecture
- [decision] The AGENTS.md composable structure should mirror the orchestrator's approach: shared rules + tool-specific overrides, composed at sync/install time #architecture

## Section-by-Section Comparison

### SHARED Sections (19 total, ~540 lines)

Identical content across both files: Required Reading, Initialization Gate, Session Start table, Memory Bridge, Context Recovery, Session Management commands, Development Tools commands, Git/GitHub commands, Ask First list, Git Commit Messages, ADR Review Requirement, Output Paths, Task Classification, Impact Analysis, Memory Architecture (150 lines byte-identical), Memory-First Gate, Brain MCP Reference, Communication Standards, Self-Improvement.

### SIMILAR Sections (8 total, differ only in terminology)

Title/Identity, Memory Delegation Rules, Execution Model, Typical Workflow, Session End table, Workflow Patterns, Disagree and Commit, Responsibilities. These differ by {worker} (agent vs teammate), {delegate_cmd} (Task vs TaskCreate), {sequence_model} (waves vs task deps).

### TOOL-SPECIFIC Sections

Standard only (5): Orchestrator Memory Delegation, Agent Catalog with Handoffs To.
Agent Teams only (9): Prerequisites, Team Lead Tools, Memory Operations, Session Resumption Warning, Team Management commands, Teammate Catalog, Spawn Prompt Template, Debate/Challenge Pattern, Agent Teams Quick Reference, Extended Anti-Patterns/Constraints.

## Proposed Structure

14 shared rule files (~540 lines, 81% of standard) + 2 tool-specific overrides (130 lines standard, 310 lines Agent Teams).

Cross-file deduplication: Task Classification, Workflow Patterns, Impact Analysis are summaries of detailed orchestrator rules -- could reference same source files.

## Relations

- relates_to [[ANALYSIS-015-orchestrator-section-comparison]]
- relates_to [[DESIGN-005-composable-orchestrator-rules]]
- part_of [[FEAT-001-cross-platform-portability]]
