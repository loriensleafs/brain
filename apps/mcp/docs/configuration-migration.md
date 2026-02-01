# Configuration Migration Guide

This guide explains how to migrate Brain configuration from the old format to the new XDG-compliant format.

## Overview

Brain v2.0 introduces a new configuration architecture that:

- Stores configuration in XDG-compliant locations (`~/.config/brain/`)
- Uses "memories" terminology instead of "notes"
- Provides three memory storage modes: DEFAULT, CODE, and CUSTOM
- Supports automatic file watching for live reconfiguration

### Storage Mode Quick Reference

| Mode | Path Pattern | Example |
|------|-------------|---------|
| DEFAULT | `{memories_location}/{project}/` | `~/memories/brain/` |
| CODE | `{code_path}/docs/` | `~/Dev/brain/docs/` |
| CUSTOM | `{memories_path}/` | `~/Dropbox/memories/brain/` |

Only DEFAULT mode appends the project name. CODE and CUSTOM use their paths directly.

## Do I Need to Migrate?

Run the migration command with `--dry-run` to check:

```bash
brain migrate --dry-run
```

Migration is needed if you have:

- Configuration at `~/.basic-memory/brain-config.json` (old location)
- Projects using the deprecated `notes_path` terminology

## Migration Process

### Step 1: Preview Changes

Always preview migration first:

```bash
brain migrate --dry-run
```

This shows:

- What configuration will be migrated
- New file locations
- Files that will be cleaned up (with `--cleanup`)

### Step 2: Execute Migration

Run migration:

```bash
brain migrate
```

This creates:

- `~/.config/brain/config.json` with the new schema (v2.0.0)
- Proper file permissions (0600 for config, 0700 for directory)

### Step 3: Clean Up (Optional)

Remove deprecated files after verifying migration:

```bash
brain migrate --cleanup
```

This removes:

- `~/.basic-memory/brain-config.json` (old config)
- `~/.brain/projects.json` (unused)
- `~/.brain/` directory (if empty)

## Configuration Changes

### Old Format

```json
{
  "code_paths": {
    "brain": "/Users/you/Dev/brain"
  },
  "default_notes_path": "~/memories"
}
```

### New Format

```json
{
  "$schema": "https://brain.dev/schemas/config-v2.json",
  "version": "2.0.0",
  "defaults": {
    "memories_location": "~/memories",
    "memories_mode": "DEFAULT"
  },
  "projects": {
    "brain": {
      "code_path": "/Users/you/Dev/brain",
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

### Key Changes

| Old | New |
|-----|-----|
| `default_notes_path` | `defaults.memories_location` |
| `code_paths.{name}` | `projects.{name}.code_path` |
| `--notes-path` flag | `--memories-path` flag |
| `--delete-notes` flag | `--delete-memories` flag |

## CLI Flag Changes

Project commands now use new flag names:

```bash
# Old (deprecated, still works)
brain projects create --name proj --code-path ~/Dev/proj --notes-path CODE

# New
brain projects create --name proj --code-path ~/Dev/proj --memories-path CODE
```

The old flags continue to work but display deprecation warnings.

## Migrating .agents/ Content

If you have `.agents/` directories in your projects, migrate them to Brain's searchable memory system:

### Preview

```bash
brain migrate-agents --dry-run
```

### Execute

```bash
brain migrate-agents
```

### Specific Project

```bash
brain migrate-agents --project myproject
```

### Verify Indexing

```bash
brain migrate-agents --verify-only
```

This checks that all migrated memories are properly indexed and searchable.

## Troubleshooting

### Migration Fails with Permission Error

Ensure you have write permissions:

```bash
chmod 700 ~/.config
mkdir -p ~/.config/brain
```

### Config Validation Error

Check your old config for syntax errors:

```bash
cat ~/.basic-memory/brain-config.json | python -m json.tool
```

### Rollback After Failed Migration

Restore the last known good configuration:

```bash
brain rollback --target lastKnownGood
```

Or restore the previous snapshot:

```bash
brain rollback --target previous
```

### Projects Not Appearing After Migration

Verify the config was written correctly:

```bash
brain config --json
```

Check project list:

```bash
brain projects list
```

### Memories Not Found After Migration

Run indexing verification:

```bash
brain migrate-agents --verify-only
```

If memories are missing from the index, re-run migration:

```bash
brain migrate-agents
```

## What Happens During Migration

1. **Detection**: Brain scans for old config at `~/.basic-memory/brain-config.json`
2. **Transformation**: Old schema transforms to new v2.0.0 schema
3. **Validation**: New config validates against JSON schema
4. **Atomic Write**: Config writes to temp file, then renames (prevents corruption)
5. **Sync**: New config syncs to internal storage for the memory backend
6. **Verification**: Brain verifies all projects and settings work correctly

## Transactional Safety

All migration operations are transactional:

- **Atomic**: Either completes fully or rolls back
- **Verified**: Each step validates before proceeding
- **Recoverable**: Rollback available if issues occur

Source files are NOT deleted until:

1. Target files are written
2. Indexing is verified (for memory content)
3. All validation passes

## Getting Help

If migration fails:

1. Check error message for specific issue
2. Run with `--dry-run` to see planned changes
3. Use `brain rollback` to restore previous state
4. Check logs at `~/.basic-memory/brain.log`
