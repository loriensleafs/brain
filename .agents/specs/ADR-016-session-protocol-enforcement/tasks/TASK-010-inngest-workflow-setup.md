---
type: task
id: TASK-010
title: Implement Inngest workflow setup
status: complete
priority: P0
complexity: S
estimate: 3h
related:
  - DESIGN-001
blocked_by: []
blocks:
  - TASK-011
  - TASK-012
  - TASK-013
assignee: implementer
created: 2026-01-18
updated: 2026-01-19
date_completed: 2026-01-19
author: spec-generator
tags:
  - inngest
  - workflows
  - setup
---

# TASK-010: Implement Inngest Workflow Setup

## Design Context

- DESIGN-001: Session State Architecture (Component infrastructure)
- ADR-016 Milestone 2.1: Inngest Workflow Setup

## Objective

Initialize Inngest project infrastructure for session protocol workflows. Configure dev server, define event types, and create workflow directory structure.

## Scope

**In Scope**:

- Inngest client initialization with local dev server
- Workflow directory structure creation
- Event type definitions (session/protocol.start, session/state.update, etc.)
- Development environment configuration
- Package.json scripts for workflow testing

**Out of Scope**:

- Workflow implementations (TASK-011, TASK-012, TASK-013)
- Production Inngest Cloud configuration
- Event emission from hooks or MCP tools

## Acceptance Criteria

- [ ] Inngest client initialized without errors
- [ ] Dev server runs at <http://localhost:8288>
- [ ] Event types defined in `apps/mcp/src/events/session.ts`
- [ ] Workflow directory exists at `apps/mcp/src/workflows/`
- [ ] Test event can be sent and received successfully
- [ ] `package.json` scripts added for `workflow:dev` and `workflow:test`
- [ ] Environment variables configured (`INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`)

## Files Affected

| File | Action | Description |
|------|--------|-------------|
| `apps/mcp/package.json` | Modify | Add inngest dependency and scripts |
| `apps/mcp/src/workflows/inngest-client.ts` | Create | Initialize Inngest client |
| `apps/mcp/src/events/session.ts` | Create | Define session event types |
| `apps/mcp/src/workflows/README.md` | Create | Workflow documentation |
| `apps/mcp/.env.example` | Modify | Add Inngest environment variables |

## Implementation Notes

### Inngest Client Setup

```typescript
// apps/mcp/src/workflows/inngest-client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "brain-session-protocol",
  eventKey: process.env.INNGEST_EVENT_KEY,
  signingKey: process.env.INNGEST_SIGNING_KEY,
});
```

### Event Type Definitions

```typescript
// apps/mcp/src/events/session.ts
import { z } from "zod";

// Event schemas
export const SessionProtocolStartEvent = z.object({
  name: z.literal("session/protocol.start"),
  data: z.object({
    sessionId: z.string(),
    workingDirectory: z.string(),
    timestamp: z.string().datetime(),
  }),
});

export const SessionStateUpdateEvent = z.object({
  name: z.literal("session/state.update"),
  data: z.object({
    sessionId: z.string(),
    updates: z.record(z.any()),
    timestamp: z.string().datetime(),
  }),
});

export const OrchestratorAgentInvokeEvent = z.object({
  name: z.literal("orchestrator/agent.invoke"),
  data: z.object({
    sessionId: z.string(),
    agent: z.string(),
    prompt: z.string(),
    context: z.record(z.any()),
    timestamp: z.string().datetime(),
  }),
});

export const OrchestratorAgentCompleteEvent = z.object({
  name: z.literal("orchestrator/agent.complete"),
  data: z.object({
    sessionId: z.string(),
    agent: z.string(),
    output: z.object({
      artifacts: z.array(z.string()),
      summary: z.string(),
      recommendations: z.array(z.string()),
      blockers: z.array(z.string()),
    }),
    timestamp: z.string().datetime(),
  }),
});

export const SessionCompleteEvent = z.object({
  name: z.literal("session/complete"),
  data: z.object({
    sessionId: z.string(),
    timestamp: z.string().datetime(),
  }),
});

// Type exports
export type SessionProtocolStartEvent = z.infer<typeof SessionProtocolStartEvent>;
export type SessionStateUpdateEvent = z.infer<typeof SessionStateUpdateEvent>;
export type OrchestratorAgentInvokeEvent = z.infer<typeof OrchestratorAgentInvokeEvent>;
export type OrchestratorAgentCompleteEvent = z.infer<typeof OrchestratorAgentCompleteEvent>;
export type SessionCompleteEvent = z.infer<typeof SessionCompleteEvent>;
```

### Directory Structure

```text
apps/mcp/src/workflows/
├── inngest-client.ts           # Inngest client initialization
├── session-protocol-start.ts   # (TASK-011)
├── session-protocol-end.ts     # (TASK-012)
├── orchestrator-agent-routing.ts # (TASK-013)
├── agent-completion-handler.ts # (TASK-013)
└── README.md                   # Workflow documentation
```

### Package.json Scripts

```json
{
  "scripts": {
    "workflow:dev": "inngest-cli dev",
    "workflow:test": "inngest-cli test",
    "workflow:serve": "tsx src/workflows/serve.ts"
  },
  "dependencies": {
    "inngest": "^3.0.0"
  },
  "devDependencies": {
    "@inngest/test": "^1.0.0"
  }
}
```

### Environment Variables

Add to `apps/mcp/.env.example`:

```bash
# Inngest Configuration
INNGEST_EVENT_KEY=local-dev-key
INNGEST_SIGNING_KEY=signkey-dev-12345
INNGEST_DEV_SERVER_URL=http://localhost:8288
```

### Test Event Example

```typescript
// Test script: apps/mcp/src/workflows/test-event.ts
import { inngest } from "./inngest-client";

async function sendTestEvent() {
  await inngest.send({
    name: "session/protocol.start",
    data: {
      sessionId: "test-session-001",
      workingDirectory: process.cwd(),
      timestamp: new Date().toISOString(),
    },
  });

  console.log("Test event sent successfully");
}

sendTestEvent().catch(console.error);
```

## Testing Requirements

### Unit Tests

- [ ] Inngest client initialization succeeds
- [ ] Event type schemas validate correct payloads
- [ ] Event type schemas reject invalid payloads

### Integration Tests

- [ ] Dev server starts without errors
- [ ] Test event can be sent via client
- [ ] Dev server UI shows received event at <http://localhost:8288>

### Manual Testing

1. Start dev server: `npm run workflow:dev`
2. Verify server accessible at <http://localhost:8288>
3. Send test event: `tsx src/workflows/test-event.ts`
4. Check dev server UI for event receipt

## Dependencies

**External**:

- Inngest npm package (^3.0.0)
- Inngest CLI (for dev server)

**Internal**:

- None (foundational task)

## Blocked By

None (foundational task)

## Blocks

- TASK-011: session-protocol-start workflow (requires Inngest client)
- TASK-012: session-protocol-end workflow (requires Inngest client)
- TASK-013: orchestrator-agent-routing workflow (requires Inngest client)

## Rollback Plan

If Inngest setup fails:

1. Remove inngest dependency from package.json
2. Delete `src/workflows/` directory
3. Remove environment variables from .env.example
4. Document issue for later resolution

## References

- **ADR-016**: Automatic Session Protocol Enforcement
- **Milestone 2.1**: Inngest Workflow Setup
- **Inngest Documentation**: <https://inngest.com/docs>
