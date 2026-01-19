# skills/analyze/

## Overview

Systematic codebase analysis skill. IMMEDIATELY invoke the command - do NOT explore first.

## Index

| File/Directory                    | Contents                       | Read When               |
| --------------------------------- | ------------------------------ | ----------------------- |
| `SKILL.md`                        | Invocation instructions        | Using the analyze skill |
| `../../hooks/scripts/brain-hooks` | Go binary with analyze command | Implementation details  |

## Key Point

The command IS the workflow. It outputs structured JSON with REQUIRED ACTIONS at each step. Follow them exactly. Do NOT try to follow any workflow manually - run the command and obey its output.

## Invocation

```bash
echo '{"stepNumber": 1, "totalSteps": 6, "thoughts": "Starting analysis..."}' | \
  ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/brain-hooks analyze
```

State is persisted to `/tmp/brain-analyze/analyze-state-YYYY-MM-DD.json`.

## Building

From the brain repo root:

```bash
make build-plugin-hooks
```

This builds the Go binary and places it in `hooks/scripts/brain-hooks`.

## Output Format

```json
{
  "phase": "EXPLORATION",
  "stepTitle": "Process Exploration Results",
  "status": "in_progress",
  "actions": ["Required actions..."],
  "next": "Instructions for next step",
  "stateFile": "/tmp/brain-analyze/analyze-state-2026-01-14.json",
  "stateSummary": "2 focus areas, 5 findings"
}
```

## State File

State is persisted to a JSON file:

```json
{
  "stepNumber": 4,
  "totalSteps": 7,
  "phase": "DEEP ANALYSIS",
  "focusAreas": [{ "name": "Security", "priority": "P1", "reason": "..." }],
  "findings": [
    { "severity": "CRITICAL", "description": "...", "file": "...", "line": 45 }
  ],
  "openQuestions": ["How is X handled?"]
}
```

This prevents memory issues by not accumulating everything in CLI arguments.

## Source Code

The implementation is in `cmd/hooks/analyze.go`.
