#!/usr/bin/env bun
/**
 * Check if staged files qualify for investigation-only QA skip.
 *
 * Tests whether the currently staged git files are all within the
 * investigation-only allowlist. This allows agents to check eligibility
 * before committing with "SKIPPED: investigation-only".
 *
 * Exit codes:
 *   0 - Success (always returns 0, eligibility is in JSON output)
 */

// Investigation allowlist patterns (single source of truth)
const ALLOWLIST_PATTERNS: RegExp[] = [
  /^\.agents\/sessions\//,
  /^\.agents\/analysis\//,
  /^\.agents\/retrospective\//,
  /^\.agents\/security\//,
  /^\.agents\/memory\//,
  /^\.agents\/architecture\/REVIEW-/,
  /^\.agents\/critique\//,
  /^\.agents\/memory\/episodes\//,
];

const ALLOWLIST_DISPLAY: string[] = [
  ".agents/sessions/",
  ".agents/analysis/",
  ".agents/retrospective/",
  ".agents/security/",
  ".agents/memory/",
  ".agents/architecture/REVIEW-*",
  ".agents/critique/",
  ".agents/memory/episodes/",
];

function fileMatchesAllowlist(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ALLOWLIST_PATTERNS.some((pattern) => pattern.test(normalized));
}

async function main(): Promise<number> {
  const proc = Bun.spawn(["git", "diff", "--cached", "--name-only"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const output = {
      Eligible: false,
      StagedFiles: [] as string[],
      Violations: [] as string[],
      AllowedPaths: ALLOWLIST_DISPLAY,
      Error: "Not in a git repository or git command failed",
    };
    console.log(JSON.stringify(output, null, 2));
    return 0;
  }

  const stagedFiles = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const violations = stagedFiles.filter((f) => !fileMatchesAllowlist(f));

  const output = {
    Eligible: violations.length === 0,
    StagedFiles: stagedFiles,
    Violations: violations,
    AllowedPaths: ALLOWLIST_DISPLAY,
  };

  console.log(JSON.stringify(output, null, 2));
  return 0;
}

main().then((code) => process.exit(code));

export { fileMatchesAllowlist, ALLOWLIST_PATTERNS, ALLOWLIST_DISPLAY };
