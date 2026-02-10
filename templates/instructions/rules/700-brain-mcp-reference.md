## Brain MCP Reference

| Tool | Purpose | Key Parameters |
|:--|:--|:--|
| `mcp__plugin_brain_brain__bootstrap_context` | Initialize project context | project path |
| `mcp__plugin_brain_brain__search` | Semantic search across notes | `query`, `mode`, `limit`, `folder` |
| `mcp__plugin_brain_brain__read_note` | Read note content | `identifier` |
| `mcp__plugin_brain_brain__write_note` | Create/overwrite note | `title`, `content`, `folder` |
| `mcp__plugin_brain_brain__edit_note` | Update note (append/prepend/find_replace/replace_section) | `identifier`, `operation`, `content` |
| `mcp__plugin_brain_brain__list_directory` | List available notes | `dir_name`, `depth` |
| `mcp__plugin_brain_brain__delete_note` | Remove obsolete note | `identifier` |
