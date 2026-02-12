---
title: REQ-007 Config-Driven Target Activation
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-007-config-driven-target-activation
---

# REQ-007 Config-Driven Target Activation

## Requirement Statement

The system SHOULD support config-driven target activation from the `brain.config.json` targets section. When a targets section exists, only targets listed there are presented to the user for install/uninstall. When no targets section exists, all registered targets are available (current behavior preserved).

### Config Schema

```json
{
  "targets": {
    "claude-code": { "enabled": true },
    "cursor": { "enabled": true },
    "windsurf": { "enabled": false }
  }
}
```

### Resolution Logic

```text
1. Load brain.config.json targets section
2. If targets section is missing or empty: all registered targets available
3. If targets section exists:
   - Only targets with "enabled": true are presented
   - Targets with "enabled": false are hidden from UI
   - Targets not in config but registered are hidden (explicit opt-in model)
4. Registry.All() filtered by config before passing to UI
```

## Acceptance Criteria

- [ ] [requirement] Config targets section is optional (missing = all available) #acceptance
- [ ] [requirement] Targets with `enabled: true` are presented in install UI #acceptance
- [ ] [requirement] Targets with `enabled: false` are hidden from install UI #acceptance
- [ ] [requirement] Unregistered targets in config are ignored (no error) #acceptance
- [ ] [requirement] Registered targets not in config are hidden when config section exists #acceptance
- [ ] [requirement] Config schema validates targets section structure #acceptance
- [ ] [requirement] Empty targets section is treated as "all available" #acceptance

## Observations

- [requirement] Config-driven activation enables tool management without code changes #extensibility
- [decision] Explicit opt-in model when config section exists; implicit all-available when absent #design
- [constraint] Must be backward compatible with configs that lack targets section #compatibility
- [insight] This enables enterprise deployments to restrict which tools are installable #enterprise
- [fact] Priority P2; core registry and pipeline functionality is P1 #priority

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- depends_on [[REQ-001 ToolInstaller Interface and Registry]]
- relates_to [[TASK-009 Install Command Rewrite]]
