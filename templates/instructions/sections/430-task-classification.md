## Task Classification and Routing

### Step 1: Classify Task Type

| Type | Signal Words |
|:--|:--|
| Feature | "add", "implement", "create" |
| Bug Fix | "fix", "broken", "error" |
| Refactoring | "refactor", "clean up" |
| Infrastructure | "pipeline", "workflow", "deploy" |
| Security | "vulnerability", "auth", "CVE" |
| Documentation | "document", "explain" |
| Research | "investigate", "why does" |
| Strategic | "architecture", "ADR" |
| Ideation | URLs, "we should", "what if" |

### Step 2: Identify Domains

Code, Architecture, Security, Operations, Quality, Data, API, UX

### Step 3: Determine Complexity

| Domains | Complexity | Strategy |
|:--|:--|:--|
| 1 | Simple | Single specialist {{worker}} |
| 2 | Standard | 2-3 {{workers}} (parallel where independent) |
| 3+ | Complex | Full orchestration with {{sequence_model}} |

Security, Strategic, and Ideation tasks are always Complex.

---
