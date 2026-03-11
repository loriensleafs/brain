#!/usr/bin/env bun
/**
 * Analyze Skill - Step-by-step codebase analysis with exploration and deep investigation.
 *
 * Six-phase workflow:
 * 1. EXPLORATION: Process Explore sub-agent results
 * 2. FOCUS SELECTION: Classify investigation areas
 * 3. INVESTIGATION PLANNING: Commit to specific files and questions
 * 4. DEEP ANALYSIS (1-N): Progressive investigation with evidence
 * 5. VERIFICATION: Validate completeness before synthesis
 * 6. SYNTHESIS: Consolidate verified findings
 *
 * Usage:
 *   bun run analyze.ts --step-number 1 --total-steps 6 --thoughts "Explore found: ..."
 */

function getPhaseName(step: number, totalSteps: number): string {
  if (step === 1) return "EXPLORATION";
  if (step === 2) return "FOCUS SELECTION";
  if (step === 3) return "INVESTIGATION PLANNING";
  if (step === totalSteps - 1) return "VERIFICATION";
  if (step === totalSteps) return "SYNTHESIS";
  return "DEEP ANALYSIS";
}

function getStateRequirement(step: number): string[] {
  if (step < 2) return [];

  return [
    "",
    "<state_requirement>",
    "CRITICAL: Your --thoughts for this step MUST include:",
    "",
    "1. FOCUS AREAS: Each area identified and its priority (from step 2)",
    "2. INVESTIGATION PLAN: Files and questions committed to (from step 3)",
    "3. FILES EXAMINED: Every file read with key observations",
    "4. ISSUES BY SEVERITY: All [CRITICAL]/[HIGH]/[MEDIUM]/[LOW] items",
    "5. PATTERNS: Cross-file patterns identified",
    "6. HYPOTHESES: Current theories and supporting evidence",
    "7. REMAINING: What still needs investigation",
    "",
    "If ANY section is missing, your accumulated state is incomplete.",
    "Reconstruct it before proceeding.",
    "</state_requirement>",
  ];
}

interface StepGuidance {
  phase: string;
  stepTitle: string;
  actions: string[];
  next: string | null;
}

function getStepGuidance(step: number, totalSteps: number): StepGuidance {
  const nextStep = step < totalSteps ? step + 1 : null;
  const phase = getPhaseName(step, totalSteps);
  const isFinal = step >= totalSteps;
  const minSteps = 6;

  // PHASE 1: EXPLORATION
  if (step === 1) {
    return {
      phase,
      stepTitle: "Process Exploration Results",
      actions: [
        "STOP. Before proceeding, verify you have Explore agent results.",
        "",
        "If your --thoughts do NOT contain Explore agent output, you MUST:",
        "",
        "<exploration_delegation>",
        "Assess the scope and delegate appropriately:",
        "",
        "SINGLE CODEBASE, FOCUSED SCOPE:",
        "  - One Explore agent is sufficient",
        "  - Use Agent tool with subagent_type='Explore'",
        "  - Prompt: 'Explore this repository. Report directory structure,",
        "    tech stack, entry points, main components, observed patterns.'",
        "",
        "LARGE CODEBASE OR BROAD SCOPE:",
        "  - Launch MULTIPLE Explore agents IN PARALLEL (single message, multiple Agent calls)",
        "  - Divide by logical boundaries: frontend/backend, services, modules",
        "  - Example prompts:",
        "    Agent 1: 'Explore src/api/ and src/services/. Focus on API structure.'",
        "    Agent 2: 'Explore src/core/ and src/models/. Focus on domain logic.'",
        "    Agent 3: 'Explore tests/ and config/. Focus on test patterns and configuration.'",
        "",
        "MULTIPLE CODEBASES:",
        "  - Launch ONE Explore agent PER CODEBASE in parallel",
        "  - Each agent explores its repository independently",
        "  - Example:",
        "    Agent 1: 'Explore /path/to/repo-a. Report structure and patterns.'",
        "    Agent 2: 'Explore /path/to/repo-b. Report structure and patterns.'",
        "",
        "WAIT for ALL agents to complete before invoking this step again.",
        "</exploration_delegation>",
        "",
        "Only proceed below if you have concrete Explore output to process.",
        "",
        "============================================================",
        "",
        "<exploration_processing>",
        "From the Explore agent(s) report(s), extract and document:",
        "",
        "STRUCTURE:",
        "  - Main directories and their purposes",
        "  - Where core logic lives vs. configuration vs. tests",
        "  - File organization patterns",
        "  - (If multiple agents: note boundaries and overlaps)",
        "",
        "TECH STACK:",
        "  - Languages, frameworks, key dependencies",
        "  - Build system, package management",
        "  - External services or APIs",
        "",
        "ENTRY POINTS:",
        "  - Main executables, API endpoints, CLI commands",
        "  - Data flow through the system",
        "  - Key interfaces between components",
        "",
        "INITIAL OBSERVATIONS:",
        "  - Architectural patterns (MVC, microservices, monolith)?",
        "  - Obvious code smells or areas of concern?",
        "  - Parts that seem well-structured vs. problematic?",
        "</exploration_processing>",
      ],
      next: `Invoke step ${nextStep} with your processed exploration summary. Include all structure, tech stack, and initial observations in --thoughts.`,
    };
  }

  // PHASE 2: FOCUS SELECTION
  if (step === 2) {
    const actions = [
      "Based on exploration findings, determine what needs deep investigation.",
      "",
      "<focus_classification>",
      "Evaluate the codebase against each dimension. Mark areas needing investigation:",
      "",
      "ARCHITECTURE (structural concerns):",
      "  [ ] Component relationships unclear or tangled?",
      "  [ ] Dependency graph needs mapping?",
      "  [ ] Layering violations or circular dependencies?",
      "  [ ] Missing or unclear module boundaries?",
      "",
      "PERFORMANCE (efficiency concerns):",
      "  [ ] Hot paths that may be inefficient?",
      "  [ ] Database queries needing review?",
      "  [ ] Memory allocation patterns?",
      "  [ ] Concurrency or parallelism issues?",
      "",
      "SECURITY (vulnerability concerns):",
      "  [ ] Input validation gaps?",
      "  [ ] Authentication/authorization flows?",
      "  [ ] Sensitive data handling?",
      "  [ ] External API integrations?",
      "",
      "QUALITY (maintainability concerns):",
      "  [ ] Code duplication patterns?",
      "  [ ] Overly complex functions/classes?",
      "  [ ] Missing error handling?",
      "  [ ] Test coverage gaps?",
      "</focus_classification>",
      "",
      "<priority_assignment>",
      "Rank your focus areas by priority (P1 = most critical):",
      "",
      "  P1: [focus area] - [why most critical]",
      "  P2: [focus area] - [why second]",
      "  P3: [focus area] - [if applicable]",
      "",
      "Consider: security > correctness > performance > maintainability",
      "</priority_assignment>",
      "",
      "<step_estimation>",
      "Estimate total steps based on scope:",
      "",
      `  Minimum steps: ${minSteps} (exploration + focus + planning + 1 analysis + verification + synthesis)`,
      "  1-2 focus areas, small codebase:  total_steps = 6-7",
      "  2-3 focus areas, medium codebase: total_steps = 7-9",
      "  3+ focus areas, large codebase:   total_steps = 9-12",
      "",
      "You can adjust this estimate as understanding grows.",
      "</step_estimation>",
      ...getStateRequirement(step),
    ];
    return {
      phase,
      stepTitle: "Classify Investigation Areas",
      actions,
      next: `Invoke step ${nextStep} with your prioritized focus areas and updated total_steps estimate. Next: create investigation plan.`,
    };
  }

  // PHASE 3: INVESTIGATION PLANNING
  if (step === 3) {
    const actions = [
      "You have identified focus areas. Now commit to specific investigation targets.",
      "",
      "This step creates ACCOUNTABILITY. You will verify against these commitments.",
      "",
      "<investigation_commitments>",
      "For EACH focus area (in priority order), specify:",
      "",
      "---",
      "FOCUS AREA: [name] (Priority: P1/P2/P3)",
      "",
      "Files to examine:",
      "  - path/to/file1.ts",
      "    Question: [specific question to answer about this file]",
      "    Hypothesis: [what you expect to find]",
      "",
      "  - path/to/file2.ts",
      "    Question: [specific question to answer]",
      "    Hypothesis: [what you expect to find]",
      "",
      "Evidence needed to confirm/refute:",
      "  - [what specific code patterns would confirm hypothesis]",
      "  - [what would refute it]",
      "---",
      "",
      "Repeat for each focus area.",
      "</investigation_commitments>",
      "",
      "<commitment_rules>",
      "This is a CONTRACT. In subsequent steps, you MUST:",
      "",
      "  1. Read every file listed (using Read tool)",
      "  2. Answer every question posed",
      "  3. Document evidence with file:line references",
      "  4. Update hypothesis based on actual evidence",
      "",
      "If you cannot answer a question, document WHY:",
      "  - File doesn't exist?",
      "  - Question was wrong?",
      "  - Need different files?",
      "",
      "Do NOT silently skip commitments.",
      "</commitment_rules>",
      ...getStateRequirement(step),
    ];
    return {
      phase,
      stepTitle: "Create Investigation Plan",
      actions,
      next: `Invoke step ${nextStep} with your complete investigation plan. Next: begin executing the plan with the highest priority focus area.`,
    };
  }

  // PHASE 5: VERIFICATION (step N-1)
  if (step === totalSteps - 1) {
    const actions = [
      "STOP. Before synthesizing, verify your investigation is complete.",
      "",
      "<completeness_audit>",
      "Review your investigation commitments from Step 3.",
      "",
      "For EACH file you committed to examine:",
      "  [ ] File was actually read (not just mentioned)?",
      "  [ ] Specific question was answered with evidence?",
      "  [ ] Finding documented with file:line reference and quoted code?",
      "",
      "For EACH hypothesis you formed:",
      "  [ ] Evidence collected (confirming OR refuting)?",
      "  [ ] Hypothesis updated based on evidence?",
      "  [ ] If refuted, what replaced it?",
      "</completeness_audit>",
      "",
      "<gap_detection>",
      "Identify gaps in your investigation:",
      "",
      "  - Files committed but not examined?",
      "  - Focus areas declared but not investigated?",
      "  - Issues referenced without file:line evidence?",
      "  - Patterns claimed without cross-file validation?",
      "  - Questions posed but not answered?",
      "",
      "List each gap explicitly:",
      "  GAP 1: [description]",
      "  GAP 2: [description]",
      "  ...",
      "</gap_detection>",
      "",
      "<gap_resolution>",
      "If gaps exist:",
      "  1. INCREASE total_steps by number of gaps that need investigation",
      "  2. Return to DEEP ANALYSIS phase to fill gaps",
      "  3. Re-enter VERIFICATION after gaps are filled",
      "",
      "If no gaps (or gaps are acceptable):",
      "  Proceed to SYNTHESIS (next step)",
      "</gap_resolution>",
      "",
      "<evidence_quality_check>",
      "For each [CRITICAL] or [HIGH] severity finding, verify:",
      "  [ ] Has quoted code (2-5 lines)?",
      "  [ ] Has exact file:line reference?",
      "  [ ] Impact is clearly explained?",
      "  [ ] Recommended fix is actionable?",
      "",
      "Findings without evidence are UNVERIFIED. Either:",
      "  - Add evidence now, or",
      "  - Downgrade severity, or",
      "  - Mark as 'needs investigation'",
      "</evidence_quality_check>",
      ...getStateRequirement(step),
    ];
    return {
      phase,
      stepTitle: "Verify Investigation Completeness",
      actions,
      next: `If gaps found: invoke earlier step to fill gaps, then return here. If complete: invoke step ${nextStep} for final synthesis.`,
    };
  }

  // PHASE 6: SYNTHESIS (final step)
  if (isFinal) {
    return {
      phase,
      stepTitle: "Consolidate and Recommend",
      actions: [
        "Investigation verified. Synthesize all findings into actionable output.",
        "",
        "<final_consolidation>",
        "Organize all VERIFIED findings by severity:",
        "",
        "CRITICAL ISSUES (must address immediately):",
        "  For each:",
        "    - file:line reference",
        "    - Quoted code (2-5 lines)",
        "    - Impact description",
        "    - Recommended fix",
        "",
        "HIGH ISSUES (should address soon):",
        "  For each: file:line, description, recommended fix",
        "",
        "MEDIUM ISSUES (consider addressing):",
        "  For each: description, general guidance",
        "",
        "LOW ISSUES (nice to fix):",
        "  Summarize patterns, defer to future work",
        "</final_consolidation>",
        "",
        "<pattern_synthesis>",
        "Identify systemic patterns:",
        "",
        "  - Issues appearing across multiple files -> systemic problem",
        "  - Root causes explaining multiple symptoms",
        "  - Architectural changes that would prevent recurrence",
        "</pattern_synthesis>",
        "",
        "<recommendations>",
        "Provide prioritized action plan:",
        "",
        "IMMEDIATE (blocks other work / security risk):",
        "  1. [action with specific file:line reference]",
        "  2. [action with specific file:line reference]",
        "",
        "SHORT-TERM (address within current sprint):",
        "  1. [action with scope indication]",
        "  2. [action with scope indication]",
        "",
        "LONG-TERM (strategic improvements):",
        "  1. [architectural or process recommendation]",
        "  2. [architectural or process recommendation]",
        "</recommendations>",
        "",
        "<final_quality_check>",
        "Before presenting to user, verify:",
        "",
        "  [ ] All CRITICAL/HIGH issues have file:line + quoted code?",
        "  [ ] Recommendations are actionable, not vague?",
        "  [ ] Findings organized by impact, not discovery order?",
        "  [ ] No findings lost from earlier steps?",
        "  [ ] Patterns are supported by multiple examples?",
        "</final_quality_check>",
      ],
      next: null,
    };
  }

  // PHASE 4: DEEP ANALYSIS (steps 4 to N-2)
  const deepAnalysisStep = step - 3;
  const remainingBeforeVerification = totalSteps - 1 - step;

  let stepTitle: string;
  let focusInstruction: string[];

  if (deepAnalysisStep === 1) {
    stepTitle = "Initial Investigation";
    focusInstruction = [
      "Execute your investigation plan from Step 3.",
      "",
      "<first_pass_protocol>",
      "For each file in your P1 (highest priority) focus area:",
      "",
      "1. READ the file using the Read tool",
      "2. ANSWER the specific question you committed to",
      "3. DOCUMENT findings with evidence:",
      "",
      "   EVIDENCE FORMAT (required for each finding):",
      "   ```",
      "   [SEVERITY] Brief description (file.ts:line-line)",
      "   > quoted code from file (2-5 lines)",
      "   Explanation: why this is an issue",
      "   ```",
      "",
      "4. UPDATE your hypothesis based on what you found",
      "   - Confirmed? Document supporting evidence",
      "   - Refuted? Document what you found instead",
      "   - Inconclusive? Note what else you need to check",
      "</first_pass_protocol>",
      "",
      "Findings without quoted code are UNVERIFIED.",
    ];
  } else if (deepAnalysisStep === 2) {
    stepTitle = "Deepen Investigation";
    focusInstruction = [
      "Review findings from previous step. Go deeper.",
      "",
      "<second_pass_protocol>",
      "For each issue found in the previous step:",
      "",
      "1. TRACE to root cause",
      "   - Why does this issue exist?",
      "   - What allowed it to be introduced?",
      "   - Are there related issues in connected files?",
      "",
      "2. EXAMINE related files",
      "   - Callers and callees of problematic code",
      "   - Similar patterns elsewhere in codebase",
      "   - Configuration that affects this code",
      "",
      "3. LOOK for patterns",
      "   - Same issue in multiple places? -> Systemic problem",
      "   - One-off issue? -> Localized fix",
      "",
      "4. MOVE to P2 focus area if P1 is sufficiently investigated",
      "</second_pass_protocol>",
      "",
      "Continue documenting with file:line + quoted code.",
    ];
  } else {
    stepTitle = `Extended Investigation (Pass ${deepAnalysisStep})`;
    focusInstruction = [
      "Focus on remaining gaps and open questions.",
      "",
      "<extended_investigation_protocol>",
      "Review your accumulated state. Address:",
      "",
      "1. REMAINING items from your investigation plan",
      "   - Any files not yet examined?",
      "   - Any questions not yet answered?",
      "",
      "2. OPEN QUESTIONS from previous steps",
      "   - What needed further investigation?",
      "   - What dependencies weren't clear?",
      "",
      "3. PATTERN VALIDATION",
      "   - Cross-file patterns claimed but not verified?",
      "   - Need more examples to confirm systemic issues?",
      "",
      "4. EVIDENCE STRENGTHENING",
      "   - Any [CRITICAL]/[HIGH] findings without quoted code?",
      "   - Any claims without file:line references?",
      "</extended_investigation_protocol>",
      "",
      "If investigation is complete, reduce total_steps to reach verification.",
    ];
  }

  const actions = [
    ...focusInstruction,
    "",
    "<scope_check>",
    "After this step's investigation:",
    "",
    `  Remaining steps before verification: ${remainingBeforeVerification}`,
    "",
    "  - Discovered more complexity? -> INCREASE total_steps",
    "  - Remaining scope smaller than expected? -> DECREASE total_steps",
    "  - All focus areas sufficiently covered? -> Set next step = total_steps - 1 (verification)",
    "</scope_check>",
    ...getStateRequirement(step),
  ];

  return {
    phase,
    stepTitle,
    actions,
    next: `Invoke step ${nextStep}. ${remainingBeforeVerification} step(s) before verification. Include ALL accumulated findings in --thoughts. Adjust total_steps if scope changed.`,
  };
}

function formatOutput(step: number, totalSteps: number, thoughts: string, guidance: StepGuidance): string {
  const lines: string[] = [];
  const separator = "=".repeat(70);

  lines.push(separator);
  lines.push(`ANALYZE - Step ${step}/${totalSteps}: ${guidance.stepTitle}`);
  lines.push(`Phase: ${guidance.phase}`);
  lines.push(separator);
  lines.push("");

  const isFinal = step >= totalSteps;
  const isVerification = step === totalSteps - 1;
  const status = isFinal ? "analysis_complete" : isVerification ? "verification_required" : "in_progress";
  lines.push(`STATUS: ${status}`);
  lines.push("");

  lines.push("YOUR ACCUMULATED STATE:");
  if (thoughts.length > 600) {
    lines.push(thoughts.slice(0, 600) + "...");
    lines.push("[truncated - full state in --thoughts]");
  } else {
    lines.push(thoughts);
  }
  lines.push("");

  lines.push("REQUIRED ACTIONS:");
  for (const action of guidance.actions) {
    if (action) {
      lines.push(`  ${action}`);
    } else {
      lines.push("");
    }
  }
  lines.push("");

  if (guidance.next) {
    lines.push("NEXT:");
    lines.push(guidance.next);
  } else {
    lines.push("WORKFLOW COMPLETE");
    lines.push("");
    lines.push("Present your consolidated findings to the user:");
    lines.push("  - Organized by severity (CRITICAL -> LOW)");
    lines.push("  - With file:line references and quoted code for serious issues");
    lines.push("  - With actionable recommendations for each category");
  }

  lines.push("");
  lines.push(separator);

  return lines.join("\n");
}

function main(): number {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Analyze Skill - Systematic codebase analysis

Workflow Phases:
  Step 1: EXPLORATION         - Process Explore agent results
  Step 2: FOCUS SELECTION     - Classify investigation areas
  Step 3: INVESTIGATION PLAN  - Commit to specific files and questions
  Step 4+: DEEP ANALYSIS      - Progressive investigation with evidence
  Step N-1: VERIFICATION      - Validate completeness before synthesis
  Step N: SYNTHESIS           - Consolidate verified findings

Usage:
  bun run analyze.ts --step-number 1 --total-steps 6 --thoughts "Starting analysis..."
`);
    return 0;
  }

  let stepNumber = 0;
  let totalSteps = 0;
  let thoughts = "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--step-number":
        stepNumber = parseInt(args[++i] ?? "0", 10);
        break;
      case "--total-steps":
        totalSteps = parseInt(args[++i] ?? "0", 10);
        break;
      case "--thoughts":
        thoughts = args[++i] ?? "";
        break;
    }
  }

  if (stepNumber < 1) {
    console.error("ERROR: step-number must be >= 1");
    return 1;
  }

  if (totalSteps < 6) {
    console.error("ERROR: total-steps must be >= 6 (minimum workflow)");
    return 1;
  }

  if (totalSteps < stepNumber) {
    console.error("ERROR: total-steps must be >= step-number");
    return 1;
  }

  const guidance = getStepGuidance(stepNumber, totalSteps);
  console.log(formatOutput(stepNumber, totalSteps, thoughts, guidance));

  return 0;
}

process.exit(main());
