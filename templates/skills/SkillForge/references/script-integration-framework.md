# Script Integration Framework

Scripts transform skills from documentation-only guides into executable, verifiable systems. This framework provides decision criteria for when to create scripts, how to integrate them effectively, and patterns for making skills autonomous and self-verifying.

---

## Overview

### Why Scripts Matter for Skills

| Without Scripts | With Scripts |
|----------------|--------------|
| Manual execution | Automated, repeatable |
| Human verification | Self-verification |
| Session-bound state | Persistent state |
| Error-prone | Deterministic |
| Hard to compose | Easily orchestrated |

**Principle:** A skill with well-designed scripts can run autonomously, verify its own success, and recover from errors without human intervention.

---

## Decision Tree: Script vs No Script

### Primary Decision

```
Does this operation require...?
│
├─► Deterministic reliability (same input → same output)?
│   └── YES → Script recommended
│
├─► Repeated execution (same logic needed >2 times)?
│   └── YES → Script recommended
│
├─► State persistence across sessions?
│   └── YES → Script required (JSON/YAML state files)
│
├─► Autonomous verification (skill verifies itself)?
│   └── YES → Script required (exit codes, ValidationResult)
│
├─► Complex calculations or transformations?
│   └── YES → Script recommended
│
├─► Integration with external tools/APIs?
│   └── YES → Script recommended (abstraction layer)
│
├─► Progress tracking or visualization?
│   └── YES → Script recommended
│
└── All NO → Prose instructions sufficient
```

### Quick Decision Matrix

| Scenario | Script? | Rationale |
|----------|---------|-----------|
| "Validate the output matches X" | Yes | Verification must be deterministic |
| "Run this command once" | No | One-off, simple instruction |
| "Track progress across phases" | Yes | State persistence needed |
| "Calculate a score based on criteria" | Yes | Complex logic, reproducible |
| "Read this file and understand it" | No | Cognitive task, not automatable |
| "Transform JSON to YAML" | Yes | Deterministic transformation |
| "Decide which approach to use" | No | Requires human judgment |
| "Check if all tests pass" | Yes | Verification with clear exit code |

---

## Script Categories

### The 7 Script Types

| Category | Purpose | When to Use | Key Patterns |
|----------|---------|-------------|--------------|
| **Validation** | Verify artifacts meet standards | Output verification, quality gates | `ValidationResult`, exit codes 0/1 |
| **State Management** | Track progress, persist data | Multi-session workflows, progress tracking | JSON files, subcommand parsing |
| **Generation** | Create artifacts from templates | Scaffolding, boilerplate creation | Template substitution, file I/O |
| **Transformation** | Convert or process data | Format conversion, data cleaning | Input parsing, output formatting |
| **Integration** | Interface with external tools | API calls, tool orchestration | Graceful fallbacks, error handling |
| **Visualization** | Render progress or status | Dashboards, progress indicators | ASCII art, progress bars |
| **Calculation** | Compute metrics or scores | Scoring rubrics, analytics | Numerical processing, aggregation |

### Category Selection Flow

```
What does the script primarily do?
│
├─► Check if something is correct/valid?
│   └── VALIDATION
│
├─► Save or load data between runs?
│   └── STATE MANAGEMENT
│
├─► Create new files from templates?
│   └── GENERATION
│
├─► Convert data from one format to another?
│   └── TRANSFORMATION
│
├─► Talk to external tools or APIs?
│   └── INTEGRATION
│
├─► Show progress or status visually?
│   └── VISUALIZATION
│
└── Compute numbers or scores?
    └── CALCULATION
```

---

## Language Selection

### Decision Guide

| Language | Best For | Pros | Cons | Use When |
|----------|----------|------|------|----------|
| **TypeScript (Bun)** | Most scripts | Type-safe, fast startup, rich stdlib | Bun required | Default choice |
| **Bash** | Simple glue | No dependencies, native | Limited logic | <30 lines, Unix-only |
| **Go** | Performance | Fast, single binary | Compile step | Performance-critical |

### Default: TypeScript (Bun)

TypeScript with Bun is the default language for skill scripts because:

1. **Type Safety** - Catches errors at write-time, not runtime
2. **Fast Startup** - Bun runs TypeScript natively with no compile step
3. **Rich Standard Library** - `fs`, `path`, `Bun.file()`, `Bun.Glob` cover most needs
4. **No Dependencies** - Bun and Node stdlib are sufficient for most scripts
5. **Ecosystem Alignment** - Matches existing skill scripts

**Rule:** Use TypeScript with Bun unless you have a specific reason not to.

### When to Consider Alternatives

| Scenario | Consider |
|----------|----------|
| Wrapping 2-3 CLI commands | Bash |
| Need single static binary | Go |
| System-level operations | Go or Bash |

---

## Agentic Script Patterns

These patterns make scripts capable of autonomous operation.

### Pattern 1: Self-Verification

Scripts should verify their own outputs:

```typescript
function executeAndVerify(inputData: unknown): Result {
  const result = performOperation(inputData);

  // Self-verification - the script checks itself
  const { valid, reason } = verifyOutput(result);
  if (!valid) {
    return {
      success: false,
      message: `Verification failed: ${reason}`,
      errors: [reason],
    };
  }

  return { success: true, message: "Operation verified", data: result };
}
```

**Why:** Enables autonomous operation - Claude can trust the script's exit code.

### Pattern 2: Error Recovery

Scripts should attempt recovery before failing:

```typescript
async function resilientOperation(maxRetries: number = 3): Promise<Result> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = performOperation();
      if (verifyResult(result)) return result;
    } catch (e) {
      if (attempt === maxRetries - 1) throw e;
      console.error(`Attempt ${attempt + 1} failed: ${e}, retrying...`);
      await Bun.sleep(1000);
    }
  }
  return fallbackResult();
}
```

**Why:** Reduces need for human intervention on transient failures.

### Pattern 3: State Persistence

Scripts should maintain state across sessions:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const HOME = process.env.HOME ?? "";
const STATE_DIR = join(HOME, ".cache", "skill-name");
const STATE_FILE = join(STATE_DIR, "state.json");

function loadState(): Record<string, unknown> {
  if (existsSync(STATE_FILE)) {
    try {
      return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    } catch {
      return { error: "corrupted", data: {} };
    }
  }
  return { version: "1.0", created_at: new Date().toISOString() };
}

function saveState(state: Record<string, unknown>): void {
  mkdirSync(STATE_DIR, { recursive: true });
  state["updated_at"] = new Date().toISOString();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
```

**Why:** Enables multi-session workflows and progress tracking.

### Pattern 4: Structured Output

Scripts should output structured data for automation:

```typescript
function main(): void {
  const result = processInput();

  // Structured output for automation
  if (jsonMode) {
    console.log(JSON.stringify({
      success: result.success,
      message: result.message,
      data: result.data,
      errors: result.errors,
    }));
  } else {
    // Human-readable output
    console.log(`${result.success ? "Success" : "Failed"}: ${result.message}`);
  }

  process.exit(result.success ? 0 : 1);
}
```

**Why:** Enables script composition and programmatic processing.

### Pattern 5: Graceful Degradation

Scripts should work with optional dependencies:

```typescript
function parseYaml(text: string): Record<string, string> {
  // Basic key-value parsing (no external YAML dependency)
  const result: Record<string, string> = {};
  for (const line of text.split("\n")) {
    if (line.includes(":") && !line.trim().startsWith("#")) {
      const colonIdx = line.indexOf(":");
      result[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
    }
  }
  return result;
}
```

**Why:** Reduces dependency requirements and improves portability.

---

## Script Discovery Process (Phase 1)

During Deep Analysis, apply the **Automation Lens** (Lens 12) to identify script opportunities.

### Automation Lens Questions

| Question | Purpose |
|----------|---------|
| "What operations will be repeated identically?" | Identify determinism needs |
| "What outputs require validation before proceeding?" | Identify verification scripts |
| "What state needs to persist between skill invocations?" | Identify state management |
| "How will the skill verify its own success?" | Enable autonomous verification |
| "What existing scripts in the ecosystem could be reused?" | Avoid reinventing |
| "Can this skill run overnight without human intervention?" | Assess agentic capability |
| "What would break if executed manually vs scripted?" | Identify fragile operations |
| "How would another Claude instance recover from failure?" | Design error handling |

### Research Existing Scripts

Before creating new scripts, search for reusable patterns:

```bash
# Find relevant scripts in the skills ecosystem
find ~/.claude/skills -name "*.ts" -path "*/scripts/*" | xargs grep -l "<keyword>"

# List all skill scripts for reference
ls ~/.claude/skills/*/scripts/

# Check specific patterns
grep -r "ValidationResult" ~/.claude/skills/*/scripts/
grep -r "process.argv" ~/.claude/skills/*/scripts/
```

### Script Decision Documentation

For each identified script, document in the specification:

```xml
<script id="S1">
  <name>validate_output.ts</name>
  <category>validation</category>
  <purpose>Verify generated artifacts meet quality standards</purpose>
  <rationale>Manual verification is error-prone and inconsistent</rationale>
  <reused_from>~/.claude/skills/skillforge/scripts/validate_skill.ts</reused_from>
</script>
```

---

## Integration Patterns

### How Scripts Are Called from Skills

**Pattern 1: Direct Invocation**

```markdown
## Phase 2: Validation

Run the validation script:

\`\`\`bash
bun ~/.claude/skills/my-skill/scripts/validate_output.ts <input-file>
\`\`\`

Expected output:
- Exit code 0: Validation passed
- Exit code 1: Validation failed (see stderr for details)
```

**Pattern 2: Conditional Invocation**

```markdown
If generating multiple files:

\`\`\`bash
bun scripts/batch_validate.ts --directory output/
\`\`\`

For single file:

\`\`\`bash
bun scripts/validate_single.ts output/result.json
\`\`\`
```

**Pattern 3: Piped Processing**

```markdown
\`\`\`bash
cat result.json | bun scripts/transform.ts --format yaml > result.yaml
\`\`\`
```

**Pattern 4: Subcommand Invocation**

```markdown
\`\`\`bash
# Initialize project
bun scripts/tracker.ts init "My Project"

# Add a step
bun scripts/tracker.ts add-step "First milestone" --project my-project.json

# Update status
bun scripts/tracker.ts update step-001 --status verified
\`\`\`
```

### Script Output Standards

| Output Type | Format | Convention |
|-------------|--------|------------|
| Success | Exit code 0 | Always for success |
| Failure | Exit code 1 | General failure |
| Validation failure | Exit code 10 | Specific to validation |
| Missing arguments | Exit code 2 | Argument errors |
| Structured data | JSON to stdout | When `--json` flag used |
| Progress messages | stderr | Keep stdout clean for data |
| Error messages | stderr | Consistent with Unix convention |

### Documentation Requirements

Every script must be documented in SKILL.md:

```markdown
## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `validate_output.ts` | Verify generated artifacts | `bun scripts/validate_output.ts <path>` |
| `generate_report.ts` | Create summary report | `bun scripts/generate_report.ts --project <name>` |
| `tracker.ts` | Track progress across sessions | `bun scripts/tracker.ts <command> [args]` |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General failure |
| 2 | Invalid arguments |
| 10 | Validation failure |
```

---

## Agentic Capability Checklist

Before finalizing a skill with scripts, verify:

- [ ] **Autonomous Execution:** Can the skill run without user intervention?
- [ ] **Self-Verification:** Can scripts verify their own outputs?
- [ ] **Error Recovery:** Do scripts attempt recovery before failing?
- [ ] **State Persistence:** Is progress saved across sessions?
- [ ] **Structured Output:** Do scripts output machine-readable data?
- [ ] **Documentation:** Are all scripts documented in SKILL.md?
- [ ] **Exit Codes:** Do scripts use consistent exit codes?
- [ ] **Graceful Degradation:** Do scripts handle optional dependencies?

---

## Hooks Integration

Skills can leverage hooks for automatic script invocation during tool use.

### When to Use Hooks with Scripts

| Scenario | Hook | Script Pattern |
|----------|------|----------------|
| Validate before generation | PreToolUse on Write | `validation/validate_input.ts` |
| Verify after generation | PostToolUse on Write | `validation/verify_output.ts` |
| Log all tool activity | PostToolUse (all) | `logging/activity_log.ts` |
| Cleanup on completion | Stop | `state/cleanup.ts` |

### Hook + Script Integration Pattern

**Skill frontmatter:**
```yaml
---
name: validated-generator
hooks:
  PreToolUse:
    - matcher: "Bash(bun:scripts/generate*)"
      hooks:
        - type: command
          command: "bun scripts/validate_params.ts"
  PostToolUse:
    - matcher: "Write"
      hooks:
        - type: command
          command: "bun scripts/verify_artifact.ts"
---
```

Read `$TOOL_INPUT` and `$TOOL_OUTPUT` from environment variables inside the script.
Avoid interpolating these values directly in shell command strings.

**Script requirements for hook integration:**
1. Accept input via `$TOOL_INPUT` or `$TOOL_OUTPUT` environment variables
2. Exit code 0 allows tool execution to proceed
3. Exit code non-0 blocks tool execution (PreToolUse) or flags error (PostToolUse)
4. Output to stderr for error messages (stdout may be captured)

### Hook Script Template

```typescript
/**
 * hook_validator.ts - Validate tool input before execution
 *
 * Called by PreToolUse hook with $TOOL_INPUT containing the tool parameters.
 * Exit 0 to allow, exit 1 to block.
 */

function validateInput(toolInput: string): { valid: boolean; reason: string } {
  try {
    JSON.parse(toolInput);
    // Add validation logic here
    return { valid: true, reason: "Input valid" };
  } catch {
    return { valid: false, reason: "Invalid JSON input" };
  }
}

function main(): void {
  const toolInput = process.env["TOOL_INPUT"] ?? "";

  if (!toolInput) {
    console.error("Warning: No TOOL_INPUT provided");
    process.exit(0); // Allow by default if no input
  }

  const { valid, reason } = validateInput(toolInput);

  if (!valid) {
    console.error(`Blocked: ${reason}`);
    process.exit(1);
  }

  process.exit(0);
}

main();
```

### Agentic Capability Enhancement

Hooks enable fully autonomous skill execution:

```
WITHOUT HOOKS:
  Claude runs script → Script fails → Claude notices → Claude retries
  (Multiple tool calls, potential for missed errors)

WITH HOOKS:
  PreToolUse validates → Only valid calls proceed → PostToolUse verifies
  (Single tool call, guaranteed validation)
```

| Capability | Without Hooks | With Hooks |
|------------|---------------|------------|
| Input validation | Manual check in script | Automatic gate |
| Output verification | Separate tool call | Inline verification |
| Error handling | After-the-fact | Preventive |
| Audit trail | Custom logging | Built-in hook logging |

---

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| Hardcoded paths | Breaks on other systems | Use `Path.home()` or arguments |
| No exit codes | Can't detect failure | Use `sys.exit(0)` / `sys.exit(1)` |
| Print-only errors | Errors lost in noise | Use `sys.stderr` |
| Required external deps | Reduces portability | Use stdlib or graceful fallback |
| No self-verification | Can't trust output | Add verification step |
| Monolithic scripts | Hard to reuse | Break into focused scripts |
| No state management | Lose progress | Use JSON state files |
| Hardcoded tool versions | Breaks with updates | Abstract tool invocations |

---

## Related References

- [Script Patterns Catalog](script-patterns-catalog.md) - Standard code patterns
- [Regression Questions](regression-questions.md) - Category 7: Script questions
- [Evolution Scoring](evolution-scoring.md) - Scripts and timelessness
