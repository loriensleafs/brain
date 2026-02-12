---
title: REQ-006 Parallel Multi-Tool Execution
type: requirement
status: pending
feature-ref: FEAT-004
permalink: features/feat-004-registry-based-installer/requirements/req-006-parallel-multi-tool-execution
---

# REQ-006 Parallel Multi-Tool Execution

## Requirement Statement

The system MUST support installing multiple tool targets in parallel using `errgroup.WithContext` with `SetLimit`. Each tool's install pipeline is independent (separate config directories, separate manifests, no shared state). First failure cancels remaining installs via context cancellation. Output from each tool is buffered to prevent interleaving.

### Execution Pattern

```go
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

### Buffered Output

Each tool writes to a `bytes.Buffer` during install. Buffers are flushed to stdout after completion. This prevents interleaved output from parallel installs while preserving per-tool progress information.

### Context Cancellation

When one tool's install fails, the context is cancelled. Other tools' pipelines should check `ctx.Done()` between steps and abort early rather than completing an install that will be reported alongside a failure.

## Acceptance Criteria

- [ ] [requirement] Multiple tools install in parallel via errgroup #acceptance
- [ ] [requirement] SetLimit matches number of confirmed tools #acceptance
- [ ] [requirement] First failure cancels remaining installs via context #acceptance
- [ ] [requirement] Per-tool output is buffered (no interleaving) #acceptance
- [ ] [requirement] Buffers flushed to stdout after each tool completes #acceptance
- [ ] [requirement] Per-tool success/failure reported individually #acceptance
- [ ] [requirement] Single tool install works correctly (parallel with N=1) #acceptance
- [ ] [requirement] Pipeline steps check context cancellation between steps #acceptance

## Observations

- [requirement] Parallel install addresses the UX pain of sequential multi-tool installs #performance
- [technique] errgroup.WithContext is stdlib-adjacent (maintained by Go team, same release cadence) #dependency
- [constraint] Tools have independent config dirs, so no shared state conflicts exist #independence
- [decision] SetLimit matches tool count rather than a fixed cap; all tools run simultaneously #design
- [insight] Buffered output is a UX requirement; interleaved progress bars are unreadable #ux
- [fact] Each tool writes to its own bytes.Buffer; no locking needed #concurrency

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[ADR-008 Registry-Based Installer Architecture]]
- depends_on [[REQ-001 ToolInstaller Interface and Registry]]
- depends_on [[REQ-002 Step Pipeline with Rollback]]
- relates_to [[TASK-008 Parallel Multi-Tool Execution]]
