#!/usr/bin/env bun
/**
 * Score vendor stability, pricing, feature fit, and support quality.
 *
 * Exit codes:
 *   0: Pass (score >70)
 *   10: Yellow flag (score 50-70)
 *   11: Red flag (score <50)
 */

import { resolve } from "path";

interface VendorData {
  years_in_business?: number;
  funding_status?: string;
  ma_risk?: string;
  market_position?: string;
  customer_count?: number;
  public_roadmap?: boolean;
  pricing_transparency?: string;
  pricing_model?: string;
  lock_in_cost?: string;
  core_feature_coverage_percent?: number;
  customization_options?: string;
}

interface VendorScore {
  vendorScore: number;
  riskFlags: string[];
  recommendation: string;
}

function scoreFinancialStability(data: VendorData): [number, string[]] {
  let score = 0;
  const flags: string[] = [];

  const years = data.years_in_business ?? 0;
  if (years >= 10) score += 10;
  else if (years >= 5) score += 7;
  else if (years >= 2) score += 4;
  else { flags.push(`Company young (${years} years), higher risk`); }

  const funding = data.funding_status ?? "";
  if (["profitable", "public"].includes(funding)) score += 10;
  else if (funding === "series_c_plus") score += 7;
  else if (["series_a", "series_b"].includes(funding)) score += 4;
  else { flags.push(`Funding unclear or early stage: ${funding}`); }

  const maRisk = data.ma_risk ?? "unknown";
  if (maRisk === "low") score += 5;
  else if (maRisk === "medium") score += 3;
  else { flags.push(`M&A risk: ${maRisk}`); }

  return [score, flags];
}

function scoreProductMaturity(data: VendorData): [number, string[]] {
  let score = 0;
  const flags: string[] = [];

  const position = data.market_position ?? "";
  if (position === "leader") score += 10;
  else if (position === "challenger") score += 7;
  else if (position === "niche") score += 4;
  else { flags.push(`Market position unclear: ${position}`); }

  const customers = data.customer_count ?? 0;
  if (customers >= 1000) score += 10;
  else if (customers >= 100) score += 7;
  else if (customers >= 10) score += 4;
  else { flags.push(`Few customers (${customers}), limited validation`); }

  if (data.public_roadmap) score += 5;
  else { flags.push("No public roadmap, hard to assess future direction"); }

  return [score, flags];
}

function scorePricingModel(data: VendorData): [number, string[]] {
  let score = 0;
  const flags: string[] = [];

  const transparency = data.pricing_transparency ?? "";
  if (transparency === "public") score += 10;
  else if (transparency === "quote_required") score += 5;
  else { flags.push(`Pricing opaque: ${transparency}`); }

  const model = data.pricing_model ?? "";
  if (["flat_rate", "per_seat"].includes(model)) score += 10;
  else if (model === "usage_based") score += 7;
  else { flags.push(`Pricing model unpredictable: ${model}`); score += 3; }

  const lockIn = data.lock_in_cost ?? "unknown";
  if (lockIn === "low") score += 5;
  else if (lockIn === "medium") score += 3;
  else { flags.push(`High lock-in cost or unknown: ${lockIn}`); }

  return [score, flags];
}

function scoreFeatureFit(data: VendorData): [number, string[]] {
  let score = 0;
  const flags: string[] = [];

  const coreCoverage = data.core_feature_coverage_percent ?? 0;
  if (coreCoverage >= 90) score += 15;
  else if (coreCoverage >= 75) score += 10;
  else if (coreCoverage >= 50) score += 5;
  else { flags.push(`Low core feature coverage: ${coreCoverage}%`); }

  const customization = data.customization_options ?? "";
  if (["api", "sdk"].includes(customization)) score += 10;
  else if (customization === "config_only") score += 5;
  else { flags.push(`Limited customization: ${customization}`); }

  return [score, flags];
}

function calculateVendorScore(data: VendorData): VendorScore {
  let totalScore = 0;
  const allFlags: string[] = [];

  const [stabilityScore, stabilityFlags] = scoreFinancialStability(data);
  totalScore += stabilityScore;
  allFlags.push(...stabilityFlags);

  const [maturityScore, maturityFlags] = scoreProductMaturity(data);
  totalScore += maturityScore;
  allFlags.push(...maturityFlags);

  const [pricingScore, pricingFlags] = scorePricingModel(data);
  totalScore += pricingScore;
  allFlags.push(...pricingFlags);

  const [featureScore, featureFlags] = scoreFeatureFit(data);
  totalScore += featureScore;
  allFlags.push(...featureFlags);

  let recommendation: string;
  if (totalScore > 70) {
    recommendation = "PASS - Vendor meets quality standards";
  } else if (totalScore >= 50) {
    recommendation = "YELLOW FLAG - Proceed with caution, mitigate risks";
  } else {
    recommendation = "RED FLAG - High risk, consider alternatives";
  }

  return { vendorScore: totalScore, riskFlags: allFlags, recommendation };
}

function validatePathNoTraversal(inputPath: string): string {
  const allowedBase = resolve(".");
  const resolvedPath = resolve(inputPath);
  if (!resolvedPath.startsWith(allowedBase)) {
    throw new Error(`Path traversal attempt detected in --vendor-data: ${inputPath}`);
  }
  return resolvedPath;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let vendorDataPath = "";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--vendor-data") {
      vendorDataPath = argv[++i] ?? "";
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: bun run score_vendor.ts --vendor-data <path>");
      return 0;
    }
  }

  if (!vendorDataPath) {
    console.error("ERROR: --vendor-data is required");
    return 11;
  }

  let resolvedPath: string;
  try {
    resolvedPath = validatePathNoTraversal(vendorDataPath);
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    return 1;
  }

  const bunFile = Bun.file(resolvedPath);
  if (!(await bunFile.exists())) {
    console.error(`ERROR: Vendor data file not found: ${vendorDataPath}`);
    return 11;
  }

  let data: VendorData;
  try {
    const text = await bunFile.text();
    data = JSON.parse(text);
  } catch (e) {
    console.error(`ERROR: Invalid JSON in vendor data file: ${(e as Error).message}`);
    return 11;
  }

  const result = calculateVendorScore(data);

  console.log("Vendor Scorecard");
  console.log("=".repeat(60));
  console.log(`Overall Score: ${result.vendorScore.toFixed(1)}/100`);
  console.log("");
  console.log(`Risk Flags (${result.riskFlags.length}):`);
  if (result.riskFlags.length > 0) {
    for (const flag of result.riskFlags) {
      console.log(`  - ${flag}`);
    }
  } else {
    console.log("  (none)");
  }
  console.log("");
  console.log(`Recommendation: ${result.recommendation}`);

  if (result.vendorScore > 70) return 0;
  if (result.vendorScore >= 50) return 10;
  return 11;
}

process.exit(await main());
