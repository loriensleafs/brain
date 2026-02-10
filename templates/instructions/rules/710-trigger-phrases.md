### Trigger Phrases

| User Says | Action |
|:--|:--|
| "search memory for X" / "what do we know about X" | `search({ query: "X" })` |
| "list memories" | `list_directory()` |
| "read memory X" | `read_note({ identifier: "X" })` |
| "extract episode from session" | `pwsh Extract-SessionEpisode.ps1 --session SESSION-X` |
| "what happened in session X" | `read_note({ identifier: "EPISODE-X" })` |
| "find sessions with failures" | `search({ query: "outcome:failure", folder: "episodes" })` |
| "add pattern" | `pwsh add-pattern.ps1 --name "..." --trigger "..."` |

---
