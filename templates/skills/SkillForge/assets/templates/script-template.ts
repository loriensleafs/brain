/**
 * {{SCRIPT_NAME}}.ts - {{BRIEF_DESCRIPTION}}
 *
 * Part of the {{SKILL_NAME}} skill.
 *
 * Responsibilities:
 * - {{RESPONSIBILITY_1}}
 * - {{RESPONSIBILITY_2}}
 *
 * Usage:
 *    bun {{SCRIPT_NAME}}.ts <required_arg> [--optional-flag]
 *    bun {{SCRIPT_NAME}}.ts --help
 *
 * Examples:
 *    bun {{SCRIPT_NAME}}.ts input.json
 *    bun {{SCRIPT_NAME}}.ts input.json --verbose --output result.json
 *
 * Exit Codes:
 *    0  - Success
 *    1  - General failure
 *    2  - Invalid arguments
 *    3  - File not found
 *    10 - Validation failure
 *    11 - Verification failure
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { resolve, dirname, join } from "path";

// ===========================================================================
// RESULT TYPES
// ===========================================================================

/**
 * Standard result object for script operations.
 */
interface Result {
  /** Whether the operation succeeded */
  success: boolean;
  /** Human-readable summary */
  message: string;
  /** Any output data from the operation */
  data: Record<string, unknown>;
  /** List of error messages */
  errors: string[];
  /** List of warning messages */
  warnings: string[];
}

function createResult(partial: Partial<Result> & Pick<Result, "success" | "message">): Result {
  return {
    data: {},
    errors: [],
    warnings: [],
    ...partial,
  };
}

function resultToDict(result: Result): Record<string, unknown> {
  return {
    success: result.success,
    message: result.message,
    data: result.data,
    errors: result.errors,
    warnings: result.warnings,
    timestamp: new Date().toISOString(),
  };
}

// ===========================================================================
// STATE MANAGEMENT (remove if not needed)
// ===========================================================================

const HOME = process.env.HOME ?? "";

function getStateDir(): string {
  return join(HOME, ".cache", "{{SKILL_NAME}}");
}

function getStatePath(projectName: string = "default"): string {
  const safeName = projectName.toLowerCase().replace(/ /g, "-").replace(/\//g, "-");
  return join(getStateDir(), `${safeName}.json`);
}

function loadState(path?: string): Record<string, unknown> {
  const statePath = path ?? getStatePath();

  if (!existsSync(statePath)) {
    return {
      version: "1.0",
      created_at: new Date().toISOString(),
      data: {},
    };
  }

  try {
    return JSON.parse(readFileSync(statePath, "utf-8"));
  } catch {
    // Backup corrupted file and return fresh state
    const backup = statePath + ".bak";
    renameSync(statePath, backup);
    return {
      version: "1.0",
      created_at: new Date().toISOString(),
      data: {},
      recovered_from: backup,
    };
  }
}

function saveState(state: Record<string, unknown>, path?: string): void {
  const statePath = path ?? getStatePath();
  const dir = dirname(statePath);
  mkdirSync(dir, { recursive: true });

  state["updated_at"] = new Date().toISOString();

  // Write to temp file first for atomic save
  const tempPath = statePath + ".tmp";
  writeFileSync(tempPath, JSON.stringify(state, null, 2));
  renameSync(tempPath, statePath);
}

// ===========================================================================
// CORE LOGIC
// ===========================================================================

function processInput(
  inputPath: string,
  options: Record<string, unknown>,
): Result {
  // ----- Input Validation -----
  if (!existsSync(inputPath)) {
    return createResult({
      success: false,
      message: `Input file not found: ${inputPath}`,
      errors: [`File not found: ${inputPath}`],
    });
  }

  // ----- Processing -----
  // TODO: Implement core logic here
  //
  // Example:
  // try {
  //   const data = JSON.parse(readFileSync(inputPath, "utf-8"));
  //   const result = transform(data);
  //   return createResult({
  //     success: true,
  //     message: "Processing complete",
  //     data: result,
  //   });
  // } catch (e) {
  //   return createResult({
  //     success: false,
  //     message: String(e),
  //     errors: [String(e)],
  //   });
  // }

  return createResult({
    success: true,
    message: "Processing complete",
    data: { processed: true },
  });
}

function verifyResult(result: Result): { valid: boolean; message: string } {
  if (!result.success) {
    return { valid: false, message: `Processing failed: ${result.message}` };
  }

  // ----- Add verification logic specific to this script -----
  // TODO: Implement verification
  //
  // Example:
  // if (!("required_field" in result.data)) {
  //   return { valid: false, message: "Missing required field in output" };
  // }

  return { valid: true, message: "Verification passed" };
}

// ===========================================================================
// CLI INTERFACE
// ===========================================================================

function parseArgs(): {
  input: string;
  output?: string;
  verbose: boolean;
  json: boolean;
  noVerify: boolean;
} {
  const args = process.argv.slice(2);
  let input = "";
  let output: string | undefined;
  let verbose = false;
  let json = false;
  let noVerify = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" || args[i] === "-o") {
      output = args[++i];
    } else if (args[i] === "--verbose" || args[i] === "-v") {
      verbose = true;
    } else if (args[i] === "--json") {
      json = true;
    } else if (args[i] === "--no-verify") {
      noVerify = true;
    } else if (!input) {
      input = args[i];
    }
  }

  return { input, output, verbose, json, noVerify };
}

function main(): void {
  const opts = parseArgs();

  if (!opts.input) {
    console.log("Usage: bun {{SCRIPT_NAME}}.ts <input> [--output <path>] [--verbose] [--json] [--no-verify]");
    process.exit(2);
  }

  const options: Record<string, unknown> = {
    verbose: opts.verbose,
  };

  if (opts.verbose) {
    console.error(`Processing: ${opts.input}`);
  }

  const result = processInput(opts.input, options);

  // ----- Self-Verify -----
  if (!opts.noVerify && result.success) {
    const { valid, message: verifyMsg } = verifyResult(result);
    if (!valid) {
      if (opts.json) {
        console.log(
          JSON.stringify({ success: false, error: `Verification failed: ${verifyMsg}` }),
        );
      } else {
        console.error(`Verification failed: ${verifyMsg}`);
      }
      process.exit(11); // Verification failure
    }
  }

  // ----- Output -----
  if (opts.json) {
    console.log(JSON.stringify(resultToDict(result), null, 2));
  } else {
    if (result.success) {
      console.log(`Success: ${result.message}`);
      if (opts.verbose) {
        for (const [key, value] of Object.entries(result.data)) {
          console.log(`  ${key}: ${value}`);
        }
      }
    } else {
      console.error(`Failed: ${result.message}`);
      for (const error of result.errors) {
        console.error(`  Error: ${error}`);
      }
    }

    for (const warning of result.warnings) {
      console.error(`  Warning: ${warning}`);
    }
  }

  // ----- Write to File -----
  if (opts.output && result.success) {
    const outputPath = resolve(opts.output);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, JSON.stringify(result.data, null, 2));
    if (!opts.json) {
      console.log(`Output written to: ${outputPath}`);
    }
  }

  // ----- Exit -----
  process.exit(result.success ? 0 : 1);
}

main();
