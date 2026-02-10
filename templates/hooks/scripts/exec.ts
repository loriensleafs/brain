/**
 * Command execution utilities for brain-hooks.
 *
 * Provides a testable wrapper around Bun.spawnSync
 * that mirrors the Go pattern of replaceable exec.Command variables.
 */

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
  const result = Bun.spawnSync([command, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    timeout: 10_000,
  });
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString();
    throw new Error(`Command failed with exit code ${result.exitCode}: ${stderr}`);
  }
  return result.stdout.toString();
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
