---
title: DESIGN-001 Engine Architecture
type: design
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/design/design-001-engine-architecture
---

# DESIGN-001 Engine Architecture

## Summary

FEAT-005 implements ADR-009 (Unified Tool Engine) to replace per-tool adapter and installer target Go files with a single config-driven engine. The design introduces three new components (config parser, generic transform engine, placement strategies) while retaining all shared infrastructure from ADR-008 (registry, pipeline, executor, manifest) and shared adapter utilities (shared.go, compose.go, source.go).

## Technical Approach

### Three-Phase Delivery

Phase 1 (Foundation) establishes the config schema, version constant, and relocates shared code. Phase 2 (Engine Implementation) builds the transform engine, placement strategies, and generic installer target. Phase 3 (Validation and Migration) ensures byte-level parity, tests scopes, and deletes old per-tool code.

### Phase 1: Foundation

1. Define `ToolConfig` struct and YAML parsing with validation (TASK-001)
2. Create build-time version constant replacing hardcoded "2.0.0" (TASK-002)
3. Relocate `shared.go`, `compose.go`, `source.go` from `adapters/` to `engine/` (TASK-003)

### Phase 2: Engine Implementation

1. Implement `TransformAll` function parameterized by `ToolConfig` (TASK-004)
2. Implement placement strategy abstraction with marketplace and copy_and_merge (TASK-005)
3. Implement `GenericTarget` replacing per-tool installer targets (TASK-006)

### Phase 3: Validation and Migration

1. Golden-file parity tests comparing engine output to existing adapter output (TASK-007)
2. Three install scopes with CLI flag and config defaults (TASK-008)
3. Integration tests for end-to-end install flow (TASK-009)
4. Delete per-tool adapter and installer target files (TASK-010)

### Package Layout

```text
apps/tui/
  internal/
    engine/                    # NEW PACKAGE
      config.go                # ToolConfig type, YAML parsing, validation
      transform.go             # Generic TransformAll (replaces claude.go + cursor.go)
      placement.go             # PlacementStrategy interface + implementations
      shared.go                # RELOCATED from adapters/: GeneratedFile, BrainConfig, frontmatter
      compose.go               # RELOCATED from adapters/: Composable directory assembly
      source.go                # RELOCATED from adapters/: TemplateSource abstraction
    installer/                 # EXISTING (retained from ADR-008)
      registry.go              # RETAINED: Register(), Get(), All(), ToolInstaller interface
      pipeline.go              # RETAINED: Step, Pipeline, Execute() with rollback
      executor.go              # RETAINED: ExecuteAll parallel execution
      manifest.go              # RETAINED: XDG-based manifest read/write
      targets/
        generic.go             # NEW: Single GenericTarget implementing ToolInstaller
    version/
      version.go               # NEW: Build-time version constant
  tools.config.yaml            # NEW: Per-tool YAML configuration
```

### Data Flow

```text
tools.config.yaml
    |
    v
config.go (parse + validate ToolConfig)
    |
    v
registry.go (register GenericTarget for each tool)
    |
    v
[user runs "brain install"]
    |
    v
pipeline.go (build step sequence)
    |
    v
generic.go Install():
    |
    +-- 1. placement.Clean(ctx, tool, scope)
    |
    +-- 2. engine.TransformAll(src, tool, brainConfig)
    |       |
    |       +-- transform agents (tool.Agents.Frontmatter)
    |       +-- transform skills  (tool.Prefix)
    |       +-- transform commands (tool.Prefix, compose.go)
    |       +-- transform rules   (tool.Rules.Extension, tool.Rules.ExtraFM)
    |       +-- transform hooks   (tool.Hooks.Strategy)
    |       +-- transform mcp     (tool.MCP.Strategy)
    |       |
    |       v
    |       TransformOutput ([]GeneratedFile per content type)
    |
    +-- 3. placement.Place(ctx, output, tool, scope)
    |       |
    |       +-- [marketplace]: write to marketplace dir, register
    |       +-- [copy_and_merge]: copy files, RFC 7396 merge configs
    |
    +-- 4. manifest.Write(tool, scope, placedFiles)
```

## Interfaces and APIs

### Engine Public API

```go
// config.go
func LoadToolConfigs(path string) (map[string]*ToolConfig, error)
func ValidateToolConfig(config *ToolConfig) error

// transform.go
type TransformOutput struct {
    Agents   []GeneratedFile
    Skills   []GeneratedFile
    Commands []GeneratedFile
    Rules    []GeneratedFile
    Hooks    []GeneratedFile
    MCP      []GeneratedFile
}

func TransformAll(src *TemplateSource, tool *ToolConfig, brainConfig *BrainConfig) (*TransformOutput, error)

// placement.go
type PlacementStrategy interface {
    Place(ctx context.Context, output *TransformOutput, tool *ToolConfig, scope string) error
    Clean(ctx context.Context, tool *ToolConfig, scope string) error
}

func NewMarketplacePlacement() PlacementStrategy
func NewCopyAndMergePlacement() PlacementStrategy
```

### Installer Integration

```go
// targets/generic.go
type GenericTarget struct {
    config    *ToolConfig
    placement PlacementStrategy
}

func NewGenericTarget(config *ToolConfig, placement PlacementStrategy) *GenericTarget
```

### Migration Approach

```text
Step 1: Build engine alongside existing per-tool code
  - Both code paths coexist; engine is not wired into install command
  - Engine tests compare output to existing adapter output

Step 2: Wire engine into install command for one tool
  - Route Claude Code through engine, keep Cursor on old path
  - Golden-file tests validate parity

Step 3: Wire remaining tools
  - Route Cursor through engine
  - All golden-file tests pass for both tools

Step 4: Delete old code
  - Remove adapters/claude.go, adapters/cursor.go
  - Remove targets/claudecode.go, targets/cursor.go
  - Remove adapter-specific tests (golden tests now test engine)
```

## Trade-offs

- [decision] YAML config over JSON because YAML supports comments and is more readable for per-tool declarations #trade-off #config
- [decision] Relocate shared code to engine/ rather than keeping adapters/ package because the adapters package concept is eliminated #trade-off #migration
- [decision] Strategy interface for placement rather than switch/case because new placement strategies (e.g., symlink-based) may be needed for future tools #trade-off #extensibility
- [decision] Incremental migration over big-bang rewrite to maintain test coverage throughout transition #trade-off #safety

## Observations

- [design] Three-phase delivery mirrors FEAT-003 pattern: foundation, implementation, validation #phases
- [decision] Package relocation (adapters/ to engine/) is a one-time cost that eliminates the artificial adapter/engine boundary #migration
- [insight] The config file becomes the single source of truth for tool differences, replacing scattered Go constants #architecture
- [constraint] Golden-file parity is the non-negotiable gate between Phase 2 and Phase 3 #quality
- [fact] All shared code (shared.go, compose.go, source.go) survives relocation unchanged #retention

## Relations

- implements [[FEAT-005 Unified Tool Engine]]
- satisfies [[REQ-001 Tool Configuration Schema]]
- satisfies [[REQ-002 Generic Transform Engine]]
- satisfies [[REQ-003 Placement Strategy Abstraction]]
- satisfies [[REQ-004 GenericTarget Installer]]
- derives_from [[ADR-009 Unified Tool Engine]]
- extends [[ADR-008 Registry-Based Installer Architecture]]
