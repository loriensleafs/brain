---
title: ADR-008 Registry-Based Installer Architecture
type: decision
permalink: decisions/adr-008-registry-based-installer-architecture
tags:
- adr
- installer
- registry-pattern
- accepted
---

# ADR-008 Registry-Based Installer Architecture

## Status: ACCEPTED

## Context

The Brain installer (`apps/tui/cmd/install.go`, 1,588 lines) handles installing Brain agents, skills, commands, hooks, and MCP configs into AI coding tools (Claude Code, Cursor). The current implementation uses switch-statement dispatch across 6 locations to route operations by tool slug string. Adding a new tool target requires modifying every switch. The file also contains hand-rolled implementations for recursive file copy, JSON merge (limited to 2-level depth), and JSON key removal that have known limitations and no rollback on failure.

### AI Tool Plugin Systems Are Converging

Research across 5 major AI coding tools reveals that plugin/extension systems have converged on nearly identical patterns:

| Capability | Claude Code | Cursor | Windsurf | Cline | Copilot |
|:--|:--|:--|:--|:--|:--|
| Skills/Commands | `.claude/commands/` | `.cursor/commands/` | `.windsurf/commands/` | - | - |
| Agent rules | `.claude/rules/` `.claude/agents/` | `.cursor/rules/` `.cursor/agents/` | `.windsurf/rules/` | `.clinerules` | `.github/copilot-instructions.md` |
| MCP config | `.claude/mcp.json` | `.cursor/mcp.json` | `.windsurf/mcp.json` | `mcp_settings.json` | `mcp.json` |
| Hooks | `.claude/hooks.json` | `.cursor/hooks.json` | - | - | - |

The adapter's job is 80% file placement into tool-specific paths and 20% tool-specific transforms. This uniformity makes the registry pattern a natural fit: each tool target is a self-contained unit that knows its own paths and install mechanics.

### Current Switch Dispatch Locations

Six switch statements dispatch on tool slug string, all of which must be updated when adding a new tool:

1. `runAdapterStage` (lines 193-211) -- transform dispatch
2. `runAdapterStageFromSource` (lines 224-246) -- transform dispatch from TemplateSource
3. `runInstall` switch (lines 1311-1322) -- install dispatch
4. `uninstallTool` (lines 1552-1564) -- uninstall dispatch
5. `isBrainInstalled` (lines 831-840) -- detection dispatch
6. `toolDisplayName` (lines 843-852) -- display name dispatch

## Decision

Four architectural decisions replace the monolithic installer with a registry-based, library-assisted, pipeline-driven system. This is a clean-break rewrite with no backwards compatibility layer.

### Decision 1: Registry Pattern (database/sql register-on-init)

Each tool target implements a `ToolInstaller` interface and self-registers via `init()`, following the same pattern used by `database/sql` since Go 1.0.

```go
// internal/installer/registry.go

type ToolInstaller interface {
    Name() string           // slug: "claude-code", "cursor"
    DisplayName() string    // human: "Claude Code", "Cursor"
    ConfigDir() string      // e.g., ~/.claude, ~/.cursor
    IsToolInstalled() bool  // tool binary/config exists on disk
    IsBrainInstalled() bool // Brain content already present
    Install(src *adapters.TemplateSource) error
    Uninstall() error
    AdapterTarget() string  // adapter transform key
}

var registry = map[string]ToolInstaller{}

func Register(installer ToolInstaller) {
    registry[installer.Name()] = installer
}

func Get(name string) (ToolInstaller, bool) {
    t, ok := registry[name]
    return t, ok
}

func All() []ToolInstaller { /* returns sorted slice */ }
```

Each tool target self-registers in its `init()`:

```go
// internal/installer/targets/claudecode.go
package targets

func init() {
    installer.Register(&ClaudeCode{})
}
```

The install command imports targets via blank import:

```go
// cmd/install.go
import _ "github.com/peterkloss/brain-tui/internal/installer/targets"
```

Config-driven activation from `brain.config.json` targets section allows enabling/disabling tools without code changes.

Optional lifecycle interfaces follow the Caddy v2 pattern for tools needing extra setup (like Claude Code's marketplace registration):

```go
// Optional interfaces, checked via type assertion
type Provisioner interface {
    Provision() error  // pre-install setup
}

type Validator interface {
    Validate() error   // post-install validation
}

type Cleaner interface {
    Cleanup() error    // post-uninstall cleanup
}
```

**Precedent**: database/sql (Go stdlib since 1.0), Caddy v2 modules, Docker volume/network drivers, Hugo output formats.

**Impact**: Adding a new tool = one Go file (~80-120 lines) implementing ToolInstaller + one blank import + one `brain.config.json` targets entry. Zero switch statements touched. All 6 switch dispatch locations are eliminated.

### Decision 2: Five Library Adoptions

Five libraries replace hand-rolled implementations. All are zero or near-zero transitive dependency, MIT/BSD licensed, actively maintained, and cross-platform tested.

#### otiai10/copy (recursive directory copy)

| | |
|:--|:--|
| **Stars** | 769 |
| **Importers** | 1,200+ |
| **License** | MIT |
| **Purpose** | Recursive directory copy with filter callbacks |
| **Replaces** | `copyBrainFiles` + `copyBrainFilesRecursive` (~70 lines) |

The `Skip` function replaces manual `.DS_Store`/`.gitkeep`/`.git` checks. `OnDirExists` controls merge-vs-replace behavior. Handles symlinks, permissions, and timestamps correctly on all platforms.

#### tidwall/gjson (path-based JSON reads)

| | |
|:--|:--|
| **Stars** | 15,400 |
| **Importers** | 9,873 |
| **License** | MIT |
| **Purpose** | Path-based JSON reads WITHOUT full unmarshal |
| **Replaces** | Manual `json.Unmarshal` + map type assertions for key existence checks |

26x faster than map-based approach for targeted reads. Zero allocations for simple path lookups. Used by the install detection code (`isBrainInstalled` checks) and config validation.

#### tidwall/sjson (path-based JSON set/delete)

| | |
|:--|:--|
| **Stars** | 2,700 |
| **Importers** | 3,100+ |
| **License** | MIT |
| **Purpose** | Path-based JSON set/delete on raw `[]byte` |
| **Replaces** | `jsonRemoveKeys` (~50 lines of manual map traversal + delete) |

Also replaces `registerMarketplace` map manipulation. Works on raw bytes without unmarshal/marshal round-trip, preserving formatting and key order.

#### evanphx/json-patch (RFC 7396 JSON Merge Patch)

| | |
|:--|:--|
| **Stars** | 1,200 |
| **Importers** | 2,673 |
| **License** | BSD-3 |
| **Purpose** | RFC 7396 JSON Merge Patch (arbitrary depth) |
| **Replaces** | `jsonMerge` (~57 lines, only handles 2-level deep merge) |

RFC 7396 semantics: objects merge recursively at any depth, scalars overwrite, explicit `null` deletes keys. Fixes a known limitation where the current 2-level merge breaks on nested MCP configs (e.g., `mcpServers.brain.settings.nested`).

#### adrg/xdg (XDG Base Directory resolution)

| | |
|:--|:--|
| **Stars** | 951 |
| **Importers** | 800+ |
| **License** | MIT |
| **Purpose** | XDG Base Directory resolution |
| **Replaces** | 15+ hardcoded `filepath.Join(home, ".config", ...)` and `filepath.Join(home, ".cache", ...)` path constructions |

Override `ConfigHome` to `~/.config` on macOS to match Brain's convention (same approach as mise, direnv). Provides `xdg.ConfigHome`, `xdg.CacheHome`, `xdg.DataHome` instead of manual path construction.

#### Selection Criteria

All five libraries meet these requirements:

- Zero or near-zero transitive dependencies
- MIT or BSD license
- Active maintenance (commits within last 6 months)
- Cross-platform tested (Linux, macOS, Windows)
- Used by major Go projects

#### Alternatives Rejected

| Library | Reason |
|:--|:--|
| spf13/viper, knadh/koanf | Config frameworks; Brain modifies OTHER apps' configs, not its own |
| spf13/afero | Filesystem abstraction; overkill for recursive copy |
| darccio/mergo | Frozen API, works on Go maps not raw JSON bytes |
| natefinch/atomic | Dormant (17 commits total) |
| TwiN/deepmerge | Pre-v1, only 8 importers |

### Decision 3: Step Pipeline with Rollback

Saga-lite pattern: sequential steps with reverse-order compensation on failure. Condition functions enable idempotent re-runs. This is ~50 lines of custom code, not a library.

```go
// internal/installer/pipeline.go

type Step struct {
    Name      string
    Condition func() bool  // skip if returns false (idempotent guard)
    Action    func() error
    Undo      func() error // nil = no rollback needed
}

type Pipeline struct {
    Steps []Step
}

func (p *Pipeline) Execute() error {
    var completed []Step
    for _, step := range p.Steps {
        if step.Condition != nil && !step.Condition() {
            continue // already done, skip
        }
        if err := step.Action(); err != nil {
            // Rollback in reverse order
            for i := len(completed) - 1; i >= 0; i-- {
                if completed[i].Undo != nil {
                    completed[i].Undo()
                }
            }
            return fmt.Errorf("step %q failed: %w", step.Name, err)
        }
        completed = append(completed, step)
    }
    return nil
}
```

Each tool's `Install()` method builds its own pipeline. Steps are wrappable in `huh/spinner` for progress display.

**Example** (Claude Code install pipeline):

1. Clean previous install (undo: restore backup)
2. Run adapter transforms to marketplace dir (undo: remove output)
3. Register marketplace in known_marketplaces.json (undo: deregister)
4. Write install manifest (undo: remove manifest)

If step 3 fails, steps 2 and 1 undo in reverse order, leaving the system in its pre-install state.

**Libraries rejected**: goyek, dagu, go-steps -- all overkill for a linear step sequence. The pipeline is ~50 lines. A library would add more code than it saves.

### Decision 4: Parallel Multi-Tool Execution

`errgroup.WithContext` + `SetLimit` for installing multiple tools simultaneously. Each tool's pipeline is independent (separate config dirs, separate manifests, no shared state).

```go
// cmd/install.go (simplified)

g, ctx := errgroup.WithContext(context.Background())
g.SetLimit(len(confirmed))

for _, tool := range confirmed {
    t := tool
    g.Go(func() error {
        installer, _ := registry.Get(t)
        return installer.Install(src)
    })
}

if err := g.Wait(); err != nil {
    // report per-tool failures
}
```

`golang.org/x/sync/errgroup` is stdlib-adjacent (maintained by the Go team, same release cadence). First failure cancels remaining installs via context. Buffered output prevents interleaving (each tool writes to a `bytes.Buffer`, flushed after completion).

## Target File Structure

```
apps/tui/
  internal/
    installer/
      registry.go        # Register(), Get(), All(), ToolInstaller interface
      pipeline.go         # Step, Pipeline, Execute() with rollback
      targets/
        claudecode.go     # ClaudeCode struct, init() self-registers
        cursor.go         # Cursor struct, init() self-registers
        targets.go        # blank import aggregator
  cmd/
    install.go            # ~150 lines: UI (huh forms), dependency check,
                          # calls registry.All() and pipeline.Execute()
```

## Impact

| Metric | Before | After |
|:--|:--|:--|
| install.go lines | 1,588 | ~300 (cmd) + ~50 (pipeline) + ~80-120 per target |
| Total installer code | ~1,588 | ~550-600 |
| New tool effort | ~200 lines across 6 switch sites | ~80-120 lines in one file |
| JSON merge depth | 2-level only | Arbitrary (RFC 7396) |
| Rollback on failure | None | Automatic reverse-order compensation |
| Parallel install | No | Yes (errgroup) |
| Idempotent re-run | No | Yes (Condition guards) |
| Switch statements | 6 | 0 |
| XDG path construction | 15+ hardcoded joins | Centralized via adrg/xdg |

## Implementation Notes

- **Single PR, clean break**: No backwards compatibility shims. The old install.go is replaced entirely.
- **XDG override**: Set `xdg.ConfigHome` to `~/.config` on macOS to match Brain's existing convention.
- **Golden-file tests**: Each target gets snapshot tests comparing generated output against checked-in expected files. Tests use `otiai10/copy` + temp dirs for isolation.
- **Buffered parallel output**: Each tool's install writes to a `bytes.Buffer`, flushed to stdout after completion. Prevents interleaved output from parallel installs.
- **Embedded template support**: `TemplateSource` abstraction (filesystem vs embedded) is preserved. Each target receives the source via `Install(src)`.

## Consequences

- All tool-specific logic is encapsulated in target files. The cmd layer becomes pure orchestration.
- JSON merge correctness improves from 2-level to RFC 7396 arbitrary depth.
- Failed installs leave the system in a clean state via pipeline rollback.
- New tool targets (Windsurf, Cline, Copilot) require one file and one blank import.
- Five new dependencies are introduced, but all are small, well-maintained, and zero/near-zero transitive deps.

## Observations

- [decision] Registry pattern with init()-based self-registration eliminates all 6 switch dispatch sites #architecture
- [decision] database/sql register-on-init chosen as the precedent: Go stdlib since 1.0, universally understood #pattern
- [decision] Optional lifecycle interfaces (Provisioner, Validator, Cleaner) follow Caddy v2 module pattern #extensibility
- [decision] Five libraries adopted: otiai10/copy, tidwall/gjson, tidwall/sjson, evanphx/json-patch, adrg/xdg #dependencies
- [decision] All five libraries selected for zero/near-zero transitive deps, MIT/BSD license, active maintenance, cross-platform #selection-criteria
- [decision] Step pipeline with reverse-order rollback (~50 lines custom) replaces no-rollback sequential install #reliability
- [decision] Condition guards on pipeline steps enable idempotent re-runs #idempotency
- [decision] errgroup.WithContext enables parallel multi-tool install with first-failure cancellation #concurrency
- [decision] Clean break rewrite, no backwards compatibility layer #migration
- [decision] evanphx/json-patch (RFC 7396) fixes known 2-level merge limitation in current jsonMerge #correctness
- [decision] adrg/xdg replaces 15+ hardcoded path constructions with XDG standard resolution #standards
- [fact] Current install.go is 1,588 lines with 6 switch dispatch locations #codebase
- [fact] AI tool plugin systems converge on identical patterns: skills, rules, MCP, hooks in dotfiles #research
- [fact] Adding a new tool target drops from ~200 lines across 6 sites to ~80-120 lines in one file #impact
- [insight] The adapter job is 80% file placement, 20% tool-specific transform, making registry a natural fit #architecture

## Relations

- supersedes [[ADR-003 Adapter Implementation Decisions]]
- extends [[ADR-002 Cross-Platform Plugin Architecture]]
- relates_to [[ADR-005 Config and Agents MD Decisions]]
- relates_to [[ADR-006 Release Workflow and Distribution]]
