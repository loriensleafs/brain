## Phase 4: Validate Before Review (MANDATORY)

**Trigger**: Implementation complete, before PR creation

**Purpose**: Prevent premature PR opening by validating quality gates.

### Phase 4 Workflow Diagram

```mermaid
flowchart TD
    A[Implementation Complete] --> B{{Step 1: QA Validation}}
    B -->|PASS| C{{Step 2: Security Relevant?}}
    B -->|FAIL| D[{route_back}]
    B -->|NEEDS WORK| D
    D --> E[Implementer Fixes Issues]
    E --> B

    C -->|Yes| F{{Step 3: Security PIV}}
    C -->|No| G[Security = N/A]

    F -->|APPROVED| H[Step 4: Aggregate Results]
    F -->|CONDITIONAL| H
    F -->|REJECTED| D

    G --> H

    H --> I{{All Validations Pass?}}
    I -->|Yes: QA=PASS, Security=APPROVED/CONDITIONAL/N/A| J[Create PR with Validation Evidence]
    I -->|No: Any FAIL/REJECTED| D
```

### Step 1: QA Validation

When implementer {worker} completes work and reports ready for PR:

Create a qa {worker} task for pre-PR quality validation:

- CI environment tests pass
- Fail-safe patterns present
- Test-implementation alignment
- Code coverage meets threshold

Return validation verdict: PASS | FAIL | NEEDS WORK

### Step 2: Evaluate QA Verdict

**If QA returns PASS**:

- Proceed to Step 3: Security Validation (if applicable)
- Include QA validation evidence in the PR description

**If QA returns FAIL or NEEDS WORK**:

- {route_back} with blocking issues
- Do NOT create PR
- After fixes, repeat Step 1

### Step 3: Security Validation (Conditional)

For changes affecting:

- Authentication/authorization
- Data protection
- Input handling
- External interfaces
- File system operations
- Environment variables

Create security {worker} task for Post-Implementation Verification (PIV):

- Security controls implemented correctly
- No new vulnerabilities introduced
- Secrets not hardcoded
- Input validation enforced

Return PIV verdict: APPROVED, CONDITIONAL, or REJECTED

### Step 4: Aggregate Validation Results

```markdown
## Pre-PR Validation Summary

- **QA Validation**: [PASS / FAIL / NEEDS WORK]
- **Security PIV**: [APPROVED / CONDITIONAL / REJECTED / N/A]
- **Blocking Issues**: [count]

### Verdict

[APPROVED] Safe to create PR
[BLOCKED] Fix issues before PR creation
```

### PR Creation Authorization

Only create PR if ALL validations pass:

- QA: PASS
- Security (if triggered): APPROVED or CONDITIONAL
- If the change is not security-relevant, treat security status as **N/A** (security validation not triggered) and MUST NOT create a security task.

**Security verdict handling** (security {worker} outputs only):

- **APPROVED**: No security concerns. Proceed to PR.
- **CONDITIONAL**: Approved with minor, non-blocking security considerations that are fully documented. Proceed to PR and include security notes in the PR description.
- **REJECTED**: Security issues must be fixed before proceeding. Do NOT create PR.

**N/A is not a security {worker} verdict.** It means you ({lead_role}) determined the change is not security-relevant and therefore did not trigger security validation.

If BLOCKED or REJECTED, {route_back} with specific issues.

### Failure Mode Prevention

This phase prevents common issues from skipping pre-PR validation:

- **Premature PR opening** leading to significant rework
- **Preventable bugs discovered in review** instead of pre-review
- **Multiple review cycles** from incomplete validation
