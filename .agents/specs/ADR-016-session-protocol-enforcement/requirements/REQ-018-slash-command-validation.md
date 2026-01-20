---
type: requirement
id: REQ-018
title: Slash Command Format Validation
status: accepted
priority: P2
category: functional
epic: ADR-016
related: []
created: 2026-01-19
updated: 2026-01-19
date_completed: 2026-01-19
validation_date: 2026-01-19
author: spec-generator
tags:
  - validation
  - slash-commands
  - format
  - ADR-006
---

# REQ-018: Slash Command Format Validation

## Requirement Statement

WHEN slash command files exist in .claude/commands/
THE SYSTEM SHALL validate format compliance and report failures
SO THAT slash commands follow ADR-006 standards and quality gates

## Context

The SlashCommandValidator.psm1 module provides validation orchestration for slash command files. It implements ADR-006 principle: logic in modules, not workflows.

The module:

- Discovers all .md files in .claude/commands/ (recursive)
- Invokes Validate-SlashCommand.ps1 on each file
- Aggregates results and returns exit code

Exit codes:

- 0 = All commands passed quality gates
- 1 = One or more commands failed validation

## Acceptance Criteria

- [ ] System discovers all .md files in .claude/commands/ directory (recursive)
- [ ] System invokes Validate-SlashCommand.ps1 for each discovered file
- [ ] System tracks validation results per file
- [ ] System reports failed files with count
- [ ] System returns exit code 0 if all validations pass
- [ ] System returns exit code 1 if any validation fails
- [ ] System exports Invoke-SlashCommandValidation function as public API
- [ ] System handles missing .claude/commands/ directory gracefully (skip validation)
- [ ] System handles missing Validate-SlashCommand.ps1 script gracefully (report error)

## Rationale

Slash command validation ensures:

- Commands follow consistent format standards
- Quality gates catch issues before deployment
- ADR-006 compliance (logic in modules, not workflows)
- Validation is reusable across CI and local development

## Dependencies

- .claude/commands/ directory structure
- .claude/skills/slashcommandcreator/scripts/Validate-SlashCommand.ps1
- PowerShell module system

## Related Artifacts

- ADR-016: Session Protocol Enforcement (parent epic)
- ADR-006: Logic in Modules, Not Workflows
