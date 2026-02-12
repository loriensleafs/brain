---
title: DESIGN-002 Target Implementation Guide
type: design
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/design/design-002-target-implementation-guide
---

# DESIGN-002 Target Implementation Guide

## Summary

Detailed specification for implementing a tool target within the registry-based installer. Covers the target file structure, interface implementation, pipeline construction, library usage patterns, and testing strategy. This guide applies to Claude Code, Cursor, and all future targets.

## Technical Approach

### Target File Template

Each target is a single Go file in `internal/installer/targets/`. The file size is typically 80-120 lines. The structure follows a consistent pattern:

```go
package targets

import (
    "github.com/peterkloss/brain-tui/internal/installer"
)

type TargetName struct {
    // target-specific state
}

func init() {
    installer.Register(&TargetName{})
}

// ToolInstaller interface methods
func (t *TargetName) Name() string           { return "target-slug" }
func (t *TargetName) DisplayName() string    { return "Target Display Name" }
func (t *TargetName) ConfigDir() string      { return configDir() }
func (t *TargetName) IsToolInstalled() bool  { return checkToolExists() }
func (t *TargetName) IsBrainInstalled() bool { return checkBrainExists() }
func (t *TargetName) AdapterTarget() string  { return "target-slug" }

func (t *TargetName) Install(src *adapters.TemplateSource) error {
    p := &installer.Pipeline{
        Steps: []installer.Step{
            // target-specific steps
        },
    }
    return p.Execute()
}

func (t *TargetName) Uninstall() error {
    // reverse of install
}
```

### Pipeline Construction Patterns

Each target builds its own pipeline. Common patterns across targets:

#### Step 1: Clean Previous Install

```go
installer.Step{
    Name: "clean-previous",
    Condition: func() bool {
        return t.IsBrainInstalled()
    },
    Action: func() error {
        // backup existing files, then remove
        return backup.CreateAndRemove(t.ConfigDir(), brainPaths)
    },
    Undo: func() error {
        return backup.Restore(t.ConfigDir())
    },
}
```

#### Step 2: Run Adapter Transforms

```go
installer.Step{
    Name: "adapter-transform",
    Condition: func() bool {
        return !outputExists(outputDir)
    },
    Action: func() error {
        return adapters.Transform(src, t.AdapterTarget(), outputDir)
    },
    Undo: func() error {
        return os.RemoveAll(outputDir)
    },
}
```

#### Step 3: Config Merge (JSON)

```go
installer.Step{
    Name: "merge-config",
    Condition: func() bool {
        existing := readFile(configPath)
        return !gjson.Get(string(existing), "mcpServers.brain").Exists()
    },
    Action: func() error {
        existing := readFile(configPath)
        patch := readFile(patchPath)
        merged, err := jsonpatch.MergePatch(existing, patch)
        return writeFile(configPath, merged)
    },
    Undo: func() error {
        existing := readFile(configPath)
        cleaned, err := sjson.DeleteBytes(existing, "mcpServers.brain")
        return writeFile(configPath, cleaned)
    },
}
```

#### Step 4: Write Manifest

```go
installer.Step{
    Name: "write-manifest",
    Condition: func() bool {
        return !manifestUpToDate(manifestPath, currentVersion)
    },
    Action: func() error {
        return writeManifest(manifestPath, currentVersion, installedFiles)
    },
    Undo: func() error {
        return os.Remove(manifestPath)
    },
}
```

### Library Usage by Target

| Operation | Library | Pattern |
|---|---|---|
| Check if Brain key exists in JSON | gjson | `gjson.Get(json, "path").Exists()` |
| Set a JSON key | sjson | `sjson.SetBytes(json, "path", value)` |
| Delete a JSON key | sjson | `sjson.DeleteBytes(json, "path")` |
| Deep merge JSON configs | json-patch | `jsonpatch.MergePatch(original, patch)` |
| Copy files recursively | copy | `copy.Copy(src, dst, copy.Options{Skip: skipFunc})` |
| Resolve config directory | xdg | `filepath.Join(xdg.ConfigHome, "tool-name")` |

### Detection Patterns

#### IsToolInstalled()

Check for the tool's config directory or binary:

```go
func (t *ClaudeCode) IsToolInstalled() bool {
    _, err := os.Stat(t.ConfigDir())
    return err == nil
}
```

#### IsBrainInstalled()

Use gjson to check for Brain-specific keys in the tool's config:

```go
func (t *ClaudeCode) IsBrainInstalled() bool {
    data, err := os.ReadFile(filepath.Join(t.ConfigDir(), "mcp.json"))
    if err != nil {
        return false
    }
    return gjson.Get(string(data), "mcpServers.brain").Exists()
}
```

### Testing Strategy

#### Golden-File Tests

Each target gets snapshot tests comparing generated output against checked-in expected files:

```go
func TestClaudeCodeInstall(t *testing.T) {
    // Setup: temp dir, mock TemplateSource
    tmpDir := t.TempDir()
    src := testutil.MockTemplateSource()

    target := &ClaudeCode{configDir: tmpDir}
    err := target.Install(src)
    require.NoError(t, err)

    // Compare output against golden files
    testutil.AssertGoldenDir(t, tmpDir, "testdata/claudecode-golden")
}
```

Golden files live in `testdata/` alongside the test file. Update with `-update` flag:

```bash
go test ./internal/installer/targets/ -update
```

#### Pipeline Rollback Tests

```go
func TestPipelineRollback(t *testing.T) {
    step3Fails := &Pipeline{
        Steps: []Step{
            {Name: "s1", Action: succeed, Undo: recordUndo("s1")},
            {Name: "s2", Action: succeed, Undo: recordUndo("s2")},
            {Name: "s3", Action: fail},
        },
    }
    err := step3Fails.Execute()
    require.Error(t, err)
    // Verify s2 and s1 undone in reverse order
    assert.Equal(t, []string{"s2", "s1"}, undoOrder)
}
```

## Trade-offs

- [decision] Single file per target chosen over splitting interface+implementation because each target is small (80-120 lines) #trade-off #simplicity
- [decision] Golden-file tests chosen over assertion-heavy tests because they catch any output drift automatically #trade-off #testing
- [decision] Backup-and-restore pattern for clean step chosen over diff-based patch because it is simpler and handles unknown file additions #trade-off #reliability
- [decision] Each target builds its own pipeline rather than sharing a base pipeline because step sequences differ enough to make inheritance awkward #trade-off #independence

## Observations

- [design] Target file template is 80-120 lines with a consistent structure #size
- [technique] gjson for reads, sjson for writes, json-patch for merges covers all JSON operations #library-usage
- [insight] Pipeline construction inside Install() means the pipeline is fresh each call, avoiding stale state #safety
- [constraint] Golden-file tests require `testdata/` directories alongside test files #test-infrastructure
- [fact] Two targets (Claude Code, Cursor) ship in this feature; the guide prepares for Windsurf, Cline, Copilot #extensibility

## Relations

- implements [[FEAT-004 Registry-Based Installer]]
- satisfies [[REQ-004 Claude Code Target]]
- satisfies [[REQ-005 Cursor Target]]
- extends [[DESIGN-001 Registry and Pipeline Architecture]]
- derives_from [[ADR-008 Registry-Based Installer Architecture]]
