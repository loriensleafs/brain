# Brain MCP Server

Brain MCP is the Model Context Protocol server that powers Brain's memory system. It provides semantic search, knowledge organization, and persistent memory for AI agents.

## Quick Start

### Running the Server

```bash
# Standard mode (stdio transport for Claude, Cursor, etc.)
bun run start

# HTTP mode (for TUI and web clients)
bun run start:http

# Development with hot reload
bun run dev
```

### Connecting from Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "brain": {
      "command": "bun",
      "args": ["run", "start"],
      "cwd": "/path/to/brain/apps/mcp"
    }
  }
}
```

## Configuration

Brain stores configuration at `~/.config/brain/config.json` (XDG-compliant).

### Quick Config Commands

```bash
# View all configuration
brain config

# View as JSON
brain config --json

# Get specific value
brain config get defaults.memories-location

# Set value
brain config set logging.level debug

# Reset to defaults
brain config reset --all
```

### Configuration File

```json
{
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories",
    "memories_mode": "DEFAULT"
  },
  "projects": {
    "my-project": {
      "code_path": "/path/to/project",
      "memories_mode": "DEFAULT"
    }
  },
  "sync": {
    "enabled": true,
    "delay_ms": 500
  },
  "logging": {
    "level": "info"
  }
}
```

### Memory Storage Modes

| Mode | Storage Location | Use Case |
|------|------------------|----------|
| DEFAULT | `~/memories/{project}` | Recommended. Keeps memories separate from code. |
| CODE | `{code_path}/docs` | Memories committed with code. |
| CUSTOM | Explicit path | Cloud sync, shared drives, non-standard locations. |

### File Watching

Brain automatically watches the config file for changes. Edit the file directly and changes apply after a brief debounce (default 2 seconds). Invalid changes revert automatically.

For full configuration documentation, see [docs/configuration.md](docs/configuration.md).

## Migration

If upgrading from an older Brain version, migrate your configuration:

```bash
# Preview migration
brain migrate --dry-run

# Execute migration
brain migrate

# Clean up old files
brain migrate --cleanup
```

For detailed migration instructions, see [docs/configuration-migration.md](docs/configuration-migration.md).

## Project Management

```bash
# List projects
brain projects list

# Create project
brain projects create --name myproject --code-path ~/Dev/myproject

# Create with CODE mode (memories in code repo)
brain projects create --name myproject --code-path ~/Dev/myproject --memories-path CODE

# View project details
brain projects myproject

# Delete project (config only)
brain projects delete --project myproject

# Delete project and memories (destructive)
brain projects delete --project myproject --delete-memories
```

## Development

```bash
# Type checking
bun run typecheck

# Run tests
bun run test

# Tests with coverage
bun run test:coverage
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BRAIN_TRANSPORT` | `stdio` | Transport mode: `stdio` or `http` |
| `BRAIN_HTTP_PORT` | `8765` | HTTP port (when transport=http) |
| `BRAIN_HTTP_HOST` | `127.0.0.1` | HTTP host (when transport=http) |
| `BRAIN_LOG_LEVEL` | `info` | Log level: trace, debug, info, warn, error |
| `BRAIN_LOG_FILE` | `~/.basic-memory/brain.log` | Log file path |

## Architecture

Brain MCP wraps the basic-memory storage backend, providing:

- **XDG-compliant configuration** at `~/.config/brain/`
- **Semantic search** via vector embeddings
- **Knowledge graph** with wikilink connections
- **Project isolation** with per-project memory storage
- **Live reconfiguration** via file watching

The server communicates via Model Context Protocol, supporting both stdio (for Claude Desktop) and HTTP (for the TUI and web clients) transports.
