### Session Entity Type

The session entity type has additional frontmatter fields for lifecycle tracking:

| Field | Required | Values | Notes |
|:--|:--|:--|:--|
| title | Yes | SESSION-YYYY-MM-DD_NN-topic | Standard naming |
| type | Yes | session | Entity type |
| status | Yes | IN_PROGRESS, PAUSED, COMPLETE | Lifecycle state (see state machine) |
| date | Yes | YYYY-MM-DD | Session date |
| tags | No | [session, ...] | Optional tags |

**Status State Machine**:

```text
IN_PROGRESS <--> PAUSED --> COMPLETE
```

| Status | Description | Allowed Transitions |
|:--|:--|:--|
| IN_PROGRESS | Active session, work ongoing | PAUSED, COMPLETE |
| PAUSED | Session suspended, can resume later | IN_PROGRESS, COMPLETE |
| COMPLETE | Session finished (terminal state) | None |

**Constraint**: Only ONE session can have status IN_PROGRESS at a time. Creating or resuming a session auto-pauses any existing IN_PROGRESS session.

**MCP Session Operations**:

| Operation | Action | Status Change |
|:--|:--|:--|
| create | Creates new session, auto-pauses existing | New session: IN_PROGRESS |
| pause | Suspends active session | IN_PROGRESS -> PAUSED |
| resume | Resumes paused session, auto-pauses existing | PAUSED -> IN_PROGRESS |
| complete | Ends session (terminal) | IN_PROGRESS -> COMPLETE |

**Backward Compatibility**: Missing status field treated as COMPLETE for existing sessions.

### Semantic Folders

`analysis/`, `decisions/`, `planning/`, `roadmap/`, `sessions/`, `specs/`, `critique/`, `qa/`, `security/`, `retrospective/`, `skills/`
