### Session End (BLOCKING -- complete before closing)

| Level | Step | Verification |
|:--|:--|:--|
| **MUST** | Complete Session End checklist in session log | All `[x]` checked |
| **MUST NOT** | Update `brain session` (read-only reference) | File unchanged |
| **MUST** | Update Brain memory (cross-session context) | Memory write confirmed |
| **MUST** | Run `npx markdownlint-cli2 --fix "**/*.md"` | Lint passes |
| **MUST** | Commit all changes including `.agents/` | Commit SHA in Evidence column |
| **MUST** | Run `Validate-SessionProtocol.ps1` -- PASS required | Exit code 0 |
| **SHOULD** | Update PROJECT-PLAN.md task checkboxes | Tasks marked complete |
| **SHOULD** | Invoke retrospective (significant sessions) | Doc created |

```bash
pwsh scripts/Validate-SessionProtocol.ps1 -SessionLogPath ".agents/sessions/[session-log].md"
```

If validation fails: fix and re-run. Do NOT claim completion until PASS.
