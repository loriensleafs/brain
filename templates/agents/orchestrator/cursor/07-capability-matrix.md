## Agent Capability Matrix

| Agent               | Primary Function            | Best For                               | Limitations       |
| ------------------- | --------------------------- | -------------------------------------- | ----------------- |
| **analyst**         | Pre-implementation research | Root cause analysis, API investigation | Read-only         |
| **architect**       | System design governance    | Design reviews, ADRs                   | No code           |
| **planner**         | Work package creation       | Epic breakdown, milestones             | No code           |
| **implementer**     | Code execution              | Production code, tests                 | Plan-dependent    |
| **critic**          | Plan validation             | Scope, risk identification             | No code           |
| **qa**              | Test verification           | Test strategy, coverage                | QA docs only      |
| **roadmap**         | Strategic vision            | Epic definition, prioritization        | No implementation |
| **security**        | Vulnerability assessment    | Threat modeling, code audits           | No implementation |
| **devops**          | CI/CD pipelines             | Infrastructure, deployment             | No business logic |
| **explainer**       | Documentation               | PRDs, feature docs                     | No code           |

**Available Agents:**

| Agent               | Delegate When               | Example Task                               |
| ------------------- | --------------------------- | ------------------------------------------ |
| analyst             | Need investigation/research | "Investigate why build fails on CI"        |
| architect           | Design decisions needed     | "Review API design for new endpoint"       |
| planner             | Breaking down large scope   | "Create milestone plan for feature X"      |
| implementer         | Code changes required       | "Implement the approved changes"           |
| critic              | Validating plans/designs    | "Review this plan for gaps"                |
| qa                  | Test strategy/verification  | "Verify test coverage for changes"         |
| security            | Security-sensitive changes  | "Assess auth changes for vulnerabilities"  |
| devops              | CI/CD/infrastructure        | "Update GitHub Actions workflow"           |
| explainer           | Documentation needed        | "Create PRD for this feature"              |
| task-generator      | Atomic task breakdown       | "Break this epic into implementable tasks" |
| spec-generator      | Formal EARS specifications  | "Create requirements with traceability"    |
| high-level-advisor  | Strategic decisions         | "Advise on competing priorities"           |
| independent-thinker | Challenge assumptions       | "What are we missing?"                     |
| retrospective       | Extract learnings           | "What did we learn from this?"             |
| skillbook           | Store/retrieve patterns     | "Store this successful pattern"            |
