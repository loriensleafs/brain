---
type: requirement
id: REQ-015
title: Session Protocol Validation
status: accepted
priority: P2
category: functional
epic: ADR-016
related:
  - REQ-001
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - session
  - protocol
  - blocking-gate
---

# REQ-015: Session Protocol Validation

## Requirement Statement

WHEN a session log exists
THE SYSTEM SHALL validate Session Start and Session End protocol compliance with fail-closed verification
SO THAT agents follow canonical protocol requirements from SESSION-PROTOCOL.md

## Context

The Validate-Session.ps1 script implements verification-based enforcement for Session Protocol (ADR-007). It validates BOTH Session Start and Session End requirements.

**Fail-Closed Design**: If a requirement cannot be verified, it FAILS. Agent self-attestation is ignored unless backed by artifacts (git state, files, tool exit codes).

**Session Start Validation**:

- MUST: Initialize Serena (`mcp__serena__activate_project`)
- MUST: Initialize Serena instructions (`mcp__serena__initial_instructions`)
- MUST: Read memory-index and list memories loaded (ADR-007 E2 evidence validation)
- SHOULD: Verify git status and note starting commit

**Session End Validation**:

- MUST: Complete all checklist items
- MUST: Route to QA agent (skippable for docs-only or investigation-only sessions)
- MUST: Run markdownlint with --fix
- MUST: Commit all changes with SHA evidence
- MUST: Session log changed since starting commit

**QA Skip Rules**:

- Docs-only: Only .md files changed
- Investigation-only: Only .agents/sessions/, .agents/analysis/, .serena/memories/ changed

Exit codes:

- 0 = PASS
- 1 = FAIL (protocol violation)
- 2 = FAIL (usage/environment error)

## Acceptance Criteria

- [ ] System reads canonical protocol from SESSION-PROTOCOL.md
- [ ] System parses Session Start checklist table (canonical format required)
- [ ] System validates Session Start MUST rows are checked
- [ ] System validates memory-index Evidence contains actual memory names (ADR-007 E2)
- [ ] System verifies referenced memories exist in .serena/memories/
- [ ] System parses Session End checklist table (canonical format required)
- [ ] System enforces template match (Req, Step order from canonical protocol)
- [ ] System validates Session End MUST rows are checked
- [ ] System validates QA row (CRITICAL or SKIPPED with valid reason)
- [ ] System supports docs-only QA skip (only .md files changed)
- [ ] System supports investigation-only QA skip (only .agents/, .serena/ changed)
- [ ] System validates git worktree is clean (skip in pre-commit mode)
- [ ] System validates at least one commit since starting commit (skip in pre-commit)
- [ ] System validates Commit SHA evidence exists and is valid (skip in pre-commit)
- [ ] System runs markdownlint validation
- [ ] System supports -FixMarkdown flag to run markdownlint --fix
- [ ] System supports -PreCommit flag for pre-commit hook integration
- [ ] System provides pedagogical error messages with fix suggestions

## Rationale

Session protocol validation ensures:

- Agents initialize memory system before work
- Memory retrieval is evidenced (not just self-reported)
- Session context is documented
- QA validation occurs for implementation changes
- All work is committed with traceability

Fail-closed design prevents protocol bypass and ensures verification.

## Dependencies

- .agents/SESSION-PROTOCOL.md (canonical protocol)
- .agents/sessions/ directory structure
- .serena/memories/ directory (for memory evidence)
- git (for worktree status, commit validation)
- npx markdownlint-cli2 (for markdown linting)

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- ADR-007: Memory Evidence Validation (E2)
- REQ-001: Session Protocol Validation (original ADR-016 requirement)
