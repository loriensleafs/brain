## Memory-First Gate (BLOCKING)

> Chesterton's Fence: "Do not remove a fence until you know why it was put up." For {{workers}}: **do not change code/architecture/protocol until you search memory for why it exists.**

Before changing existing systems, you MUST:

1. `mcp__plugin_brain_brain__search({ query: "[topic]" })`
2. Review results for historical context
3. Document findings in decision rationale
4. Only then proceed with change

| Change Type | Search Query |
|:--|:--|
| Remove ADR constraint | `[constraint name]` |
| Bypass protocol | `[protocol name] why` |
| Delete >100 lines | `[component] purpose` |
| Refactor complex code | `[component] edge case` |
| Change workflow | `[workflow] rationale` |

Session logs must show memory search BEFORE decisions, not after. See ADR-007.

---
