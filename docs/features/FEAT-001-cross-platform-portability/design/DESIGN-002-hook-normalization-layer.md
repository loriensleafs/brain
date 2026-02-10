---
title: DESIGN-002-hook-normalization-layer
type: design
status: draft
feature-ref: FEAT-001
req-refs:
- REQ-003
tags:
- design
- hooks
- normalization
permalink: features/feat-001-cross-platform-portability/design/design-002-hook-normalization-layer
---

# DESIGN-002 Hook Normalization Layer

## Summary

A thin normalization shim detects the platform from the event JSON shape and normalizes to a common interface. Each hook script imports the normalizer, then runs platform-agnostic logic.

## Technical Approach

- [decision] normalize.ts shim detects platform from stdin JSON event shape #detection
- [decision] NormalizedHookEvent interface provides common fields across tools #interface
- [fact] Per-tool JSON configs map tool-specific event names to shared scripts #config

### Normalization Interface

```typescript
interface NormalizedHookEvent {
  platform: 'claude-code' | 'cursor';
  event: string;
  sessionId: string;
  workspaceRoot: string;
  payload: Record<string, unknown>;
}
```

### Hook Directory Structure

```text
hooks/
  scripts/
    normalize.ts           # Platform detection + event normalization
    session-lifecycle.ts   # Session start/end, validation
    user-prompt.ts         # Prompt processing, scenario detection
    pre-tool-use.ts        # Tool gating, mode enforcement
    stop-validator.ts      # Session validation before stop
    skill-loader.ts        # Skill discovery and loading
    analyze.ts             # Step-by-step analysis workflow
  claude-code.json         # Maps CC events to scripts
  cursor.json              # Maps Cursor events to scripts
```

### Platform Detection

```typescript
// Claude Code: { tool_name: "Bash", tool_input: { command: "..." } }
// Cursor:     { command: "git status", hook_event_name: "beforeShellExecution" }
// Detection: Cursor events have hook_event_name field; CC events do not
```

## Trade-offs Considered

- [decision] Thin shim normalization vs full Go-to-TS port: normalization is less work and produces portable scripts #tradeoff
- [risk] Different blocking semantics (CC Stop blocks, Cursor stop is info-only) must be handled per-platform #blocking

## Relations

- implements [[FEAT-001 Cross-Platform Portability]]
- satisfies [[REQ-003-hook-normalization]]
- traces_to [[ADR-002 Cross-Platform Plugin Architecture]]
