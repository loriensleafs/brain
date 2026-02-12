---
title: REQ-001 ToolInstaller Interface and Registry
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-001-toolinstaller-interface-and-registry
---

# REQ-001 ToolInstaller Interface and Registry

## Requirement Statement

The system MUST implement a `ToolInstaller` interface and a global registry following the `database/sql` register-on-init pattern. Each tool target implements the interface and self-registers via `init()`. The registry provides `Register()`, `Get()`, and `All()` functions for tool lookup and enumeration.

### ToolInstaller Interface

```go
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
```

### Optional Lifecycle Interfaces

Optional interfaces follow the Caddy v2 pattern, checked via type assertion:

```go
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

### Registry Functions

```go
var registry = map[string]ToolInstaller{}

func Register(installer ToolInstaller)          // called from init()
func Get(name string) (ToolInstaller, bool)     // lookup by slug
func All() []ToolInstaller                      // sorted slice of all registered
```

### Self-Registration Pattern

Each tool target registers in its package init():

```go
// internal/installer/targets/claudecode.go
func init() {
    installer.Register(&ClaudeCode{})
}
```

The install command imports via blank import:

```go
// cmd/install.go
import _ "github.com/peterkloss/brain-tui/internal/installer/targets"
```

## Acceptance Criteria

- [ ] [requirement] `ToolInstaller` interface defined in `internal/installer/registry.go` #acceptance
- [ ] [requirement] `Register()` function stores installers by `Name()` slug #acceptance
- [ ] [requirement] `Get()` function retrieves installer by slug, returns ok bool #acceptance
- [ ] [requirement] `All()` function returns sorted slice of all registered installers #acceptance
- [ ] [requirement] Duplicate `Register()` calls for same slug panic (fail-fast, matches database/sql) #acceptance
- [ ] [requirement] `Provisioner`, `Validator`, `Cleaner` optional interfaces defined #acceptance
- [ ] [requirement] Type assertions for optional interfaces work correctly #acceptance
- [ ] [requirement] Blank import of targets package triggers all init() registrations #acceptance
- [ ] [requirement] Unit tests verify register, get, all, and duplicate detection #acceptance

## Observations

- [requirement] Registry pattern eliminates all 6 switch dispatch sites with a single map lookup #architecture
- [technique] database/sql register-on-init is the Go stdlib precedent since 1.0 #pattern
- [technique] Optional interfaces via type assertion follow Caddy v2 module pattern #extensibility
- [constraint] Duplicate slug registration must panic to prevent silent conflicts #safety
- [fact] All() returns sorted slice for deterministic UI ordering #ux
- [insight] Each tool is a self-contained unit: one Go file, one init(), one blank import #simplicity

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- enables [[REQ-004 Claude Code Target]]
- enables [[REQ-005 Cursor Target]]
- relates_to [[TASK-001 Registry and ToolInstaller Interface]]
