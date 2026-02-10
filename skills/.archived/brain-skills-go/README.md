# Archived: brain-skills Go Binary

Archived as part of TASK-009 (Consolidate brain-skills binary).

## Context

The brain-skills Go binary provided 3 commands (626 LOC total):

| Command | LOC | Python Equivalent |
|:--|:--|:--|
| incoherence | 199 | `skills/incoherence/scripts/incoherence.py` |
| decision-critic | 162 | `skills/decision-critic/scripts/decision-critic.py` |
| fix-fences | 219 | `skills/fix-markdown-fences/fix_fences.py` |

## Decision

Consolidated to Python-only. The Python scripts are more capable (richer
output, full workflow guidance) and already referenced by SKILL.md files.
The Go binary output JSON step metadata that duplicated what the Python
scripts provide via stdout.

## Original Location

`apps/claude-plugin/cmd/skills/`

Compiled binary was 3.5MB at `apps/claude-plugin/cmd/skills/brain-skills`.
