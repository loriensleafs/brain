#!/usr/bin/env bun
/**
 * Validate QA agent output completeness when qa subagent stops.
 *
 * Claude Code SubagentStop hook that verifies QA validation reports are
 * complete and contain required sections. This ensures quality gates are
 * properly executed per SESSION-PROTOCOL requirements.
 *
 * Hook Type: SubagentStop
 * Exit Codes:
 *     0 = Always (non-blocking hook, all errors are warnings)
 */

import { skipIfConsumerRepo } from "../../lib/guards.ts";

interface HookInput {
  readonly subagent_type?: string;
  readonly transcript_path?: string;
  readonly cwd?: string;
}

const TEST_STRATEGY_PATTERN =
  /^#{1,3}\s*(Test Strategy|Testing Approach|Test Plan)\s*$/m;
const TEST_RESULTS_PATTERN =
  /^#{1,3}\s*(Test Results|Validation Results|Test Execution)\s*$/m;
const COVERAGE_PATTERN =
  /^#{1,3}\s*(Coverage|Test Coverage|Acceptance Criteria)\s*$/m;

function isQaAgent(hookInput: HookInput): boolean {
  return hookInput.subagent_type === "qa";
}

async function getTranscriptPath(
  hookInput: HookInput,
): Promise<string | null> {
  const path = hookInput.transcript_path;
  if (typeof path !== "string" || !path.trim()) return null;
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  return path;
}

function getMissingQaSections(transcript: string): string[] {
  const missing: string[] = [];

  if (!TEST_STRATEGY_PATTERN.test(transcript)) {
    missing.push(
      "Test Strategy/Testing Approach/Test Plan (as section header)",
    );
  }
  if (!TEST_RESULTS_PATTERN.test(transcript)) {
    missing.push(
      "Test Results/Validation Results/Test Execution (as section header)",
    );
  }
  if (!COVERAGE_PATTERN.test(transcript)) {
    missing.push(
      "Coverage/Test Coverage/Acceptance Criteria (as section header)",
    );
  }

  return missing;
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;

    const hookInput = JSON.parse(inputJson) as HookInput;

    if (await skipIfConsumerRepo("qa-agent-validator", hookInput.cwd)) return 0;

    if (!isQaAgent(hookInput)) return 0;

    const transcriptPath = await getTranscriptPath(hookInput);
    if (transcriptPath === null) {
      // Log why transcript is missing for troubleshooting
      if (!("transcript_path" in hookInput)) {
        console.error(
          "QA validator: No transcript_path property in hook input. " +
            "Agent may not have provided transcript. Validation skipped.",
        );
      } else if (
        !(hookInput.transcript_path ?? "").trim()
      ) {
        console.error(
          "QA validator: transcript_path property exists but is empty/whitespace. " +
            "Validation skipped.",
        );
      } else {
        console.error(
          `QA validator: Transcript file does not exist at ` +
            `'${hookInput.transcript_path}'. ` +
            `Agent may have failed or transcript not written. Validation skipped.`,
        );
      }
      return 0;
    }

    const transcript = await Bun.file(transcriptPath).text();
    const missingSections = getMissingQaSections(transcript);

    if (missingSections.length > 0) {
      const missingList = missingSections.join(", ");

      console.log(
        `\n**QA VALIDATION FAILURE**: QA agent report is incomplete ` +
          `and does NOT meet session protocol requirements.\n\n` +
          `Missing required sections: ${missingList}\n\n` +
          `ACTION REQUIRED: Re-run QA agent with complete report ` +
          `including all required sections per session protocol\n`,
      );
      console.error(
        `QA validation failed: Missing sections - ${missingList}`,
      );
    } else {
      console.log(
        "\n**QA Validation PASSED**: All required sections present in QA report.\n",
      );
    }

    const validationResult = {
      validation_passed: missingSections.length === 0,
      missing_sections: missingSections,
      transcript_path: transcriptPath,
    };
    console.log(JSON.stringify(validationResult));

    return 0;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("EACCES") ||
        error.message.includes("ENOENT") ||
        error.message.includes("Permission"))
    ) {
      console.error(
        `QA validator file error: Cannot read transcript - ${error}`,
      );
      console.log(
        "\n**QA Validation ERROR**: Cannot access QA agent transcript file. " +
          "Validation skipped.\n",
      );
      return 0;
    }

    const errorName =
      error instanceof Error ? error.constructor.name : "Unknown";
    console.error(
      `QA validator unexpected error: ${errorName} - ${error}`,
    );
    console.log(
      `\n**QA Validation ERROR**: Unexpected error during validation. ` +
        `MUST investigate: ${error}\n`,
    );
    return 0;
  }
}

process.exit(await main());
