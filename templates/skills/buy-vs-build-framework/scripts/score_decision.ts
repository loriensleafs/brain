#!/usr/bin/env bun
/**
 * Calculate weighted decision scores with sensitivity analysis.
 *
 * Exit codes:
 *   0: Clear winner (>20% score gap)
 *   1: Tie requires human judgment (scores within 10%)
 */

import { resolve } from "path";

interface CriteriaFile {
  weights: Record<string, number>;
  options: Record<string, Record<string, Record<string, number>>>;
}

function validateCriteria(criteria: CriteriaFile): string[] {
  const errors: string[] = [];

  if (!criteria.weights) {
    errors.push("Missing 'weights' section in criteria file");
    return errors;
  }

  const totalWeight = Object.values(criteria.weights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(totalWeight - 100.0) > 0.01) {
    errors.push(`Weights must sum to 100%, got ${totalWeight}%`);
  }

  if (!criteria.options) {
    errors.push("Missing 'options' section in criteria file");
    return errors;
  }

  for (const option of Object.values(criteria.options)) {
    for (const category of Object.keys(criteria.weights)) {
      if (!(category in option)) {
        errors.push(`Option missing category: ${category}`);
      }
    }
  }

  return errors;
}

function calculateScores(criteria: CriteriaFile): Record<string, number> {
  const scores: Record<string, number> = {};

  for (const [optionName, optionScores] of Object.entries(criteria.options)) {
    let totalScore = 0;
    for (const [category, weight] of Object.entries(criteria.weights)) {
      const categoryValues = Object.values(optionScores[category]);
      const categoryScore = categoryValues.reduce((sum, v) => sum + v, 0) / categoryValues.length;
      totalScore += categoryScore * (weight / 100.0);
    }
    scores[optionName] = totalScore;
  }

  return scores;
}

function determineConfidence(scores: Record<string, number>): string {
  const sortedScores = Object.values(scores).sort((a, b) => b - a);
  if (sortedScores.length < 2) return "high";

  const gap = ((sortedScores[0] - sortedScores[1]) / sortedScores[0]) * 100;

  if (gap > 20) return "high";
  if (gap > 10) return "medium";
  return "low";
}

function runSensitivityAnalysis(
  criteria: CriteriaFile,
  baseScores: Record<string, number>
): Record<string, number> {
  const sensitivity: Record<string, number> = {};

  for (const category of Object.keys(criteria.weights)) {
    const testCriteria: CriteriaFile = JSON.parse(JSON.stringify(criteria));
    const originalWeight = testCriteria.weights[category];

    testCriteria.weights[category] = originalWeight * 1.2;
    const remaining = 100 - testCriteria.weights[category];

    for (const otherCategory of Object.keys(testCriteria.weights)) {
      if (otherCategory !== category) {
        const proportion = testCriteria.weights[otherCategory] / (100 - originalWeight);
        testCriteria.weights[otherCategory] = remaining * proportion;
      }
    }

    const newScores = calculateScores(testCriteria);
    let maxDelta = 0;
    for (const opt of Object.keys(baseScores)) {
      maxDelta = Math.max(maxDelta, Math.abs(newScores[opt] - baseScores[opt]));
    }
    sensitivity[category] = maxDelta;
  }

  return sensitivity;
}

function validatePathNoTraversal(inputPath: string): string {
  const allowedBase = resolve(".");
  const resolvedPath = resolve(inputPath);
  if (!resolvedPath.startsWith(allowedBase)) {
    throw new Error(`Path traversal attempt detected in: ${inputPath}`);
  }
  return resolvedPath;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  let criteriaFilePath = "";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--criteria-file") {
      criteriaFilePath = argv[++i] ?? "";
    } else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("Usage: bun run score_decision.ts --criteria-file <path>");
      return 0;
    }
  }

  if (!criteriaFilePath) {
    console.error("ERROR: --criteria-file is required");
    return 11;
  }

  let resolvedPath: string;
  try {
    resolvedPath = validatePathNoTraversal(criteriaFilePath);
  } catch (e) {
    console.error(`ERROR: ${(e as Error).message}`);
    return 1;
  }

  const bunFile = Bun.file(resolvedPath);
  if (!(await bunFile.exists())) {
    console.error(`ERROR: Criteria file not found: ${criteriaFilePath}`);
    return 11;
  }

  let criteria: CriteriaFile;
  try {
    const text = await bunFile.text();
    criteria = JSON.parse(text);
  } catch (e) {
    console.error(`ERROR: Invalid JSON in criteria file: ${(e as Error).message}`);
    return 11;
  }

  const errors = validateCriteria(criteria);
  if (errors.length > 0) {
    console.error("ERROR: Validation failed");
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    return 11;
  }

  const scores = calculateScores(criteria);
  const winner = Object.entries(scores).reduce((max, curr) =>
    curr[1] > max[1] ? curr : max
  )[0];
  const confidence = determineConfidence(scores);

  const sensitivity = runSensitivityAnalysis(criteria, scores);

  console.log("Decision Matrix Scores");
  console.log("=".repeat(60));
  const sortedEntries = Object.entries(scores).sort(([, a], [, b]) => b - a);
  for (const [option, score] of sortedEntries) {
    const name = option.charAt(0).toUpperCase() + option.slice(1);
    console.log(`${name.padEnd(12)} ${score.toFixed(1)}`);
  }
  console.log("");
  console.log(`Winner:     ${winner.charAt(0).toUpperCase() + winner.slice(1)}`);
  console.log(`Confidence: ${confidence.toUpperCase()}`);
  console.log("");
  console.log("Sensitivity Analysis (+/-20% weight)");
  const sortedSensitivity = Object.entries(sensitivity).sort(([, a], [, b]) => b - a);
  for (const [category, delta] of sortedSensitivity) {
    console.log(`  ${category.padEnd(12)} +/-${delta.toFixed(1)} points`);
  }

  if (confidence === "low") {
    console.log("\nNOTE: Low confidence (scores within 10%) - human judgment required");
    return 1;
  }

  return 0;
}

process.exit(await main());
