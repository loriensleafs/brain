# Plan: Context Enhancement Features

## Overview

Implement three independent context enhancement features that improve user experience with Brain MCP:

1. Fix SessionStart hook output format to use Claude's documented `hookSpecificOutput.additionalContext` structure
2. Add `full_context` parameter to `bootstrap_context` for opt-in full note content injection
3. Add optional `--project` flag to CLI search command with auto-resolution fallback

## Objectives

- [ ] Fix hook output format to align with Claude Code hook specification
- [ ] Enable rich context injection in session start hooks when needed
- [ ] Provide convenient project scoping for CLI search with auto-resolution
- [ ] Maintain backward compatibility with existing callers
- [ ] Control token costs through opt-in expansion

## Scope

### In Scope

**Feature 1: Hook Format Fix**

- Update SessionStart hook to use `hookSpecificOutput.additionalContext` structure
- Reference Analysis 016 for format requirements
- Maintain all existing context content (git, bootstrap, workflow)

**Feature 2: Full Context Parameter**

- Add `full_context` boolean parameter to `bootstrap_context` schema
- Modify template rendering to conditionally expand note content
- Update hook to request full content
- Add CLI flag for manual invocation

**Feature 3: Optional Project Flag**

- Add optional `--project` flag to CLI search command
- Implement auto-resolution from CWD as fallback
- Update help text and error messages
- Reuse existing resolveProject function from hooks package

### Out of Scope

- Semantic search improvements (separate effort)
- Context caching optimization (future work)
- Token usage monitoring/alerting (future work)
- CLI search output format changes

## Milestones

### Milestone 1: Feature 1 - Hook Format Fix

**Status**: [PENDING]

**Goal**: Fix SessionStart hook output to use Claude's documented format

**Estimated Effort**: 30 minutes based on simple format restructuring

**Dependencies**: None (blocker for Feature 2)

**Deliverables**:

- [ ] Hook output uses `hookSpecificOutput.additionalContext` structure
- [ ] All existing context content preserved (git, bootstrap, workflow)
- [ ] Hook tests updated to verify new format
- [ ] Analysis 016 findings addressed

**Acceptance Criteria** (quantified):

- [ ] **Format compliance**: Output matches Claude Code hook specification exactly
- [ ] **Content preservation**: Git context, bootstrap markdown, workflow state all present
- [ ] **No regressions**: Existing hook functionality unchanged
- [ ] **Test coverage**: Hook format tests pass with new structure

**Files to Modify**:

```
apps/claude-plugin/cmd/hooks/
├── session_start.go             [MODIFY output format]
└── session_start_test.go        [UPDATE tests]
```

**Technical Approach**:

- Already implemented in session_start.go lines 333-343
- Verify structure matches Analysis 016 requirements:

  ```go
  hookOutput := HookOutput{
      HookSpecificOutput: HookSpecificOutput{
          HookEventName:     "SessionStart",
          AdditionalContext: formatContextMarkdown(output),
      },
  }
  ```

**Reference**: Analysis 016 section 6 (Recommendations, P1)

---

### Milestone 2: Feature 2 - MCP Tool Enhancement

**Status**: [PENDING]

**Goal**: Add full_context parameter to bootstrap_context tool

**Estimated Effort**: 3-4 hours based on template rendering complexity

**Dependencies**: None (independent feature)

**Deliverables**:

- [ ] Schema updated with `full_context` parameter (default: false)
- [ ] Template modified to conditionally render full note content
- [ ] Unit tests for compact vs full rendering modes
- [ ] Integration test verifying token count differences

**Acceptance Criteria** (quantified):

- [ ] **Parameter validation**: Schema accepts boolean `full_context` (default: false)
- [ ] **Backward compatibility**: Existing calls without parameter return compact output
- [ ] **Full content rendering**: When `full_context: true`, output includes note content for active features, recent decisions, recent activity
- [ ] **Token count delta**: Full context mode produces 10-15x more tokens than compact (measured in test using @anthropic-ai/tokenizer)
- [ ] **Test coverage**: 90% minimum for modified files (template rendering, schema validation)
- [ ] **All unit tests pass**: Jest tests for formattedOutput, templates modules

**Files to Modify**:

```
apps/mcp/src/tools/bootstrap-context/
├── schema.ts                    [ADD full_context parameter]
├── formattedOutput.ts           [PASS parameter to template]
├── templates/context.ts         [MODIFY rendering logic]
└── __tests__/
    ├── formattedOutput.test.ts  [ADD test cases]
    └── templates.test.ts        [ADD test cases]
```

**Technical Approach**:

- Add Zod schema for `full_context: z.boolean().default(false)`
- Pass parameter through `buildFormattedOutput` → `renderContext`
- Modify rendering functions to check parameter:

  ```typescript
  function renderFeaturesBlock(features: ContextNote[], fullContext: boolean): string {
    if (fullContext) {
      return features.map(f => `### ${f.title}\n\n${f.content}`).join("\n\n");
    }
    return features.map(f => `- [[${f.title}]]`).join("\n");
  }
  ```

**Token Counter Library**: Use `@anthropic-ai/tokenizer` for accurate Claude token counting in tests.

---

### Milestone 3: Feature 2 - Hook Integration

**Status**: [PENDING]

**Goal**: Update SessionStart hook to use full_context

**Estimated Effort**: 1-2 hours based on simple parameter passing

**Dependencies**: Milestone 2 complete

**Deliverables**:

- [ ] Hook passes `full_context: true` to bootstrap command
- [ ] System reminder contains expanded note content
- [ ] Hook tests verify parameter propagation

**Acceptance Criteria** (quantified):

- [ ] **Hook output**: SessionStart system reminder includes full note content (not just wikilinks)
- [ ] **Parameter passing**: `brain bootstrap -p <project> --full-context` invocation verified
- [ ] **Content validation**: Output contains ≥3 expanded notes with >100 characters each
- [ ] **Test coverage**: Hook tests pass with full_context verification

**Files to Modify**:

```
apps/claude-plugin/cmd/hooks/
├── session_start.go             [MODIFY bootstrap call]
└── session_start_test.go        [ADD test cases]
```

**Technical Approach**:

- Update `getBootstrapContext` to accept `fullContext` parameter
- Modify hook to call: `brain bootstrap -p <project> --full-context`
- Verify output format in hook tests

---

### Milestone 4: Feature 2 - CLI Enhancement

**Status**: [PENDING]

**Goal**: Add --full-content flag to brain bootstrap command

**Estimated Effort**: 1 hour based on existing flag patterns

**Dependencies**: Milestone 2 complete (Milestone 3 optional)

**Deliverables**:

- [ ] CLI flag added to bootstrap command
- [ ] Flag passed to MCP tool invocation
- [ ] Help text updated

**Acceptance Criteria** (quantified):

- [ ] **Flag parsing**: `brain bootstrap -p brain --full-content` works
- [ ] **Tool invocation**: MCP tool receives `full_context: true`
- [ ] **Output verification**: CLI output includes expanded content
- [ ] **Help text**: `brain bootstrap --help` documents --full-content flag

**Files to Modify**:

```
apps/tui/cmd/
└── bootstrap.go                 [ADD flag, pass to tool]
```

**Technical Approach**:

- Add cobra flag: `bootstrapCmd.Flags().BoolVar(&fullContent, "full-content", false, "Include full note content")`
- Pass to tool: `toolArgs["full_context"] = fullContent`

---

### Milestone 5: Feature 3 - CLI Search Project Flag

**Status**: [PENDING]

**Goal**: Add optional project flag with auto-resolution to CLI search

**Estimated Effort**: 30 minutes based on reusing existing resolveProject function

**Dependencies**: None (independent feature)

**Deliverables**:

- [ ] `--project` flag added to search command (optional)
- [ ] Project parameter passed to MCP tool
- [ ] Auto-resolution from CWD using existing resolveProject function
- [ ] Error message when project cannot be resolved
- [ ] Updated help text documenting optional flag and auto-resolution
- [ ] Verification that MCP search respects project parameter

**Acceptance Criteria** (quantified):

- [ ] **Flag parsing**: `brain search "query" --project brain` works
- [ ] **Auto-resolution**: `brain search "query"` resolves project from CWD when in known directory
- [ ] **Error handling**: Search without project in unknown directory shows helpful error (exit code 1)
- [ ] **Tool invocation**: MCP search receives project parameter
- [ ] **MCP filtering verification**: Confirmed that MCP search tool filters results by project
- [ ] **Results validation**: Search returns results (>0 when matches exist)
- [ ] **Help text**: `brain search --help` documents optional --project flag with auto-resolution note

**Files to Modify**:

```
apps/tui/cmd/
├── search.go                    [ADD project flag, import resolveProject]
└── tests/
    └── search_test.go           [ADD test cases]
```

**Technical Approach**:

- Add cobra flag: `searchCmd.Flags().StringVarP(&searchProject, "project", "p", "", "Project name (optional, auto-resolved from CWD)")`
- Import resolveProject from hooks package:

  ```go
  import hooks "github.com/yourusername/brain/apps/claude-plugin/cmd/hooks"
  ```
- Reuse existing project resolution logic:

  ```go
  project := searchProject
  if project == "" {
      cwd, _ := os.Getwd()
      project = hooks.ResolveProject("", cwd)  // Use exported function
      if project == "" {
          fmt.Fprintf(os.Stderr, "Error: No project specified and none could be resolved from CWD\nUse --project flag or run from a known project directory\n")
          os.Exit(1)
      }
  }
  toolArgs["project"] = project
  ```
- Add investigation task: Verify MCP search tool actually filters by project parameter (check MCP source or test output)

---

### Milestone 6: Pre-PR Validation

**Status**: [PENDING]

**Goal**: Validate implementation meets acceptance criteria

**Estimated Effort**: 1-2 hours based on standard validation checklist

**Dependencies**: Milestones 1-5 complete

**Assignee**: QA Agent

**Blocking**: PR creation

**Tasks**:

#### Task 1: Cross-Cutting Concerns Audit

- [ ] Verify no hardcoded project names
- [ ] Verify all default values documented
- [ ] Verify no TODO/FIXME/XXX placeholders
- [ ] Verify test-only code isolated from production

#### Task 2: Fail-Safe Design Verification

- [ ] Verify backward compatibility: existing calls without new parameters work
- [ ] Verify error handling defaults to safe behavior (compact mode, CWD resolution)
- [ ] Verify graceful degradation when MCP unavailable

#### Task 3: Test-Implementation Alignment

- [ ] Verify test parameters match implementation defaults
- [ ] Verify code coverage meets 90% threshold (consistent across all milestones)
- [ ] Verify edge cases covered (empty project, no results, invalid CWD)

#### Task 4: Token Cost Validation

- [ ] Measure compact mode token count (baseline) using @anthropic-ai/tokenizer
- [ ] Measure full_context mode token count using @anthropic-ai/tokenizer
- [ ] Verify ratio is 10-15x (expected range)
- [ ] Document findings in test output

#### Task 5: Integration Testing

- [ ] Test SessionStart hook with full_context in real Claude Code session
- [ ] Test CLI search with auto-resolution in various directories
- [ ] Verify no regressions in existing callers

**Acceptance Criteria**:

- All 5 validation tasks complete
- QA agent provides validation evidence
- No blocking issues identified
- Test coverage ≥90% for modified files

---

## Parallelization Strategy

**Features 2 and 3 are FULLY INDEPENDENT** and can proceed in parallel after Feature 1:

```
Timeline (assuming single engineer):

Day 1:
├── AM: Milestone 1 (Hook format fix) - 30min
├── AM: Milestone 2 (MCP tool enhancement) - 3-4h
└── PM: Milestone 5 (CLI search flag) - 30min

Day 2:
├── AM: Milestone 3 (Hook integration) - 1-2h
├── Mid: Milestone 4 (CLI bootstrap flag) - 1h
└── PM: Milestone 6 (QA validation) - 1-2h

Total: 7.5-11 hours (1-1.5 days)
```

**Parallel execution (with 2 engineers)**:

```
Engineer A: Milestones 1, 2, 3, 4 (Features 1-2)
Engineer B: Milestone 5 (Feature 3)
Both: Milestone 6 (QA validation)

Total: 6-8 hours (0.75-1 day)
```

**Critical Path**: Milestone 1 → Milestone 2 → Milestone 3 (Hook format must be correct before full context)

**Non-blocking**:

- Milestone 4 (CLI bootstrap flag) can happen anytime after Milestone 2
- Milestone 5 (CLI search flag) is fully independent after Milestone 1

---

## Testing Strategy

### Unit Tests (Per Milestone)

**Milestone 1 - Hook Format**:

```go
func TestSessionStartHookFormat(t *testing.T) {
    // Test hookSpecificOutput structure
    output := buildSessionOutput("")
    hookOutput := formatHookOutput(output)

    assert.Equal(t, "SessionStart", hookOutput.HookSpecificOutput.HookEventName)
    assert.NotEmpty(t, hookOutput.HookSpecificOutput.AdditionalContext)

    // Verify all content sections present
    context := hookOutput.HookSpecificOutput.AdditionalContext
    assert.Contains(t, context, "**Branch:**")
    assert.Contains(t, context, "## Memory Context")
    assert.Contains(t, context, "### Workflow State")
}
```

**Milestone 2 - MCP Tool**:

```typescript
describe("bootstrap_context with full_context", () => {
  it("returns compact output by default", async () => {
    const result = await handler({ project: "test" });
    expect(result.content[0].text).toMatch(/\[\[Feature-Auth\]\]/);
    expect(result.content[0].text).not.toMatch(/# Feature-Auth\n\n.*OAuth/s);
  });

  it("returns full content when full_context: true", async () => {
    const result = await handler({ project: "test", full_context: true });
    expect(result.content[0].text).toMatch(/# Feature-Auth\n\n.*OAuth/s);
  });

  it("token count increases 10-15x with full_context", async () => {
    // Use @anthropic-ai/tokenizer for accurate counting
    import { countTokens } from '@anthropic-ai/tokenizer';

    const compact = await handler({ project: "test", full_context: false });
    const full = await handler({ project: "test", full_context: true });
    const compactTokens = countTokens(compact.content[0].text);
    const fullTokens = countTokens(full.content[0].text);
    expect(fullTokens / compactTokens).toBeGreaterThan(10);
    expect(fullTokens / compactTokens).toBeLessThan(15);
  });
});
```

**Milestone 5 - CLI Search**:

```go
func TestSearchWithProject(t *testing.T) {
    // Test explicit project flag
    result := runSearch("authentication", "--project", "brain")
    assert.Greater(t, len(result.Results), 0)

    // Test auto-resolution using existing resolveProject
    os.Chdir("/path/to/brain")
    result = runSearch("authentication")
    assert.Greater(t, len(result.Results), 0)

    // Test error when no project
    os.Chdir("/tmp")
    result = runSearch("authentication")
    assert.Error(t, result.Error)
    assert.Contains(t, result.Error.Error(), "No project specified")
}

func TestMCPSearchFiltering(t *testing.T) {
    // Verify MCP search actually filters by project
    // This may require MCP server running
    result := runSearch("test query", "--project", "brain")
    // Verify results are only from brain project
    // May need to check MCP source if unclear
}
```

### Integration Tests

**SessionStart Hook**:

1. Invoke hook in test Claude Code session
2. Verify system reminder contains full note content
3. Measure token count in actual session

**CLI Search**:

1. Test in various directory contexts (inside project, outside project)
2. Verify MCP tool receives project parameter
3. Verify results are scoped to project

### Token Cost Analysis

| Scenario                       | Estimated Tokens  | Evidence Base                            |
| ------------------------------ | ----------------- | ---------------------------------------- |
| Compact mode (6 features)      | ~200 tokens       | Analyst report: 30 tokens/line × 6 lines |
| Full content mode (6 features) | ~3000 tokens      | Analyst report: 500 tokens/feature × 6   |
| Ratio                          | 15x               | Analyst calculation                      |
| Context window impact          | Low (<2% of 200K) | Claude Sonnet 4.5                        |

**Mitigation**: Full context is opt-in and used only where value justifies cost (SessionStart hook for immediate context).

---

## Backward Compatibility Considerations

### Feature 1: Hook Format Fix

**Breaking Change Risk**: NONE

| Scenario           | Impact                      | Mitigation                                         |
| ------------------ | --------------------------- | -------------------------------------------------- |
| Hook output format | No impact (internal change) | Claude processes additionalContext field correctly |
| Hook content       | No change                   | All existing sections preserved                    |
| Hook tests         | Tests updated               | Verify new format structure                        |

**Validation**:

- Test hook output matches Claude specification
- Verify all content sections present
- Confirm no functional changes

### Feature 2: full_context Parameter

**Breaking Change Risk**: LOW

| Scenario         | Impact                                | Mitigation                                |
| ---------------- | ------------------------------------- | ----------------------------------------- |
| Existing callers | No impact (default: false)            | Schema default maintains current behavior |
| Hook callers     | Behavior change (opt-in full content) | Explicit opt-in required                  |
| CLI callers      | No impact (no flag = compact)         | Flag is optional                          |

**Validation**:

- Test existing caller without parameter
- Verify output matches pre-change behavior
- Regression test suite passes

### Feature 3: --project Flag

**Breaking Change Risk**: NONE

| Scenario                       | Impact                               | Mitigation                                    |
| ------------------------------ | ------------------------------------ | --------------------------------------------- |
| CLI calls without --project    | Auto-resolution from CWD             | Maintains convenience, flag is optional       |
| CLI calls outside project dirs | Error message (same as before)       | Clear error with instructions                 |
| MCP tool calls                 | No impact (project already optional) | Auto-resolution using existing resolveProject |

**Validation**:

- Test auto-resolution paths (BM_PROJECT, BM_ACTIVE_PROJECT, BRAIN_PROJECT, CWD match)
- Verify error message clarity
- Document optional flag in help text
- Verify MCP search respects project parameter

---

## Token Cost Analysis

### Cost Comparison

Based on analyst investigation (`.agents/analysis/020-hook-context-injection-truncation.md`):

| Mode                            | Sections Expanded                                  | Token Count | Use Case                         |
| ------------------------------- | -------------------------------------------------- | ----------- | -------------------------------- |
| **Compact (current)**           | None (wikilinks only)                              | ~200        | General bootstrap, quick context |
| **Full context**                | Active features, recent decisions, recent activity | ~3000       | SessionStart hook, rich context  |
| **Full context (all sections)** | All 6 sections                                     | ~4500       | Rarely needed                    |

### Expansion Strategy

**Sections to expand in full_context mode**:

1. **Active Features** - Most valuable (current work)
2. **Recent Decisions** - High value (context for choices)
3. **Recent Activity** - Medium value (awareness)

**Sections to keep compact**:

1. **Open Bugs** - Use wikilinks (drill down if needed)
2. **Referenced Notes** - Use wikilinks (follow graph explicitly)
3. **Session State** - Already expanded (not affected by parameter)

**Rationale**: Expand only high-value sections to balance richness and cost.

### Token Budget

| Context Type             | Tokens | Percentage of 200K Window |
| ------------------------ | ------ | ------------------------- |
| Compact bootstrap        | 200    | 0.1%                      |
| Full bootstrap           | 3000   | 1.5%                      |
| Session reminder (total) | ~5000  | 2.5%                      |

**Verdict**: Full context mode is affordable for SessionStart hook use case.

---

## Risks

| Risk                                | Probability | Impact | Mitigation                                      |
| ----------------------------------- | ----------- | ------ | ----------------------------------------------- |
| **Token cost exceeds expectations** | Low         | Medium | Measured in tests; limit sections expanded      |
| **Backward compatibility break**    | Low         | High   | Default parameter = false; regression tests     |
| **Auto-resolution ambiguity**       | Medium      | Low    | Clear error messages; document resolution order |
| **Test coverage gaps**              | Medium      | Medium | QA validation milestone; 90% coverage target    |
| **Hook integration failure**        | Low         | Medium | Integration test in real session                |

---

## Dependencies

**External Dependencies**:

- Brain MCP server running (all features)
- Git installed (SessionStart hook git context)
- Project configuration in `~/.basic-memory/brain-config.json` (auto-resolution)

**Internal Dependencies**:

- Milestone 2 depends on Milestone 1 (hook needs MCP tool update)
- Milestone 3 depends on Milestone 1 (CLI needs MCP tool update)
- Milestone 5 depends on Milestones 1-4 (QA validates all)

**No inter-feature dependencies**: Feature 1 and Feature 2 are fully independent.

---

## Success Criteria

How we know the plan is complete:

- [ ] **Feature 1 delivered**: SessionStart hook uses correct `hookSpecificOutput.additionalContext` format (verified by hook tests)
- [ ] **Feature 2 delivered**: SessionStart hook provides full note content (verified in real session)
- [ ] **Feature 3 delivered**: CLI search has optional project flag with auto-resolution (verified with edge cases)
- [ ] **Backward compatibility maintained**: Existing callers unchanged (regression tests pass)
- [ ] **Token costs validated**: Full context mode measured at 10-15x compact using @anthropic-ai/tokenizer (documented in tests)
- [ ] **Test coverage achieved**: ≥90% coverage for modified files (Jest/Go coverage reports)
- [ ] **QA validation passed**: All 5 pre-PR validation tasks complete
- [ ] **Documentation updated**: Help text, README, and schema docs reflect changes
- [ ] **No regressions**: All existing tests pass
- [ ] **MCP search filtering verified**: Confirmed MCP search tool filters by project parameter

---

## Implementation Notes

### Key Design Decisions

1. **Hook format fix first**: Blocker for other features to ensure correct Claude integration
2. **Default to compact mode**: Prevents token explosion for existing callers
3. **Selective expansion**: Only expand high-value sections (features, decisions, activity)
4. **Optional project flag**: Auto-resolution provides convenience without breaking existing workflows
5. **Reuse resolveProject**: Avoid code duplication by importing existing function from hooks package
6. **Opt-in full content**: Hook explicitly requests rich context where value is clear

### Alternative Approaches Considered

**Option A: Always expand full content**

- **Rejected**: 15x token cost unacceptable for all callers

**Option B: Require --project flag with no auto-resolution**

- **Rejected**: Poor UX; auto-resolution is safe and convenient. Changed to optional flag.

**Option C: Add --compact flag instead of --full-content**

- **Rejected**: Inverts default, breaking backward compatibility

**Option D: Duplicate resolveProject logic in CLI search**

- **Rejected**: Code duplication. Reusing existing function better maintains consistency.

---

## Related Documents

- **Hook Format Analysis**: `.agents/analysis/016-session-start-context-injection.md` (P1 recommendation for format fix)
- **Context Truncation Investigation**: `.agents/analysis/020-hook-context-injection-truncation.md`
- **Schema Definition**: `apps/mcp/src/tools/bootstrap-context/schema.ts`
- **Template Rendering**: `apps/mcp/src/tools/bootstrap-context/templates/context.ts`
- **Hook Implementation**: `apps/claude-plugin/cmd/hooks/session_start.go`
- **Project Resolution**: `apps/claude-plugin/cmd/hooks/project_resolve.go` (reusable function)
- **CLI Bootstrap**: `apps/tui/cmd/bootstrap.go`
- **CLI Search**: `apps/tui/cmd/search.go`