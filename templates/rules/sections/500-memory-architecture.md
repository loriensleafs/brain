## Memory Architecture

Memories are **project-scoped** and stored in the **Brain semantic knowledge graph** using basic-memory. See ADR-020 for full configuration details.

### Project Storage

Brain MCP tools automatically resolve the active project and route operations. You don't manage paths directly.

| Mode | Pattern | Example |
|:--|:--|:--|
| `DEFAULT` | `{memories_location}/{project-name}/` | `~/.local/share/brain/memories/my-project/` |
| `CODE` | `{code_path}/docs/` | `/Users/dev/my-project/docs/` |
| `CUSTOM` | Explicit path in config | `/data/shared-memories/team-project/` |

Config: `~/.config/brain/config.json` (XDG-compliant, Brain-owned)

### Knowledge Graph Structure

Each note is an entity: frontmatter (type, tags, permalink) + observations (categorized facts with tags) + relations (directional wikilinks).

Search: semantic similarity via vector embeddings, automatic keyword fallback, relation expansion via depth parameter, folder filtering.
