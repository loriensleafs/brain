---
name: analyze
description: Invoke IMMEDIATELY via brain-hooks when user requests codebase analysis, architecture review, security assessment, or quality evaluation. Do NOT explore first - the command orchestrates exploration.
license: MIT
agents:
  - analyst
  - orchestrator
metadata:
---

# Analyze Skill

When this skill activates, IMMEDIATELY invoke the command. The command IS the workflow.

## Invocation

```bash
echo '{"stepNumber": 1, "totalSteps": 6, "thoughts": "Starting analysis. User request: <describe what user asked>"}' | \
  ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/brain-hooks analyze
```

| Field | Required | Description |
|-------|----------|-------------|
| `stepNumber` | Yes | Current step (starts at 1) |
| `totalSteps` | Yes | Minimum 6; adjust as workflow instructs |
| `thoughts` | No | Summary of current progress |
| `stateFile` | No | Path to state file (auto-created if not specified) |

## File-Based State

State is automatically persisted to: `/tmp/brain-analyze/analyze-state-YYYY-MM-DD.json`

The state file tracks:

- Focus areas and priorities
- Investigation plans
- Findings by severity
- Open questions
- Patterns discovered

## Workflow

The command outputs structured JSON at each step. Follow the `actions` array exactly.

```
Step 1: EXPLORATION         - Delegate to Explore agent(s)
Step 2: FOCUS SELECTION     - Classify areas, assign priorities
Step 3: INVESTIGATION PLAN  - Commit to specific files and questions
Step 4+: DEEP ANALYSIS      - Progressive investigation with evidence
Step N-1: VERIFICATION      - Validate completeness
Step N: SYNTHESIS           - Consolidate findings
```

## Example Sequence

```bash
# Step 1: Start analysis
echo '{"stepNumber": 1, "totalSteps": 6, "thoughts": "Starting analysis of auth system"}' | \
  ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/brain-hooks analyze

# Output will instruct you to delegate to Explore agent(s)
# After exploration completes, invoke step 2

# Step 2+: Continue following output instructions
echo '{"stepNumber": 2, "totalSteps": 7, "thoughts": "Explore found: Flask app, SQLAlchemy..."}' | \
  ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/brain-hooks analyze
```

## Output Format

```json
{
  "phase": "EXPLORATION",
  "stepTitle": "Process Exploration Results",
  "status": "in_progress",
  "actions": ["Array of required actions..."],
  "next": "Instructions for next step",
  "stateFile": "/tmp/brain-analyze/analyze-state-2026-01-14.json",
  "stateSummary": "2 focus areas, 5 findings (1 critical, 2 high)"
}
```

## State File Structure

```json
{
  "stepNumber": 4,
  "totalSteps": 7,
  "phase": "DEEP ANALYSIS",
  "focusAreas": [
    {"name": "Security", "priority": "P1", "reason": "Auth vulnerabilities"}
  ],
  "findings": [
    {"severity": "CRITICAL", "description": "SQL injection", "file": "auth.py", "line": 45}
  ],
  "openQuestions": ["How is session management handled?"]
}
```
