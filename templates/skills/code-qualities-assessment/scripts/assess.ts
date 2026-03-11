#!/usr/bin/env bun
/**
 * Code Qualities Assessment - Main Orchestrator
 *
 * Assesses code maintainability using 5 foundational qualities:
 * - Cohesion
 * - Coupling
 * - Encapsulation
 * - Testability
 * - Non-Redundancy
 *
 * Exit codes:
 *   0: Assessment complete, all thresholds met
 *   10: Quality degraded vs previous run
 *   11: Quality below configured thresholds
 *   1: Script error
 */

import { resolve, extname } from "path";
import { Glob } from "bun";

interface QualityScore {
  value: number; // 1-10
  confidence: number; // 0-1
  reasons: string[];
}

interface FileAssessment {
  filePath: string;
  cohesion: QualityScore;
  coupling: QualityScore;
  encapsulation: QualityScore;
  testability: QualityScore;
  nonRedundancy: QualityScore;
  overall: number;
}

interface Config {
  thresholds: {
    cohesion: { min: number; warn: number };
    coupling: { max: number; warn: number };
    encapsulation: { min: number; warn: number };
    testability: { min: number; warn: number };
    nonRedundancy: { min: number; warn: number };
    [key: string]: { min?: number; max?: number; warn: number };
  };
  context: Record<string, Record<string, { min?: number; max?: number }>>;
  ignore: string[];
}

const DEFAULT_CONFIG: Config = {
  thresholds: {
    cohesion: { min: 7, warn: 5 },
    coupling: { max: 3, warn: 5 },
    encapsulation: { min: 7, warn: 5 },
    testability: { min: 6, warn: 4 },
    nonRedundancy: { min: 8, warn: 6 },
  },
  context: {
    test: { testability: { min: 3 } },
  },
  ignore: ["**/generated/**", "**/*.pb.ts"],
};

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".cs", ".java", ".go"]);

async function loadConfig(configPath: string): Promise<Config> {
  const file = Bun.file(configPath);
  if (await file.exists()) {
    return (await file.json()) as Config;
  }
  return DEFAULT_CONFIG;
}

async function getFilesToAssess(target: string, changedOnly: boolean): Promise<string[]> {
  if (changedOnly) {
    const proc = Bun.spawn(["git", "diff", "--name-only", "HEAD"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    await proc.exited;
    return output
      .trim()
      .split("\n")
      .filter((f) => f && CODE_EXTENSIONS.has(extname(f)));
  }

  const targetPath = resolve(target);
  const file = Bun.file(targetPath);

  // Single file
  const stat = await file.exists();
  if (stat && !targetPath.endsWith("/")) {
    try {
      // Check if it's a file (not directory) by trying to get size
      if (file.size !== undefined && file.size >= 0) {
        return [targetPath];
      }
    } catch {
      // Fall through to directory handling
    }
  }

  // Directory or glob
  const files: string[] = [];
  for (const ext of CODE_EXTENSIONS) {
    const glob = new Glob(`**/*${ext}`);
    for await (const match of glob.scan({ cwd: targetPath, absolute: true })) {
      files.push(match);
    }
  }
  return files;
}

async function assessFile(filePath: string, context: string): Promise<FileAssessment> {
  const file = Bun.file(filePath);
  let lines: string[] = [];
  let loc = 0;

  try {
    const content = await file.text();
    lines = content.split("\n");
    loc = lines.filter((line) => line.trim() && !line.trim().startsWith("//") && !line.trim().startsWith("#")).length;
  } catch {
    loc = 0;
  }

  // Cohesion: penalize large files (likely low cohesion)
  const cohesionScore = Math.max(1, Math.min(10, 10 - loc / 100));

  // Coupling: heuristic based on imports
  const importCount = lines.filter((line) => /^\s*(import |from |require\()/.test(line)).length;
  const couplingScore = Math.max(1, Math.min(10, 10 - importCount));

  // Encapsulation: check for private vs public
  const publicMethods = lines.filter(
    (line) => /\b(function |def |public )/.test(line) && !/\b(private |protected |_\w)/.test(line)
  ).length;
  const privateMethods = lines.filter(
    (line) => /\b(private |protected |#|_\w+\s*\()/.test(line)
  ).length;
  const encapScore =
    publicMethods + privateMethods > 0
      ? (privateMethods / (publicMethods + privateMethods)) * 10
      : 10;

  // Testability: check for global state, hard-coded values
  const globalVars = lines.filter((line) => /^\s*(global |var |let )\w/.test(line) && !/^\s*(const |readonly )/.test(line)).length;
  const testabilityScore = Math.max(1, 10 - globalVars * 2);

  // Non-redundancy: basic duplication check
  const strippedLines = lines.filter((line) => line.trim()).map((line) => line.trim());
  const uniqueLines = new Set(strippedLines).size;
  const redundancyScore = lines.length > 0 ? (uniqueLines / lines.length) * 10 : 10;

  const overall =
    (cohesionScore + couplingScore + encapScore + testabilityScore + redundancyScore) / 5;

  return {
    filePath,
    cohesion: {
      value: Math.round(cohesionScore * 10) / 10,
      confidence: 0.7,
      reasons: [
        `File has ${loc} LOC`,
        loc > 200 ? "Large files often indicate low cohesion" : "File size is reasonable",
      ],
    },
    coupling: {
      value: Math.round(couplingScore * 10) / 10,
      confidence: 0.6,
      reasons: [
        `File has ${importCount} imports`,
        importCount > 10
          ? "High import count suggests high coupling"
          : "Import count is reasonable",
      ],
    },
    encapsulation: {
      value: Math.round(encapScore * 10) / 10,
      confidence: 0.8,
      reasons: [
        `${privateMethods} private methods, ${publicMethods} public methods`,
        encapScore > 7 ? "Good balance of private vs public" : "Too many public methods",
      ],
    },
    testability: {
      value: Math.round(testabilityScore * 10) / 10,
      confidence: 0.7,
      reasons: [
        `Found ${globalVars} mutable variable declarations`,
        globalVars > 0 ? "Mutable state hinders testability" : "No mutable global state detected",
      ],
    },
    nonRedundancy: {
      value: Math.round(redundancyScore * 10) / 10,
      confidence: 0.5,
      reasons: [
        `${uniqueLines}/${lines.length} unique lines`,
        redundancyScore < 7 ? "High duplication detected" : "Low duplication",
      ],
    },
    overall: Math.round(overall * 10) / 10,
  };
}

function generateMarkdownReport(assessments: FileAssessment[], config: Config): string {
  if (assessments.length === 0) return "No files assessed.";

  const report: string[] = ["# Code Quality Assessment Report\n"];

  const avgCohesion = assessments.reduce((s, a) => s + a.cohesion.value, 0) / assessments.length;
  const avgCoupling = assessments.reduce((s, a) => s + a.coupling.value, 0) / assessments.length;
  const avgEncap = assessments.reduce((s, a) => s + a.encapsulation.value, 0) / assessments.length;
  const avgTest = assessments.reduce((s, a) => s + a.testability.value, 0) / assessments.length;
  const avgNonred = assessments.reduce((s, a) => s + a.nonRedundancy.value, 0) / assessments.length;

  report.push("## Summary\n");
  report.push(`**Files Assessed**: ${assessments.length}\n`);
  report.push(`**Average Cohesion**: ${avgCohesion.toFixed(1)}/10`);
  report.push(`**Average Coupling**: ${avgCoupling.toFixed(1)}/10`);
  report.push(`**Average Encapsulation**: ${avgEncap.toFixed(1)}/10`);
  report.push(`**Average Testability**: ${avgTest.toFixed(1)}/10`);
  report.push(`**Average Non-Redundancy**: ${avgNonred.toFixed(1)}/10\n`);

  report.push("## File Assessments\n");
  for (const assessment of assessments.sort((a, b) => a.overall - b.overall)) {
    report.push(`### ${assessment.filePath}\n`);
    report.push(`**Overall**: ${assessment.overall}/10\n`);
    report.push(`- **Cohesion**: ${assessment.cohesion.value}/10`);
    report.push(`- **Coupling**: ${assessment.coupling.value}/10`);
    report.push(`- **Encapsulation**: ${assessment.encapsulation.value}/10`);
    report.push(`- **Testability**: ${assessment.testability.value}/10`);
    report.push(`- **Non-Redundancy**: ${assessment.nonRedundancy.value}/10\n`);

    if (assessment.cohesion.value < 7) {
      report.push("**Cohesion Issues**:");
      for (const reason of assessment.cohesion.reasons) {
        report.push(`  - ${reason}`);
      }
      report.push("");
    }

    if (assessment.coupling.value < 7) {
      report.push("**Coupling Issues**:");
      for (const reason of assessment.coupling.reasons) {
        report.push(`  - ${reason}`);
      }
      report.push("");
    }
  }

  return report.join("\n");
}

function generateJsonReport(assessments: FileAssessment[]): string {
  const count = assessments.length || 1;
  return JSON.stringify(
    {
      files: assessments,
      summary: {
        fileCount: assessments.length,
        averageScores: {
          cohesion: assessments.reduce((s, a) => s + a.cohesion.value, 0) / count,
          coupling: assessments.reduce((s, a) => s + a.coupling.value, 0) / count,
          encapsulation: assessments.reduce((s, a) => s + a.encapsulation.value, 0) / count,
          testability: assessments.reduce((s, a) => s + a.testability.value, 0) / count,
          nonRedundancy: assessments.reduce((s, a) => s + a.nonRedundancy.value, 0) / count,
        },
      },
    },
    null,
    2
  );
}

function checkThresholds(assessments: FileAssessment[], config: Config, context: string): number {
  const thresholds = { ...config.thresholds };

  if (context in (config.context ?? {})) {
    Object.assign(thresholds, config.context[context]);
  }

  for (const assessment of assessments) {
    if (assessment.cohesion.value < (thresholds.cohesion?.min ?? 7)) {
      console.error(
        `[FAIL] ${assessment.filePath}: Cohesion ${assessment.cohesion.value} < ${thresholds.cohesion?.min ?? 7}`
      );
      return 11;
    }
    if (assessment.coupling.value > (thresholds.coupling?.max ?? 3)) {
      console.error(
        `[FAIL] ${assessment.filePath}: Coupling ${assessment.coupling.value} > ${thresholds.coupling?.max ?? 3}`
      );
      return 11;
    }
    if (assessment.encapsulation.value < (thresholds.encapsulation?.min ?? 7)) {
      console.error(
        `[FAIL] ${assessment.filePath}: Encapsulation ${assessment.encapsulation.value} < ${thresholds.encapsulation?.min ?? 7}`
      );
      return 11;
    }
    if (assessment.testability.value < (thresholds.testability?.min ?? 6)) {
      console.error(
        `[FAIL] ${assessment.filePath}: Testability ${assessment.testability.value} < ${thresholds.testability?.min ?? 6}`
      );
      return 11;
    }
    if (assessment.nonRedundancy.value < (thresholds.nonRedundancy?.min ?? 8)) {
      console.error(
        `[FAIL] ${assessment.filePath}: Non-Redundancy ${assessment.nonRedundancy.value} < ${thresholds.nonRedundancy?.min ?? 8}`
      );
      return 11;
    }
  }

  return 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage: bun run assess.ts --target <path> [options]");
    console.log("\nOptions:");
    console.log("  --target <path>        File, directory, or glob pattern to assess");
    console.log("  --context <type>       production, test, or generated (default: production)");
    console.log("  --changed-only         Only assess changed files (git diff)");
    console.log("  --format <fmt>         markdown, json (default: markdown)");
    console.log("  --config <path>        Path to .qualityrc.json (default: .qualityrc.json)");
    console.log("  --output <path>        Output file path (default: stdout)");
    return 0;
  }

  let target = "";
  let context = "production";
  let changedOnly = false;
  let format = "markdown";
  let configPath = ".qualityrc.json";
  let outputPath = "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--target":
        target = args[++i] ?? "";
        break;
      case "--context":
        context = args[++i] ?? "production";
        break;
      case "--changed-only":
        changedOnly = true;
        break;
      case "--format":
        format = args[++i] ?? "markdown";
        break;
      case "--config":
        configPath = args[++i] ?? ".qualityrc.json";
        break;
      case "--output":
        outputPath = args[++i] ?? "";
        break;
    }
  }

  if (!target) {
    console.error("ERROR: --target is required");
    return 1;
  }

  // Validate target path to prevent path traversal (CWE-22)
  const allowedBase = resolve(".");
  const targetPath = resolve(target);
  if (!targetPath.startsWith(allowedBase)) {
    console.error(`ERROR: Path traversal attempt detected in --target: ${target}`);
    return 1;
  }

  const config = await loadConfig(configPath);

  let files: string[];
  try {
    files = await getFilesToAssess(targetPath, changedOnly);
  } catch (e) {
    console.error(`Error getting files: ${e}`);
    return 1;
  }

  if (files.length === 0) {
    console.error("No files to assess");
    return 1;
  }

  const assessments: FileAssessment[] = [];
  for (const filePath of files) {
    try {
      const assessment = await assessFile(filePath, context);
      assessments.push(assessment);
    } catch (e) {
      console.error(`Error assessing ${filePath}: ${e}`);
    }
  }

  let report: string;
  if (format === "json") {
    report = generateJsonReport(assessments);
  } else {
    report = generateMarkdownReport(assessments, config);
  }

  if (outputPath) {
    await Bun.write(outputPath, report);
    console.log(`Report written to ${outputPath}`);
  } else {
    console.log(report);
  }

  return checkThresholds(assessments, config, context);
}

process.exit(await main());
