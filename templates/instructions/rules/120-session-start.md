### Session Start (BLOCKING -- complete before ANY work)

| Level | Step | Verification |
|:--|:--|:--|
| **MUST** | Initialize Brain MCP (`mcp__plugin_brain_brain__bootstrap_context`) | Tool output in transcript |
| **MUST** | Read `brain session` | Content in context |
| **MUST** | Create session log at `sessions/YYYY-MM-DD-session-NN.md` if missing | File exists |
| **SHOULD** | Search relevant Brain memories | Memory results present |
| **SHOULD** | Verify git status and note starting commit | Output documented |
