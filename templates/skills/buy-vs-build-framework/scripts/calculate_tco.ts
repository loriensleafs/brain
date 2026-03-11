#!/usr/bin/env bun
/**
 * Calculate Total Cost of Ownership (TCO) for Build/Buy/Partner decisions.
 *
 * Realistic TCO includes hidden costs that grow over time:
 * - Engineer salary (fully-loaded with benefits, facilities, etc.)
 * - Maintenance overhead (security patches, dependency updates, compliance)
 * - Maintenance expansion (overhead grows ~10-20% yearly as systems mature)
 * - Code churn drag (40-60% of code changes yearly = unplanned "side quests")
 *
 * Exit codes:
 *   0: Success
 *   1: Error (invalid inputs)
 *   2: Warning (negative NPV detected - you lose money on all options)
 */

interface TCOResult {
  npvBuild: number;
  npvBuy: number;
  npvPartner: number;
  irrBuild: number;
  breakevenYears: number;
  sensitivity: Record<string, number>;
  warning: string;
}

interface ParsedArgs {
  discountRate: number;
  years: number;
  buildInitial: number;
  buildOngoing: number | null;
  engineerCost: number | null;
  maintenanceHours: number;
  maintenanceGrowth: number;
  codeChurnRate: number;
  buyInitial: number;
  buyOngoing: number;
  partnerInitial: number;
  partnerOngoing: number;
}

function calculateRealisticBuildCost(
  engineerCost: number,
  maintenanceHours: number,
  maintenanceGrowth: number,
  codeChurnRate: number,
  year: number
): number {
  const baseCost = engineerCost;
  const hourlyRate = engineerCost / 2080;
  const maintenanceCost =
    maintenanceHours * hourlyRate * maintenanceGrowth ** (year - 1);
  const churnDrag = engineerCost * codeChurnRate * 0.3;
  return baseCost + maintenanceCost + churnDrag;
}

function calculateNpv(
  initialCost: number,
  ongoingCost: number,
  discountRate: number,
  years: number
): number {
  let npv = -initialCost;
  for (let year = 1; year <= years; year++) {
    npv += ongoingCost / (1 + discountRate) ** year;
  }
  return -npv;
}

function calculateIrr(
  initialCost: number,
  ongoingCost: number,
  years: number,
  iterations: number = 100
): number {
  let low = -0.99;
  let high = 1.0;
  let mid = 0;

  for (let i = 0; i < iterations; i++) {
    mid = (low + high) / 2;
    const npv = calculateNpv(initialCost, ongoingCost, mid, years);

    if (Math.abs(npv) < 0.01) return mid;
    if (npv > 0) low = mid;
    else high = mid;
  }

  return mid;
}

function calculateBreakeven(
  buildInitial: number,
  buildOngoing: number,
  buyInitial: number,
  buyOngoing: number,
  discountRate: number,
  maxYears: number = 20
): number {
  for (let year = 1; year <= maxYears; year++) {
    const npvBuild = calculateNpv(buildInitial, buildOngoing, discountRate, year);
    const npvBuy = calculateNpv(buyInitial, buyOngoing, discountRate, year);

    if (npvBuild < npvBuy) {
      if (year === 1) return 1.0;
      const prevYear = year - 1;
      const npvBuildPrev = calculateNpv(buildInitial, buildOngoing, discountRate, prevYear);
      const npvBuyPrev = calculateNpv(buyInitial, buyOngoing, discountRate, prevYear);

      const diff = npvBuy - npvBuild;
      if (diff !== 0) {
        const denominator = diff + (npvBuyPrev - npvBuildPrev);
        const fraction = (npvBuyPrev - npvBuildPrev) / denominator;
        return prevYear + fraction;
      }
      return year;
    }
  }

  return maxYears;
}

function sensitivityAnalysis(
  avgBuildCost: number,
  args: ParsedArgs
): Record<string, number> {
  const sensitivity: Record<string, number> = {};

  const rateLow = args.discountRate * 0.8;
  const rateHigh = args.discountRate * 1.2;
  const npvBuildLow = calculateNpv(args.buildInitial, avgBuildCost, rateLow, args.years);
  const npvBuildHigh = calculateNpv(args.buildInitial, avgBuildCost, rateHigh, args.years);
  sensitivity["discount_rate"] = Math.abs(npvBuildHigh - npvBuildLow);

  const costLow = avgBuildCost * 0.8;
  const costHigh = avgBuildCost * 1.2;
  const npvCostLow = calculateNpv(args.buildInitial, costLow, args.discountRate, args.years);
  const npvCostHigh = calculateNpv(args.buildInitial, costHigh, args.discountRate, args.years);
  sensitivity["ongoing_cost"] = Math.abs(npvCostHigh - npvCostLow);

  return sensitivity;
}

function validateInputs(args: ParsedArgs): string[] {
  const errors: string[] = [];

  if (args.buildInitial < 0) errors.push("Build initial cost cannot be negative");
  if (args.buyInitial < 0) errors.push("Buy initial cost cannot be negative");
  if (args.buyOngoing < 0) errors.push("Buy ongoing cost cannot be negative");
  if (args.discountRate <= 0 || args.discountRate >= 1)
    errors.push("Discount rate must be between 0 and 1 (0.10 = 10%)");
  if (![3, 5, 10].includes(args.years))
    errors.push("Years must be 3, 5, or 10");

  if (args.buildOngoing !== null && args.buildOngoing < 0)
    errors.push("Build ongoing cost cannot be negative");

  if (args.engineerCost !== null) {
    if (args.engineerCost < 50000)
      errors.push("Engineer cost seems low (< $50K/year) - did you mean $50,000 not 50?");
    if (args.engineerCost > 1000000)
      errors.push("Engineer cost seems high (> $1M/year) - check your input");
  }

  if (args.maintenanceHours < 0 || args.maintenanceHours > 2080)
    errors.push("Maintenance hours must be 0-2080 (0-100% of work year)");
  if (args.maintenanceGrowth < 0.5 || args.maintenanceGrowth > 2.0)
    errors.push("Maintenance growth must be 0.5-2.0 (50%-200% yearly growth)");
  if (args.codeChurnRate < 0 || args.codeChurnRate > 1.0)
    errors.push("Code churn rate must be 0.0-1.0 (0%-100% of code changes/year)");

  if (args.partnerInitial < 0) errors.push("Partner initial cost cannot be negative");
  if (args.partnerOngoing < 0) errors.push("Partner ongoing cost cannot be negative");

  return errors;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    discountRate: 0,
    years: 0,
    buildInitial: 0,
    buildOngoing: null,
    engineerCost: null,
    maintenanceHours: 0,
    maintenanceGrowth: 1.0,
    codeChurnRate: 0.0,
    buyInitial: 0,
    buyOngoing: 0,
    partnerInitial: 0,
    partnerOngoing: 0,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    switch (flag) {
      case "--discount-rate": args.discountRate = parseFloat(val); i++; break;
      case "--years": args.years = parseInt(val, 10); i++; break;
      case "--build-initial": args.buildInitial = parseFloat(val); i++; break;
      case "--build-ongoing": args.buildOngoing = parseFloat(val); i++; break;
      case "--engineer-cost": args.engineerCost = parseFloat(val); i++; break;
      case "--maintenance-hours": args.maintenanceHours = parseFloat(val); i++; break;
      case "--maintenance-growth": args.maintenanceGrowth = parseFloat(val); i++; break;
      case "--code-churn-rate": args.codeChurnRate = parseFloat(val); i++; break;
      case "--buy-initial": args.buyInitial = parseFloat(val); i++; break;
      case "--buy-ongoing": args.buyOngoing = parseFloat(val); i++; break;
      case "--partner-initial": args.partnerInitial = parseFloat(val); i++; break;
      case "--partner-ongoing": args.partnerOngoing = parseFloat(val); i++; break;
      case "--help":
      case "-h":
        console.log("Usage: bun run calculate_tco.ts --discount-rate <rate> --years <3|5|10> ...");
        process.exit(0);
    }
  }

  return args;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));

  let mode: string;
  let npvBuild: number;
  let avgBuildCost: number;
  let buildYearlyCosts: number[] | null = null;

  if (args.engineerCost !== null) {
    mode = "REALISTIC";
    if (args.buildOngoing !== null) {
      console.error("ERROR: Cannot use both --build-ongoing (simple) and --engineer-cost (realistic)");
      console.error("       Choose ONE mode: simple OR realistic");
      return 1;
    }

    buildYearlyCosts = [];
    for (let year = 1; year <= args.years; year++) {
      const yearlyCost = calculateRealisticBuildCost(
        args.engineerCost,
        args.maintenanceHours,
        args.maintenanceGrowth,
        args.codeChurnRate,
        year
      );
      buildYearlyCosts.push(yearlyCost);
    }

    npvBuild = -args.buildInitial;
    for (let year = 0; year < buildYearlyCosts.length; year++) {
      npvBuild -= buildYearlyCosts[year] / (1 + args.discountRate) ** (year + 1);
    }

    avgBuildCost = buildYearlyCosts.reduce((a, b) => a + b, 0) / buildYearlyCosts.length;
  } else if (args.buildOngoing !== null) {
    mode = "SIMPLE";
    npvBuild = calculateNpv(args.buildInitial, args.buildOngoing, args.discountRate, args.years);
    avgBuildCost = args.buildOngoing;
  } else {
    console.error("ERROR: Must provide EITHER --build-ongoing (simple) OR --engineer-cost (realistic)");
    console.error("       See --help for examples");
    return 1;
  }

  const errors = validateInputs(args);
  if (errors.length > 0) {
    console.error("ERROR: Validation failed");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }

  const npvBuy = calculateNpv(args.buyInitial, args.buyOngoing, args.discountRate, args.years);
  const npvPartner = calculateNpv(args.partnerInitial, args.partnerOngoing, args.discountRate, args.years);
  const irrBuild = calculateIrr(args.buildInitial, avgBuildCost, args.years);
  const breakeven = calculateBreakeven(
    args.buildInitial, avgBuildCost,
    args.buyInitial, args.buyOngoing,
    args.discountRate
  );

  const result: TCOResult = {
    npvBuild,
    npvBuy,
    npvPartner,
    irrBuild,
    breakevenYears: breakeven,
    sensitivity: sensitivityAnalysis(avgBuildCost, args),
    warning: "",
  };

  if (npvBuild > 0 || npvBuy > 0 || npvPartner > 0) {
    result.warning = "Negative NPV detected (costs exceed discounted value)";
  }

  console.log("=".repeat(80));
  console.log(`TCO Analysis (${args.years} year horizon) - ${mode} MODE`);
  console.log("=".repeat(80));
  console.log("");
  console.log("COSTS (in today's dollars):");
  console.log(`  Build:   $${formatCurrency(Math.abs(result.npvBuild)).padStart(15)}`);
  console.log(`  Buy:     $${formatCurrency(Math.abs(result.npvBuy)).padStart(15)}`);
  if (args.partnerOngoing > 0) {
    console.log(`  Partner: $${formatCurrency(Math.abs(result.npvPartner)).padStart(15)}`);
  }
  console.log("");

  const costs: [string, number][] = [
    ["Build", Math.abs(result.npvBuild)],
    ["Buy", Math.abs(result.npvBuy)],
  ];
  if (args.partnerOngoing > 0) {
    costs.push(["Partner", Math.abs(result.npvPartner)]);
  }

  const winner = costs.reduce((min, curr) => (curr[1] < min[1] ? curr : min));
  console.log(`RECOMMENDATION: ${winner[0]} ($${formatCurrency(winner[1])} total cost)`);
  console.log("");

  if (mode === "REALISTIC" && buildYearlyCosts) {
    console.log("BUILD COST BREAKDOWN:");
    for (let year = 0; year < buildYearlyCosts.length; year++) {
      console.log(`  Year ${year + 1}: $${formatCurrency(buildYearlyCosts[year]).padStart(10)}`);
    }
    console.log(`  Average: $${formatCurrency(avgBuildCost).padStart(10)}/year`);
    console.log("");
  }

  console.log("FINANCIAL METRICS:");
  console.log(`  IRR (Build):         ${(result.irrBuild * 100).toFixed(1).padStart(6)}%`);
  console.log(`  Break-even vs Buy:   Year ${result.breakevenYears.toFixed(1)}`);
  if (result.breakevenYears > args.years) {
    console.log("                       Break-even AFTER analysis horizon");
    console.log(`                       > Buy wins (cheaper over ${args.years} years)`);
  }
  console.log("");

  console.log("SENSITIVITY ANALYSIS (+/-20%):");
  console.log(`  Discount rate swing: +/-$${Math.round(result.sensitivity["discount_rate"]).toLocaleString()}`);
  console.log(`  Ongoing cost swing:  +/-$${Math.round(result.sensitivity["ongoing_cost"]).toLocaleString()}`);
  console.log("");

  console.log("WHAT THIS MEANS:");
  const npvDiff = Math.abs(result.npvBuild) - Math.abs(result.npvBuy);
  if (Math.abs(npvDiff) < 100000) {
    console.log("  - Costs are SIMILAR - decision should be based on strategic factors");
    console.log("    (core vs context, team capability, vendor risk)");
  } else if (npvDiff > 0) {
    console.log(`  - Buy saves $${Math.abs(npvDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })} over ${args.years} years`);
    console.log("  - Strong financial case for buying");
  } else {
    console.log(`  - Build saves $${Math.abs(npvDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })} over ${args.years} years`);
    console.log("  - Financial case for building (if you have the time)");
  }

  if (result.warning) {
    console.log(`\nWARNING: ${result.warning}`);
    return 2;
  }

  return 0;
}

process.exit(main());
