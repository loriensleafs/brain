---
title: DESIGN-002 Config Schema Detail
type: design
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/design/design-002-config-schema-detail
---

# DESIGN-002 Config Schema Detail

## Summary

Detailed specification of the `tools.config.yaml` schema, the `ToolConfig` Go type hierarchy, validation rules, and the mapping from existing per-tool Go code to config entries. Covers every field, its type, valid values, and which existing code it replaces.

## Technical Approach

### Complete YAML Schema

```yaml
tools:
  claude-code:
    display_name: "Claude Code"
    prefix: false
    config_dir: ~/.claude
    scopes:
      global: ~/.claude/
      plugin: ~/.claude/plugins/marketplaces/brain/
      project: .claude/
    default_scope: plugin
    agents:
      frontmatter:
        - name
        - model
        - description
        - memory
        - color
        - argument-hint
        - tools
        - skills
    rules:
      extension: .md
      extra_frontmatter: {}
    hooks:
      strategy: direct
      target: hooks/hooks.json
    mcp:
      strategy: direct
      target: .mcp.json
    manifest:
      type: marketplace
    detection:
      brain_installed:
        type: json_key
        file: plugins/known_marketplaces.json
        key: brain
    placement: marketplace

  cursor:
    display_name: "Cursor"
    prefix: true
    config_dir: ~/.cursor
    scopes:
      global: ~/.cursor/
      project: .cursor/
    default_scope: global
    agents:
      frontmatter:
        - description
    rules:
      extension: .mdc
      extra_frontmatter:
        alwaysApply: true
    hooks:
      strategy: merge
      target: hooks.json
    mcp:
      strategy: merge
      target: mcp.json
    manifest:
      type: file_list
    detection:
      brain_installed:
        type: prefix_scan
        dirs:
          - agents
          - rules
    placement: copy_and_merge
```

### Go Type Hierarchy

```go
type ToolsConfig struct {
    Tools map[string]*ToolConfig `yaml:"tools"`
}

type ToolConfig struct {
    Name             string            // derived from map key, not in YAML
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

type AgentConfig struct {
    Frontmatter []string `yaml:"frontmatter"`
}

type RuleConfig struct {
    Extension      string         `yaml:"extension"`
    ExtraFrontmatter map[string]any `yaml:"extra_frontmatter"`
}

type ConfigFileConfig struct {
    Strategy string `yaml:"strategy"`  // "direct", "merge", "none"
    Target   string `yaml:"target"`    // relative path within scope
}

type ManifestConfig struct {
    Type string `yaml:"type"`  // "marketplace", "file_list"
}

type DetectionConfig struct {
    BrainInstalled DetectionCheck `yaml:"brain_installed"`
}

type DetectionCheck struct {
    Type string   `yaml:"type"`  // "json_key", "prefix_scan"
    File string   `yaml:"file"`  // for json_key: path to JSON file
    Key  string   `yaml:"key"`   // for json_key: key to check
    Dirs []string `yaml:"dirs"`  // for prefix_scan: directories to scan
}
```

### Config-to-Code Mapping

This table maps every config field to the existing Go code it replaces:

| Config Field | Claude Code Source | Cursor Source |
|---|---|---|
| `prefix` | `claude.go` hardcoded `false` | `cursor.go` hardcoded `true` |
| `config_dir` | `claudecode.go:ConfigDir()` | `cursor.go:ConfigDir()` |
| `agents.frontmatter` | `claude.go:TransformClaudeAgents()` field list | `cursor.go:TransformCursorAgents()` field list |
| `rules.extension` | `claude.go:TransformClaudeRules()` `.md` | `cursor.go:TransformCursorRules()` `.mdc` |
| `rules.extra_frontmatter` | `claude.go` (none) | `cursor.go` `{alwaysApply: true}` |
| `hooks.strategy` | `claudecode.go` direct write | `cursor.go` RFC 7396 merge |
| `hooks.target` | `claudecode.go` `hooks/hooks.json` | `cursor.go` `hooks.json` |
| `mcp.strategy` | `claudecode.go` direct write | `cursor.go` RFC 7396 merge |
| `mcp.target` | `claudecode.go` `.mcp.json` | `cursor.go` `mcp.json` |
| `manifest.type` | `claudecode.go` marketplace manifest | `cursor.go` file list manifest |
| `detection.brain_installed` | `claudecode.go:IsInstalled()` json key check | `cursor.go:IsInstalled()` prefix scan |
| `placement` | `claudecode.go:Install()` marketplace flow | `cursor.go:Install()` copy+merge flow |
| `scopes` | (single path in `claudecode.go`) | (single path in `cursor.go`) |

### Validation Implementation

```go
func ValidateToolConfig(name string, config *ToolConfig) error {
    var errs []string

    if config.DisplayName == "" {
        errs = append(errs, "display_name is required")
    }
    if config.ConfigDir == "" {
        errs = append(errs, "config_dir is required")
    }
    if len(config.Scopes) == 0 {
        errs = append(errs, "at least one scope is required")
    }
    if _, ok := config.Scopes[config.DefaultScope]; !ok {
        errs = append(errs, fmt.Sprintf("default_scope %q not found in scopes", config.DefaultScope))
    }
    if len(config.Agents.Frontmatter) == 0 {
        errs = append(errs, "agents.frontmatter must list at least one field")
    }
    if !strings.HasPrefix(config.Rules.Extension, ".") {
        errs = append(errs, "rules.extension must start with '.'")
    }

    validStrategies := map[string]bool{"direct": true, "merge": true, "none": true}
    if !validStrategies[config.Hooks.Strategy] {
        errs = append(errs, fmt.Sprintf("hooks.strategy %q invalid; must be direct, merge, or none", config.Hooks.Strategy))
    }
    if !validStrategies[config.MCP.Strategy] {
        errs = append(errs, fmt.Sprintf("mcp.strategy %q invalid; must be direct, merge, or none", config.MCP.Strategy))
    }

    validPlacements := map[string]bool{"marketplace": true, "copy_and_merge": true}
    if !validPlacements[config.Placement] {
        errs = append(errs, fmt.Sprintf("placement %q invalid; must be marketplace or copy_and_merge", config.Placement))
    }

    validManifests := map[string]bool{"marketplace": true, "file_list": true}
    if !validManifests[config.Manifest.Type] {
        errs = append(errs, fmt.Sprintf("manifest.type %q invalid; must be marketplace or file_list", config.Manifest.Type))
    }

    if len(errs) > 0 {
        return fmt.Errorf("tool %q config invalid:\n  %s", name, strings.Join(errs, "\n  "))
    }
    return nil
}
```

### Adding a New Tool (Zero Go Code)

```yaml
  windsurf:
    display_name: "Windsurf"
    prefix: true
    config_dir: ~/.windsurf
    scopes:
      global: ~/.windsurf/
      project: .windsurf/
    default_scope: global
    agents:
      frontmatter:
        - description
    rules:
      extension: .md
    hooks:
      strategy: none
    mcp:
      strategy: merge
      target: mcp.json
    manifest:
      type: file_list
    detection:
      brain_installed:
        type: prefix_scan
        dirs: [agents, rules]
    placement: copy_and_merge
```

No Go code changes required. The engine reads the new tool config at startup and registers a `GenericTarget`.

## Interfaces and APIs

### Public API

```go
func LoadToolConfigs(path string) (*ToolsConfig, error)
func ValidateToolConfig(name string, config *ToolConfig) error
func ValidateAllToolConfigs(configs *ToolsConfig) error
```

## Trade-offs

- [decision] Tool name derived from map key rather than duplicated in YAML to avoid name/key drift #trade-off #consistency
- [decision] Detection config uses a discriminated union (Type field) rather than separate config types because only two detection strategies exist #trade-off #simplicity
- [decision] Extra frontmatter uses `map[string]any` for flexibility rather than typed fields because future tools may need arbitrary frontmatter #trade-off #extensibility

## Observations

- [design] Complete config-to-code mapping table enables mechanical verification of migration correctness #traceability
- [technique] Validation function collects all errors before returning, giving actionable feedback on first run #developer-experience
- [fact] Every config field maps to a specific line range in existing per-tool Go code #completeness
- [insight] The config file serves as documentation of tool differences in addition to driving behavior #dual-purpose
- [constraint] Config schema must be stable before engine implementation begins (TASK-001 blocks TASK-004) #sequencing

## Relations

- implements [[FEAT-005 Unified Tool Engine]]
- satisfies [[REQ-001 Tool Configuration Schema]]
- extends [[DESIGN-001 Engine Architecture]]
- derives_from [[ADR-009 Unified Tool Engine]]
- relates_to [[TASK-001 ToolConfig Schema and YAML Parsing]]
