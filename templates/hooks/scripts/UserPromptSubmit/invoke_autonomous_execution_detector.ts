#!/usr/bin/env bun
/**
 * Inject stricter protocol enforcement for autonomy keywords.
 *
 * Claude Code UserPromptSubmit hook that detects keywords signaling
 * autonomous execution (e.g., "autonomous", "hands-off", "without asking").
 *
 * When detected, injects stricter protocol guards into context.
 *
 * Hook Type: UserPromptSubmit
 * Exit Codes (Claude Hook Semantics, exempt from ADR-035):
 *     0 = Always (educational injection, not blocking)
 */

import { skipIfConsumerRepo } from "../../lib/guards.ts";

interface HookInput {
  readonly prompt?: string;
  readonly user_message_text?: string;
  readonly message?: string;
  readonly cwd?: string;
}

const AUTONOMY_PATTERNS: ReadonlyArray<RegExp> = [
  /\bautonomous\b/i,
  /\bhands-off\b/i,
  /\bwithout asking\b/i,
  /\bwithout confirmation\b/i,
  /\bauto-\w+/i,
  /\bunattended\b/i,
  /\brun autonomously\b/i,
  /\bfull autonomy\b/i,
  /\bno human\b/i,
  /\bno verification\b/i,
  /\bblindly\b/i,
];

function buildStricterProtocolMessage(): string {
  return (
    "\nAutonomous mode: Stricter protocol active. " +
    "Session log with evidence required. " +
    "High-risk ops (merge, force-push, branch delete) need consensus gates " +
    "via /orchestrator. Blocked on main. See session protocol.\n"
  );
}

function hasAutonomyKeywords(prompt: string): boolean {
  if (!prompt || !prompt.trim()) return false;
  return AUTONOMY_PATTERNS.some((pattern) => pattern.test(prompt));
}

function extractPrompt(hookInput: HookInput): string | null {
  for (const key of ["prompt", "user_message_text", "message"] as const) {
    const value = hookInput[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

async function main(): Promise<number> {
  let hookInput: HookInput;
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;
    hookInput = JSON.parse(inputJson) as HookInput;
  } catch (error) {
    console.error(
      `autonomous_execution_detector: Failed to parse input JSON: ${error}`,
    );
    return 0;
  }

  if (await skipIfConsumerRepo("autonomous-execution-detector", hookInput.cwd)) return 0;

  const userPrompt = extractPrompt(hookInput);
  if (!userPrompt) return 0;

  if (hasAutonomyKeywords(userPrompt)) {
    console.log(buildStricterProtocolMessage());
  }

  return 0;
}

process.exit(await main());
