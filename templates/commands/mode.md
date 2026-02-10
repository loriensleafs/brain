---
description: Set workflow mode (analysis, planning, coding)
---

Set the current workflow mode using set_mode.

Modes:

- **analysis**: Read-only exploration. Blocks Edit, Write, Bash. Default mode.
- **planning**: Design phase. Blocks Edit, Write. Allows Bash for research.
- **coding**: Full access. All tools allowed.

If no mode specified, show current mode using get_mode.

User request: $ARGUMENTS
