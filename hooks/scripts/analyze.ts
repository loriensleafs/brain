/**
 * Analyze command handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/analyze.go.
 * Step-by-step codebase analysis workflow with file-based state.
 */
import { join } from "path";
import type {
  AnalyzeInput,
  AnalyzeOutput,
  AnalyzeState,
} from "./types";

interface StepGuidance {
  phase: string;
  stepTitle: string;
  actions: string[];
  next: string;
}

/** Get the phase name for a given step. */
function getPhaseName(step: number, totalSteps: number): string {
  if (step === 1) return "EXPLORATION";
  if (step === 2) return "FOCUS SELECTION";
  if (step === 3) return "INVESTIGATION PLANNING";
  if (step === totalSteps - 1) return "VERIFICATION";
  if (step >= totalSteps) return "SYNTHESIS";
  return "DEEP ANALYSIS";
}

/** Get the status for a given step. */
function getStatus(step: number, totalSteps: number): string {
  if (step >= totalSteps) return "analysis_complete";
  if (step === totalSteps - 1) return "verification_required";
  return "in_progress";
}

/** Get the default state file path. */
function getDefaultStateFile(): string {
  const brainDir = join(process.env.TMPDIR ?? "/tmp", "brain-analyze");
  try {
    Bun.spawnSync(["mkdir", "-p", brainDir]);
  } catch {
    // Directory exists
  }
  const date = new Date().toISOString().split("T")[0];
  return join(brainDir, `analyze-state-${date}.json`);
}

/** Load or create analysis state. */
async function loadOrCreateState(
  input: AnalyzeInput,
): Promise<{ state: AnalyzeState; stateFile: string }> {
  const stateFile = input.stateFile || getDefaultStateFile();

  try {
    const data = await Bun.file(stateFile).text();
    const state = JSON.parse(data) as AnalyzeState;
    return { state, stateFile };
  } catch {
    // Create new state
    const now = new Date().toISOString();
    return {
      state: {
        stepNumber: input.stepNumber,
        totalSteps: input.totalSteps,
        phase: "",
        startedAt: now,
        updatedAt: now,
      },
      stateFile,
    };
  }
}

/** Save analysis state to file. */
async function saveState(path: string, state: AnalyzeState): Promise<void> {
  await Bun.write(path, JSON.stringify(state, null, 2));
}

/** Get a brief summary of the current state. */
function getStateSummary(state: AnalyzeState): string {
  const parts: string[] = [];

  if (state.focusAreas && state.focusAreas.length > 0) {
    parts.push(`${state.focusAreas.length} focus areas`);
  }
  if (state.findings && state.findings.length > 0) {
    let critical = 0;
    let high = 0;
    for (const f of state.findings) {
      if (f.severity === "CRITICAL") critical++;
      if (f.severity === "HIGH") high++;
    }
    parts.push(
      `${state.findings.length} findings (${critical} critical, ${high} high)`,
    );
  }
  if (state.openQuestions && state.openQuestions.length > 0) {
    parts.push(`${state.openQuestions.length} open questions`);
  }

  return parts.length === 0 ? "No accumulated state yet" : parts.join(", ");
}

/** Get step guidance for a specific step. */
function getStepGuidance(step: number, totalSteps: number): StepGuidance {
  const nextStep = step >= totalSteps ? 0 : step + 1;
  const phase = getPhaseName(step, totalSteps);

  // Phase 1: Exploration
  if (step === 1) {
    return {
      phase,
      stepTitle: "Process Exploration Results",
      actions: [
        "STOP. Before proceeding, verify you have Explore agent results.",
        "",
        "If you do NOT have exploration data, delegate to Explore agent:",
        "  - Use Task tool with subagent_type='Explore'",
        "  - For large codebases, launch MULTIPLE Explore agents in parallel",
        "",
        "Once you have exploration results, extract:",
        "  - Directory structure and purposes",
        "  - Tech stack (languages, frameworks, dependencies)",
        "  - Entry points and data flow",
        "  - Initial observations and areas of concern",
      ],
      next: `Invoke step ${nextStep} with exploration summary. Update state file with findings.`,
    };
  }

  // Phase 2: Focus Selection
  if (step === 2) {
    return {
      phase,
      stepTitle: "Classify Investigation Areas",
      actions: [
        "Evaluate codebase against each dimension:",
        "",
        "ARCHITECTURE: Component relationships, dependencies, boundaries",
        "PERFORMANCE: Hot paths, queries, memory, concurrency",
        "SECURITY: Input validation, auth, data handling",
        "QUALITY: Duplication, complexity, error handling, tests",
        "",
        "Assign priorities (P1 = most critical):",
        "  P1: [area] - [why most critical]",
        "  P2: [area] - [why second]",
        "  P3: [area] - [if applicable]",
        "",
        "Update state file with focusAreas array.",
      ],
      next: `Invoke step ${nextStep}. Update state file with focus areas.`,
    };
  }

  // Phase 3: Investigation Planning
  if (step === 3) {
    return {
      phase,
      stepTitle: "Create Investigation Plan",
      actions: [
        "For each focus area, specify:",
        "",
        "  Files to examine:",
        "    - path/to/file.py",
        "      Question: [specific question]",
        "      Hypothesis: [expected finding]",
        "",
        "This is a CONTRACT. You MUST:",
        "  1. Read every file listed",
        "  2. Answer every question",
        "  3. Document evidence with file:line references",
        "",
        "Update state file with investigations array.",
      ],
      next: `Invoke step ${nextStep}. Begin with highest priority focus area.`,
    };
  }

  // Phase N-1: Verification
  if (step === totalSteps - 1) {
    return {
      phase,
      stepTitle: "Verify Investigation Completeness",
      actions: [
        "Review your investigation commitments from Step 3.",
        "",
        "For each file committed:",
        "  [ ] File was actually read?",
        "  [ ] Question answered with evidence?",
        "  [ ] Finding has file:line reference?",
        "",
        "Identify gaps:",
        "  - Files not examined?",
        "  - Questions unanswered?",
        "  - Evidence missing?",
        "",
        "If gaps exist: increase totalSteps, return to DEEP ANALYSIS",
        "If complete: proceed to SYNTHESIS",
      ],
      next: `If gaps: fill them first. If complete: invoke step ${nextStep} for synthesis.`,
    };
  }

  // Phase N: Synthesis
  if (step >= totalSteps) {
    return {
      phase,
      stepTitle: "Consolidate and Recommend",
      actions: [
        "Organize all VERIFIED findings by severity:",
        "",
        "CRITICAL: [must address immediately]",
        "  - file:line, quoted code, impact, fix",
        "",
        "HIGH: [should address soon]",
        "  - file:line, description, fix",
        "",
        "MEDIUM/LOW: [consider addressing]",
        "  - description, guidance",
        "",
        "Provide prioritized action plan:",
        "  IMMEDIATE: security risks, blockers",
        "  SHORT-TERM: current sprint items",
        "  LONG-TERM: strategic improvements",
      ],
      next: "",
    };
  }

  // Phase 4+: Deep Analysis
  const deepStep = step - 3;
  const remaining = totalSteps - 1 - step;

  let stepTitle: string;
  let focusInstructions: string[];

  if (deepStep === 1) {
    stepTitle = "Initial Investigation";
    focusInstructions = [
      "Execute your investigation plan from Step 3.",
      "",
      "For each file in P1 focus area:",
      "  1. READ the file",
      "  2. ANSWER the committed question",
      "  3. DOCUMENT with evidence:",
      "",
      "     [SEVERITY] Description (file.py:line)",
      "     > quoted code (2-5 lines)",
      "     Explanation: why this is an issue",
      "",
      "Update state file: add to findings array.",
    ];
  } else if (deepStep === 2) {
    stepTitle = "Deepen Investigation";
    focusInstructions = [
      "Review previous findings. Go deeper:",
      "",
      "  1. TRACE issues to root cause",
      "  2. EXAMINE related files (callers, callees)",
      "  3. LOOK for patterns across codebase",
      "  4. MOVE to P2 focus area if P1 complete",
      "",
      "Update state file with new findings.",
    ];
  } else {
    stepTitle = `Extended Investigation (Pass ${deepStep})`;
    focusInstructions = [
      "Address remaining gaps:",
      "",
      "  - Files not yet examined",
      "  - Questions not yet answered",
      "  - Patterns not yet validated",
      "  - Evidence not yet collected",
      "",
      "If investigation complete: reduce totalSteps to reach verification.",
    ];
  }

  const actions = [
    ...focusInstructions,
    "",
    `Remaining steps before verification: ${remaining}`,
    "  - More complexity? INCREASE totalSteps",
    "  - Scope smaller? DECREASE totalSteps",
  ];

  return {
    phase,
    stepTitle,
    actions,
    next: `Invoke step ${nextStep}. ${remaining} step(s) before verification.`,
  };
}

export async function runAnalyze(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let analyzeInput: AnalyzeInput;
  if (raw) {
    try {
      analyzeInput = JSON.parse(raw) as AnalyzeInput;
    } catch {
      process.stderr.write("failed to parse input\n");
      process.exit(1);
    }
  } else {
    process.stderr.write("no input provided\n");
    process.exit(1);
  }

  // Validate input
  if (analyzeInput.stepNumber < 1) {
    process.stderr.write("stepNumber must be >= 1\n");
    process.exit(1);
  }
  if (analyzeInput.totalSteps < 6) {
    process.stderr.write("totalSteps must be >= 6 (minimum workflow)\n");
    process.exit(1);
  }
  if (analyzeInput.totalSteps < analyzeInput.stepNumber) {
    process.stderr.write("totalSteps must be >= stepNumber\n");
    process.exit(1);
  }

  // Load or create state
  const { state, stateFile } = await loadOrCreateState(analyzeInput);

  // Update state with current step
  state.stepNumber = analyzeInput.stepNumber;
  state.totalSteps = analyzeInput.totalSteps;
  state.phase = getPhaseName(analyzeInput.stepNumber, analyzeInput.totalSteps);
  state.updatedAt = new Date().toISOString();

  // If thoughts provided, append to raw thoughts (legacy support)
  if (analyzeInput.thoughts && analyzeInput.thoughts !== state.rawThoughts) {
    if (state.rawThoughts) {
      state.rawThoughts += "\n---\n";
    } else {
      state.rawThoughts = "";
    }
    state.rawThoughts += analyzeInput.thoughts;
  }

  // Save state
  saveState(stateFile, state);

  // Generate guidance
  const guidance = getStepGuidance(
    analyzeInput.stepNumber,
    analyzeInput.totalSteps,
  );

  const output: AnalyzeOutput = {
    phase: guidance.phase,
    stepTitle: guidance.stepTitle,
    status: getStatus(analyzeInput.stepNumber, analyzeInput.totalSteps),
    actions: guidance.actions,
    next: guidance.next || undefined,
    stateFile,
    stateSummary: getStateSummary(state),
  };

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("analyze.ts") ||
  process.argv[1]?.endsWith("analyze.js");
if (isMain) {
  runAnalyze().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
