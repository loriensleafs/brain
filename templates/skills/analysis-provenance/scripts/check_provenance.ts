#!/usr/bin/env bun
/**
 * Check code provenance to determine if a file is upstream or local.
 *
 * Analyzes files to determine their ownership status before modification.
 * Prevents accidental modification of external dependencies.
 *
 * Exit Codes:
 *   0: Provenance determined successfully
 *   1: Script error (file not found, invalid arguments)
 */

import { parseArgs } from "util";
import { resolve, dirname } from "path";
import { readFileSync, existsSync, statSync } from "fs";
import { spawnSync } from "child_process";

type Category = "UPSTREAM" | "LOCAL" | "VENDOR" | "UNKNOWN";
type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface Evidence {
  signal: string;
  value: unknown;
  weight: number;
}

interface ProvenanceResult {
  target: string;
  category: Category;
  confidence: Confidence;
  evidence: Evidence[];
  recommendation: string;
}

const UPSTREAM_DIRS = new Set([
  "node_modules", ".venv", "venv", "site-packages", ".nuget",
  "packages", "__pycache__", ".tox", ".nox", "dist-packages",
]);

const VENDOR_DIRS = new Set(["vendor", "vendored", "third-party", "third_party", "external"]);

const GENERATED_MARKERS = [
  "generated", "do not edit", "auto-generated",
  "automatically generated", "this file is generated", "machine generated",
];

const EXTERNAL_COPYRIGHT_PATTERNS = [
  "copyright (c)", "copyright ©", "licensed under", "license:", "spdx-license-identifier:",
];

function getRelativeParts(target: string, projectRoot: string): string[] {
  const resolved = resolve(target);
  const root = resolve(projectRoot);
  if (resolved.startsWith(root)) {
    return resolved.slice(root.length + 1).split("/").filter(Boolean);
  }
  return resolved.split("/").filter(Boolean);
}

function checkDirectoryPath(target: string, projectRoot: string): Evidence[] {
  const evidence: Evidence[] = [];
  const parts = getRelativeParts(target, projectRoot);
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (UPSTREAM_DIRS.has(lower)) evidence.push({ signal: "upstream_directory", value: part, weight: 10 });
    else if (VENDOR_DIRS.has(lower)) evidence.push({ signal: "vendor_directory", value: part, weight: 8 });
  }
  return evidence;
}

function checkFileHeader(target: string): Evidence[] {
  const evidence: Evidence[] = [];
  if (!existsSync(target) || !statSync(target).isFile()) return evidence;

  try {
    const content = readFileSync(target, "utf-8");
    const headerLines = content.split("\n").slice(0, 20).map((l) => l.toLowerCase());
    const headerText = headerLines.join(" ");

    for (const marker of GENERATED_MARKERS) {
      if (headerText.includes(marker)) evidence.push({ signal: "generated_marker", value: marker, weight: 7 });
    }
    for (const pattern of EXTERNAL_COPYRIGHT_PATTERNS) {
      if (headerText.includes(pattern)) evidence.push({ signal: "copyright_notice", value: pattern, weight: 3 });
    }
  } catch {
    // Ignore read errors
  }
  return evidence;
}

function checkGitSubmodule(target: string, projectRoot: string): Evidence[] {
  const evidence: Evidence[] = [];
  const gitmodules = resolve(projectRoot, ".gitmodules");
  if (!existsSync(gitmodules)) return evidence;

  try {
    const content = readFileSync(gitmodules, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("path = ")) {
        const submodulePath = trimmed.split("=")[1].trim();
        const absSubmodule = resolve(projectRoot, submodulePath);
        if (resolve(target).startsWith(absSubmodule)) {
          evidence.push({ signal: "git_submodule", value: submodulePath, weight: 9 });
          break;
        }
      }
    }
  } catch {
    // Ignore
  }
  return evidence;
}

function checkPackageManifest(target: string, projectRoot: string): Evidence[] {
  const evidence: Evidence[] = [];
  const pkgJson = resolve(projectRoot, "package.json");
  if (!existsSync(pkgJson)) return evidence;

  try {
    const pkg = JSON.parse(readFileSync(pkgJson, "utf-8"));
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const parts = getRelativeParts(target, projectRoot);
    if (parts.length >= 2 && parts[0] === "node_modules") {
      let packageName = parts[1];
      if (packageName.startsWith("@") && parts.length >= 3) packageName = `${parts[1]}/${parts[2]}`;
      if (deps[packageName]) {
        evidence.push({ signal: "package_json_dependency", value: `${packageName}@${deps[packageName]}`, weight: 10 });
      }
    }
  } catch {
    // Ignore
  }
  return evidence;
}

function checkGitTracked(target: string, projectRoot: string): Evidence[] {
  const evidence: Evidence[] = [];
  if (!existsSync(resolve(projectRoot, ".git"))) return evidence;

  const parts = getRelativeParts(target, projectRoot);
  const relativePath = parts.join("/");
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd: projectRoot, encoding: "utf-8",
  });
  if (result.status === 0) evidence.push({ signal: "git_tracked", value: true, weight: 5 });
  else evidence.push({ signal: "git_tracked", value: false, weight: -2 });
  return evidence;
}

function checkProjectRoot(target: string, projectRoot: string): Evidence[] {
  const evidence: Evidence[] = [];
  const resolved = resolve(target);
  const root = resolve(projectRoot);

  if (!resolved.startsWith(root)) {
    evidence.push({ signal: "outside_project", value: true, weight: -5 });
    return evidence;
  }

  const parts = getRelativeParts(target, projectRoot);
  const inDepDir = parts.some((p) => UPSTREAM_DIRS.has(p.toLowerCase()));
  if (!inDepDir) evidence.push({ signal: "project_root", value: true, weight: 6 });
  return evidence;
}

function determineProvenance(target: string, projectRoot: string): ProvenanceResult {
  const allEvidence: Evidence[] = [
    ...checkDirectoryPath(target, projectRoot),
    ...checkFileHeader(target),
    ...checkGitSubmodule(target, projectRoot),
    ...checkPackageManifest(target, projectRoot),
    ...checkGitTracked(target, projectRoot),
    ...checkProjectRoot(target, projectRoot),
  ];

  const upstreamSignals = new Set(["upstream_directory", "package_json_dependency", "git_submodule", "generated_marker"]);
  const upstreamScore = allEvidence.filter((e) => upstreamSignals.has(e.signal)).reduce((s, e) => s + e.weight, 0);
  const vendorScore = allEvidence.filter((e) => e.signal === "vendor_directory").reduce((s, e) => s + e.weight, 0);
  const localSignals = new Set(["project_root", "git_tracked"]);
  const localScore = allEvidence.filter((e) => localSignals.has(e.signal) && e.value === true).reduce((s, e) => s + e.weight, 0);
  const totalWeight = allEvidence.reduce((s, e) => s + Math.abs(e.weight), 0);

  let category: Category;
  let confidence: Confidence;
  let recommendation: string;

  if (upstreamScore >= 8) {
    category = "UPSTREAM";
    confidence = upstreamScore >= 15 ? "HIGH" : "MEDIUM";
    recommendation = "Do NOT modify. Configure via local config files instead.";
  } else if (vendorScore >= 6) {
    category = "VENDOR";
    confidence = vendorScore >= 10 ? "HIGH" : "MEDIUM";
    recommendation = "Avoid modification. Track upstream source for updates.";
  } else if (localScore >= 5) {
    category = "LOCAL";
    confidence = localScore >= 10 ? "HIGH" : "MEDIUM";
    recommendation = "Safe to modify as needed.";
  } else if (totalWeight === 0) {
    category = "UNKNOWN";
    confidence = "LOW";
    recommendation = "Investigate ownership before modifying.";
  } else {
    const maxScore = Math.max(upstreamScore, vendorScore, localScore);
    category = maxScore === upstreamScore ? "UPSTREAM" : maxScore === vendorScore ? "VENDOR" : "LOCAL";
    confidence = "LOW";
    recommendation = "Low confidence. Verify ownership manually.";
  }

  return { target, category, confidence, evidence: allEvidence, recommendation };
}

function findProjectRoot(startPath: string): string {
  let current = resolve(startPath);
  if (existsSync(current) && statSync(current).isFile()) current = dirname(current);

  while (current !== dirname(current)) {
    if (existsSync(resolve(current, ".git"))) return current;
    current = dirname(current);
  }
  return existsSync(startPath) && statSync(startPath).isFile() ? dirname(resolve(startPath)) : resolve(startPath);
}

function formatText(result: ProvenanceResult): string {
  const lines = [
    `Provenance Check: ${result.target}`,
    "=".repeat(18 + result.target.length),
    "",
    `Category: ${result.category}`,
    `Confidence: ${result.confidence}`,
    "",
    "Evidence:",
  ];
  for (const e of result.evidence) lines.push(`  - ${e.signal}: ${e.value}`);
  lines.push("", `Recommendation: ${result.recommendation}`);
  return lines.join("\n");
}

function main(): number {
  const { values } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      target: { type: "string" },
      format: { type: "string", default: "text" },
      verbose: { type: "boolean", default: false },
    },
    strict: false,
  });

  if (!values.target) {
    console.error("Error: --target is required");
    return 1;
  }

  const target = resolve(values.target as string);
  if (!existsSync(target)) {
    console.error(`Error: Target not found: ${target}`);
    return 1;
  }

  const projectRoot = findProjectRoot(target);
  const result = determineProvenance(target, projectRoot);

  if (values.format === "json") {
    console.log(JSON.stringify({
      target: result.target, category: result.category, confidence: result.confidence,
      evidence: result.evidence.map((e) => ({ signal: e.signal, value: e.value })),
      recommendation: result.recommendation,
    }, null, 2));
  } else {
    console.log(formatText(result));
  }
  return 0;
}

process.exit(main());
