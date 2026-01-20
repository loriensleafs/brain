# Analysis: Hook Organization Inconsistency

## 1. Objective and Scope

**Objective**: Investigate why only gatecheck and sessionstart hooks have
subdirectories while other hooks do not.

**Scope**: File organization pattern analysis in cmd/hooks/ directory.

## 2. Context

User reported inconsistency in hook file organization:

- gatecheck and sessionstart: Refactored into packages with subdirectories
- Other hooks (stop, pre_tool_use, user_prompt, validate_session): Single
  files without subdirectories

User requested investigation to determine pattern and recommend consistency
approach.

## 3. Approach

**Methodology**: File system analysis, size comparison, git history review

**Tools Used**: Read, Bash, Grep, Glob

**Limitations**: Unable to complete investigation due to codebase structure
mismatch.

## 4. Data and Analysis

### Evidence Gathered

| Finding | Source | Confidence |
| ------- | ------ | ---------- |
| No cmd/hooks/ directory exists | File system search | High |
| Project is TypeScript/Node.js | package.json, tsconfig.json | High |
| Inngest workflows in src/inngest/workflows/ | Directory listing | High |
| All workflows are single files | File system structure | High |
| No Go files in project | find command | High |

### Facts (Verified)

Repository structure at /Users/peter.kloss/Dev/brain/apps/mcp:

- TypeScript MCP server project
- Uses Bun/Node.js runtime
- Inngest workflows in src/inngest/workflows/
- No cmd/ directory
- No Go source files
- No hook files matching user description

Workflow file sizes (lines of code):

```text
  90 hitlApproval.ts
 218 verdicts.ts
 230 featureCompletion.ts
 282 orchestratorAgentInvoked.ts
 299 sessionState.ts
 354 workflowState.ts
 566 orchestratorAgentCompleted.ts
 764 sessionProtocolStart.ts
 971 sessionProtocolEnd.ts
```

All workflows follow consistent pattern: Single file per workflow, no
subdirectories.

### Hypotheses (Unverified)

Three possible explanations:

1. **Wrong Repository**: User may be referring to a different repository
2. **Future Work**: User may be planning a Go implementation that does not
   exist yet
3. **Memory Error**: User may have confused this project with another

## 5. Results

Investigation cannot be completed as described. The file structure mentioned
by user does not exist in this codebase.

Actual codebase: TypeScript MCP server with consistent single-file workflow
pattern.

Described structure: Go project with cmd/hooks/ directory and mixed
organization patterns.

## 6. Discussion

The request assumes existence of Go hook files with inconsistent organization.
No such files exist in this repository.

This indicates one of three scenarios:

1. User is working across multiple repositories
2. User is planning future work not yet implemented
3. Documentation or memory reference is outdated

Unable to provide recommendation without clarification on actual target
repository.

## 7. Recommendations

| Priority | Recommendation | Rationale | Effort |
| -------- | -------------- | --------- | ------ |
| P0 | Request user clarification | Cannot proceed | 5m |
| P1 | Verify this is correct project | May be different | 5m |
| P2 | If future Go work, create ADR | Architecture | 1h |

## 8. Conclusion

**Verdict**: Investigation Blocked

**Confidence**: High (verified file system structure)

**Rationale**: User described file structure does not exist in this codebase.
TypeScript MCP server has no Go hooks or cmd/hooks/ directory.

### User Impact

- **What changes for you**: Cannot provide hook organization analysis without
  correct repository
- **Effort required**: 5 minutes to clarify repository path
- **Risk if ignored**: Wasted effort analyzing wrong codebase

## 9. Appendices

### Sources Consulted

- File system at /Users/peter.kloss/Dev/brain/apps/mcp
- Git history (initial commit 1f920cd)
- Directory structure via find/ls commands

### Data Transparency

- **Found**: TypeScript MCP server with Inngest workflows
- **Not Found**: cmd/hooks/ directory, Go files, gatecheck/sessionstart
  subdirectories

### Questions for User

1. Which repository contains the cmd/hooks/ files?
2. Is this a different Brain monorepo app?
3. Are you planning to implement Go hooks in the future?
4. Can you provide absolute path to the actual hook files?
