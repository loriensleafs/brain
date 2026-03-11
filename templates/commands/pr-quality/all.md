---
description: Use when running all 6 PR quality gate agents locally before pushing. Provides comprehensive pre-push validation across security, QA, analysis, architecture, DevOps, and roadmap.
argument-hint: [BASE_BRANCH]
allowed-tools:
  - Bash(git:*)
  - Skill
model: haiku
---

# PR Quality Gate - All Agents

Run all 6 quality gate agents (security, QA, analyst, architect, DevOps, and roadmap) sequentially on your current changes.

## Pre-flight Checks

<!-- NOTE: Commands prefixed with an exclamation mark and a backtick run at PREPROCESSING time in an
     isolated shell. $ARGUMENTS and positional params ($0, $1) are NOT
     available in that shell. Only $ARGUMENTS substitution in prompt text
     works. This is why git diff uses hardcoded "main" below. See #1088. -->

- Current branch: !`git branch --show-current`
- Changed files: !`git diff main --name-only | wc -l`
- Base branch: main

If no changes detected, exit early with PASS.

## Agent Execution

Invoke each agent command using Skill tool and capture results.

**Note**: All sub-skills compare against the `main` branch. To use a different base branch, run individual skills directly:

1. Security Agent: `/pr-quality:security BRANCH_NAME`
2. QA Agent: `/pr-quality:qa BRANCH_NAME`
3. Analyst Agent: `/pr-quality:analyst BRANCH_NAME`
4. Architect Agent: `/pr-quality:architect BRANCH_NAME`
5. DevOps Agent: `/pr-quality:devops BRANCH_NAME`
6. Roadmap Agent: `/pr-quality:roadmap BRANCH_NAME`

## Verdict Aggregation

Parse each agent's `VERDICT: TOKEN` output and merge using these rules:

**Merge Logic**:

- ANY `CRITICAL_FAIL`, `REJECTED`, or `FAIL` -> Final: **CRITICAL_FAIL**
- ANY `WARN` (no critical failures) -> Final: **WARN**
- ALL `PASS` -> Final: **PASS**

## Output Summary

Generate consolidated report in EXACTLY this format. Do not add preambles or explanations before the table:

| Agent | Verdict | Status | Key Findings |
|-------|---------|--------|--------------|
| Security | [verdict] | [status] | [summary] |
| QA | [verdict] | [status] | [summary] |
| Analyst | [verdict] | [status] | [summary] |
| Architect | [verdict] | [status] | [summary] |
| DevOps | [verdict] | [status] | [summary] |
| Roadmap | [verdict] | [status] | [summary] |

**FINAL VERDICT**: [PASS|WARN|CRITICAL_FAIL]

**Status Mapping**:

- PASS -> [PASS]
- WARN -> [WARNING]
- CRITICAL_FAIL/REJECTED/FAIL -> [FAIL]
- UNKNOWN -> [UNKNOWN]

**Next Steps**:

- **PASS**: Safe to commit and push
- **WARN**: Review findings, address if time permits, safe to push
- **CRITICAL_FAIL**: Fix blocking issues before pushing
