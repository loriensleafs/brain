---
title: REQ-003 Library Adoptions
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-003-library-adoptions
---

# REQ-003 Library Adoptions

## Requirement Statement

The system MUST adopt five libraries to replace hand-rolled implementations. All five libraries MUST meet the selection criteria: zero or near-zero transitive dependencies, MIT or BSD license, active maintenance (commits within last 6 months), and cross-platform tested (Linux, macOS, Windows).

### Library 1: otiai10/copy

| Attribute | Value |
|---|---|
| Purpose | Recursive directory copy with filter callbacks |
| Replaces | `copyBrainFiles` + `copyBrainFilesRecursive` (~70 lines) |
| Key Feature | `Skip` function replaces manual `.DS_Store`/`.gitkeep`/`.git` checks |
| Key Feature | `OnDirExists` controls merge-vs-replace behavior |

### Library 2: tidwall/gjson

| Attribute | Value |
|---|---|
| Purpose | Path-based JSON reads WITHOUT full unmarshal |
| Replaces | Manual `json.Unmarshal` + map type assertions for key existence checks |
| Key Feature | 26x faster than map-based approach for targeted reads |
| Key Feature | Zero allocations for simple path lookups |

### Library 3: tidwall/sjson

| Attribute | Value |
|---|---|
| Purpose | Path-based JSON set/delete on raw `[]byte` |
| Replaces | `jsonRemoveKeys` (~50 lines of manual map traversal + delete) |
| Key Feature | Works on raw bytes without unmarshal/marshal round-trip |
| Key Feature | Preserves formatting and key order |

### Library 4: evanphx/json-patch

| Attribute | Value |
|---|---|
| Purpose | RFC 7396 JSON Merge Patch (arbitrary depth) |
| Replaces | `jsonMerge` (~57 lines, only handles 2-level deep merge) |
| Key Feature | RFC 7396 semantics: objects merge recursively at any depth |
| Key Feature | Fixes known limitation where 2-level merge breaks on nested MCP configs |

### Library 5: adrg/xdg

| Attribute | Value |
|---|---|
| Purpose | XDG Base Directory resolution |
| Replaces | 15+ hardcoded `filepath.Join(home, ".config", ...)` path constructions |
| Key Feature | `xdg.ConfigHome`, `xdg.CacheHome`, `xdg.DataHome` |
| Key Feature | Override `ConfigHome` to `~/.config` on macOS to match Brain convention |

## Acceptance Criteria

- [ ] [requirement] otiai10/copy integrated and replaces all recursive copy code #acceptance
- [ ] [requirement] tidwall/gjson integrated and used for install detection JSON reads #acceptance
- [ ] [requirement] tidwall/sjson integrated and replaces jsonRemoveKeys and marketplace map manipulation #acceptance
- [ ] [requirement] evanphx/json-patch integrated and replaces jsonMerge with RFC 7396 semantics #acceptance
- [ ] [requirement] adrg/xdg integrated and replaces all hardcoded XDG path constructions #acceptance
- [ ] [requirement] XDG ConfigHome overridden to `~/.config` on macOS #acceptance
- [ ] [requirement] All five libraries pass `go mod tidy` with no unused imports #acceptance
- [ ] [requirement] JSON merge works correctly on nested MCP configs (e.g., `mcpServers.brain.settings.nested`) #acceptance
- [ ] [requirement] Recursive copy correctly skips `.DS_Store`, `.gitkeep`, `.git` files #acceptance

## Observations

- [decision] Five specific libraries chosen after evaluating alternatives including viper, afero, mergo #selection
- [fact] spf13/viper rejected because Brain modifies OTHER apps' configs, not its own #rejected-alternative
- [fact] darccio/mergo rejected: frozen API, works on Go maps not raw JSON bytes #rejected-alternative
- [fact] natefinch/atomic rejected: dormant (17 commits total) #rejected-alternative
- [constraint] All libraries must have zero/near-zero transitive deps #dependency-management
- [insight] evanphx/json-patch fixes a known production bug where 2-level merge breaks nested MCP configs #correctness
- [risk] adrg/xdg macOS override requires setting ConfigHome early in program initialization #initialization-order

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- relates_to [[TASK-003 Library Integration otiai10-copy]]
- relates_to [[TASK-004 Library Integration tidwall-gjson-sjson]]
- relates_to [[TASK-005 Library Integration json-patch-xdg]]
