/**
 * Command execution utilities for brain-hooks.
 *
 * Provides a testable wrapper around child_process.execFileSync
 * that mirrors the Go pattern of replaceable exec.Command variables.
 */
import { execFileSync } from "node:child_process";

export interface ExecResult {
  stdout: string;
  exitCode: number;
}

/**
 * Execute a command and return stdout.
 * Throws on non-zero exit code.
 * This is the default implementation; tests can replace execCommand.
 */
function defaultExecCommand(
  command: string,
  args: string[],
): string {
  const result = execFileSync(command, args, {
    encoding: "utf-8",
    timeout: 10_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
  return result;
}

/**
 * Replaceable exec function for testing.
 * Tests can override this to mock command execution.
 */
export let execCommand: (command: string, args: string[]) => string =
  defaultExecCommand;

/**
 * Set a custom exec function (for testing).
 */
export function setExecCommand(
  fn: (command: string, args: string[]) => string,
): void {
  execCommand = fn;
}

/**
 * Reset exec to the default implementation.
 */
export function resetExecCommand(): void {
  execCommand = defaultExecCommand;
}
