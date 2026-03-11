#!/usr/bin/env bun
/**
 * Pre-Mortem Risk Inventory Validator
 *
 * Validates that a risk inventory document contains all required sections
 * and calculates aggregate risk statistics.
 *
 * Exit Codes:
 *   0: Valid inventory with all required fields
 *   1: Invalid arguments or file not found
 *   10: Validation failed (missing required sections)
 */

import { resolve } from "path";
import { existsSync } from "fs";

interface Risk {
  id: string;
  name: string;
  category: string;
  likelihood: number;
  impact: number;
  score: number;
  hasMitigation: boolean;
  owner: string | null;
  status: string | null;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  statistics: Record<string, number>;
}

const REQUIRED_SECTIONS = [
  "Project Context",
  "Risk Summary",
  "Critical Risks",
  "High Risks",
  "Medium Risks",
  "Low Risks",
  "Action Items",
];

function parseRiskEntry(text: string): Risk | null {
  const headerMatch = text.match(/###\s+R(\d+):\s+(.+)/);
  if (!headerMatch) return null;

  const riskId = `R${headerMatch[1]}`;
  const name = headerMatch[2].trim();

  const categoryMatch = text.match(/\*\*Category:\*\*\s*(.+)/);
  const category = categoryMatch ? categoryMatch[1].trim() : "Unknown";

  const likelihoodMatch = text.match(/\*\*Likelihood:\*\*\s*(\d+)/);
  const likelihood = likelihoodMatch ? parseInt(likelihoodMatch[1], 10) : 0;

  const impactMatch = text.match(/\*\*Impact:\*\*\s*(\d+)/);
  const impact = impactMatch ? parseInt(impactMatch[1], 10) : 0;

  const scoreMatch = text.match(/\*\*Score:\*\*\s*(\d+)/);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : likelihood * impact;

  const hasMitigation =
    text.includes("**Mitigation:**") || text.includes("**Prevention:**");

  const ownerMatch = text.match(/\*\*Owner:\*\*\s*(.+)/);
  const owner = ownerMatch ? ownerMatch[1].trim() : null;

  const statusMatch = text.match(/\*\*Status:\*\*\s*(.+)/);
  const status = statusMatch ? statusMatch[1].trim() : null;

  return {
    id: riskId,
    name,
    category,
    likelihood,
    impact,
    score,
    hasMitigation,
    owner,
    status,
  };
}

function validateInventory(content: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    statistics: {},
  };

  function addError(msg: string): void {
    result.errors.push(msg);
    result.valid = false;
  }

  for (const section of REQUIRED_SECTIONS) {
    const pattern = new RegExp(`##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    if (!pattern.test(content)) {
      addError(`Missing required section: ${section}`);
    }
  }

  if (!content.includes("**Project:**") && !content.includes("**Objective:**")) {
    addError("Project context missing: no project name or objective found");
  }

  if (!content.includes("**Date:**")) {
    result.warnings.push("Missing date field in header");
  }

  const risks: Risk[] = [];
  const riskPattern = /###\s+R\d+:.+?(?=###\s+R\d+:|##\s+|$)/gs;
  const riskMatches = content.match(riskPattern);

  if (riskMatches) {
    for (const match of riskMatches) {
      const risk = parseRiskEntry(match);
      if (risk) risks.push(risk);
    }
  }

  for (const risk of risks) {
    if (risk.score >= 8 && !risk.hasMitigation) {
      addError(`${risk.id} (score ${risk.score}) missing mitigation plan`);
    }

    if (risk.likelihood < 1 || risk.likelihood > 5) {
      addError(`${risk.id} has invalid likelihood: ${risk.likelihood}`);
    }

    if (risk.impact < 1 || risk.impact > 5) {
      addError(`${risk.id} has invalid impact: ${risk.impact}`);
    }

    const expectedScore = risk.likelihood * risk.impact;
    if (risk.score !== expectedScore) {
      result.warnings.push(
        `${risk.id} score mismatch: ${risk.score} != ${risk.likelihood} x ${risk.impact}`
      );
    }
  }

  const actionPattern = /\|\s*A\d+\s*\|/;
  if (!actionPattern.test(content)) {
    if (risks.some((r) => r.score >= 8)) {
      result.warnings.push("No action items defined for high-priority risks");
    }
  }

  result.statistics = {
    total_risks: risks.length,
    critical_count: risks.filter((r) => r.score >= 15).length,
    high_count: risks.filter((r) => r.score >= 8 && r.score < 15).length,
    medium_count: risks.filter((r) => r.score >= 4 && r.score < 8).length,
    low_count: risks.filter((r) => r.score < 4).length,
    average_score: risks.length > 0
      ? risks.reduce((sum, r) => sum + r.score, 0) / risks.length
      : 0,
    risks_with_mitigation: risks.filter((r) => r.hasMitigation).length,
    risks_with_owner: risks.filter((r) => r.owner !== null).length,
  };

  return result;
}

function printResult(result: ValidationResult): void {
  console.log("\n" + "=".repeat(60));
  console.log("PRE-MORTEM RISK INVENTORY VALIDATION");
  console.log("=".repeat(60));

  const status = result.valid ? "VALID" : "INVALID";
  console.log(`\nStatus: ${status}`);

  if (result.errors.length > 0) {
    console.log(`\nErrors (${result.errors.length}):`);
    for (const error of result.errors) {
      console.log(`  [ERROR] ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log(`\nWarnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      console.log(`  [WARN] ${warning}`);
    }
  }

  const s = result.statistics;
  if (Object.keys(s).length > 0) {
    console.log("\nRisk Statistics:");
    console.log(`  Total Risks: ${s["total_risks"]}`);
    console.log(`  Critical (15-25): ${s["critical_count"]}`);
    console.log(`  High (8-14): ${s["high_count"]}`);
    console.log(`  Medium (4-7): ${s["medium_count"]}`);
    console.log(`  Low (1-3): ${s["low_count"]}`);
    console.log(`  Average Score: ${s["average_score"].toFixed(1)}`);
    console.log(`  With Mitigation: ${s["risks_with_mitigation"]}`);
    console.log(`  With Owner: ${s["risks_with_owner"]}`);
  }

  console.log("\n" + "=".repeat(60));
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let inventoryPath = "";
  let quiet = false;
  let jsonOutput = false;

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--inventory-path": inventoryPath = argv[++i] ?? ""; break;
      case "--validate": break;
      case "--quiet": quiet = true; break;
      case "--json": jsonOutput = true; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run pre-mortem.ts --inventory-path <path> [--validate] [--quiet] [--json]");
        return 0;
    }
  }

  if (!inventoryPath) {
    console.error("ERROR: --inventory-path is required");
    return 1;
  }

  if (inventoryPath.includes("..")) {
    if (!quiet) {
      console.error(
        `Error: Path traversal attempt detected: '${inventoryPath}' contains prohibited '..' sequence.`
      );
    }
    return 1;
  }

  const resolvedPath = resolve(inventoryPath);
  if (!resolvedPath.startsWith(resolve("."))) {
    if (!quiet) {
      console.error(
        `Error: Path traversal attempt detected: '${inventoryPath}' resolves outside the working directory.`
      );
    }
    return 1;
  }

  if (!existsSync(resolvedPath)) {
    if (!quiet) {
      console.error(`Error: File not found: ${inventoryPath}`);
    }
    return 1;
  }

  let content: string;
  try {
    content = await Bun.file(resolvedPath).text();
  } catch (e) {
    if (!quiet) {
      console.error(`Error reading file: ${(e as Error).message}`);
    }
    return 1;
  }

  const result = validateInventory(content);

  if (jsonOutput) {
    console.log(JSON.stringify({
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
      statistics: result.statistics,
    }, null, 2));
  } else if (!quiet) {
    printResult(result);
  }

  return result.valid ? 0 : 10;
}

process.exit(await main());
