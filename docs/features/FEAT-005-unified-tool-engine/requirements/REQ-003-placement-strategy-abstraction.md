---
title: REQ-003 Placement Strategy Abstraction
type: requirement
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/requirements/req-003-placement-strategy-abstraction
---

# REQ-003 Placement Strategy Abstraction

## Requirement Statement

The system MUST implement a placement strategy abstraction in `internal/engine/placement.go` that encapsulates how generated files are written to disk. Two strategies MUST be implemented, matching the existing behavior of Claude Code and Cursor installer targets.

### Placement Strategies

| Strategy | Tool | Behavior |
|---|---|---|
| `marketplace` | Claude Code | Write to marketplace directory, register in `known_marketplaces.json`, generate `plugin.json` and `marketplace.json` |
| `copy_and_merge` | Cursor | Copy content files to config directory, apply RFC 7396 JSON merge for hooks and MCP config files |

### Strategy Interface

```go
// PlacementStrategy defines how generated files are placed on disk.
type PlacementStrategy interface {
    // Place writes generated files to the target location.
    Place(ctx context.Context, output *TransformOutput, tool *ToolConfig, scope string) error

    // Clean removes previously placed files before a fresh install.
    Clean(ctx context.Context, tool *ToolConfig, scope string) error
}
```

### Marketplace Strategy Detail

```text
1. Resolve scope path from tool.Scopes[scope]
2. Write all GeneratedFile content to marketplace directory
3. Register marketplace in known_marketplaces.json (create if missing)
4. Generate plugin.json with version and content listing
5. Generate marketplace.json with metadata
```

### Copy-and-Merge Strategy Detail

```text
1. Resolve scope path from tool.Scopes[scope]
2. Copy content files (agents, skills, commands, rules) to scope directory
3. For hooks (strategy=merge): Read existing hooks.json, apply RFC 7396 merge, write back
4. For MCP (strategy=merge): Read existing mcp.json, apply RFC 7396 merge, write back
5. Track placed files for manifest (file_list type)
```

## Acceptance Criteria

- [ ] [requirement] `PlacementStrategy` interface defined in `internal/engine/placement.go` #acceptance
- [ ] [requirement] `MarketplacePlacement` implements marketplace registration flow matching existing `claudecode.go` #acceptance
- [ ] [requirement] `CopyAndMergePlacement` implements file copy and JSON merge flow matching existing `cursor.go` #acceptance
- [ ] [requirement] RFC 7396 JSON merge uses existing `json-patch` library (retained from ADR-008) #acceptance
- [ ] [requirement] Both strategies handle missing target directories (create as needed) #acceptance
- [ ] [requirement] Clean operation removes only Brain-managed files (prefixed files for copy_and_merge, marketplace dir for marketplace) #acceptance
- [ ] [requirement] Scope path resolution expands `~` to home directory #acceptance

## Observations

- [requirement] Two strategies cover all existing tool placement behaviors #completeness
- [technique] Strategy pattern enables adding new placement approaches without modifying existing strategies #extensibility
- [constraint] RFC 7396 merge must preserve non-Brain entries in hooks.json and mcp.json #safety
- [fact] Marketplace strategy is Claude Code specific; copy_and_merge is used by Cursor and future tools #usage
- [insight] The placement abstraction separates "what to generate" (engine) from "where to put it" (placement) #separation-of-concerns

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[ADR-009 Unified Tool Engine]]
- depends_on [[REQ-002 Generic Transform Engine]]
- relates_to [[TASK-005 Placement Strategy Abstraction]]
- relates_to [[DESIGN-001 Engine Architecture]]
- enables [[REQ-004 GenericTarget Installer]]
