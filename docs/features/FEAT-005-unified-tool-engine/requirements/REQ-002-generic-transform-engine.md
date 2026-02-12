---
title: REQ-002 Generic Transform Engine
type: requirement
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/requirements/req-002-generic-transform-engine
---

# REQ-002 Generic Transform Engine

## Requirement Statement

The system MUST implement a single `TransformAll` function in `internal/engine/transform.go` that replaces both `TransformClaudeCodeFromSource` and `CursorTransformFromSource`. The function MUST accept a `ToolConfig` and produce the same `GeneratedFile` output as the per-tool adapter functions it replaces.

### Transform Pipeline

```text
TransformAll(src *TemplateSource, tool *ToolConfig, brainConfig *BrainConfig) -> *TransformOutput

Phase 1: Agents
  - Read canonical agent templates from src
  - Apply frontmatter fields per tool.Agents.Frontmatter (include only listed fields)
  - Apply prefix per tool.Prefix (prepend tool name or not)
  - Output: []GeneratedFile for agents

Phase 2: Skills
  - Read canonical skill directories from src
  - Apply prefix per tool.Prefix
  - Output: []GeneratedFile for skills

Phase 3: Commands
  - Read canonical command files from src
  - Support composable directories via compose.go (_order.yaml assembly)
  - Apply prefix per tool.Prefix
  - Output: []GeneratedFile for commands

Phase 4: Rules
  - Read canonical protocol/rule templates from src
  - Apply tool.Rules.Extension (file extension conversion)
  - Apply tool.Rules.ExtraFrontmatter (additional frontmatter fields)
  - Apply prefix per tool.Prefix
  - Output: []GeneratedFile for rules

Phase 5: Hooks
  - Route by tool.Hooks.Strategy:
    - "direct": Generate hooks config file for direct write
    - "merge": Generate RFC 7396 JSON merge patch payload
    - "none": Skip hooks generation
  - Target path from tool.Hooks.Target
  - Output: []GeneratedFile for hooks (or empty)

Phase 6: MCP
  - Route by tool.MCP.Strategy:
    - "direct": Generate MCP config file for direct write
    - "merge": Generate RFC 7396 JSON merge patch payload
    - "none": Skip MCP generation
  - Target path from tool.MCP.Target
  - Output: []GeneratedFile for MCP (or empty)
```

### Parity Constraint

The engine MUST produce byte-identical output to existing per-tool adapters for every content type. Validation via golden-file comparison tests (REQ covered in TASK-007).

## Acceptance Criteria

- [ ] [requirement] `TransformAll` function defined in `internal/engine/transform.go` #acceptance
- [ ] [requirement] Agent transforms apply only frontmatter fields listed in tool config #acceptance
- [ ] [requirement] Rule transforms use tool-specific file extension and extra frontmatter #acceptance
- [ ] [requirement] Hook transforms dispatch to direct-write or merge strategy based on config #acceptance
- [ ] [requirement] MCP transforms dispatch to direct-write or merge strategy based on config #acceptance
- [ ] [requirement] Skill and command transforms apply prefix behavior from config #acceptance
- [ ] [requirement] Composable directory assembly (compose.go) works through the engine #acceptance
- [ ] [requirement] Output for Claude Code config matches existing `TransformClaudeCodeFromSource` byte-for-byte #acceptance
- [ ] [requirement] Output for Cursor config matches existing `CursorTransformFromSource` byte-for-byte #acceptance

## Observations

- [requirement] Single entry point replaces two per-tool adapter entry points #simplification
- [technique] Six-phase pipeline mirrors existing adapter structure for migration safety #migration
- [constraint] Byte-identical output is the parity gate before old code can be deleted #parity
- [fact] Existing shared utilities (compose.go, source.go) are reused without modification #retention
- [insight] Per-phase strategy dispatch (direct vs merge) replaces per-tool if/else branches #abstraction

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[ADR-009 Unified Tool Engine]]
- depends_on [[REQ-001 Tool Configuration Schema]]
- relates_to [[TASK-004 Generic Transform Engine]]
- relates_to [[DESIGN-001 Engine Architecture]]
- enables [[REQ-004 GenericTarget Installer]]
