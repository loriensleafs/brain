---
title: REQ-001 Tool Configuration Schema
type: requirement
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/requirements/req-001-tool-configuration-schema
---

# REQ-001 Tool Configuration Schema

## Requirement Statement

The system MUST define a `ToolConfig` YAML schema that captures all per-tool differences currently encoded in Go adapter files. A `tools.config.yaml` file at `apps/tui/tools.config.yaml` MUST declare tool configurations for Claude Code and Cursor. The config MUST be validated at startup with fail-fast behavior on invalid definitions.

### Configuration Axes

The schema MUST capture these five axes that differ between tools:

| Axis | Claude Code | Cursor | Config Key |
|---|---|---|---|
| Agent frontmatter fields | name, model, description, memory, color, argument-hint, tools, skills | description | `agents.frontmatter` |
| Rule file extension | `.md` | `.mdc` | `rules.extension` |
| Prefix behavior | false (no prefix) | true (brain- prefix) | `prefix` |
| Config merge strategy | direct write | RFC 7396 JSON merge | `hooks.strategy`, `mcp.strategy` |
| Placement strategy | marketplace registration | file copy + merge | `placement` |

### ToolConfig Type

```go
type ToolConfig struct {
    Name             string            `yaml:"name"`
    DisplayName      string            `yaml:"display_name"`
    Prefix           bool              `yaml:"prefix"`
    ConfigDir        string            `yaml:"config_dir"`
    Scopes           map[string]string `yaml:"scopes"`
    DefaultScope     string            `yaml:"default_scope"`
    Agents           AgentConfig       `yaml:"agents"`
    Rules            RuleConfig        `yaml:"rules"`
    Hooks            ConfigFileConfig  `yaml:"hooks"`
    MCP              ConfigFileConfig  `yaml:"mcp"`
    Manifest         ManifestConfig    `yaml:"manifest"`
    Detection        DetectionConfig   `yaml:"detection"`
    Placement        string            `yaml:"placement"`
}
```

### Validation Rules

```text
1. Name MUST be non-empty and unique across all tool definitions
2. DisplayName MUST be non-empty
3. ConfigDir MUST be a valid path pattern (may contain ~)
4. Scopes MUST contain at least one entry
5. DefaultScope MUST reference a key in Scopes
6. Agents.Frontmatter MUST be a non-empty string list
7. Rules.Extension MUST start with "."
8. Hooks.Strategy MUST be one of: "direct", "merge", "none"
9. MCP.Strategy MUST be one of: "direct", "merge", "none"
10. Placement MUST be one of: "marketplace", "copy_and_merge"
11. Manifest.Type MUST be one of: "marketplace", "file_list"
```

## Acceptance Criteria

- [ ] [requirement] `ToolConfig` Go struct defined with YAML struct tags in `internal/engine/config.go` #acceptance
- [ ] [requirement] `tools.config.yaml` contains valid Claude Code tool definition #acceptance
- [ ] [requirement] `tools.config.yaml` contains valid Cursor tool definition #acceptance
- [ ] [requirement] YAML parsing loads and deserializes `tools.config.yaml` correctly #acceptance
- [ ] [requirement] Validation function checks all 11 rules and returns actionable error messages #acceptance
- [ ] [requirement] Invalid config causes startup failure with clear error (fail-fast) #acceptance
- [ ] [requirement] All per-tool differences from existing `claude.go` and `cursor.go` are captured in config #acceptance
- [ ] [requirement] Config values match the behavior encoded in the current per-tool Go code #acceptance

## Observations

- [requirement] YAML chosen over JSON for config readability and comment support #config
- [technique] Struct tags enable direct YAML unmarshaling into Go types #implementation
- [constraint] All validation must run at startup before any transforms execute #fail-fast
- [fact] Five axes capture 100% of per-tool differences in the adapter layer #analysis
- [insight] Config entries are data extracted from Go code, not new abstractions #design

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[ADR-009 Unified Tool Engine]]
- relates_to [[TASK-001 ToolConfig Schema and YAML Parsing]]
- relates_to [[DESIGN-002 Config Schema Detail]]
- enables [[REQ-002 Generic Transform Engine]]
