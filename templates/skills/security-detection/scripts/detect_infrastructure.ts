#!/usr/bin/env bun
/**
 * Detect infrastructure and security-critical file changes.
 *
 * Analyzes changed files to identify those requiring security agent review.
 * Returns risk level and matching patterns.
 *
 * Exit codes:
 *   0 - Success: Detection completed (always)
 */

const CRITICAL_PATTERNS: RegExp[] = [
  /^\.github\/workflows\/.*\.(yml|yaml)$/,
  /^\.github\/actions\//,
  /^\.githooks\//,
  /^\.husky\//,
  /.*\/Auth\//,
  /.*\/Authentication\//,
  /.*\/Authorization\//,
  /.*\/Security\//,
  /.*\/Identity\//,
  /.*Auth.*\.(cs|ts|js|py)$/,
  /\.env.*$/,
  /.*\.(pem|key|p12|pfx|jks)$/,
  /.*secret.*/,
  /.*credential.*/,
  /.*password.*/,
];

const HIGH_PATTERNS: RegExp[] = [
  /^build\/.*\.(ps1|sh|cmd|bat)$/,
  /^scripts\/.*\.(ps1|sh)$/,
  /^Makefile$/,
  /^Dockerfile.*$/,
  /^docker-compose.*\.(yml|yaml)$/,
  /.*\/Controllers\//,
  /.*\/Endpoints\//,
  /.*\/Handlers\//,
  /.*\/Middleware\//,
  /^appsettings.*\.json$/,
  /^web\.config$/,
  /^app\.config$/,
  /^config\/.*\.(json|yml|yaml)$/,
  /.*\.tf$/,
  /.*\.tfvars$/,
  /.*\.bicep$/,
  /^nuget\.config$/,
  /^\.npmrc$/,
];

interface Finding {
  File: string;
  RiskLevel: string;
}

interface DetectionResult {
  findings: Finding[];
  highest_risk: string;
  file_count: number;
}

function matchesPattern(filePath: string, patterns: ReadonlyArray<RegExp>): boolean {
  return patterns.some((pattern) => pattern.test(filePath));
}

function getSecurityRiskLevel(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  if (matchesPattern(normalized, CRITICAL_PATTERNS)) return "critical";
  if (matchesPattern(normalized, HIGH_PATTERNS)) return "high";
  return "none";
}

async function getStagedFiles(): Promise<string[]> {
  try {
    const proc = Bun.spawn(["git", "diff", "--cached", "--name-only"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    if (exitCode !== 0) return [];
    return output
      .trim()
      .split("\n")
      .filter((f) => f.trim());
  } catch {
    return [];
  }
}

async function detectInfrastructure(
  changedFiles?: string[],
  useGitStaged: boolean = false,
): Promise<DetectionResult> {
  if (useGitStaged) {
    changedFiles = await getStagedFiles();
  }

  if (!changedFiles || changedFiles.length === 0) {
    return { findings: [], highest_risk: "none", file_count: 0 };
  }

  const findings: Finding[] = [];
  let highestRisk = "none";

  for (const filePath of changedFiles) {
    const risk = getSecurityRiskLevel(filePath);
    if (risk !== "none") {
      findings.push({ File: filePath, RiskLevel: risk });
      if (risk === "critical") {
        highestRisk = "critical";
      } else if (risk === "high" && highestRisk !== "critical") {
        highestRisk = "high";
      }
    }
  }

  return { findings, highest_risk: highestRisk, file_count: changedFiles.length };
}

function parseArgs(argv: string[]): {
  files?: string[];
  useGitStaged: boolean;
  json: boolean;
} {
  const files: string[] = [];
  let useGitStaged = false;
  let json = false;
  let collectingFiles = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--files") {
      collectingFiles = true;
      continue;
    }
    if (argv[i] === "--use-git-staged") {
      useGitStaged = true;
      collectingFiles = false;
      continue;
    }
    if (argv[i] === "--json") {
      json = true;
      collectingFiles = false;
      continue;
    }
    if (argv[i]?.startsWith("--")) {
      collectingFiles = false;
      continue;
    }
    if (collectingFiles) {
      files.push(argv[i]);
    } else {
      // Positional args treated as files
      files.push(argv[i]);
    }
  }

  return {
    files: files.length > 0 ? files : undefined,
    useGitStaged,
    json,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await detectInfrastructure(args.files, args.useGitStaged);

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.findings.length === 0) {
    console.log("No infrastructure/security files detected.");
    return;
  }

  console.log("");
  console.log("=== Security Review Detection ===");
  console.log("");

  if (result.highest_risk === "critical") {
    console.log("CRITICAL: Security agent review REQUIRED");
  } else {
    console.log("HIGH: Security agent review RECOMMENDED");
  }

  console.log("");
  console.log("Matching files:");

  for (const finding of result.findings) {
    const level = finding.RiskLevel.toUpperCase();
    console.log(`  [${level}] ${finding.File}`);
  }

  console.log("");
  console.log("Run security agent before implementation:");
  console.log('  Agent(subagent_type="security", prompt="Review infrastructure changes")');
  console.log("");
}

main();

export { detectInfrastructure, getSecurityRiskLevel, matchesPattern, getStagedFiles };
export type { Finding, DetectionResult };
