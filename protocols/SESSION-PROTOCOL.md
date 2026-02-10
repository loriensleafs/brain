# Session Protocol

> **Status**: Canonical Source of Truth
>
> **Last Updated**: 2026-02-10
>
> **RFC 2119**: This document uses RFC 2119 key words to indicate requirement levels.

This document is the **single canonical source** for session protocol requirements. All other documents (AGENTS.md, AGENT-INSTRUCTIONS.md) MUST reference this document rather than duplicate its content.

---

## RFC 2119 Key Words

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

| Key Word                             | Meaning                                                            |
| ------------------------------------ | ------------------------------------------------------------------ |
| **MUST** / **REQUIRED** / **SHALL**  | Absolute requirement; violation is a protocol failure              |
| **MUST NOT** / **SHALL NOT**         | Absolute prohibition; violation is a protocol failure              |
| **SHOULD** / **RECOMMENDED**         | Strong recommendation; deviation requires documented justification |
| **SHOULD NOT** / **NOT RECOMMENDED** | Strong discouragement; use requires documented justification       |
| **MAY** / **OPTIONAL**               | Truly optional; no justification needed                            |

---

## Session Status Lifecycle

Session notes track status through a state machine. Status is computed from note frontmatter, not persisted separately.

### Status State Machine

```text
IN_PROGRESS <--> PAUSED --> COMPLETE
```

| Status | Description | Allowed Transitions |
| ------ | ----------- | ------------------- |
| IN_PROGRESS | Active session, work ongoing | PAUSED, COMPLETE |
| PAUSED | Session suspended, can resume later | IN_PROGRESS, COMPLETE |
| COMPLETE | Session finished (terminal state) | None |

### Constraint: Single Active Session

Only ONE session can have status IN_PROGRESS at a time. This ensures clear context about which session is active.

**Auto-pause behavior**: When you create or resume a session, any existing IN_PROGRESS session is automatically paused.

### Session Operations

Use the Brain session tool for status transitions:

| Operation | Action |
| --------- | ------ |
| Get current | Returns current IN_PROGRESS session (if any) |
| Create | Creates session with IN_PROGRESS, auto-pauses existing |
| Pause | IN_PROGRESS -> PAUSED |
| Resume | PAUSED -> IN_PROGRESS, auto-pauses existing |
| Complete | IN_PROGRESS -> COMPLETE (terminal) |

### Session Note Frontmatter

```yaml
---
title: SESSION-YYYY-MM-DD_NN-topic
type: session
status: IN_PROGRESS
date: YYYY-MM-DD
tags: [session]
---
```

**Backward Compatibility**: Notes missing the status field are treated as COMPLETE.

---

## Protocol Enforcement Model

### Trust-Based vs Verification-Based

This protocol uses **verification-based enforcement**. Protocol compliance is verified through:

1. **Technical controls** that block work until requirements are met
2. **Observable checkpoints** that produce verifiable evidence
3. **Validation tooling** that detects violations automatically

Labels like "MANDATORY" or "NON-NEGOTIABLE" are insufficient. Each requirement MUST have a verification mechanism.

### Verification Mechanisms

| Requirement Type     | Verification Method                      |
| -------------------- | ---------------------------------------- |
| Tool calls           | Tool output exists in session transcript |
| File reads           | Content appears in session context       |
| File writes          | File exists with expected content        |
| Git operations       | Git log/status shows expected state      |
| Checklist completion | Session log contains completed checklist |
| Session status       | Frontmatter contains expected status     |

---

## Session Start Protocol

### Phase 0: Get Oriented (BLOCKING)

The agent MUST check recent commits and current branch.

1. The agent MUST run `git branch --show-current` to verify correct branch
2. The agent MUST verify the branch matches the intended work context (issue, PR, feature)
3. The agent MUST NOT proceed with work if on `main` or `master` branch (create feature branch first)
4. The agent MUST check recent commits

### Phase 1: Memory Initialization (BLOCKING)

The agent MUST complete memory initialization before any other action. This is a **blocking gate**.

**Requirements:**

1. The agent MUST initialize Brain memory tools as the first tool call
2. The agent MUST load initial context by reading relevant notes
3. The agent MUST NOT read files, search code, or respond to user requests until initialization succeeds
4. If initialization fails, the agent MUST report the failure and stop

**Verification:**

- Tool call outputs appear in session transcript
- Notes become available for reading
- Memory tools (read, write, edit, search) become functional

**Rationale:** Without memory initialization, agents lack access to project notes, semantic knowledge graph, and historical context. This causes repeated mistakes and lost decisions.

### Phase 2: Context Retrieval (BLOCKING)

The agent MUST read context documents before starting work. This is a **blocking gate**.

**Requirements:**

1. The agent MUST read the handoff document for previous session context (READ-ONLY reference)
2. The agent MUST read the memory index note to identify task-relevant notes
3. The agent MUST read notes from the memory index that match the task keywords before modifying code or files
4. The agent SHOULD read the project plan if working on the current project
5. The agent MAY read additional context files based on task requirements

**Evidence**: 30% session efficiency loss observed when notes not loaded first.

**Verification:**

- File contents appear in session context
- Agent references prior decisions from handoff document
- Agent does not ask questions answered in handoff document
- Session log Protocol Compliance section lists notes read (in Evidence column)

**Rationale:** Agents are expert amnesiacs. Without reading handoff context, they will repeat completed work or contradict prior decisions. Without loading relevant notes, agents repeat solved problems or miss established patterns.

### Phase 3: Skill Validation (BLOCKING)

The agent MUST validate skill availability before starting work. This is a **blocking gate**.

**Requirements:**

1. The agent MUST verify the skills directory exists
2. The agent MUST list available skill scripts
3. The agent MUST read the usage-mandatory note
4. The agent MUST read project constraints
5. The agent MUST document available skills in session log under "Skill Inventory"

**Verification:**

- Directory listing output appears in session transcript
- Note content loaded in context
- Session log contains Skill Inventory section

### Phase 4: Session Log Creation (REQUIRED)

The agent MUST create a session log early in the session.

**Requirements:**

1. The agent MUST create a session (which creates the session note and sets status to IN_PROGRESS)
2. The session log SHOULD be created within the first 5 tool calls of the session
3. The session log MUST include the Protocol Compliance section (see template below)
4. The agent MUST NOT defer session log creation to the end of the session

**Verification:**

- Session log file exists with correct naming pattern
- File contains Protocol Compliance section
- Frontmatter contains `status: IN_PROGRESS`
- Timestamp shows early creation, not late

**Rationale:** Late session log creation reduces traceability and often results in incomplete documentation when sessions end unexpectedly.

### Phase 5: Branch Verification (BLOCKING)

The agent MUST verify and declare the current branch before starting work. This is a **blocking gate**.

**Requirements:**

1. The agent MUST run `git branch --show-current` to verify correct branch
2. The agent MUST document the branch name in the session log header
3. The agent MUST verify the branch matches the intended work context (issue, PR, feature)
4. The agent MUST NOT proceed with work if on `main` or `master` branch (create feature branch first)
5. The agent SHOULD run `git status` to understand current working state
6. The agent SHOULD run `git log --oneline -1` to note starting commit

**Verification:**

- Session log contains branch name in Session Info section
- Branch matches conventional naming patterns (feat/*, fix/*, docs/*, etc.)
- Agent is not working on main/master (unless explicitly approved)

**Exit Criteria:** Branch name documented in session log before any file modifications.

---

## Session Start Checklist

Copy this checklist to each session log and verify completion:

```markdown
## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req    | Step                                       | Status | Evidence                    |
| ------ | ------------------------------------------ | ------ | --------------------------- |
| MUST   | Initialize Brain memory tools              | [ ]    | Tool output present         |
| MUST   | Load initial context (read relevant notes) | [ ]    | Tool output present         |
| MUST   | Read handoff context                       | [ ]    | Content in context          |
| MUST   | Create session log                         | [ ]    | Status: IN_PROGRESS         |
| MUST   | Verify available skills                    | [ ]    | Output documented below     |
| MUST   | Read usage-mandatory note                  | [ ]    | Content in context          |
| MUST   | Read project constraints                   | [ ]    | Content in context          |
| MUST   | Load task-relevant memories                | [ ]    | List notes loaded           |
| MUST   | Verify and declare current branch          | [ ]    | Branch documented below     |
| MUST   | Confirm not on main/master                 | [ ]    | On feature branch           |
| SHOULD | Verify git status                          | [ ]    | Output documented below     |
| SHOULD | Note starting commit                       | [ ]    | SHA documented below        |

### Skill Inventory

Available skills:

- [List from directory scan]

### Git State

- **Status**: [clean/dirty]
- **Branch**: [branch name - REQUIRED]
- **Starting Commit**: [SHA]

### Branch Verification

**Current Branch**: [output of `git branch --show-current`]
**Matches Expected Context**: [Yes/No - explain if No]

### Work Blocked Until

All MUST requirements above are marked complete.
```

---

## Session End Protocol

### Phase 1: Documentation Update (REQUIRED)

The agent MUST update documentation before ending.

**Requirements:**

1. The agent MUST complete the session (setting status to COMPLETE)
2. The agent MUST NOT update the handoff file directly. Session context MUST go to:

   - Your session log
   - Brain memory notes for cross-session context
   - Branch-specific handoff files (if on feature branch)

3. The agent MUST complete the session log with:

   - Tasks attempted and outcomes
   - Decisions made with rationale
   - Challenges encountered and resolutions
   - Link reference for next session handoff

4. The agent SHOULD update the project plan if tasks were completed
5. The agent MAY read the handoff file for historical context (read-only reference)

**Verification:**

- Session log contains complete information
- Brain memory note updated with relevant context
- Project plan checkboxes updated if applicable
- Handoff file is NOT modified (unless explicitly approved by architect)

### Phase 2: Quality Checks (REQUIRED)

The agent MUST run quality checks before ending.

**Requirements:**

1. The agent MUST run markdown lint with auto-fix on all markdown files
2. The agent SHOULD run validation scripts if available
3. The agent MUST NOT end session with known failing lints

**Verification:**

- Markdown lint output shows no errors
- Validation scripts pass or issues documented

### Phase 3: QA Validation (BLOCKING)

The agent MUST route to the qa agent after feature implementation. This is a **blocking gate**.

**Requirements:**

1. The agent MUST invoke the qa agent after completing feature implementation
2. The agent MUST wait for QA validation to complete
3. The agent MUST NOT commit feature code without QA validation
4. The agent MAY skip QA validation when:

   - **Docs-only**: All modified files are documentation files, and changes are strictly editorial (spelling, grammar, or formatting) with no changes to code, configuration, tests, workflows, or code blocks of any kind. Use evidence: `SKIPPED: docs-only`
   - **Investigation-only**: Session is investigation-only (no code/config changes), with staged files limited to investigation artifacts: sessions, analysis, retrospective, notes. Use evidence: `SKIPPED: investigation-only`

**Session Log Exemption:**

Session logs, analysis artifacts, and note updates are **audit trail, not implementation**. They are automatically filtered out when determining if QA validation is required.

**Verification:**

- QA report exists
- QA agent confirms validation passed
- No critical issues remain unaddressed

#### Investigation Session Examples

**Valid investigation sessions** (may use `SKIPPED: investigation-only`):

1. **Pure analysis** - Reading code, documenting findings
2. **Note updates** - Cross-session context updates
3. **CI debugging** - Investigating CI failures, documenting in session log
4. **Security assessments** - Writing security analysis
5. **Retrospectives** - Extracting learnings

**Not investigation sessions** (require QA validation):

- Planning sessions that produce PRDs
- Architecture sessions that produce ADRs
- Implementation sessions that touch code
- Critique sessions that gate implementation

### Phase 4: Git Operations (REQUIRED)

The agent MUST commit changes before ending.

**Requirements:**

1. The agent MUST re-verify current branch before EVERY commit:

   ```bash
   git branch --show-current
   # Verify matches session log declaration
   ```

2. The agent MUST NOT commit if branch mismatch detected (stop and investigate)
3. The agent MUST stage all changed files including session and note files
4. The agent MUST commit with conventional commit message format
5. The agent SHOULD verify clean git status after commit
6. The agent MAY push to remote if appropriate

**Verification:**

- Branch matches session log declaration before each commit
- `git status` shows clean state (or intentionally dirty with explanation)
- Commit exists with conventional format

**Branch Mismatch Recovery:**

If `git branch --show-current` differs from session log declaration:

1. **STOP** - Do not commit
2. **Document** the discrepancy in session log
3. **Investigate** - How did branch change?
4. **Resolve** - Either switch back or update session log with justification
5. **Resume** - Only after branch is confirmed correct

### Phase 5: Retrospective (RECOMMENDED)

The agent SHOULD invoke retrospective for significant sessions.

**Requirements:**

1. The agent SHOULD invoke retrospective agent for sessions with:

   - Multiple tasks completed
   - Significant challenges encountered
   - New patterns discovered
   - Process improvements identified

2. The agent MAY skip retrospective for trivial sessions (single file edits, documentation-only)

---

## Session End Checklist

Copy this checklist to each session log and verify completion:

```markdown
### Session End (COMPLETE ALL before closing)

| Req      | Step                                                    | Status | Evidence                             |
| -------- | ------------------------------------------------------- | ------ | ------------------------------------ |
| MUST     | Complete session log (all sections filled)               | [ ]    | File complete                        |
| MUST     | Complete session (set status to COMPLETE)                | [ ]    | Status: COMPLETE                     |
| MUST     | Update Brain memory (cross-session context)              | [ ]    | Note write confirmed                 |
| MUST     | Run markdown lint                                        | [ ]    | Lint output clean                    |
| MUST     | Route to qa agent (feature implementation)               | [ ]    | QA report or SKIPPED: docs-only      |
| MUST     | Commit all changes (including notes)                     | [ ]    | Commit SHA: ______                   |
| MUST NOT | Update handoff file directly                             | [ ]    | Handoff unchanged                    |
| SHOULD   | Update project plan                                      | [ ]    | Tasks checked off                    |
| SHOULD   | Invoke retrospective (significant sessions)              | [ ]    | Doc: ______                          |
| SHOULD   | Verify clean git status                                  | [ ]    | git status output                    |
```

---

## Session Log Template

Create at: `sessions/YYYY-MM-DD-session-NN.md`

```markdown
---
title: SESSION-YYYY-MM-DD_NN-topic
type: session
status: IN_PROGRESS
date: YYYY-MM-DD
tags: [session]
---

# Session NN - YYYY-MM-DD

## Session Info

- **Date**: YYYY-MM-DD
- **Branch**: [branch name]
- **Starting Commit**: [SHA]
- **Objective**: [What this session aims to accomplish]

## Protocol Compliance

### Session Start (COMPLETE ALL before work)

| Req    | Step                                       | Status | Evidence                    |
| ------ | ------------------------------------------ | ------ | --------------------------- |
| MUST   | Initialize Brain memory tools              | [ ]    | Tool output present         |
| MUST   | Load initial context (read relevant notes) | [ ]    | Tool output present         |
| MUST   | Read handoff context                       | [ ]    | Content in context          |
| MUST   | Create session log                         | [ ]    | Status: IN_PROGRESS         |
| MUST   | Verify available skills                    | [ ]    | Output documented below     |
| MUST   | Read usage-mandatory note                  | [ ]    | Content in context          |
| MUST   | Read project constraints                   | [ ]    | Content in context          |
| MUST   | Load task-relevant memories                | [ ]    | List notes loaded           |
| MUST   | Verify and declare current branch          | [ ]    | Branch documented below     |
| MUST   | Confirm not on main/master                 | [ ]    | On feature branch           |
| SHOULD | Verify git status                          | [ ]    | Output documented below     |
| SHOULD | Note starting commit                       | [ ]    | SHA documented below        |

### Skill Inventory

Available skills:

- [List from directory scan]

### Git State

- **Status**: [clean/dirty]
- **Branch**: [branch name - REQUIRED]
- **Starting Commit**: [SHA]

### Branch Verification

**Current Branch**: [output of `git branch --show-current`]
**Matches Expected Context**: [Yes/No - explain if No]

### Work Blocked Until

All MUST requirements above are marked complete.

---

## Work Log

### [Task/Topic]

**Status**: In Progress / Complete / Blocked

**What was done**:

- [Action taken]

**Decisions made**:

- [Decision]: [Rationale]

**Challenges**:

- [Challenge]: [Resolution]

**Files changed**:

- `[path]` - [What changed]

---

## Session End (COMPLETE ALL before closing)

| Req      | Step                                                    | Status | Evidence                             |
| -------- | ------------------------------------------------------- | ------ | ------------------------------------ |
| MUST     | Complete session log (all sections filled)               | [ ]    | File complete                        |
| MUST     | Complete session (set status to COMPLETE)                | [ ]    | Status: COMPLETE                     |
| MUST     | Update Brain memory (cross-session context)              | [ ]    | Note write confirmed                 |
| MUST     | Run markdown lint                                        | [ ]    | Lint output clean                    |
| MUST     | Route to qa agent (feature implementation)               | [ ]    | QA report or SKIPPED: docs-only      |
| MUST     | Commit all changes (including notes)                     | [ ]    | Commit SHA: ______                   |
| MUST NOT | Update handoff file directly                             | [ ]    | Handoff unchanged                    |
| SHOULD   | Update project plan                                      | [ ]    | Tasks checked off                    |
| SHOULD   | Invoke retrospective (significant sessions)              | [ ]    | Doc: ______                          |
| SHOULD   | Verify clean git status                                  | [ ]    | git status output                    |

### Lint Output

[Paste lint output here]

### Final Git Status

[Paste git status output here]

### Commits This Session

- `[SHA]` - [message]

---

## Notes for Next Session

- [Important context]
- [Gotchas discovered]
- [Recommendations]
```

---

## Unattended Execution Protocol

When user indicates autonomous/unattended operation:

### Requirements (STRICTER than attended mode)

| Req      | Requirement                                                         | Verification                                     |
| -------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| MUST     | Create session log IMMEDIATELY (within first 3 tool calls)          | Session log exists before any substantive work   |
| MUST     | Invoke orchestrator for task coordination                           | Orchestrator invoked in session transcript       |
| MUST     | Invoke critic before ANY merge or PR creation                       | Critic report exists                             |
| MUST     | Invoke QA after ANY code change                                     | QA report exists                                 |
| MUST NOT | Mark security comments as "won't fix" without security agent review | Security agent approval documented               |
| MUST NOT | Merge without explicit validation gate pass                         | All validations passed and documented            |
| MUST     | Document all "won't fix" decisions with rationale                   | Session log contains decision justification      |
| MUST     | Use skill scripts instead of raw commands                           | No raw API commands in automation                |

### Rationale

Autonomous execution removes human oversight. This requires **stricter** guardrails, not looser ones. Agents under time pressure optimize for task completion over protocol compliance. Technical enforcement prevents this.

### Recovery from Violations

If autonomous agent violates protocol:

1. **Stop work immediately**
2. **Create session log** if missing
3. **Invoke missing agents** (orchestrator, critic, QA)
4. **Document violation** in session log
5. **Complete all MUST requirements** before resuming

---

## Violation Handling

### What Constitutes a Protocol Violation

| Violation Type              | Severity | Response                         |
| --------------------------- | -------- | -------------------------------- |
| Skipping MUST requirement   | Critical | Stop work, complete requirement  |
| Skipping SHOULD requirement | Warning  | Document justification, continue |
| Skipping MAY requirement    | None     | No action needed                 |
| Fabricating evidence        | Critical | Session invalid, restart         |

### Recovery from Violations

If a protocol violation is discovered mid-session:

1. **Acknowledge** the violation explicitly
2. **Complete** the missed requirement immediately
3. **Document** the violation in session log
4. **Continue** work only after requirement is satisfied

Example:

```markdown
### Protocol Violation Detected

**Requirement**: MUST read handoff context
**Status**: Skipped
**Recovery**: Reading now before continuing work
**Timestamp**: [When detected]
```

---

## Cross-Reference: Other Documents

These documents reference this protocol but MUST NOT duplicate it:

| Document                | What it Should Contain                                  |
| ----------------------- | ------------------------------------------------------- |
| `AGENTS.md`             | Brief reference with link to this document              |
| `AGENT-INSTRUCTIONS.md` | Detailed task execution protocol (not session protocol) |

---

## Rationale for RFC 2119

### Why Use Formal Requirement Language

1. **Eliminates ambiguity**: "MANDATORY" can be interpreted as "very important suggestion." "MUST" is unambiguous.
2. **Enables tooling**: Scripts can parse MUST/SHOULD/MAY and verify accordingly.
3. **Supports prioritization**: Agents know which requirements can be deferred under time pressure.
4. **Industry standard**: RFC 2119 is widely understood across engineering disciplines.

### Requirement Level Selection

| Use Level | When                                                  |
| --------- | ----------------------------------------------------- |
| MUST      | Violation would cause session failure or data loss    |
| SHOULD    | Violation would degrade quality but not cause failure |
| MAY       | Truly optional enhancement                            |

---

## Related Documents

- [AGENTS.md](../AGENTS.md) - Entry point and coordination rules
- [AGENT-SYSTEM.md](./AGENT-SYSTEM.md) - Full agent catalog and workflows
- [AGENT-INSTRUCTIONS.md](./AGENT-INSTRUCTIONS.md) - Task execution protocol

---

*Version 3.0 - Tool-neutral canonical protocol*
