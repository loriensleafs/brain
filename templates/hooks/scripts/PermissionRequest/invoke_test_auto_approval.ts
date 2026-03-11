#!/usr/bin/env bun
/**
 * Auto-approve test execution commands to reduce permission fatigue.
 *
 * Claude Code PermissionRequest hook that automatically approves safe test
 * execution commands (Invoke-Pester, npm test, pytest, bun test, etc.)
 * without user intervention.
 *
 * Hook Type: PermissionRequest
 * When a safe test command is detected, outputs a JSON approval decision on stdout.
 *
 * Exit Codes (Claude Hook Semantics, exempt from ADR-035):
 *     0 = Always (non-blocking hook, all errors are warnings)
 */

interface HookInput {
  readonly tool_input?: {
    readonly command?: string;
  };
}

/** Shell metacharacters that indicate compound/dangerous commands. */
const DANGEROUS_METACHARACTERS = [
  ";",
  "|",
  "&",
  "<",
  ">",
  "$",
  "`",
  "\n",
  "\r",
] as const;

/** Safe test command patterns (anchored to start of command). */
const SAFE_TEST_PATTERNS: ReadonlyArray<RegExp> = [
  /^pwsh\s+.*Invoke-Pester/,
  /^npm\s+test/,
  /^npm\s+run\s+test/,
  /^pnpm\s+test/,
  /^yarn\s+test/,
  /^bun\s+test/,
  /^bunx\s+.*test/,
  /^pytest(\s|$)/,
  /^python\s+.*pytest/,
  /^dotnet\s+test/,
  /^mvn\s+test/,
  /^gradle\s+test/,
  /^cargo\s+test/,
  /^go\s+test/,
];

function getCommandFromInput(hookInput: HookInput): string | null {
  const command = hookInput.tool_input?.command;
  if (typeof command === "string" && command.trim()) {
    return command.trim();
  }
  return null;
}

function isSafeTestCommand(command: string): boolean {
  for (const char of DANGEROUS_METACHARACTERS) {
    if (command.includes(char)) {
      console.error(
        `WARNING: Test auto-approval: Rejected command containing ` +
          `dangerous metacharacter ${JSON.stringify(char)}: ${command}`,
      );
      return false;
    }
  }

  return SAFE_TEST_PATTERNS.some((pattern) => pattern.test(command));
}

async function main(): Promise<number> {
  let hookInput: HookInput;
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;
    hookInput = JSON.parse(inputJson) as HookInput;
  } catch (error) {
    console.error(
      `test_auto_approval: Failed to parse input JSON: ${error}`,
    );
    return 0;
  }

  const command = getCommandFromInput(hookInput);
  if (!command) return 0;

  if (isSafeTestCommand(command)) {
    const response = JSON.stringify({
      decision: "approve",
      reason: "Auto-approved test execution (safe read-only operation)",
    });
    console.log(response);
  }

  return 0;
}

process.exit(await main());
