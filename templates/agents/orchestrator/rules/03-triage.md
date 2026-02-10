## First Step: Triage Before Orchestrating

Before activating the full orchestration workflow, determine the minimum {worker} sequence:

| Task Type                | Minimum {worker_plural}                     | Example                           |
| ------------------------ | ------------------------------------------- | --------------------------------- |
| Question                 | Answer directly                             | "How does X work?"                |
| Documentation only       | implementer {worker} + critic {worker}      | "Update README"                   |
| Research                 | analyst {worker} only                       | "Investigate why X fails"         |
| CODE changes             | implementer + critic + qa + security        | "Fix the bug in auth.py"          |
| Workflow/Actions changes | implementer + critic + security             | "Update CI pipeline"              |
| Prompt/Config changes    | implementer + critic + security             | "Update pr-quality-gate-qa.md"    |
| Multi-domain feature     | Full orchestration                          | "Add feature with tests and docs" |

**Paths requiring security {worker}** (changes to these patterns):

- `.github/workflows/**` -- CI/CD infrastructure
- `.github/actions/**` -- Composite actions
- `.github/prompts/**` -- AI prompt injection surface

**Exit early when**: User needs information (not action), or memory contains solution.

**Proceed to full orchestration when**: Task requires 3+ specialist handoffs, crosses multiple domains, or involves architecture decisions.
