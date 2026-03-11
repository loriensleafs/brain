#!/usr/bin/env bun
/**
 * Extract validation errors from GitHub Actions Job Summary.
 *
 * Reads the Job Summary from a failed Session Protocol Validation workflow run
 * and extracts the specific validation errors to guide fixes.
 *
 * Exit codes:
 *   0 - Success (errors extracted)
 *   1 - Run not found or gh command failed
 *   2 - No validation errors found in Job Summary
 */

interface NonCompliantSession {
  file: string;
  must_failures: number;
}

interface DetailedError {
  check: string;
  issue: string;
}

interface ParsedSummary {
  overall_verdict: string | null;
  must_failure_count: number;
  non_compliant_sessions: NonCompliantSession[];
  detailed_errors: Record<string, DetailedError[]>;
}

async function getRunIdFromPr(prNumber: number): Promise<string> {
  const prProc = Bun.spawn(
    ["gh", "pr", "view", String(prNumber), "--json", "headRefName"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const prStdout = await new Response(prProc.stdout).text();
  const prExit = await prProc.exited;

  if (prExit !== 0) {
    throw new Error(`Failed to get PR #${prNumber} info`);
  }

  const prInfo = JSON.parse(prStdout);
  const branch = prInfo.headRefName;

  const runsProc = Bun.spawn(
    [
      "gh", "run", "list", "--branch", branch,
      "--workflow", "session-protocol-validation.yml",
      "--limit", "5", "--json", "databaseId,conclusion",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  const runsStdout = await new Response(runsProc.stdout).text();
  const runsExit = await runsProc.exited;

  if (runsExit !== 0) {
    throw new Error("Failed to list workflow runs");
  }

  const runs = JSON.parse(runsStdout) as Array<{ databaseId: number; conclusion: string }>;
  for (const run of runs) {
    if (run.conclusion === "failure") {
      return String(run.databaseId);
    }
  }

  throw new Error(`No failed Session Protocol validation runs found for PR #${prNumber}`);
}

function parseJobSummary(summary: string): ParsedSummary {
  const result: ParsedSummary = {
    overall_verdict: null,
    must_failure_count: 0,
    non_compliant_sessions: [],
    detailed_errors: {},
  };

  const verdictMatch = /Overall Verdict:\s*\*\*([A-Z_]+)\*\*/.exec(summary);
  if (verdictMatch) {
    result.overall_verdict = verdictMatch[1];
  }

  const mustMatch = /(\d+)\s+MUST requirement\(s\) not met/.exec(summary);
  if (mustMatch) {
    result.must_failure_count = parseInt(mustMatch[1], 10);
  }

  let currentSession: string | null = null;
  let inTable = false;

  for (const line of summary.split("\n")) {
    if (/^\|\s*Session File\s*\|/.test(line)) {
      inTable = true;
      continue;
    }

    if (inTable) {
      const sessionMatch = /\|\s*`([^`]+)`\s*\|\s*.*NON_COMPLIANT\s*\|\s*(\d+)\s*\|/.exec(line);
      if (sessionMatch) {
        result.non_compliant_sessions.push({
          file: sessionMatch[1],
          must_failures: parseInt(sessionMatch[2], 10),
        });
      } else if (!/^\|/.test(line) || /^---/.test(line)) {
        inTable = false;
      }
    }

    const summaryMatch = /<summary>.*?\s*([^<]+)<\/summary>/.exec(line);
    if (summaryMatch) {
      currentSession = summaryMatch[1].trim();
      result.detailed_errors[currentSession] = [];
    }

    const errorMatch = /\|\s*([^|]+)\s*\|\s*MUST\s*\|\s*FAIL\s*\|\s*([^|]+)\s*\|/.exec(line);
    if (errorMatch && currentSession) {
      result.detailed_errors[currentSession].push({
        check: errorMatch[1].trim(),
        issue: errorMatch[2].trim(),
      });
    }
  }

  return result;
}

function parseArgs(argv: string[]): { runId?: string; pullRequest?: number } {
  let runId: string | undefined;
  let pullRequest: number | undefined;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--run-id") {
      runId = argv[++i];
    } else if (argv[i] === "--pull-request") {
      pullRequest = parseInt(argv[++i], 10);
    }
  }

  if (!runId && !pullRequest) {
    console.error("ERROR: --run-id or --pull-request is required");
    process.exit(1);
  }

  return { runId, pullRequest };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  let targetRunId: string;

  if (args.pullRequest) {
    try {
      targetRunId = await getRunIdFromPr(args.pullRequest);
    } catch (err) {
      console.error(`ERROR: ${(err as Error).message}`);
      return 1;
    }
  } else {
    targetRunId = args.runId!;
  }

  try {
    const logProc = Bun.spawn(
      ["gh", "run", "view", targetRunId, "--log-failed"],
      { stdout: "pipe", stderr: "pipe" },
    );
    const logStdout = await new Response(logProc.stdout).text();
    const logExit = await logProc.exited;

    if (logExit !== 0) {
      console.error(`ERROR: Unable to fetch run details for ${targetRunId}`);
      return 1;
    }

    const parsed = parseJobSummary(logStdout);

    if (parsed.non_compliant_sessions.length === 0) {
      console.error(
        `WARNING: No validation errors found in Job Summary for run ${targetRunId}`,
      );
      return 2;
    }

    const output = {
      run_id: targetRunId,
      overall_verdict: parsed.overall_verdict,
      must_failure_count: parsed.must_failure_count,
      non_compliant_sessions: parsed.non_compliant_sessions,
      detailed_errors: parsed.detailed_errors,
    };

    console.log(JSON.stringify(output, null, 2));
    return 0;
  } catch (err) {
    console.error(`ERROR: ${(err as Error).message}`);
    return 1;
  }
}

main().then((code) => process.exit(code));

export { parseJobSummary, getRunIdFromPr };
export type { ParsedSummary, NonCompliantSession, DetailedError };
