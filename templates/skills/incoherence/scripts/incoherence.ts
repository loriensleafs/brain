#!/usr/bin/env bun
/**
 * Incoherence Detector - Step-based incoherence detection workflow
 *
 * Usage:
 *   bun run incoherence.ts --step-number 1 --total-steps 22 --thoughts "Analyzing project X"
 *   bun run incoherence.ts --step-number 14 --total-steps 22 --thoughts "Reconciling..."
 */

import { parseArgs } from "util";
import { resolve } from "path";

const DIMENSION_CATALOG = `
ABSTRACT DIMENSION CATALOG
==========================

Choose dimensions from this catalog based on Step 1 info sources.

CATEGORY A: SPECIFICATION VS BEHAVIOR
  - README/docs claim X, but code does Y
  Source pairs: Documentation <-> Code implementation

CATEGORY B: INTERFACE CONTRACT INTEGRITY
  - Type definitions vs actual runtime values
  Source pairs: Type/Schema definitions <-> Runtime behavior

CATEGORY C: CROSS-REFERENCE CONSISTENCY
  - Same concept described differently in different docs
  Source pairs: Document <-> Document

CATEGORY D: TEMPORAL CONSISTENCY (Staleness)
  - Outdated comments referencing removed code
  Source pairs: Historical references <-> Current state

CATEGORY E: ERROR HANDLING CONSISTENCY
  - Documented error codes vs actual error responses
  Source pairs: Error documentation <-> Error implementation

CATEGORY F: CONFIGURATION & ENVIRONMENT
  - Documented env vars vs actual env var usage
  Source pairs: Config documentation <-> Config handling code

CATEGORY G: AMBIGUITY & UNDERSPECIFICATION
  - Vague statements that could be interpreted multiple ways
  Detection method: Ask "could two people read this differently?"

CATEGORY H: POLICY & CONVENTION COMPLIANCE
  - Style guide rules not followed in code
  Source pairs: Policy documents <-> Implementation patterns

CATEGORY I: COMPLETENESS & DOCUMENTATION GAPS
  - Public API endpoints with no documentation
  Detection method: Find code constructs, check if docs exist

CATEGORY J: COMPOSITIONAL CONSISTENCY
  - Claims individually valid but jointly impossible
  Detection method: Gather related claims, compute implications, check for contradiction

CATEGORY K: IMPLICIT CONTRACT INTEGRITY
  - Names/identifiers promise behavior the code doesn't deliver
  Detection method: Parse names semantically, infer promise, compare to behavior

SELECTION RULES:
- Select ALL categories relevant to Step 1 info sources
- Typical selection is 5-8 dimensions
- G, H, I, K are especially relevant for LLM-assisted coding
- J requires cross-referencing multiple claims (more expensive)
`;

type StepGuidance = { actions: string[]; next: string };

function getStepGuidance(stepNumber: number, _totalSteps: number, scriptPath: string): StepGuidance {
  // Detection Phase: Steps 1-13
  if (stepNumber === 1) return { actions: ["CODEBASE SURVEY", "", "Gather MINIMAL context. Do NOT read domain-specific docs.", "", "ALLOWED: README.md (first 50 lines), CLAUDE.md, directory listing, package manifest", "NOT ALLOWED: Detailed docs, source code, configs, tests", "", "Identify:", "1. CODEBASE TYPE: library/service/CLI/framework/application", "2. PRIMARY LANGUAGE", "3. DOCUMENTATION LOCATIONS", "4. INFO SOURCE TYPES:", "   [ ] README/guides  [ ] API docs  [ ] Code comments", "   [ ] Type definitions  [ ] Configs  [ ] Schemas", "   [ ] Style guides  [ ] CONTRIBUTING.md", "   [ ] Test descriptions  [ ] Error catalogs"], next: "Invoke step 2 with survey results in --thoughts" };

  if (stepNumber === 2) return { actions: ["DIMENSION SELECTION", "", "Select from catalog (A-K) based on Step 1 info sources.", "Do NOT read files. Do NOT create domain-specific dimensions.", "", DIMENSION_CATALOG, "", "OUTPUT: List selected dimensions with rationale."], next: "Invoke step 3 with selected dimensions in --thoughts" };

  if (stepNumber === 3) return { actions: ["EXPLORATION DISPATCH", "", "Launch one haiku Explore agent per dimension.", "Launch ALL in a SINGLE message for parallelism.", "", `SCRIPT PATH: ${scriptPath}`, "", "AGENT PROMPT TEMPLATE (copy exactly, fill placeholders):", "```", "DIMENSION EXPLORATION TASK", "", "DIMENSION: {category_letter} - {dimension_name}", "DESCRIPTION: {description_from_catalog}", "", "Start by invoking:", `  bun run ${scriptPath} --step-number 4 --total-steps 22 \\`, "    --thoughts \"Dimension: {category_letter} - {dimension_name}\"", "```"], next: "After all agents complete, invoke step 8 with combined findings" };

  if (stepNumber === 4) return { actions: ["BROAD SWEEP [SUB-AGENT]", "", "Cast a WIDE NET. Prioritize recall over precision.", "Report ANYTHING that MIGHT be incoherence.", "", "SEARCH STRATEGY:", "  1. Start with obvious locations (docs/, README, src/)", "  2. Search for keywords related to your dimension", "  3. Check configs, schemas, type definitions", "  4. Look at tests for behavioral claims", "", "FOR EACH POTENTIAL FINDING, note:", "  - Location A (file:line)", "  - Location B (file:line)", "  - What might conflict", "  - Confidence: high/medium/low", "", "BIAS: Report more, not fewer. False positives are filtered later."], next: "Invoke step 5 with your findings in --thoughts" };

  if (stepNumber === 5) return { actions: ["COVERAGE CHECK [SUB-AGENT]", "", "Review your search coverage. Identify GAPS.", "", "ASK YOURSELF:", "  - What directories have I NOT searched?", "  - What file types did I skip?", "  - Are there related modules I haven't checked?", "  - Did I check both docs AND code?", "", "OUTPUT:", "  1. List of gaps/unexplored areas (at least 3)", "  2. Specific files or patterns to search next"], next: "Invoke step 6 with identified gaps in --thoughts" };

  if (stepNumber === 6) return { actions: ["GAP-FILL EXPLORATION [SUB-AGENT]", "", "Explore the gaps identified in step 5.", "", "REQUIREMENTS:", "  - Search at least 3 new locations from your gap list", "  - Use different search strategies than before", "  - Look in non-obvious places (tests, examples, scripts/)"], next: "Invoke step 7 with all findings in --thoughts" };

  if (stepNumber === 7) return { actions: ["FORMAT EXPLORATION FINDINGS [SUB-AGENT]", "", "Consolidate all findings.", "", "OUTPUT FORMAT:", "```", "EXPLORATION RESULTS - DIMENSION {letter}", "", "FINDING 1:", "  Location A: [file:line]", "  Location B: [file:line]", "  Potential conflict: [one-line description]", "  Confidence: high|medium|low", "", "TOTAL FINDINGS: N", "AREAS SEARCHED: [list]", "```"], next: "Output formatted results. Sub-agent task complete." };

  if (stepNumber === 8) return { actions: ["SYNTHESIS & CANDIDATE SELECTION", "", "Score findings (0-10): Impact + Confidence + Specificity + Fixability", "Select TOP 10 candidates. Deduplicate overlapping findings.", "", "Output: C1, C2, ... with location, summary, score."], next: "Invoke step 9 with selected candidates in --thoughts" };

  if (stepNumber === 9) return { actions: ["DEEP-DIVE DISPATCH", "", "Launch sonnet agents to verify each candidate.", "", `SCRIPT PATH: ${scriptPath}`, "", "AGENT PROMPT TEMPLATE:", "```", "DEEP-DIVE VERIFICATION TASK", "", "CANDIDATE: {id} at {location}", "Claimed issue: {summary}", "", "YOUR WORKFLOW:", "", "STEP A: Get exploration instructions", `   bun run ${scriptPath} --step-number 10 --total-steps 22 --thoughts "Verifying: {id}"`, "", "STEP B: Follow those instructions", "", "STEP C: Format your findings", `   bun run ${scriptPath} --step-number 11 --total-steps 22 --thoughts "<your findings>"`, "```"], next: "After all agents complete, invoke step 12 with all verdicts" };

  if (stepNumber === 10) return { actions: ["DEEP-DIVE EXPLORATION [SUB-AGENT]", "", "1. LOCATE PRIMARY SOURCE - Navigate to exact file:line", "2. FIND CONFLICTING SOURCE", "3. EXTRACT EVIDENCE", "4. ANALYZE CONFLICT", "5. DETERMINE VERDICT: TRUE_INCOHERENCE or FALSE_POSITIVE"], next: "When done, invoke step 11 with findings in --thoughts" };

  if (stepNumber === 11) return { actions: ["FORMAT RESULTS [SUB-AGENT]", "", "REQUIRED FORMAT:", "```", "VERIFICATION RESULT", "", "CANDIDATE: {id}", "VERDICT: TRUE_INCOHERENCE | FALSE_POSITIVE", "", "SOURCE A:", "  File: [path]  Line: [number]  Quote: \"[exact quote]\"", "", "SOURCE B:", "  File: [path]  Line: [number]  Quote: \"[exact quote]\"", "", "ANALYSIS: [why they do/don't conflict]", "SEVERITY: critical|high|medium|low (if TRUE)", "RECOMMENDATION: [fix action]", "```"], next: "Output formatted result. Sub-agent task complete." };

  if (stepNumber === 12) return { actions: ["VERDICT ANALYSIS", "", "Tally results:", "  - Total verified", "  - TRUE_INCOHERENCE count", "  - FALSE_POSITIVE count", "  - By severity"], next: "Invoke step 13 with confirmed findings" };

  if (stepNumber === 13) return { actions: ["REPORT GENERATION", "", "Write the incoherence report to the specified file.", "Include Resolution sections for user input.", "", "See SKILL.md for full report format."], next: "DETECTION PHASE COMPLETE. User edits report, then runs step 14." };

  // Reconciliation Phase: Steps 14-22
  if (stepNumber === 14) return { actions: ["RECONCILE PARSE", "", "Extract resolutions from the report file.", "For each issue: check for Status section, find Resolution section.", "If empty -> skip. If non-empty -> TO_PROCESS."], next: "Invoke step 15 with issues to process in --thoughts" };

  if (stepNumber === 15) return { actions: ["RECONCILE ANALYZE", "", "Determine target files and agent types for each resolution.", "Identify: target file(s), change type (code/docs/config), agent type."], next: "Invoke step 16 with analysis in --thoughts" };

  if (stepNumber === 16) return { actions: ["RECONCILE PLAN", "", "Group resolutions by file and create dispatch waves.", "BATCH same agent type, SEQUENCE different agent types."], next: "Invoke step 17 with dispatch plan in --thoughts" };

  if (stepNumber === 17) return { actions: ["RECONCILE DISPATCH", "", "Launch agents for the current wave.", "", `SCRIPT PATH: ${scriptPath}`, "", "AGENT PROMPT TEMPLATE:", "```", "RECONCILIATION TASK", "", "TARGET FILE: {file_path}", "RESOLUTIONS TO APPLY: ...", "", "YOUR WORKFLOW:", `1. bun run ${scriptPath} --step-number 18 --total-steps 22 --thoughts "..."`, "2. Apply the resolution(s)", `3. bun run ${scriptPath} --step-number 19 --total-steps 22 --thoughts "..."`, "```"], next: "After all wave agents complete, invoke step 20 with results" };

  if (stepNumber === 18) return { actions: ["RECONCILE APPLY [SUB-AGENT]", "", "Apply the user's resolution(s) to the target file.", "Understand -> Locate -> Apply -> Verify."], next: "When done, invoke step 19 with results in --thoughts" };

  if (stepNumber === 19) return { actions: ["RECONCILE FORMAT [SUB-AGENT]", "", "Format your reconciliation result(s).", "", "IF SUCCESSFULLY APPLIED:", "```", "RECONCILIATION RESULT", "ISSUE: {id}  STATUS: RESOLVED  FILE: {file_path}", "CHANGE: {brief description}", "```"], next: "Output formatted result(s). Sub-agent task complete." };

  if (stepNumber === 20) return { actions: ["RECONCILE COLLECT", "", "Collect results from the completed wave.", "If more waves -> step 17. If all done -> step 21."], next: "If more waves: invoke step 17. Otherwise: invoke step 21." };

  if (stepNumber === 21) return { actions: ["RECONCILE UPDATE", "", "Update the original report file with resolved status markers.", "Add: #### Status\\n  RESOLVED -- {file}:{line}: {change}"], next: "Invoke step 22 to output summary" };

  if (stepNumber >= 22) return { actions: ["RECONCILE COMPLETE", "", "Output a brief structured summary to the user.", "List ALL issues (resolved + skipped)."], next: "RECONCILIATION COMPLETE." };

  return { actions: ["Unknown step"], next: "Check step number" };
}

function main(): void {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "step-number": { type: "string" },
      "total-steps": { type: "string" },
      thoughts: { type: "string" },
    },
    strict: false,
  });

  const stepNumber = parseInt(values["step-number"] as string, 10);
  const totalSteps = parseInt(values["total-steps"] as string, 10);
  const thoughts = values.thoughts as string ?? "";

  if (isNaN(stepNumber) || isNaN(totalSteps)) {
    console.error("Usage: incoherence.ts --step-number N --total-steps N --thoughts '...'");
    process.exit(1);
  }

  const scriptPath = resolve(import.meta.dir, "incoherence.ts");
  const guidance = getStepGuidance(stepNumber, totalSteps, scriptPath);

  const isSubAgent = [4, 5, 6, 7, 10, 11, 18, 19].includes(stepNumber);
  const phase = stepNumber <= 13 ? "DETECTION" : "RECONCILIATION";
  const agentType = isSubAgent ? "SUB-AGENT" : "PARENT";

  console.log("=".repeat(70));
  console.log(`INCOHERENCE DETECTOR - Step ${stepNumber}/${totalSteps}`);
  console.log(`[${phase}] [${agentType}]`);
  console.log("=".repeat(70));
  console.log();
  console.log("THOUGHTS:", thoughts.length > 300 ? thoughts.slice(0, 300) + "..." : thoughts);
  console.log();
  console.log("REQUIRED ACTIONS:");
  for (const action of guidance.actions) console.log(`  ${action}`);
  console.log();
  console.log("NEXT:", guidance.next);
  console.log("=".repeat(70));
}

main();
