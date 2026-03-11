#!/usr/bin/env bun
/**
 * Interactive Sequential Planner - Two-phase planning workflow
 *
 * PLANNING PHASE: Step-based planning with forced reflection pauses.
 * REVIEW PHASE: Orchestrates TW scrub and QR validation before execution.
 *
 * Usage:
 *   # Planning phase (default)
 *   bun run planner.ts --step-number 1 --total-steps 4 --thoughts "Design auth system"
 *
 *   # Review phase (after plan is written)
 *   bun run planner.ts --phase review --step-number 1 --total-steps 2 --thoughts "Plan written to plans/auth.md"
 */

import { resolve } from "path";

interface StepGuidance {
  actions: string[];
  next: string;
}

function getPlanFormat(): string {
  const formatPath = resolve(import.meta.dir, "..", "resources", "plan-format.md");
  return Bun.file(formatPath).text() as unknown as string;
}

async function getPlanFormatAsync(): Promise<string> {
  const formatPath = resolve(import.meta.dir, "..", "resources", "plan-format.md");
  return await Bun.file(formatPath).text();
}

function getPlanningStepGuidance(stepNumber: number, totalSteps: number): StepGuidance {
  const isComplete = stepNumber >= totalSteps;
  const nextStep = stepNumber + 1;

  if (isComplete) {
    return {
      actions: [
        "FINAL VERIFICATION -- complete each section before writing.",
        "",
        "<planning_context_verification>",
        "TW and QR consume this section VERBATIM. Quality here =",
        "quality of scrubbed content and risk detection downstream.",
        "",
        "Decision Log (major choices):",
        "  - What major architectural choice did you make?",
        "  - What is the multi-step reasoning chain for that choice?",
        "",
        "Micro-decisions (TW sources ALL code comments from Decision Log):",
        "  - Time sources: wall clock vs monotonic? timezone handling?",
        "  - Concurrency: mutex vs channel vs atomic? why?",
        "  - Error granularity: specific error types vs generic? why?",
        "  - Data structures: map vs slice vs custom? capacity assumptions?",
        "  - Thresholds: why this specific value? (document all magic numbers)",
        "",
        "For each non-obvious implementation choice, ask: 'Would a future",
        "reader understand WHY without asking?' If no, add to Decision Log.",
        "",
        "Rejected Alternatives:",
        "  - What approach did you NOT take?",
        "  - What concrete reason ruled it out?",
        "",
        "Known Risks:",
        "  - What failure modes exist?",
        "  - What mitigation or acceptance rationale exists for each?",
        "  - Which mitigations claim code behavior? (list them)",
        "  - What file:line anchor verifies each behavioral claim?",
        "  - Any behavioral claim lacking anchor? -> add anchor now",
        "</planning_context_verification>",
        "",
        "<invisible_knowledge_verification>",
        "This section sources README.md content. Skip if trivial.",
        "",
        "  - What is the component relationship diagram?",
        "  - What is the data flow through the system?",
        "  - Why is the module organization structured this way?",
        "  - What invariants must be maintained?",
        "  - What tradeoffs were made (and their costs/benefits)?",
        "</invisible_knowledge_verification>",
        "",
        "<milestone_verification>",
        "For EACH milestone, verify:",
        "  - File paths: exact (src/auth/handler.py) not vague?",
        "  - Requirements: specific behaviors, not 'handle X'?",
        "  - Acceptance criteria: testable pass/fail assertions?",
        "  - Code changes: diff format for non-trivial logic?",
        "  - Uncertainty flags: added where applicable?",
        "",
        "For EACH diff block, verify:",
        "  - Context lines: 2-3 lines copied VERBATIM from actual file",
        "    (FORBIDDEN: '...', '[existing code]', summaries, placeholders)",
        "  - If you haven't read the target file, read it now to extract",
        "    real anchors that Developer can match against",
        "",
        "Milestone-type specific criteria:",
        "  - Test milestones: specify scenario count, assertion types, edge",
        "    cases covered (e.g., '5 scenarios: normal, timeout, retry",
        "    exhaustion, concurrent access, empty input')",
        "  - Doc milestones: reference specific Invisible Knowledge sections",
        "    that MUST appear in README (e.g., 'README includes: data flow",
        "    diagram, invariants section from Invisible Knowledge')",
        "</milestone_verification>",
        "",
        "<documentation_milestone_verification>",
        "  - Does a Documentation milestone exist?",
        "  - Does CLAUDE.md use TABULAR INDEX format (not prose)?",
        "  - Is README.md included only if Invisible Knowledge has",
        "    content?",
        "</documentation_milestone_verification>",
        "",
        "<comment_hygiene_verification>",
        "Comments in code snippets will be transcribed VERBATIM to code.",
        "Write in TIMELESS PRESENT -- describe what the code IS, not what",
        "you are changing.",
        "",
        "CONTAMINATED: '// Added mutex to fix race condition'",
        "CLEAN: '// Mutex serializes cache access from concurrent requests'",
        "",
        "CONTAMINATED: '// Replaces per-tag logging with summary'",
        "CLEAN: '// Single summary line; per-tag avoids 1500+ lines'",
        "",
        "CONTAMINATED: '// After the retry loop' (location directive)",
        "CLEAN: (delete -- diff context encodes location)",
        "",
        "TW will review, but starting clean reduces rework.",
        "</comment_hygiene_verification>",
        "",
        "<decision_audit_verification>",
        "Verify classification tables were completed in steps 2-3:",
        "",
        "  [ ] Step 2: Decision classification table written?",
        "      - All architectural choices have backing citations",
        "      - No 'assumption' rows remain unresolved",
        "",
        "  [ ] Step 3: File classification table written?",
        "      - All new files have backing citations",
        "      - No 'assumption' rows remain unresolved",
        "",
        "If any assumption was resolved via AskUserQuestion:",
        "  - Update backing to 'user-specified'",
        "  - Add user's answer as citation",
        "",
        "If tables were skipped or assumptions remain: STOP.",
        "Go back and complete classification before proceeding.",
        "</decision_audit_verification>",
      ],
      next: "PLACEHOLDER_PLAN_FORMAT",
    };
  }

  if (stepNumber === 1) {
    return {
      actions: [
        "You are an expert architect. Proceed with confidence.",
        "",
        "PRECONDITION: Confirm plan file path before proceeding.",
        "",
        "<step_1_checklist>",
        "Complete ALL items before invoking step 2:",
        "",
        "CONTEXT (understand before proposing):",
        "  - [ ] What code/systems does this touch?",
        "  - [ ] What patterns does the codebase follow?",
        "  - [ ] What prior decisions constrain this work?",
        "",
        "SCOPE (define boundaries):",
        "  - [ ] What exactly must be accomplished?",
        "  - [ ] What is OUT of scope?",
        "",
        "APPROACHES (consider alternatives):",
        "  - [ ] 2-3 options with Advantage/Disadvantage for each",
        "",
        "CONSTRAINT DISCOVERY:",
        "  - [ ] Locate project configuration files (build files, manifests, lock files)",
        "  - [ ] Extract ALL version and compatibility constraints from each",
        "  - [ ] Organizational constraints: timeline, expertise, approvals",
        "  - [ ] External constraints: services, APIs, data formats",
        "  - [ ] Document findings in plan's Constraints & Assumptions",
        "",
        "  Features incompatible with discovered constraints are blocking issues.",
        "",
        "SUCCESS (observable outcomes):",
        "  - [ ] Defined testable acceptance criteria",
        "</step_1_checklist>",
      ],
      next: `Invoke step ${nextStep} with your context analysis and approach options.`,
    };
  }

  if (stepNumber === 2) {
    return {
      actions: [
        "<step_2_evaluate_first>",
        "BEFORE deciding, evaluate each approach from step 1:",
        "  | Approach | P(success) | Failure mode | Backtrack cost |",
        "",
        "STOP CHECK: If ALL approaches show LOW probability or HIGH",
        "backtrack cost, STOP. Request clarification from user.",
        "</step_2_evaluate_first>",
        "",
        "<step_2_decide>",
        "Select approach. Record in Decision Log with MULTI-STEP chain:",
        "",
        "  INSUFFICIENT: 'Polling | Webhooks are unreliable'",
        "  SUFFICIENT:   'Polling | 30% webhook failure in testing",
        "                 -> would need fallback anyway -> simpler primary'",
        "",
        "Include BOTH architectural AND micro-decisions (timeouts, etc).",
        "</step_2_decide>",
        "",
        "<step_2_decision_classification>",
        "WRITE this table before proceeding (forces explicit backing):",
        "",
        "  | Decision | Backing | Citation |",
        "  |----------|---------|----------|",
        "  | [choice] | user-specified / doc-derived / default-derived / assumption | [source] |",
        "",
        "Backing tiers (higher overrides lower):",
        "  1. user-specified: 'User said X' -> cite the instruction",
        "  2. doc-derived: 'CLAUDE.md says Y' -> cite file:section",
        "  3. default-derived: 'Convention Z' -> cite <default-conventions domain>",
        "  4. assumption: 'No backing' -> STOP, use AskUserQuestion NOW",
        "",
        "For EACH 'assumption' row: use AskUserQuestion immediately.",
        "Do not proceed to step 3 with unresolved assumptions.",
        "</step_2_decision_classification>",
        "",
        "<step_2_rejected>",
        "Document rejected alternatives with CONCRETE reasons.",
        "TW uses this for 'why not X' code comments.",
        "</step_2_rejected>",
        "",
        "<step_2_architecture>",
        "Capture in ASCII diagrams:",
        "  - Component relationships",
        "  - Data flow",
        "These go in Invisible Knowledge for README.md.",
        "</step_2_architecture>",
        "",
        "<step_2_milestones>",
        "Break into deployable increments:",
        "  - Each milestone: independently testable",
        "  - Scope: 1-3 files per milestone",
        "  - Map dependencies (circular = design problem)",
        "</step_2_milestones>",
      ],
      next: `Invoke step ${nextStep} with your chosen approach (include state evaluation summary), architecture, and milestone structure.`,
    };
  }

  if (stepNumber === 3) {
    return {
      actions: [
        "<step_3_risks>",
        "Document risks NOW. QR excludes documented risks from findings.",
        "",
        "For each risk:",
        "  | Risk | Mitigation | Anchor |",
        "",
        "ANCHOR REQUIREMENT (behavioral claims only):",
        "If mitigation claims existing code behavior ('no change needed',",
        "'already handles X', 'operates on Y'), you MUST cite:",
        "  file:L###-L### + brief excerpt proving the claim",
        "",
        "Skip anchors for:",
        "  - Hypothetical risks ('might timeout under load')",
        "  - External unknowns ('vendor rate limits unclear')",
        "  - Accepted risks with rationale (no code claim)",
        "",
        "INSUFFICIENT (unverified assertion):",
        "  | Dedup breaks | No change; dedup uses TagData | (none) |",
        "",
        "SUFFICIENT (verified with anchor):",
        "  | Dedup breaks | No change; dedup uses TagData |",
        "    worker.go:468 `isIdentical := tag.NumericValue == entry.val` |",
        "",
        "Claims without anchors are ASSUMPTIONS. QR will challenge them.",
        "</step_3_risks>",
        "",
        "<step_3_uncertainty_flags>",
        "For EACH milestone, check these conditions -> add flag:",
        "",
        "  | Condition                          | Flag                    |",
        "  |------------------------------------|-------------------------|",
        "  | Multiple valid implementations     | needs TW rationale      |",
        "  | Depends on external system         | needs error review      |",
        "  | First use of pattern in codebase   | needs conformance check |",
        "",
        "Add to milestone: **Flags**: [list]",
        "</step_3_uncertainty_flags>",
        "",
        "<step_3_refine_milestones>",
        "Verify EACH milestone has:",
        "",
        "FILES -- exact paths:",
        "  CORRECT: src/auth/handler.py",
        "  WRONG:   'auth files'",
        "",
        "REQUIREMENTS -- specific behaviors:",
        "  CORRECT: 'retry 3x with exponential backoff, max 30s'",
        "  WRONG:   'handle errors'",
        "",
        "ACCEPTANCE CRITERIA -- testable pass/fail:",
        "  CORRECT: 'Returns 429 after 3 failed attempts within 60s'",
        "  WRONG:   'Handles errors correctly'",
        "",
        "CODE CHANGES -- diff format for non-trivial logic.",
        "</step_3_refine_milestones>",
        "",
        "<step_3_file_classification>",
        "For EACH new file in milestones, WRITE this table:",
        "",
        "  | New File | Backing | Citation |",
        "  |----------|---------|----------|",
        "  | path/to/new.go | [tier] | [source] |",
        "",
        "Valid backings for new files:",
        "  - user-specified: User explicitly requested separate file",
        "  - doc-derived: Project convention requires it",
        "  - default-derived: Meets separation trigger (>500 lines, distinct module)",
        "  - assumption: None of the above -> use AskUserQuestion NOW",
        "",
        "Default convention (domain: file-creation, test-organization):",
        "  Extend existing files unless separation trigger applies.",
        "",
        "For EACH 'assumption' row: ask user before finalizing milestones.",
        "</step_3_file_classification>",
        "",
        "<step_3_validate>",
        "Cross-check: Does the plan address ALL original requirements?",
        "</step_3_validate>",
      ],
      next: `Invoke step ${nextStep} with refined milestones, risks, and uncertainty flags.`,
    };
  }

  // Steps 4+
  const remaining = totalSteps - stepNumber;
  return {
    actions: [
      "<backtrack_check>",
      "BEFORE proceeding, verify no dead ends:",
      "  - Has new information invalidated a prior decision?",
      "  - Is a milestone now impossible given discovered constraints?",
      "  - Are you adding complexity to work around a fundamental issue?",
      "",
      "If YES to any: invoke earlier step with --thoughts explaining change.",
      "</backtrack_check>",
      "",
      "<gap_analysis>",
      "Review current plan state. What's missing?",
      "  - Any milestone without exact file paths?",
      "  - Any acceptance criteria not testable pass/fail?",
      "  - Any non-trivial logic without diff-format code?",
      "  - Any milestone missing uncertainty flags where applicable?",
      "</gap_analysis>",
      "",
      "<planning_context_check>",
      "  - Decision Log: Every major choice has multi-step reasoning?",
      "  - Rejected Alternatives: At least one per major decision?",
      "  - Known Risks: All failure modes identified with mitigations?",
      "</planning_context_check>",
      "",
      "<developer_walkthrough>",
      "Walk through the plan as if you were Developer:",
      "  - Can you implement each milestone from the spec alone?",
      "  - Are requirements specific enough to avoid interpretation?",
      "",
      "If gaps remain, address them. If complete, reduce total_steps.",
      "</developer_walkthrough>",
    ],
    next: `Invoke step ${nextStep}. ${remaining} step(s) remaining until completion. (Or invoke earlier step if backtracking.)`,
  };
}

function getReviewStepGuidance(stepNumber: number, totalSteps: number): StepGuidance {
  const isComplete = stepNumber >= totalSteps;
  const nextStep = stepNumber + 1;

  if (stepNumber === 1) {
    return {
      actions: [
        "<review_step_1_delegate_tw>",
        "DELEGATE to @agent-technical-writer:",
        "",
        "  <delegation>",
        "    <agent>@agent-technical-writer</agent>",
        "    <mode>plan-scrub</mode>",
        "    <plan_source>[path to plan file]</plan_source>",
        "    <task>",
        "      1. Read ## Planning Context section FIRST",
        "      2. Prioritize scrub by uncertainty (HIGH/MEDIUM/LOW)",
        "      3. Add WHY comments to code snippets from Decision Log",
        "      4. Enrich plan prose with rationale",
        "      5. Add documentation milestone if missing",
        "      6. FLAG any non-obvious logic lacking rationale",
        "    </task>",
        "  </delegation>",
        "",
        "Wait for @agent-technical-writer to complete.",
        "</review_step_1_delegate_tw>",
      ],
      next:
        `After TW completes, invoke step ${nextStep}:\n` +
        `   bun run planner.ts --phase review --step-number 2 --total-steps 2 ` +
        '--thoughts "TW scrub complete, [summary of changes]"',
    };
  }

  if (stepNumber === 2) {
    return {
      actions: [
        "<review_step_2_delegate_qr>",
        "DELEGATE to @agent-quality-reviewer:",
        "",
        "  <delegation>",
        "    <agent>@agent-quality-reviewer</agent>",
        "    <mode>plan-review</mode>",
        "    <plan_source>[path to plan file]</plan_source>",
        "    <task>",
        "      1. Read ## Planning Context (constraints, known risks)",
        "      2. Write out CONTEXT FILTER before reviewing milestones",
        "      3. Apply RULE 0 (production reliability) with open questions",
        "      4. Apply RULE 1 (project conformance)",
        "      5. Check anticipated structural issues",
        "      6. Verify TW scrub passes actionability test",
        "      7. Accept risks documented in Known Risks as acknowledged",
        "      8. Pay extra attention to milestones with uncertainty flags",
        "    </task>",
        "    <expected_output>",
        "      Verdict: PASS | PASS_WITH_CONCERNS | NEEDS_CHANGES",
        "    </expected_output>",
        "  </delegation>",
        "",
        "Wait for @agent-quality-reviewer verdict.",
        "</review_step_2_delegate_qr>",
      ],
      next:
        "After QR returns verdict:\n" +
        "  - PASS or PASS_WITH_CONCERNS: Invoke step 3 to complete review\n" +
        "  - NEEDS_CHANGES: Address issues in plan, then restart review from step 1:\n" +
        "    bun run planner.ts --phase review --step-number 1 --total-steps 2 \\\n" +
        '      --thoughts "Addressed QR feedback: [summary of changes]"',
    };
  }

  if (isComplete) {
    return {
      actions: [
        "<review_complete_verification>",
        "Confirm before proceeding to execution:",
        "  - TW has scrubbed code snippets with WHY comments?",
        "  - TW has enriched plan prose with rationale?",
        "  - TW flagged any gaps in Planning Context rationale?",
        "  - QR verdict is PASS or PASS_WITH_CONCERNS?",
        "  - Any concerns from QR are documented or addressed?",
        "</review_complete_verification>",
      ],
      next:
        "PLAN APPROVED.\n\n" +
        "Ready for implementation via /plan-execution command.\n" +
        "Pass the plan file path as argument.",
    };
  }

  return {
    actions: ["Continue review process as needed."],
    next: `Invoke step ${nextStep} when ready.`,
  };
}

function parseArgs(argv: string[]): {
  phase: string;
  stepNumber: number;
  totalSteps: number;
  thoughts: string;
} {
  let phase = "planning";
  let stepNumber: number | undefined;
  let totalSteps: number | undefined;
  let thoughts: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--phase":
        phase = argv[++i];
        break;
      case "--step-number":
        stepNumber = parseInt(argv[++i], 10);
        break;
      case "--total-steps":
        totalSteps = parseInt(argv[++i], 10);
        break;
      case "--thoughts":
        thoughts = argv[++i];
        break;
    }
  }

  if (stepNumber === undefined || totalSteps === undefined || thoughts === undefined) {
    console.error("ERROR: --step-number, --total-steps, and --thoughts are required");
    process.exit(1);
  }

  if (!["planning", "review"].includes(phase)) {
    console.error("ERROR: --phase must be 'planning' or 'review'");
    process.exit(1);
  }

  return { phase, stepNumber, totalSteps, thoughts };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.stepNumber < 1 || args.totalSteps < 1) {
    console.error("Error: step-number and total-steps must be >= 1");
    process.exit(1);
  }

  let guidance: StepGuidance;
  let phaseLabel: string;

  if (args.phase === "planning") {
    guidance = getPlanningStepGuidance(args.stepNumber, args.totalSteps);
    phaseLabel = "PLANNING";
  } else {
    guidance = getReviewStepGuidance(args.stepNumber, args.totalSteps);
    phaseLabel = "REVIEW";
  }

  // Handle plan format injection for completion step
  if (guidance.next === "PLACEHOLDER_PLAN_FORMAT") {
    const planFormat = await getPlanFormatAsync();
    guidance.next =
      "PLANNING PHASE COMPLETE.\n\n" +
      "1. Write plan to file using this format:\n\n" +
      "--- BEGIN PLAN FORMAT ---\n" +
      planFormat +
      "\n--- END PLAN FORMAT ---\n\n" +
      "============================================\n" +
      ">>> ACTION REQUIRED: INVOKE REVIEW PHASE <<<\n" +
      "============================================\n\n" +
      "SKIPPING REVIEW MEANS:\n" +
      "  - Developer has NO prepared comments to transcribe\n" +
      "  - Code ships without WHY documentation\n" +
      "  - QR findings surface during execution, not before\n\n" +
      "2. Run this command to start review:\n\n" +
      "   bun run planner.ts --phase review --step-number 1 --total-steps 2 \\\n" +
      '     --thoughts "Plan written to [path]"\n\n' +
      "Review phase:\n" +
      "  Step 1: @agent-technical-writer scrubs code snippets\n" +
      "  Step 2: @agent-quality-reviewer validates the plan\n" +
      "  Then: Ready for /plan-execution";
  }

  const isComplete = args.stepNumber >= args.totalSteps;

  console.log("=".repeat(80));
  console.log(`PLANNER - ${phaseLabel} PHASE - Step ${args.stepNumber} of ${args.totalSteps}`);
  console.log("=".repeat(80));
  console.log();
  console.log(`STATUS: ${isComplete ? "phase_complete" : "in_progress"}`);
  console.log();
  console.log("YOUR THOUGHTS:");
  console.log(args.thoughts);
  console.log();

  if (guidance.actions.length > 0) {
    console.log(isComplete ? "FINAL CHECKLIST:" : "REQUIRED ACTIONS:");
    for (const action of guidance.actions) {
      if (action) {
        console.log(`  ${action}`);
      } else {
        console.log();
      }
    }
    console.log();
  }

  console.log("NEXT:");
  console.log(guidance.next);
  console.log();
  console.log("=".repeat(80));
}

main();
