#!/usr/bin/env bun
/**
 * Validate a threat model document for completeness.
 *
 * Checks that a threat model has all required sections, valid STRIDE
 * categories, and proper risk ratings.
 */

import { resolve } from "path";
import { existsSync } from "fs";

interface ValidationResult {
  passed: boolean;
  message: string;
  severity: "error" | "warning" | "info";
}

const REQUIRED_SECTIONS: [string, RegExp][] = [
  ["Scope", /##\s+\d*\.?\s*Scope/i],
  ["Architecture Overview", /##\s+\d*\.?\s*Architecture/i],
  ["STRIDE Analysis", /##\s+\d*\.?\s*STRIDE/i],
  ["Threat Matrix", /##\s+\d*\.?\s*Threat\s+Matrix/i],
  ["Mitigations", /##\s+\d*\.?\s*Mitigations/i],
];

const STRIDE_CATEGORIES = new Set(["S", "T", "R", "I", "D", "E"]);
const RISK_LEVELS = new Set(["Critical", "High", "Medium", "Low"]);

function checkRequiredSections(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];

  for (const [name, pattern] of REQUIRED_SECTIONS) {
    if (pattern.test(content)) {
      results.push({ passed: true, message: `Section '${name}' present`, severity: "info" });
    } else {
      results.push({ passed: false, message: `Missing required section: ${name}`, severity: "error" });
    }
  }

  return results;
}

function checkThreatMatrix(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const tablePattern = /\| ID \| Element \| STRIDE \| Threat \|.*?\n((?:\|.*\n)*)/i;
  const match = content.match(tablePattern);

  if (!match) {
    results.push({
      passed: false,
      message: "Threat matrix table not found or has invalid header",
      severity: "error",
    });
    return results;
  }

  const tableRows = match[1].trim().split("\n");
  let threatCount = 0;
  const strideFound = new Set<string>();
  const riskFound = new Set<string>();

  for (const row of tableRows) {
    if (row.includes("---")) continue;

    const cells = row.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 7) continue;

    threatCount++;
    const threatId = cells[0];
    const stride = cells[2].toUpperCase();
    const risk = cells[6];

    if (STRIDE_CATEGORIES.has(stride)) {
      strideFound.add(stride);
    } else {
      results.push({
        passed: false,
        message: `${threatId}: Invalid STRIDE category '${stride}'`,
        severity: "error",
      });
    }

    let riskValid = false;
    for (const level of RISK_LEVELS) {
      if (risk.toLowerCase().includes(level.toLowerCase())) {
        riskFound.add(level);
        riskValid = true;
        break;
      }
    }

    if (!riskValid) {
      results.push({
        passed: false,
        message: `${threatId}: Invalid risk level '${risk}'`,
        severity: "error",
      });
    }
  }

  if (threatCount === 0) {
    results.push({ passed: false, message: "No threats found in threat matrix", severity: "error" });
  } else {
    results.push({ passed: true, message: `Found ${threatCount} threats`, severity: "info" });
  }

  const missingStride = [...STRIDE_CATEGORIES].filter((s) => !strideFound.has(s));
  if (missingStride.length > 0) {
    results.push({
      passed: true,
      message: `STRIDE categories not addressed: ${missingStride.sort().join(", ")}`,
      severity: "warning",
    });
  } else {
    results.push({ passed: true, message: "All STRIDE categories addressed", severity: "info" });
  }

  return results;
}

function checkMitigations(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const threatPattern = /\| (T\d+) \|.*?\| (Critical|High) \|/gi;
  const allMatches: [string, string][] = [];
  let m: RegExpExecArray | null;

  while ((m = threatPattern.exec(content)) !== null) {
    allMatches.push([m[1], m[2]]);
  }

  const seen = new Set<string>();
  const criticalHigh: [string, string][] = [];
  for (const [threatId, risk] of allMatches) {
    if (!seen.has(threatId)) {
      seen.add(threatId);
      criticalHigh.push([threatId, risk]);
    }
  }

  if (criticalHigh.length === 0) {
    results.push({
      passed: true,
      message: "No Critical/High threats (or already mitigated)",
      severity: "info",
    });
    return results;
  }

  const mitigationsMatch = content.match(
    /##\s+\d*\.?\s*Mitigations(.*?)(?=\n##\s+\d|$)/is
  );

  if (!mitigationsMatch) {
    results.push({ passed: false, message: "Mitigations section missing", severity: "error" });
    return results;
  }

  const mitigationContent = mitigationsMatch[1];

  for (const [threatId, risk] of criticalHigh) {
    if (mitigationContent.toLowerCase().includes(threatId.toLowerCase())) {
      results.push({
        passed: true,
        message: `${threatId} (${risk}): Mitigation documented`,
        severity: "info",
      });
    } else {
      results.push({
        passed: false,
        message: `${threatId} (${risk}): No mitigation found`,
        severity: "error",
      });
    }
  }

  return results;
}

function checkComponents(content: string): ValidationResult[] {
  const results: ValidationResult[] = [];
  const componentsPattern =
    /\| ID \| Name \| Type \| Description \|.*?\n((?:\|.*\n)*)/i;
  const match = content.match(componentsPattern);

  if (!match) {
    results.push({
      passed: true,
      message: "Components table not found (optional)",
      severity: "warning",
    });
    return results;
  }

  const rows = match[1]
    .trim()
    .split("\n")
    .filter((r) => !r.includes("---"));

  if (rows.length === 0) {
    results.push({ passed: false, message: "Components table is empty", severity: "warning" });
  } else {
    results.push({ passed: true, message: `Found ${rows.length} components`, severity: "info" });
  }

  return results;
}

function validatePathNoTraversal(inputPath: string): string {
  if (inputPath.includes("..")) {
    throw new Error(
      `Path traversal attempt detected: '${inputPath}' contains prohibited '..' sequence.`
    );
  }
  const resolvedPath = resolve(inputPath);
  if (!resolvedPath.startsWith(resolve("."))) {
    throw new Error(
      `Path traversal attempt detected: '${inputPath}' resolves outside the working directory.`
    );
  }
  return resolvedPath;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let modelPath = "";
  let jsonOutput = false;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--json") {
      jsonOutput = true;
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: bun run validate_threat_model.ts <path> [--json]");
      return 0;
    } else if (!argv[i].startsWith("-")) {
      modelPath = argv[i];
    }
  }

  if (!modelPath) {
    console.error("ERROR: Path to threat model is required");
    return 1;
  }

  let resolvedPath: string;
  try {
    resolvedPath = validatePathNoTraversal(modelPath);
  } catch (e) {
    if (jsonOutput) {
      console.log(JSON.stringify({ passed: false, results: [{ passed: false, message: (e as Error).message, severity: "error" }] }, null, 2));
    } else {
      console.error(`Error: ${(e as Error).message}`);
    }
    return 10;
  }

  if (!existsSync(resolvedPath)) {
    const msg = `File not found: ${modelPath}`;
    if (jsonOutput) {
      console.log(JSON.stringify({ passed: false, results: [{ passed: false, message: msg, severity: "error" }] }, null, 2));
    } else {
      console.error(msg);
    }
    return 10;
  }

  const content = await Bun.file(resolvedPath).text();
  const results: ValidationResult[] = [
    ...checkRequiredSections(content),
    ...checkThreatMatrix(content),
    ...checkMitigations(content),
    ...checkComponents(content),
  ];

  const errors = results.filter((r) => !r.passed && r.severity === "error");
  const passed = errors.length === 0;

  if (jsonOutput) {
    console.log(JSON.stringify({ passed, results }, null, 2));
  } else {
    console.log(`Validating: ${modelPath}`);
    console.log("=".repeat(60));

    const errorsArr = results.filter((r) => r.severity === "error");
    const warnings = results.filter((r) => r.severity === "warning");
    const info = results.filter((r) => r.severity === "info");

    if (errorsArr.length > 0) {
      console.log("\nERRORS:");
      for (const r of errorsArr) {
        const status = r.passed ? "PASS" : "FAIL";
        console.log(`  [${status}] ${r.message}`);
      }
    }

    if (warnings.length > 0) {
      console.log("\nWARNINGS:");
      for (const r of warnings) {
        console.log(`  [WARN] ${r.message}`);
      }
    }

    if (info.length > 0) {
      console.log("\nINFO:");
      for (const r of info) {
        console.log(`  [INFO] ${r.message}`);
      }
    }

    console.log("=".repeat(60));
    if (passed) {
      console.log("RESULT: PASSED");
    } else {
      console.log(`RESULT: FAILED (${errors.length} errors)`);
    }
  }

  return passed ? 0 : 10;
}

process.exit(await main());
