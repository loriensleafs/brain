#!/usr/bin/env bun
/**
 * Validate slash command file for quality gates.
 *
 * Validates slash command (.md) files for 5 categories:
 * 1. Frontmatter - Required YAML frontmatter with description
 * 2. Arguments - Consistency between argument-hint and $ARGUMENTS usage
 * 3. Security - allowed-tools required when bash execution (!) is used
 * 4. Length - Warning if >200 lines (suggest converting to skill)
 * 5. Lint - Markdown lint via markdownlint-cli2
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more BLOCKING violations found
 */

interface ValidationResult {
  violations: string[];
  blockingCount: number;
  warningCount: number;
}

function validateFrontmatter(
  content: string,
  violations: string[],
): { frontmatter: string | null; hasArgHint: boolean } {
  const fmMatch = /^---\s*\n([\s\S]*?)\n---/.exec(content);
  if (!fmMatch) {
    violations.push("BLOCKING: Missing YAML frontmatter block");
    return { frontmatter: null, hasArgHint: false };
  }

  const frontmatter = fmMatch[1];

  const descMatch = /description:\s*(.+)/.exec(frontmatter);
  if (!descMatch) {
    violations.push("BLOCKING: Missing 'description' in frontmatter");
  } else {
    const description = descMatch[1].trim();
    const triggerRe = /^(Use when|Generate|Research|Invoke|Create|Analyze|Review|Search)/;
    if (!triggerRe.test(description)) {
      violations.push(
        "WARNING: Description should start with action verb or 'Use when...'",
      );
    }
  }

  const hasArgHint = /argument-hint:\s*(.+)/.test(frontmatter);
  return { frontmatter, hasArgHint };
}

function validateArguments(
  content: string,
  hasArgHint: boolean,
  violations: string[],
): void {
  const usesArguments = /\$ARGUMENTS|\$1|\$2|\$3/.test(content);

  if (usesArguments && !hasArgHint) {
    violations.push(
      "BLOCKING: Prompt uses arguments but no 'argument-hint' in frontmatter",
    );
  }

  if (hasArgHint && !usesArguments) {
    violations.push(
      "WARNING: Frontmatter has 'argument-hint' but prompt doesn't use arguments",
    );
  }
}

function validateSecurity(
  content: string,
  frontmatter: string | null,
  violations: string[],
): void {
  const usesBash = /!\s*\w+/.test(content);

  if (!usesBash || frontmatter === null) return;

  const toolsMatch = /allowed-tools:\s*\[(.+)\]/.exec(frontmatter);
  if (!toolsMatch) {
    violations.push(
      "BLOCKING: Prompt uses bash execution (!) but no 'allowed-tools' in frontmatter",
    );
    return;
  }

  const allowedTools = toolsMatch[1];
  const toolList = allowedTools.split(",").map((t) => t.trim());
  for (const tool of toolList) {
    if (tool.includes("*") && !tool.startsWith("mcp__")) {
      violations.push(
        "BLOCKING: 'allowed-tools' has overly permissive wildcard " +
          "(use mcp__* for scoped namespaces)",
      );
      break;
    }
  }
}

function validateLength(content: string, violations: string[]): void {
  const lineCount = content.split("\n").length;
  if (lineCount > 200) {
    violations.push(
      `WARNING: File has ${lineCount} lines (>200). Consider converting to skill.`,
    );
  }
}

async function validateLint(path: string, violations: string[]): Promise<void> {
  console.log("Running markdownlint-cli2...");
  const proc = Bun.spawn(["npx", "markdownlint-cli2", "--", path], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    violations.push("BLOCKING: Markdown lint errors:");
    const lintOutput = stdout || stderr;
    if (lintOutput) {
      violations.push(lintOutput.trim());
    }
    violations.push(`  To auto-fix: npx markdownlint-cli2 --fix ${path}`);
  }
}

async function validateSlashCommand(
  path: string,
  skipLint: boolean = false,
): Promise<ValidationResult> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.log(`[FAIL] File not found: ${path}`);
    console.log("  Troubleshooting:");
    console.log("    - Verify file path is correct");
    console.log("    - Check if file has been moved or deleted");
    console.log("    - Use absolute path if relative path is ambiguous");
    return { violations: ["BLOCKING: File not found"], blockingCount: 1, warningCount: 0 };
  }

  const content = await file.text();
  const violations: string[] = [];

  const { frontmatter, hasArgHint } = validateFrontmatter(content, violations);
  validateArguments(content, hasArgHint, violations);
  validateSecurity(content, frontmatter, violations);
  validateLength(content, violations);

  if (!skipLint) {
    await validateLint(path, violations);
  }

  const blockingCount = violations.filter((v) => v.startsWith("BLOCKING:")).length;
  const warningCount = violations.filter((v) => v.startsWith("WARNING:")).length;

  return { violations, blockingCount, warningCount };
}

function parseArgs(argv: string[]): { path: string; skipLint: boolean } {
  let path: string | undefined;
  let skipLint = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--path") {
      path = argv[++i];
    } else if (argv[i] === "--skip-lint") {
      skipLint = true;
    }
  }

  if (!path) {
    console.error("ERROR: --path is required");
    process.exit(1);
  }

  return { path, skipLint };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const { violations, blockingCount, warningCount } = await validateSlashCommand(
    args.path,
    args.skipLint,
  );

  if (violations.length > 0) {
    if (violations[0] === "BLOCKING: File not found") {
      return 1;
    }

    console.log(`\n[FAIL] Validation FAILED: ${args.path}`);
    console.log(`\nViolations (${blockingCount} blocking, ${warningCount} warnings):`);
    for (const v of violations) {
      console.log(`  - ${v}`);
    }

    if (blockingCount > 0) return 1;

    console.log(`\n[PASS] Validation PASSED with warnings: ${args.path}`);
    return 0;
  }

  console.log(`\n[PASS] Validation PASSED: ${args.path}`);
  return 0;
}

main().then((code) => process.exit(code));

export { validateSlashCommand, validateFrontmatter, validateArguments, validateSecurity };
export type { ValidationResult };
