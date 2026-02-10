---
title: DESIGN-001-adapter-architecture
type: design
status: implemented
feature-ref: FEAT-001
req-refs:
- REQ-001
- REQ-002
tags:
- design
- adapters
- typescript
permalink: features/feat-001-cross-platform-portability/design/design-001-adapter-architecture-2
---

# DESIGN-001 Adapter Architecture

## Summary

TS-only adapter pattern. No dual TS+Go implementation. Go CLI shells out to bun for transforms.

## Technical Approach

- [decision] Adapters are TS-only pure functions: input is canonical content + brain.config.json, output is tool-specific content #ts-only
- [decision] Go CLI shells out to `bun adapters/sync.ts` at install time; users already need bun for MCP server #bun
- [fact] No parity testing burden; single implementation is source of truth #simplicity

### Adapter Files

```text
adapters/
  sync.ts                # Main orchestrator: reads brain.config.json, invokes per-tool adapters
  claude-code.ts         # CC-specific transforms (frontmatter, hooks config, MCP config)
  cursor.ts              # Cursor-specific transforms (frontmatter, hooks config, rules)
  shared.ts              # Common utilities (frontmatter parsing, file generation)
```

### Transform Pipeline

```text
Canonical Content + brain.config.json -> sync.ts -> Per-Tool Adapter -> Tool-Specific Output
  agents/*.md              claude-code.ts     .claude/agents/*.md (CC frontmatter)
  agents/*.md              cursor.ts          .cursor/agents/*.md (Cursor frontmatter)
  skills/                  (copy as-is)       .claude/skills/ and .cursor/skills/
  commands/                (copy as-is)       .claude/commands/ and .cursor/commands/
  mcp.json                 (copy as-is)       .claude/mcp.json and .cursor/mcp.json
```

## Trade-offs Considered

- [decision] TS-only vs dual TS+Go: eliminates parity testing, accepts bun dependency for users #tradeoff
- [insight] Users already need bun for the MCP server, so bun at install time is not a new dependency #justification

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- satisfies [[REQ-001-canonical-content-extraction]]
- satisfies [[REQ-002-cross-platform-agent-adaptation]]
- traces_to [[ADR-002 Cross-Platform Plugin Architecture]]

## Transform Pipeline

### Transform Pipeline

```text
Canonical Content + brain.config.json -> sync.ts -> Per-Tool Adapter -> Tool-Specific Output
  agents/*.md              claude-code.ts     .claude/agents/🧠-*.md (CC frontmatter, plugin isolation)
  agents/*.md              cursor.ts          .cursor/agents/🧠-*.md (Cursor frontmatter, 🧠 prefix)
  skills/                  (copy as-is)       .claude/skills/🧠-*/ and .cursor/skills/🧠-*/
  commands/                (copy as-is)       .claude/commands/🧠-*.md and .cursor/commands/🧠-*.md
  protocols/               claude-code.ts     .claude/rules/🧠-*.md (composable rules)
  protocols/               cursor.ts          .cursor/rules/🧠-*.mdc (composable rules)
  mcp.json                 (merge)            .cursor/mcp.json (JSON merge with manifest, not overwrite)
  hooks/                   cursor.ts          .cursor/hooks.json (JSON merge with manifest, not overwrite)
```

All output filenames use the `🧠` emoji prefix for immediate identification. Claude Code plugin isolation handles namespacing natively. Cursor uses 🧠-prefixed files + JSON merge with manifest tracking for hooks and MCP config.
