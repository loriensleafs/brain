# Brain Configuration Reference

This document describes Brain's configuration schema, fields, and behavior.

## Configuration Location

Brain stores configuration at:

```text
~/.config/brain/config.json
```

This follows XDG Base Directory Specification. The directory and file have restricted permissions:

- Directory: `0700` (owner access only)
- File: `0600` (owner read/write only)

## Configuration Schema

```json
{
  "$schema": "https://brain.dev/schemas/config-v2.json",
  "version": "2.0.0",

  "defaults": {
    "memories_location": "~/memories",
    "memories_mode": "DEFAULT"
  },

  "projects": {
    "project-name": {
      "code_path": "/absolute/path/to/code",
      "memories_path": "/absolute/path/to/memories",
      "memories_mode": "DEFAULT"
    }
  },

  "sync": {
    "enabled": true,
    "delay_ms": 500
  },

  "logging": {
    "level": "info"
  },

  "watcher": {
    "enabled": true,
    "debounce_ms": 2000
  }
}
```

## Field Reference

### Root Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | string | No | JSON schema URL for validation |
| `version` | string | Yes | Schema version (currently "2.0.0") |
| `defaults` | object | Yes | Global default settings |
| `projects` | object | No | Project-specific configurations |
| `sync` | object | No | File synchronization settings |
| `logging` | object | No | Logging configuration |
| `watcher` | object | No | Config file watching settings |

### defaults Object

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memories_location` | string | `~/memories` | Base path for DEFAULT mode memories |
| `memories_mode` | enum | `DEFAULT` | Default mode for new projects |

### projects.{name} Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code_path` | string | Yes | Absolute path to project source code |
| `memories_path` | string | No | Explicit memories path (CUSTOM mode only) |
| `memories_mode` | enum | No | Storage mode: DEFAULT, CODE, or CUSTOM |

### sync Object

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable file change synchronization |
| `delay_ms` | number | `500` | Delay before syncing changes (milliseconds) |

### logging Object

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `level` | enum | `info` | Log level: trace, debug, info, warn, error |

### watcher Object

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable config file watching |
| `debounce_ms` | number | `2000` | Debounce delay for file changes (milliseconds) |

## Memory Storage Modes

Brain supports three modes for storing project memories:

| Mode | Path Pattern | Example |
|------|-------------|---------|
| DEFAULT | `{memories_location}/{project}/` | `~/memories/brain/` |
| CODE | `{code_path}/docs/` | `~/Dev/brain/docs/` |
| CUSTOM | `{memories_path}/` | `~/Dropbox/memories/brain/` |

Note: Only DEFAULT mode appends the project name. CODE and CUSTOM use their paths directly.

### DEFAULT Mode

Memories store in a subdirectory under `memories_location`:

```text
${defaults.memories_location}/${project_name}
```

Example: If `memories_location` is `~/memories` and project is `brain`:

```text
~/memories/brain/
```

This is the recommended mode. It keeps memories separate from code.

### CODE Mode

Memories store in a `docs/` subdirectory under the project's code path:

```text
${code_path}/docs
```

Example: If `code_path` is `~/Dev/brain`:

```text
~/Dev/brain/docs/
```

Use this mode when you want memories committed alongside code.

### CUSTOM Mode

Memories store at an explicit path you specify:

```text
${memories_path}
```

Example: `~/Dropbox/memories/brain`

Use this mode for cloud sync, shared drives, or non-standard locations.

## CLI Commands

### View Configuration

```bash
# Pretty-printed view
brain config

# JSON output
brain config --json
```

### Get Specific Value

```bash
brain config get defaults.memories-location
brain config get logging.level
brain config get sync.enabled
```

### Set Value

```bash
brain config set defaults.memories-location ~/my-memories
brain config set logging.level debug
brain config set sync.delay-ms 1000
brain config set sync.enabled false
```

### Reset to Defaults

```bash
# Reset single field
brain config reset logging.level

# Reset all configuration
brain config reset --all
```

## Configuration Keys

Keys use dot notation for nested values. Both dashes and dots work in CLI:

| Key | Description |
|-----|-------------|
| `defaults.memories-location` | Base path for DEFAULT mode |
| `defaults.memories-mode` | Default mode for new projects |
| `sync.enabled` | Enable/disable sync |
| `sync.delay-ms` | Sync delay in milliseconds |
| `logging.level` | Log level |
| `watcher.enabled` | Enable/disable config watching |
| `watcher.debounce-ms` | Watch debounce in milliseconds |

## File Watching Behavior

When `watcher.enabled` is `true` (default), Brain monitors the config file for changes:

1. **Detection**: File system events trigger on config file modification
2. **Debounce**: Multiple rapid edits collapse into single processing (configurable via `debounce_ms`)
3. **Validation**: Changed config validates against schema
4. **Migration**: If memory paths changed, Brain migrates memories automatically
5. **Rollback**: Invalid changes revert to last known good configuration

### What Triggers Migration

These config changes trigger automatic memory migration:

| Change | Effect |
|--------|--------|
| `memories_mode` change | Migrates project memories to new location |
| `memories_path` change | Migrates project memories to explicit path |
| `memories_location` change | Migrates ALL DEFAULT-mode projects |

### Safety Features

- Changes validate before applying
- Invalid JSON reverts to previous config
- Schema violations revert to previous config
- Migration failures revert to previous config
- All operations are atomic (complete fully or not at all)

## Examples

### Minimal Configuration

```json
{
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories"
  }
}
```

### Multiple Projects

```json
{
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories",
    "memories_mode": "DEFAULT"
  },
  "projects": {
    "brain": {
      "code_path": "/Users/you/Dev/brain",
      "memories_mode": "DEFAULT"
    },
    "my-app": {
      "code_path": "/Users/you/Dev/my-app",
      "memories_mode": "CODE"
    },
    "shared-notes": {
      "code_path": "/Users/you/Dev/shared",
      "memories_path": "/Users/you/Dropbox/memories/shared",
      "memories_mode": "CUSTOM"
    }
  }
}
```

### Debug Configuration

```json
{
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories"
  },
  "logging": {
    "level": "debug"
  },
  "sync": {
    "enabled": true,
    "delay_ms": 100
  }
}
```

### Disable File Watching

```json
{
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories"
  },
  "watcher": {
    "enabled": false
  }
}
```

## Environment Variables

Some settings can be overridden via environment variables:

| Variable | Description |
|----------|-------------|
| `BRAIN_LOG_LEVEL` | Override logging.level |
| `BRAIN_TRANSPORT` | Transport mode: stdio or http |
| `BRAIN_HTTP_PORT` | HTTP port (when transport=http) |
| `BRAIN_HTTP_HOST` | HTTP host (when transport=http) |

## Path Validation

Brain validates all paths for security:

- No path traversal (`..` rejected)
- No null bytes
- No system paths (`/etc`, `/usr`, `/var`, `C:\Windows`)
- Tilde (`~`) expands to home directory

## Troubleshooting

### Config Not Loading

Check file permissions:

```bash
ls -la ~/.config/brain/config.json
```

Should show `-rw-------` (0600).

### Changes Not Taking Effect

1. Check watcher is enabled:

   ```bash
   brain config get watcher.enabled
   ```

2. Wait for debounce period (default 2 seconds)

3. Check logs for validation errors:

   ```bash
   tail -f ~/.basic-memory/brain.log
   ```

### Invalid Config After Manual Edit

Rollback to last known good:

```bash
brain rollback --target lastKnownGood
```

### Project Memories in Wrong Location

Check project's mode:

```bash
brain projects myproject
```

Change mode if needed:

```bash
brain projects myproject --memories-path DEFAULT
```
