---
title: ADR-009 Unified Tool Engine
type: decision
permalink: decisions/adr-009-unified-tool-engine
tags:
- adr
- tool-engine
- config-driven
- adapters
- installer
- proposed
---

# ADR-009 Unified Tool Engine

## Status: PROPOSED

## Context

Brain installs agents, skills, commands, rules, hooks, and MCP configs into AI coding tools (Claude Code, Cursor). The current architecture splits this work across two layers that perform overlapping jobs:

### Layer 1: Adapters (`internal/adapters/`)

Per-tool Go files that read canonical templates and produce `GeneratedFile` slices with tool-specific transforms:

| File | Lines | Responsibility |
|:--|:--|:--|
| `claude.go` | 877 | Claude Code transforms (agents, skills, commands, rules, hooks, MCP) |
| `cursor.go` | 694 | Cursor transforms (same six content types, different output format) |
| `shared.go` | 618 | Shared types, frontmatter parsing, file discovery, config reading |
| `compose.go` | 483 | Composable directory assembly (`_order.yaml`, sections, variants) |
| `source.go` | 107 | TemplateSource abstraction (filesystem vs embedded) |

Each per-tool adapter file duplicates the same six-phase transform: agents, skills, commands, rules/protocols, hooks, MCP. The tool-specific differences are narrow:

- **Agents**: Which frontmatter fields to include (Claude Code: name, model, description, memory, color, argument-hint, tools, skills; Cursor: description only)
- **Rules**: File extension (`.md` vs `.mdc`) and optional extra frontmatter (`alwaysApply: true` for Cursor)
- **Hooks**: Direct file write (Claude Code) vs JSON merge payload (Cursor)
- **MCP**: Direct file write (Claude Code) vs JSON merge payload (Cursor)
- **Skills/Commands**: Identical logic, delegated to shared functions already
- **Prefix**: Configurable per-tool (`false` for Claude Code, `true` for Cursor)

Every transform function exists in both a filesystem variant (`TransformClaudeAgents`) and a TemplateSource variant (`TransformClaudeAgentsFromSource`), doubling the surface area.

### Layer 2: Installer Targets (`internal/installer/targets/`)

Per-tool Go files that orchestrate the installation pipeline:

| File | Lines | Responsibility |
|:--|:--|:--|
| `claudecode.go` | 225 | Pipeline: clean, adapter-transform, register-marketplace, write-manifest |
| `cursor.go` | 566 | Pipeline: clean, adapter-transform, copy-and-merge, write-manifest |

Each target calls its adapter, writes the output to disk, then performs tool-specific placement (Claude Code uses marketplace registration; Cursor uses file copy with RFC 7396 JSON merge for hooks/MCP).

### The Duplication Problem

Adding a new tool (Windsurf, Cline, Codex) requires:

1. A new `internal/adapters/{tool}.go` file (~500-700 lines) repeating the six-phase transform with minor config differences
2. A new `internal/installer/targets/{tool}.go` file (~200-500 lines) repeating the pipeline with a different placement strategy
3. Updates to `brain.config.json` targets section

The per-tool Go code in the adapter layer is **80% identical** across tools. The remaining 20% is parameterizable: which frontmatter fields, what file extension, prefix or not, direct-write or merge. These are data, not logic.

### Line Count Summary (Per-Tool Go Code)

| | Claude Code | Cursor | Total |
|:--|:--|:--|:--|
| Adapter | 877 | 694 | 1,571 |
| Installer target | 225 | 566 | 791 |
| **Per-tool total** | **1,102** | **1,260** | **2,362** |

Shared code (used by both tools, survives the merge): `shared.go` (618), `compose.go` (483), `source.go` (107), `registry.go` (92), `pipeline.go` (64), `executor.go` (99), `manifest.go` (70) = 1,533 lines.

## Decision

Replace both the per-tool adapter layer and per-tool installer target layer with a single config-driven engine. The registry, pipeline, executor, and shared adapter utilities are retained. Only the per-tool files are eliminated.

### Decision 1: Tool Configuration Schema

A `tools.config.yaml` file (or an expanded `targets` section in `brain.config.json`) declares the per-tool differences that currently live in Go code:

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
      strategy: direct  # write hooks.json directly
      target: hooks/hooks.json
    mcp:
      strategy: direct  # write .mcp.json directly
      target: .mcp.json
    manifest:
      type: marketplace  # generates plugin.json + marketplace.json
    detection:
      brain_installed:
        type: json_key  # check for key in a JSON file
        file: plugins/known_marketplaces.json
        key: brain
    placement: marketplace  # uses marketplace registration flow

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
      strategy: merge  # RFC 7396 JSON merge into existing hooks.json
      target: hooks.json
    mcp:
      strategy: merge  # RFC 7396 JSON merge into existing mcp.json
      target: mcp.json
    manifest:
      type: file_list  # tracks installed files for uninstall
    detection:
      brain_installed:
        type: prefix_scan  # scan agents/rules dirs for brain-prefixed files
        dirs: [agents, rules]
    placement: copy_and_merge  # file copy + JSON merge for configs

  # Future tools - zero Go code required
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
      strategy: none  # Windsurf has no hooks yet
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

Every field that currently differs between `claude.go` and `cursor.go` becomes a config entry. The tool config is the single source of truth for per-tool behavior.

### Decision 2: Generic Transform Engine

A single `engine.go` replaces both `claude.go` and `cursor.go` with one set of transform functions parameterized by tool config:

```go
// internal/engine/transform.go

type ToolConfig struct {
    Name            string
    DisplayName     string
    Prefix          bool
    ConfigDir       string
    Scopes          map[string]string
    DefaultScope    string
    AgentFrontmatter []string       // which fields to include
    RuleExtension   string          // ".md" or ".mdc"
    ExtraRuleFM     map[string]any  // e.g., {alwaysApply: true}
    HookStrategy    string          // "direct", "merge", "none"
    HookTarget      string
    MCPStrategy     string          // "direct", "merge", "none"
    MCPTarget       string
    ManifestType    string          // "marketplace", "file_list"
    Placement       string          // "marketplace", "copy_and_merge"
    Detection       DetectionConfig
}

// TransformAll is the single entry point, replacing
// TransformClaudeCodeFromSource and CursorTransformFromSource.
func TransformAll(src *adapters.TemplateSource, tool *ToolConfig,
    brainConfig *adapters.BrainConfig) (*TransformOutput, error) {
    // 1. Transform agents using tool.AgentFrontmatter
    // 2. Transform skills (shared, parameterized by tool.Prefix)
    // 3. Transform commands (shared, parameterized by tool.Prefix)
    // 4. Transform rules using tool.RuleExtension + tool.ExtraRuleFM
    // 5. Transform hooks using tool.HookStrategy
    // 6. Transform MCP using tool.MCPStrategy
    // All driven by config, zero per-tool branching
}
```

The five operations the engine performs for every tool:

1. **Agents**: Read canonical agents, apply frontmatter fields from `tool.AgentFrontmatter` list, apply prefix per `tool.Prefix`
2. **Skills**: Copy skill directories with optional prefix (already shared logic)
3. **Commands**: Copy command files with optional prefix, support composable dirs (already shared logic)
4. **Rules**: Read protocols, apply `tool.RuleExtension` and `tool.ExtraRuleFM`, apply prefix
5. **Config files (hooks + MCP)**: Route to `direct` (write file as-is) or `merge` (produce RFC 7396 merge payload) based on `tool.HookStrategy` / `tool.MCPStrategy`

### Decision 3: Generic Installer Target

A single `GenericTarget` replaces both `claudecode.go` and `cursor.go`:

```go
// internal/installer/targets/generic.go

type GenericTarget struct {
    config *engine.ToolConfig
}

func (g *GenericTarget) Name() string        { return g.config.Name }
func (g *GenericTarget) DisplayName() string { return g.config.DisplayName }
func (g *GenericTarget) ConfigDir() string   { return expandPath(g.config.ConfigDir) }
func (g *GenericTarget) AdapterTarget() string { return g.config.Name }

func (g *GenericTarget) Install(ctx context.Context, src *adapters.TemplateSource) error {
    // Build pipeline from config:
    // 1. Clean previous (strategy-aware)
    // 2. Engine transform (config-driven, replaces per-tool adapter call)
    // 3. Place output (route to marketplace-register or copy-and-merge)
    // 4. Write manifest (type from config)
    return pipeline.Execute(ctx)
}
```

The placement step dispatches on `tool.Placement`:
- `"marketplace"`: Write to marketplace dir, register in `known_marketplaces.json` (Claude Code flow)
- `"copy_and_merge"`: Copy content dirs, apply RFC 7396 merge for hooks/MCP (Cursor flow)

New placement strategies can be added as needed without per-tool files.

### Decision 4: Three Install Scopes

The current code supports only one install location per tool. The engine supports three scopes declared in config:

| Scope | Path Pattern | Use Case |
|:--|:--|:--|
| `global` | `~/.{tool}/` | Install Brain globally for a tool |
| `plugin` | `~/.{tool}/plugins/marketplaces/brain/` | Install as marketplace entry (Claude Code) |
| `project` | `./{project}/.{tool}/` | Install per-project |

The `default_scope` config key determines which scope `brain install` uses. The `--scope` CLI flag overrides it. All scopes use the same engine; only the output path changes.

### Decision 5: Hardcoded Version Elimination

The hardcoded `"version": "2.0.0"` in `cmd/install.go:367` is replaced by a build-time constant:

```go
// internal/version/version.go
var Version = "dev" // set by -ldflags at build time
```

The Makefile/GoReleaser sets `-ldflags "-X .../version.Version=0.1.13"` from the release tag.

## What This Supersedes

- **ADR-008** (registry-based installer): The registry pattern, pipeline, executor, and library choices are **retained**. What changes is that per-tool target files (`claudecode.go`, `cursor.go`) become a single `generic.go` driven by config. ADR-008's ToolInstaller interface stays; the implementations become generic.
- **ADR-003** (adapter implementation): Per-tool adapter files (`claude.go`, `cursor.go`) are replaced by the config-driven engine. The shared utilities (`shared.go`, `compose.go`, `source.go`) survive as-is.

## Target File Structure

```
apps/tui/
  internal/
    engine/
      config.go          # ToolConfig type, YAML parsing, validation
      transform.go       # Generic TransformAll (replaces claude.go + cursor.go adapters)
      placement.go       # Placement strategies (marketplace, copy_and_merge)
      shared.go          # RETAINED: GeneratedFile, BrainConfig, frontmatter, file discovery
      compose.go         # RETAINED: Composable directory assembly
      source.go          # RETAINED: TemplateSource abstraction
    installer/
      registry.go        # RETAINED: Register(), Get(), All(), ToolInstaller interface
      pipeline.go        # RETAINED: Step, Pipeline, Execute() with rollback
      executor.go        # RETAINED: ExecuteAll parallel execution
      manifest.go        # RETAINED: XDG-based manifest read/write
      targets.go         # NEW: Single GenericTarget implementing ToolInstaller
    version.go         # NEW: Build-time version constant
  tools.config.yaml      # NEW: Per-tool configuration
```

## Impact

| Metric | Before | After |
|:--|:--|:--|
| Per-tool adapter Go files | 2 (1,571 lines) | 0 |
| Per-tool installer target Go files | 2 (791 lines) | 0 |
| Per-tool Go code total | 2,362 lines | 0 |
| New engine code | 0 | ~400-500 lines (transform + placement + config) |
| New tool config | 0 | ~30 lines YAML per tool |
| Net code reduction | -- | ~1,800-1,900 lines |
| New tool effort | ~800-1,200 lines Go across 2 files | ~30 lines YAML config |
| Shared code retained | 1,533 lines | 1,533 lines (unchanged) |
| Registry pattern (ADR-008) | Kept | Kept (targets become config-driven) |
| Pipeline + rollback (ADR-008) | Kept | Kept |
| Library choices (ADR-008) | Kept | Kept (gjson, sjson, json-patch, copy, xdg) |
| TemplateSource abstraction | Kept | Kept |
| Composable directories | Kept | Kept |
| Three install scopes | No | Yes (global, plugin, project) |
| Hardcoded version | Yes ("2.0.0") | No (build-time -ldflags) |

## Alternatives Considered

### Alternative 1: Keep Separate Adapter + Installer Layers (Status Quo)

Each new tool requires ~800-1,200 lines of Go code across two files that are 80% copy-paste of existing tool files. At 5 tools, this is ~6,000 lines of near-identical Go code. Rejected because the per-tool differences are data, not logic.

### Alternative 2: Per-Tool Go Files with Shared Helpers (ADR-008 Current Trajectory)

ADR-008 reduced the installer side from a monolithic file to per-tool target files, but each target still contains Go code. The adapter layer was untouched. Adding a new tool still requires writing Go code in two places. This approach is better than status quo but does not address the fundamental observation that per-tool differences are parameterizable.

### Alternative 3: Runtime Plugin System (Dynamic Loading)

Go plugins (`plugin.Open`) or hashicorp/go-plugin for dynamically loaded tool support. Overkill: Brain targets 5-10 compile-time known tools. Plugin systems add deployment complexity (shared objects, version pinning, platform support) for zero benefit when all tools are known at build time. Plugin boundaries also prevent the compiler from catching type errors.

### Alternative 4: Code Generation

Generate `claude.go` and `cursor.go` from a template + config at build time using `go generate`. This preserves compile-time type safety and eliminates manual duplication, but adds build complexity (codegen templates, generated file hygiene) and the generated code is still per-tool boilerplate. The config-driven engine achieves the same outcome at runtime with less machinery.

## Implementation Notes

- **Incremental migration**: The engine can be introduced alongside existing per-tool files. Route one tool to the engine, validate parity with golden-file tests, then migrate the second tool and delete the old files.
- **Config validation**: The tool config schema should be validated at startup. Invalid config (missing required fields, unknown placement strategy) should fail fast with clear errors.
- **Existing tests**: Golden-file tests in `targets/golden_test.go` and adapter tests (`claude_test.go`, `cursor_test.go`, `compose_test.go`) become the parity tests. The engine's output must match the existing golden files byte-for-byte before the old code is removed.
- **TemplateSource preserved**: The engine uses the same `TemplateSource` abstraction for filesystem/embedded reads. No changes to the binary embedding pipeline.
- **Composable directories preserved**: The engine delegates to `compose.go` for `_order.yaml` assembly. The composition logic is tool-agnostic and already parameterized by variant name.

## Consequences

- Adding a new tool (Windsurf, Cline, Codex) requires only a YAML config block (~30 lines) and zero Go code.
- The adapter and installer layers merge into a single engine, reducing cognitive overhead for contributors.
- All per-tool transform logic is expressed declaratively in config, making differences between tools visible in one file.
- The registry, pipeline, and library infrastructure from ADR-008 is preserved; this ADR builds on that foundation rather than replacing it.
- Edge cases specific to one tool (e.g., Claude Code's marketplace registration, Cursor's reference docs in `~/.agents/`) are handled via config-driven placement strategies, not per-tool code branches.

## Observations

- [decision] Config-driven engine replaces per-tool adapter and installer target Go files #architecture
- [decision] ToolConfig YAML schema parameterizes all per-tool differences: frontmatter fields, extensions, placement strategy, merge strategy #config
- [decision] Single GenericTarget implements ToolInstaller interface for all tools, driven by ToolConfig #registry
- [decision] Placement strategies (marketplace, copy_and_merge) replace per-tool Install() implementations #placement
- [decision] Three install scopes (global, plugin, project) replace single hardcoded install location #scopes
- [decision] Build-time version constant replaces hardcoded "2.0.0" string #versioning
- [decision] ADR-008 registry, pipeline, executor, and library choices are retained, not replaced #continuity
- [decision] Incremental migration path: engine alongside old code, golden-file parity, then delete old files #migration
- [fact] Per-tool adapter code is 1,571 lines (claude.go 877 + cursor.go 694) #codebase
- [fact] Per-tool installer target code is 791 lines (claudecode.go 225 + cursor.go 566) #codebase
- [fact] Total per-tool Go code to eliminate: 2,362 lines #impact
- [fact] Shared code retained unchanged: 1,533 lines (shared.go, compose.go, source.go, registry, pipeline, executor, manifest) #codebase
- [fact] Per-tool differences reduce to 5 parameterizable axes: frontmatter fields, file extension, prefix, merge strategy, placement strategy #analysis
- [insight] The adapter layer's per-tool code is 80% identical; the 20% that differs is data (which fields, which extension) not logic #architecture
- [insight] Merging adapters + installer targets into one engine eliminates the artificial boundary where transforms produce GeneratedFile slices that targets then re-read and place #simplification

## Relations

- supersedes [[ADR-003 Adapter Implementation Decisions]]
- extends [[ADR-008 Registry-Based Installer Architecture]]
- extends [[ADR-002 Cross-Platform Plugin Architecture]]
- relates_to [[ADR-005 Config and Agents MD Decisions]]
- relates_to [[ADR-006 Release Workflow and Distribution]]
