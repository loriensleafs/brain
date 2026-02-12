---
title: REQ-005 Three Install Scopes
type: requirement
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/requirements/req-005-three-install-scopes
---

# REQ-005 Three Install Scopes

## Requirement Statement

The system MUST support three installation scopes per tool, declared in the tool's YAML config. The `default_scope` config key determines which scope `brain install` uses by default. A `--scope` CLI flag MUST override the default. All scopes use the same engine; only the output path changes.

### Scope Definitions

| Scope | Path Pattern | Use Case |
|---|---|---|
| `global` | `~/.{tool}/` | Install Brain globally for a tool |
| `plugin` | `~/.{tool}/plugins/marketplaces/brain/` | Install as marketplace entry (Claude Code) |
| `project` | `./{project}/.{tool}/` | Install per-project in working directory |

### Scope Resolution

```text
1. CLI --scope flag provided?
   YES -> use specified scope
   NO  -> use tool.DefaultScope from config

2. Resolve path:
   scope_path = tool.Scopes[resolved_scope]
   expanded_path = expandHome(scope_path)

3. If scope == "project":
   expanded_path = join(cwd, scope_path)
```

### Per-Tool Scope Configuration

Not all tools support all scopes. The config declares available scopes per tool:

- Claude Code: global, plugin (default: plugin), project
- Cursor: global (default: global), project
- Future tools: define as needed in YAML

## Acceptance Criteria

- [ ] [requirement] `--scope` CLI flag added to `brain install` command #acceptance
- [ ] [requirement] Default scope read from `tool.DefaultScope` in config #acceptance
- [ ] [requirement] Scope path resolved from `tool.Scopes` map in config #acceptance
- [ ] [requirement] `~` expansion works in scope paths #acceptance
- [ ] [requirement] Project scope resolves relative to current working directory #acceptance
- [ ] [requirement] Error on invalid scope name (not in tool's Scopes map) #acceptance
- [ ] [requirement] Install output placed in correct directory per resolved scope #acceptance

## Observations

- [requirement] Three scopes replace the single hardcoded install location per tool #flexibility
- [decision] Default scope varies by tool (plugin for Claude Code, global for Cursor) #config
- [constraint] Not all tools support all scopes; available scopes are per-tool config #validation
- [fact] Current code only supports one install location per tool #limitation
- [insight] Scope resolution is pure path computation; the engine and placement code are scope-agnostic #separation

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[ADR-009 Unified Tool Engine]]
- depends_on [[REQ-001 Tool Configuration Schema]]
- relates_to [[TASK-008 Three Install Scopes]]
- relates_to [[DESIGN-001 Engine Architecture]]
