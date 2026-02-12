---
title: REQ-004 GenericTarget Installer
type: requirement
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/requirements/req-004-generic-target-installer
---

# REQ-004 GenericTarget Installer

## Requirement Statement

The system MUST implement a single `GenericTarget` struct in `internal/installer/targets/` that replaces both `ClaudeCodeTarget` and `CursorTarget`. The `GenericTarget` MUST implement the existing `ToolInstaller` interface from ADR-008's registry, parameterized by `ToolConfig`.

### GenericTarget Structure

```go
type GenericTarget struct {
    config    *engine.ToolConfig
    placement engine.PlacementStrategy
}

// ToolInstaller interface (from registry.go, unchanged)
func (g *GenericTarget) Name() string
func (g *GenericTarget) DisplayName() string
func (g *GenericTarget) ConfigDir() string
func (g *GenericTarget) AdapterTarget() string
func (g *GenericTarget) Install(ctx context.Context, src *adapters.TemplateSource) error
func (g *GenericTarget) Uninstall(ctx context.Context) error
func (g *GenericTarget) IsInstalled(ctx context.Context) (bool, error)
```

### Install Pipeline

The `Install` method builds a pipeline from config:

```text
1. Clean previous installation (placement.Clean)
2. Transform all content types (engine.TransformAll)
3. Place output on disk (placement.Place)
4. Write manifest (marketplace or file_list per config)
```

### Registration

All tools from `tools.config.yaml` MUST be registered with the existing registry at startup:

```text
FOR each tool in config.Tools:
    placement = resolvePlacement(tool.Placement)  // marketplace or copy_and_merge
    target = &GenericTarget{config: tool, placement: placement}
    registry.Register(target)
```

## Acceptance Criteria

- [ ] [requirement] `GenericTarget` struct defined in `internal/installer/targets/` #acceptance
- [ ] [requirement] `GenericTarget` implements `ToolInstaller` interface from `registry.go` #acceptance
- [ ] [requirement] Install pipeline: clean, transform, place, manifest #acceptance
- [ ] [requirement] Uninstall removes placed files using manifest data #acceptance
- [ ] [requirement] IsInstalled uses `tool.Detection` config for tool-specific checks #acceptance
- [ ] [requirement] All tools from config registered with registry at startup #acceptance
- [ ] [requirement] Existing `pipeline.Execute` used for rollback-safe installation #acceptance
- [ ] [requirement] Per-tool target files (`claudecode.go`, `cursor.go`) can be deleted after `GenericTarget` passes all tests #acceptance

## Observations

- [requirement] GenericTarget is the unification point for per-tool installer code #architecture
- [technique] ToolConfig drives all behavior; zero per-tool branching in GenericTarget #config-driven
- [constraint] Must implement existing ToolInstaller interface to maintain registry compatibility #compatibility
- [fact] Registry, pipeline, executor from ADR-008 are retained unchanged #continuity
- [insight] Detection config replaces hardcoded IsInstalled checks in per-tool targets #detection

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[ADR-009 Unified Tool Engine]]
- depends_on [[REQ-002 Generic Transform Engine]]
- depends_on [[REQ-003 Placement Strategy Abstraction]]
- relates_to [[TASK-006 GenericTarget Installer]]
- relates_to [[DESIGN-001 Engine Architecture]]
- extends [[ADR-008 Registry-Based Installer Architecture]]
