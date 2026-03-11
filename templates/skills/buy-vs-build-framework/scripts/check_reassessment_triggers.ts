#!/usr/bin/env bun
/**
 * Detect assumption drift and recommend re-evaluation.
 *
 * Exit codes:
 *   0: Assumptions hold, stay course
 *   1: Error (file not found or invalid JSON)
 *   2: Minor drift (<20%), monitor closely
 *   3: Major drift (>20%), re-evaluation required
 */

import { resolve } from "path";

interface CurrentState {
  costs?: number[];
  time_horizon_years?: number;
  strategic_priority_changed?: boolean;
  vendor_viability_concerns?: boolean;
  team_capacity_changed?: boolean;
  competitive_dynamics_shifted?: boolean;
  regulatory_changes?: boolean;
  technology_disruption?: boolean;
  customer_demand_signal?: boolean;
}

interface OriginalAssumptions {
  decision_type?: string;
  costs?: number[];
  time_horizon_years?: number;
}

function parseAdr(content: string): OriginalAssumptions {
  const assumptions: OriginalAssumptions = {};

  const decisionMatch = content.match(
    /##\s+Decision\s+We will (BUILD|BUY|PARTNER|DEFER)/i
  );
  if (decisionMatch) {
    assumptions.decision_type = decisionMatch[1].toLowerCase();
  }

  const tcoMatches = content.match(/\$([0-9,]+)/g);
  if (tcoMatches) {
    assumptions.costs = tcoMatches.map((m) =>
      parseInt(m.replace(/[$,]/g, ""), 10)
    );
  }

  const horizonMatch = content.match(/(\d+)\s*year/i);
  if (horizonMatch) {
    assumptions.time_horizon_years = parseInt(horizonMatch[1], 10);
  }

  return assumptions;
}

function calculateDrift(
  original: OriginalAssumptions,
  current: CurrentState
): Record<string, number> {
  const drift: Record<string, number> = {};

  if (original.costs && current.costs) {
    const origTotal = original.costs.reduce((a, b) => a + b, 0);
    const currTotal = current.costs.reduce((a, b) => a + b, 0);
    if (origTotal > 0) {
      drift["cost"] = (Math.abs(currTotal - origTotal) / origTotal) * 100;
    }
  }

  if (
    original.time_horizon_years !== undefined &&
    current.time_horizon_years !== undefined
  ) {
    const origHorizon = original.time_horizon_years;
    const currHorizon = current.time_horizon_years;
    if (origHorizon > 0) {
      drift["time_horizon"] =
        (Math.abs(currHorizon - origHorizon) / origHorizon) * 100;
    }
  }

  if (current.strategic_priority_changed !== undefined) {
    drift["strategic_priority"] = current.strategic_priority_changed ? 100 : 0;
  }
  if (current.vendor_viability_concerns !== undefined) {
    drift["vendor_viability"] = current.vendor_viability_concerns ? 100 : 0;
  }
  if (current.team_capacity_changed !== undefined) {
    drift["team_capacity"] = current.team_capacity_changed ? 100 : 0;
  }

  return drift;
}

function checkTriggers(
  drift: Record<string, number>,
  current: CurrentState
): string[] {
  const triggered: string[] = [];

  if (drift["cost"] !== undefined && drift["cost"] > 20) {
    triggered.push(`Cost assumption changed ${drift["cost"].toFixed(1)}% (trigger: >20%)`);
  }
  if (drift["time_horizon"] !== undefined && drift["time_horizon"] > 20) {
    triggered.push(
      `Time horizon shifted ${drift["time_horizon"].toFixed(1)}% (trigger: material shift)`
    );
  }
  if (drift["strategic_priority"] !== undefined && drift["strategic_priority"] > 0) {
    triggered.push("Strategic priority shifted (core <-> context)");
  }
  if (drift["vendor_viability"] !== undefined && drift["vendor_viability"] > 0) {
    triggered.push("Vendor viability concerns detected (M&A, financials, EOL)");
  }
  if (drift["team_capacity"] !== undefined && drift["team_capacity"] > 0) {
    triggered.push("Team capacity changed (key departures or hiring surge)");
  }
  if (current.competitive_dynamics_shifted) {
    triggered.push("Competitive dynamics shifted (urgency increased)");
  }
  if (current.regulatory_changes) {
    triggered.push("Regulatory changes affect decision");
  }
  if (current.technology_disruption) {
    triggered.push("Technology disruption makes decision obsolete");
  }
  if (current.customer_demand_signal) {
    triggered.push("Customer demand signal changed");
  }

  return triggered;
}

function determineRecommendation(
  drift: Record<string, number>,
  triggered: string[]
): [string, number] {
  const values = Object.values(drift);
  const maxDrift = values.length > 0 ? Math.max(...values) : 0;

  if (triggered.length >= 3 || maxDrift > 20) {
    return ["Full re-evaluation required", 3];
  }
  if (triggered.length >= 1 || maxDrift > 10) {
    return ["Monitor closely, consider re-evaluation", 2];
  }
  return ["Assumptions hold, stay course", 0];
}

function validatePathNoTraversal(inputPath: string): string {
  const allowedBase = resolve(".");
  const resolvedPath = resolve(inputPath);
  if (!resolvedPath.startsWith(allowedBase)) {
    throw new Error(`Path traversal attempt detected: ${inputPath}`);
  }
  return resolvedPath;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let adrFile = "";
  let currentStateFile = "";

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--adr-file": adrFile = argv[++i] ?? ""; break;
      case "--current-state": currentStateFile = argv[++i] ?? ""; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run check_reassessment_triggers.ts --adr-file <path> --current-state <path>");
        return 0;
    }
  }

  if (!adrFile || !currentStateFile) {
    console.error("ERROR: Both --adr-file and --current-state are required");
    return 1;
  }

  let adrPath: string;
  let statePath: string;
  try {
    adrPath = validatePathNoTraversal(adrFile);
    statePath = validatePathNoTraversal(currentStateFile);
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    return 1;
  }

  const adrBunFile = Bun.file(adrPath);
  if (!(await adrBunFile.exists())) {
    console.error(`ERROR: ADR file not found: ${adrFile}`);
    return 1;
  }

  const adrContent = await adrBunFile.text();
  const original = parseAdr(adrContent);

  const stateBunFile = Bun.file(statePath);
  if (!(await stateBunFile.exists())) {
    console.error(`ERROR: Current state file not found: ${currentStateFile}`);
    return 1;
  }

  let current: CurrentState;
  try {
    const stateText = await stateBunFile.text();
    current = JSON.parse(stateText);
  } catch (e) {
    console.error(`ERROR: Invalid JSON in current state file: ${(e as Error).message}`);
    return 1;
  }

  const drift = calculateDrift(original, current);
  const triggered = checkTriggers(drift, current);
  const [recommendation, exitCode] = determineRecommendation(drift, triggered);

  console.log("Reassessment Trigger Analysis");
  console.log("=".repeat(60));
  console.log(`Original Decision: ${(original.decision_type ?? "Unknown").toUpperCase()}`);
  console.log("");
  console.log("Drift Analysis:");
  const sortedDrift = Object.entries(drift).sort(([, a], [, b]) => b - a);
  for (const [key, value] of sortedDrift) {
    console.log(`  ${key.padEnd(20)} ${value.toFixed(1)}%`);
  }
  console.log("");
  console.log(`Triggered Rules (${triggered.length}):`);
  for (const rule of triggered) {
    console.log(`  - ${rule}`);
  }
  console.log("");
  console.log(`Recommendation: ${recommendation}`);

  return exitCode;
}

process.exit(await main());
