---
title: DESIGN-001 Registry and Pipeline Architecture
type: design
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/design/design-001-registry-and-pipeline-architecture
---

# DESIGN-001 Registry and Pipeline Architecture

## Summary

FEAT-004 implements ADR-008 (Registry-Based Installer Architecture) to replace the monolithic `apps/tui/cmd/install.go` with a registry-based, pipeline-driven system. The design combines four architectural decisions: a registry pattern for tool dispatch, five library adoptions for JSON and file operations, a step pipeline with rollback for atomic installs, and parallel execution via errgroup.

## Technical Approach

### Four-Phase Delivery

Phase 1 (Foundation) builds the registry, pipeline, and library integrations. Phase 2 (Targets) implements Claude Code and Cursor as self-contained tool installers. Phase 3 (Orchestration) adds parallel execution and rewrites the install command. Phase 4 (Validation) adds golden-file tests and integration verification.

### Phase 1: Foundation

1. Define ToolInstaller interface and registry (TASK-001)
2. Implement step pipeline with rollback (TASK-002)
3. Integrate otiai10/copy for recursive directory copy (TASK-003)
4. Integrate tidwall/gjson and tidwall/sjson for JSON reads/writes (TASK-004)
5. Integrate evanphx/json-patch and adrg/xdg (TASK-005)

### Phase 2: Targets

1. Implement Claude Code target with marketplace registration (TASK-006)
2. Implement Cursor target (TASK-007)

### Phase 3: Orchestration

1. Add parallel multi-tool execution via errgroup (TASK-008)
2. Rewrite install.go as thin orchestration layer (TASK-009)

### Phase 4: Validation

1. Golden-file tests and integration tests (TASK-010)

### Architecture Overview

```text
cmd/install.go (~300 lines)
  |
  +-- UI layer (huh forms: tool selection, confirmation)
  |
  +-- Registry.All() --> filtered by config targets
  |
  +-- errgroup.WithContext (parallel execution)
      |
      +-- Tool A: Pipeline.Execute()
      |     +-- Step 1: Clean (Condition, Action, Undo)
      |     +-- Step 2: Transform (Condition, Action, Undo)
      |     +-- Step 3: Config merge (Condition, Action, Undo)
      |     +-- Step 4: Manifest (Condition, Action, Undo)
      |
      +-- Tool B: Pipeline.Execute()
            +-- Step 1: Clean (Condition, Action, Undo)
            +-- Step 2: Transform (Condition, Action, Undo)
            +-- Step 3: Config merge (Condition, Action, Undo)
            +-- Step 4: Manifest (Condition, Action, Undo)
```

### Registry Dispatch Flow

```text
1. Program starts
2. Blank import triggers init() in each target file
3. Each init() calls installer.Register(&Target{})
4. cmd/install.go calls installer.All() for UI list
5. User selects tools
6. For each selected tool:
   a. installer.Get(slug) returns ToolInstaller
   b. Check Provisioner interface, call Provision() if present
   c. Call Install(src) which builds and executes pipeline
   d. Check Validator interface, call Validate() if present
7. On uninstall:
   a. Call Uninstall()
   b. Check Cleaner interface, call Cleanup() if present
```

### Library Integration Points

| Library | Used By | Purpose |
|---|---|---|
| otiai10/copy | All targets | Recursive file copy with skip filters |
| tidwall/gjson | IsBrainInstalled(), Condition guards | Path-based JSON reads |
| tidwall/sjson | Install/Uninstall steps | Path-based JSON set/delete |
| evanphx/json-patch | MCP config merge step | RFC 7396 deep merge |
| adrg/xdg | ConfigDir() | XDG path resolution |

## Interfaces and APIs

### Primary Interface

```go
// internal/installer/registry.go
type ToolInstaller interface {
    Name() string
    DisplayName() string
    ConfigDir() string
    IsToolInstalled() bool
    IsBrainInstalled() bool
    Install(src *adapters.TemplateSource) error
    Uninstall() error
    AdapterTarget() string
}
```

- [decision] Single interface covers all tool operations; optional interfaces handle lifecycle hooks #api

### Pipeline API

```go
// internal/installer/pipeline.go
type Step struct {
    Name      string
    Condition func() bool
    Action    func() error
    Undo      func() error
}

type Pipeline struct {
    Steps []Step
}

func (p *Pipeline) Execute() error
```

- [decision] Pipeline is a value type; each Install() call creates a fresh pipeline #immutability

### Data Flow

```text
User selects "Claude Code" and "Cursor" for install:
  |
  +-- errgroup spawns 2 goroutines
  |
  +-- Goroutine 1: ClaudeCode.Install(src)
  |     +-- Pipeline: clean -> transform -> marketplace -> manifest
  |     +-- Output buffered to bytes.Buffer
  |     +-- On success: buffer flushed to stdout
  |
  +-- Goroutine 2: Cursor.Install(src)
  |     +-- Pipeline: clean -> transform -> mcp-merge -> manifest
  |     +-- Output buffered to bytes.Buffer
  |     +-- On success: buffer flushed to stdout
  |
  +-- errgroup.Wait() collects results
  +-- Report per-tool success/failure
```

### File Structure

```text
apps/tui/
  internal/
    installer/
      registry.go        # ToolInstaller interface, Register(), Get(), All()
      pipeline.go         # Step, Pipeline, Execute() with rollback
      targets/
        claudecode.go     # ClaudeCode struct, init() self-registers
        cursor.go         # Cursor struct, init() self-registers
        targets.go        # blank import aggregator (if needed)
  cmd/
    install.go            # ~300 lines: UI, registry calls, errgroup orchestration
```

## Trade-offs

- [decision] Single PR clean break chosen over incremental migration because the old switch dispatch and new registry cannot coexist meaningfully #trade-off #migration
- [decision] ~50 lines custom pipeline chosen over workflow libraries because the use case is a simple linear sequence #trade-off #simplicity
- [decision] Buffered output adds memory overhead but prevents interleaved output which is unreadable #trade-off #ux
- [decision] Blank import pattern requires explicit import management but provides automatic registration #trade-off #ergonomics

## Observations

- [design] Four-phase delivery: foundation, targets, orchestration, validation #phases
- [decision] Registry + pipeline + errgroup compose into a clean architecture where each tool is fully self-contained #architecture
- [insight] The blank import pattern means adding a tool never touches existing code #extensibility
- [constraint] All targets share the Pipeline type but build independent step sequences #encapsulation
- [fact] install.go drops from 1,588 to ~300 lines with 0 switch statements #impact

## Relations

- implements [[FEAT-004 Registry-Based Installer]]
- satisfies [[REQ-001 ToolInstaller Interface and Registry]]
- satisfies [[REQ-002 Step Pipeline with Rollback]]
- satisfies [[REQ-006 Parallel Multi-Tool Execution]]
- derives_from [[ADR-008 Registry-Based Installer Architecture]]
