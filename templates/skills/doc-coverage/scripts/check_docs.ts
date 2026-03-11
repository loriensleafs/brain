#!/usr/bin/env bun
/**
 * Documentation Coverage Scanner
 *
 * Detects missing documentation in code (XML docs, docstrings, JSDoc)
 * and project files (CHANGELOG gaps).
 *
 * Exit Codes:
 *   0: Coverage meets threshold
 *   10: Coverage below threshold (gaps detected)
 *   1: Error (file not found, parse error)
 */

import { parseArgs } from "util";
import { resolve, extname, basename } from "path";
import { readFileSync, existsSync, statSync } from "fs";
import { spawnSync } from "child_process";

// --- Types ---

interface DocGap {
  file: string;
  line: number;
  symbol: string;
  type: string;
  missing: string[];
  language: string;
}

interface CoverageReport {
  totalSymbols: number;
  documentedSymbols: number;
  gaps: DocGap[];
  filesScanned: number;
  threshold: number;
}

interface Config {
  minCoveragePercent: number;
  checkPublicOnly: boolean;
  checkChangelog: boolean;
  excludePatterns: string[];
  languages: Record<string, Record<string, unknown>>;
}

// --- Config ---

function loadConfig(configPath?: string): Config {
  const defaultConfig: Config = {
    minCoveragePercent: 80,
    checkPublicOnly: true,
    checkChangelog: true,
    excludePatterns: [
      "**/tests/**", "**/test_*.py", "**/*.Tests.cs",
      "**/dist/**", "**/node_modules/**", "**/bin/**", "**/obj/**",
    ],
    languages: {
      csharp: { require_summary: true, require_param: true, require_returns: true },
      python: { style: "google", require_module_docstring: true },
      javascript: { require_jsdoc: true, require_param: true },
    },
  };

  const path = configPath ?? ".doccoveragerc.json";
  if (existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, "utf-8"));
      return {
        minCoveragePercent: data.min_coverage_percent ?? 80,
        checkPublicOnly: data.check_public_only ?? true,
        checkChangelog: data.check_changelog ?? true,
        excludePatterns: data.exclude_patterns ?? defaultConfig.excludePatterns,
        languages: data.languages ?? defaultConfig.languages,
      };
    } catch {
      // Fall through to default
    }
  }
  return defaultConfig;
}

// --- Exclusion ---

function shouldExclude(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const regex = pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
    if (new RegExp(regex).test(filePath)) return true;
  }
  return false;
}

// --- Git staged ---

function getGitStagedFiles(): string[] {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], {
    encoding: "utf-8",
  });
  if (result.status !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean);
}

// --- Scanners ---

function scanCSharpFile(filePath: string, config: Config): { total: number; documented: number; gaps: DocGap[] } {
  const langConfig = config.languages.csharp ?? {};
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return { total: 0, documented: 0, gaps: [] };
  }

  const lines = content.split("\n");
  let total = 0;
  let documented = 0;
  const gaps: DocGap[] = [];

  const publicPattern = /^\s*(?:\[[^\]]*\]\s*)*public\s+(?:(?:static|virtual|override|abstract|async|sealed|readonly)\s+)*(?:class|struct|interface|enum|record|(?:[\w<>\[\],\s]+)\s+)(\w+)(?:\s*[<({\[:]|$)/;
  const xmlDocPattern = /^\s*\/\/\//;

  for (let i = 0; i < lines.length; i++) {
    const match = publicPattern.exec(lines[i]);
    if (match && config.checkPublicOnly) {
      const symbolName = match[1];
      const line = lines[i];
      const symbolType = line.includes("class ") ? "class" : line.includes("interface ") ? "interface" : line.includes("(") ? "method" : "property";
      total++;

      let hasXmlDoc = false;
      const missing: string[] = [];
      let j = i - 1;
      while (j >= 0 && xmlDocPattern.test(lines[j])) {
        hasXmlDoc = true;
        j--;
      }

      if (hasXmlDoc) {
        const docBlock = lines.slice(j + 1, i).join("\n");
        if (langConfig.require_summary && !docBlock.includes("<summary>")) missing.push("summary");
        if (langConfig.require_param && line.includes("(")) {
          const paramMatch = /\(([^)]*)\)/.exec(line);
          if (paramMatch?.[1]?.trim()) {
            for (const param of paramMatch[1].split(",")) {
              const nameMatch = /(\w+)\s*(?:=|$)/.exec(param.trim());
              if (nameMatch && !docBlock.includes(`name="${nameMatch[1]}"`)) {
                missing.push(`param:${nameMatch[1]}`);
              }
            }
          }
        }
        if (langConfig.require_returns && line.includes("(") && !/\bvoid\s+\w+\s*\(/.test(line)) {
          if (!docBlock.includes("<returns>")) missing.push("returns");
        }
        if (missing.length === 0) documented++;
        else gaps.push({ file: filePath, line: i + 1, symbol: symbolName, type: symbolType, missing, language: "csharp" });
      } else {
        const m = ["summary"];
        if (langConfig.require_param && line.includes("(")) m.push("param");
        if (langConfig.require_returns && line.includes("(") && !/\bvoid\s+\w+\s*\(/.test(line)) m.push("returns");
        gaps.push({ file: filePath, line: i + 1, symbol: symbolName, type: symbolType, missing: m, language: "csharp" });
      }
    }
  }
  return { total, documented, gaps };
}

function scanPythonFile(filePath: string, config: Config): { total: number; documented: number; gaps: DocGap[] } {
  const langConfig = config.languages.python ?? {};
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return { total: 0, documented: 0, gaps: [] };
  }

  const lines = content.split("\n");
  let total = 0;
  let documented = 0;
  const gaps: DocGap[] = [];

  if (langConfig.require_module_docstring) {
    total++;
    let firstContentLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const stripped = lines[i].trim();
      if (stripped && !stripped.startsWith("#")) { firstContentLine = i; break; }
    }
    if (lines[firstContentLine]?.trim().startsWith('"""') || lines[firstContentLine]?.trim().startsWith("'''")) {
      documented++;
    } else {
      gaps.push({ file: filePath, line: 1, symbol: basename(filePath, extname(filePath)), type: "module", missing: ["module_docstring"], language: "python" });
    }
  }

  const defPattern = /^(\s*)(def|class)\s+(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const match = defPattern.exec(lines[i]);
    if (match) {
      const name = match[3];
      if (config.checkPublicOnly && name.startsWith("_")) continue;
      total++;
      const symbolType = match[2] === "class" ? "class" : "function";
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      if (j < lines.length && (lines[j].trim().startsWith('"""') || lines[j].trim().startsWith("'''"))) {
        documented++;
      } else {
        gaps.push({ file: filePath, line: i + 1, symbol: name, type: symbolType, missing: ["docstring"], language: "python" });
      }
    }
  }
  return { total, documented, gaps };
}

function scanJavaScriptFile(filePath: string, config: Config): { total: number; documented: number; gaps: DocGap[] } {
  const langConfig = config.languages.javascript ?? {};
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return { total: 0, documented: 0, gaps: [] };
  }

  const lines = content.split("\n");
  let total = 0;
  let documented = 0;
  const gaps: DocGap[] = [];

  const exportPattern = /^(?:export\s+)?(?:(?:async|default)\s+)*(?:function|class|const|let|var)\s+(\w+)/;
  const jsdocEndPattern = /\*\/\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const match = exportPattern.exec(lines[i].trim());
    if (match) {
      const name = match[1];
      const line = lines[i];
      if (config.checkPublicOnly && !line.includes("export")) continue;
      total++;

      let hasJsdoc = false;
      let j = i - 1;
      while (j >= 0) {
        const prev = lines[j].trim();
        if (jsdocEndPattern.test(prev)) { hasJsdoc = true; break; }
        if (prev && !prev.startsWith("*") && !prev.startsWith("//")) break;
        j--;
      }
      if (hasJsdoc) {
        documented++;
      } else {
        const missing = ["jsdoc"];
        if (langConfig.require_param && line.includes("(")) missing.push("@param");
        if (langConfig.require_returns) missing.push("@returns");
        gaps.push({ file: filePath, line: i + 1, symbol: name, type: line.includes("class ") ? "class" : "function", missing, language: "javascript" });
      }
    }
  }
  return { total, documented, gaps };
}

function checkChangelog(projectRoot: string): DocGap[] {
  const changelogPath = resolve(projectRoot, "CHANGELOG.md");
  if (!existsSync(changelogPath)) {
    return [{ file: "CHANGELOG.md", line: 0, symbol: "CHANGELOG", type: "file", missing: ["file_exists"], language: "markdown" }];
  }
  const content = readFileSync(changelogPath, "utf-8");
  if (!content.includes("[Unreleased]") && !content.includes("## Unreleased")) {
    return [{ file: "CHANGELOG.md", line: 1, symbol: "Unreleased", type: "section", missing: ["unreleased_section"], language: "markdown" }];
  }
  return [];
}

// --- Directory scanning ---

function collectFiles(target: string, recursive: boolean): string[] {
  const files: string[] = [];
  const stat = statSync(target);
  if (stat.isFile()) return [target];
  if (!stat.isDirectory()) return [];

  const glob = new Bun.Glob("**/*");
  for (const entry of glob.scanSync({ cwd: target, onlyFiles: true })) {
    files.push(resolve(target, entry));
  }
  return files;
}

function scanDirectory(target: string, config: Config, gitStagedOnly: boolean): CoverageReport {
  const report: CoverageReport = { totalSymbols: 0, documentedSymbols: 0, gaps: [], filesScanned: 0, threshold: config.minCoveragePercent };

  const files = gitStagedOnly ? getGitStagedFiles() : collectFiles(target, true);
  const scanners: Record<string, (f: string, c: Config) => { total: number; documented: number; gaps: DocGap[] }> = {
    ".cs": scanCSharpFile,
    ".py": scanPythonFile,
    ".js": scanJavaScriptFile,
    ".ts": scanJavaScriptFile,
    ".jsx": scanJavaScriptFile,
    ".tsx": scanJavaScriptFile,
  };

  for (const filePath of files) {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) continue;
    if (shouldExclude(filePath, config.excludePatterns)) continue;
    const ext = extname(filePath).toLowerCase();
    const scanner = scanners[ext];
    if (scanner) {
      report.filesScanned++;
      const { total, documented, gaps } = scanner(filePath, config);
      report.totalSymbols += total;
      report.documentedSymbols += documented;
      report.gaps.push(...gaps);
    }
  }

  if (config.checkChangelog) {
    const root = statSync(target).isDirectory() ? target : resolve(target, "..");
    report.gaps.push(...checkChangelog(root));
  }
  return report;
}

// --- Formatters ---

function coveragePercent(report: CoverageReport): number {
  if (report.totalSymbols === 0) return 100;
  return (report.documentedSymbols / report.totalSymbols) * 100;
}

function formatText(report: CoverageReport): string {
  const pct = coveragePercent(report);
  const passed = pct >= report.threshold;
  const lines = [
    "Documentation Coverage Report",
    "=".repeat(29),
    "",
    `Overall Coverage: ${pct.toFixed(1)}%${passed ? "" : ` (below ${report.threshold}% threshold)`}`,
    `Files Scanned: ${report.filesScanned}`,
    `Symbols: ${report.documentedSymbols}/${report.totalSymbols}`,
    "",
  ];
  if (report.gaps.length > 0) {
    lines.push(`Gaps Found: ${report.gaps.length}`, "");
    const byFile = new Map<string, DocGap[]>();
    for (const gap of report.gaps) {
      if (!byFile.has(gap.file)) byFile.set(gap.file, []);
      byFile.get(gap.file)!.push(gap);
    }
    for (const [file, gaps] of byFile) {
      lines.push(file);
      for (const gap of gaps) {
        lines.push(`  Line ${gap.line}: ${gap.symbol} (${gap.type})`);
        for (const m of gap.missing) lines.push(`    - Missing: ${m}`);
      }
      lines.push("");
    }
  } else {
    lines.push("No gaps found! Documentation is complete.");
  }
  return lines.join("\n");
}

function formatMarkdown(report: CoverageReport): string {
  const pct = coveragePercent(report);
  const passed = pct >= report.threshold;
  const status = passed ? "PASS" : "FAIL";
  const lines = [
    "# Documentation Coverage Report", "",
    `**Status**: ${status}`,
    `**Coverage**: ${pct.toFixed(1)}% (threshold: ${report.threshold}%)`,
    `**Files Scanned**: ${report.filesScanned}`,
    `**Symbols**: ${report.documentedSymbols}/${report.totalSymbols}`, "",
  ];
  if (report.gaps.length > 0) {
    lines.push("## Gaps Found", "", "| File | Line | Symbol | Type | Missing |", "|------|------|--------|------|---------|");
    for (const gap of report.gaps) {
      lines.push(`| ${gap.file} | ${gap.line} | ${gap.symbol} | ${gap.type} | ${gap.missing.join(", ")} |`);
    }
  }
  return lines.join("\n");
}

// --- Main ---

function main(): number {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      target: { type: "string", short: "t", default: "." },
      "git-staged": { type: "boolean", default: false },
      "min-coverage": { type: "string", default: "80" },
      format: { type: "string", short: "f", default: "text" },
      output: { type: "string", short: "o" },
      config: { type: "string", short: "c" },
    },
    strict: false,
    allowPositionals: true,
  });

  const config = loadConfig(values.config);
  config.minCoveragePercent = parseInt(values["min-coverage"] as string, 10);

  let report: CoverageReport;
  if (positionals.length > 0) {
    report = { totalSymbols: 0, documentedSymbols: 0, gaps: [], filesScanned: 0, threshold: config.minCoveragePercent };
    for (const filePath of positionals) {
      const ext = extname(filePath);
      const scanners: Record<string, (f: string, c: Config) => { total: number; documented: number; gaps: DocGap[] }> = {
        ".cs": scanCSharpFile, ".py": scanPythonFile,
        ".js": scanJavaScriptFile, ".ts": scanJavaScriptFile,
        ".jsx": scanJavaScriptFile, ".tsx": scanJavaScriptFile,
      };
      const scanner = scanners[ext];
      if (!scanner) continue;
      report.filesScanned++;
      const { total, documented, gaps } = scanner(filePath, config);
      report.totalSymbols += total;
      report.documentedSymbols += documented;
      report.gaps.push(...gaps);
    }
  } else {
    report = scanDirectory(values.target as string, config, values["git-staged"] as boolean);
  }

  let output: string;
  if (values.format === "json") {
    output = JSON.stringify({
      coverage_percent: Math.round(coveragePercent(report) * 10) / 10,
      threshold: report.threshold,
      passed: coveragePercent(report) >= report.threshold,
      total_symbols: report.totalSymbols,
      documented_symbols: report.documentedSymbols,
      files_scanned: report.filesScanned,
      gaps: report.gaps,
    }, null, 2);
  } else if (values.format === "markdown") {
    output = formatMarkdown(report);
  } else {
    output = formatText(report);
  }

  if (values.output) {
    Bun.write(values.output as string, output);
    console.log(`Report written to ${values.output}`);
  } else {
    console.log(output);
  }

  return coveragePercent(report) >= report.threshold ? 0 : 10;
}

process.exit(main());
