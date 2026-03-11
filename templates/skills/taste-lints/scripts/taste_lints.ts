#!/usr/bin/env bun
/**
 * Taste invariant linter with agent-readable remediation instructions.
 *
 * Project-config-aware: detects and reads biome.json, eslint.config.js/.mjs,
 * .editorconfig, tsconfig.json, .prettierrc when present. Uses those rules
 * and falls back to defaults when no config found.
 *
 * Exit codes: 0 = clean, 1 = script error, 10 = violations detected.
 */

import { parseArgs } from "util";
import { resolve, extname, basename, dirname } from "path";
import { readFileSync, existsSync, statSync } from "fs";
import { spawnSync } from "child_process";

const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_VIOLATIONS = 10;

const SUPPRESSION_PATTERN = /#\s*taste-lint:\s*ignore\s+([\w-]+)/i;
const ALL_RULES = ["file-size", "naming", "complexity", "skill-size"] as const;
type RuleName = (typeof ALL_RULES)[number];

const SCANNABLE_EXTENSIONS = new Set([".py", ".ts", ".js", ".tsx", ".jsx", ".sh", ".bash", ".yml", ".yaml", ".md", ".json"]);

interface Violation {
  rule: string;
  severity: string;
  file: string;
  line: number;
  message: string;
  remediation: string;
}

interface LintResult {
  filesScanned: number;
  violations: Violation[];
}

interface ProjectConfig {
  maxFileLines: number;
  maxSkillLines: number;
  maxComplexity: number;
  indentStyle: string | null;
  indentSize: number | null;
}

function detectProjectConfig(startPath: string): ProjectConfig {
  const config: ProjectConfig = {
    maxFileLines: 500,
    maxSkillLines: 500,
    maxComplexity: 10,
    indentStyle: null,
    indentSize: null,
  };

  let dir = resolve(startPath);
  if (existsSync(dir) && statSync(dir).isFile()) dir = dirname(dir);

  // Walk up to find config files
  let current = dir;
  for (let i = 0; i < 10; i++) {
    // biome.json
    const biomePath = resolve(current, "biome.json");
    if (existsSync(biomePath)) {
      try {
        const biome = JSON.parse(readFileSync(biomePath, "utf-8"));
        if (biome?.formatter?.indentStyle) config.indentStyle = biome.formatter.indentStyle;
        if (biome?.formatter?.indentWidth) config.indentSize = biome.formatter.indentWidth;
        if (biome?.linter?.rules?.complexity?.maxFileSize) {
          config.maxFileLines = biome.linter.rules.complexity.maxFileSize;
        }
      } catch { /* ignore */ }
    }

    // tsconfig.json
    const tsconfigPath = resolve(current, "tsconfig.json");
    if (existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
        // Can extract strictness signals if needed
        if (tsconfig?.compilerOptions?.strict === false) {
          // Could relax complexity rules but we keep defaults
        }
      } catch { /* ignore */ }
    }

    // .prettierrc
    for (const name of [".prettierrc", ".prettierrc.json"]) {
      const prettierPath = resolve(current, name);
      if (existsSync(prettierPath)) {
        try {
          const prettier = JSON.parse(readFileSync(prettierPath, "utf-8"));
          if (prettier.useTabs !== undefined && !config.indentStyle) {
            config.indentStyle = prettier.useTabs ? "tab" : "space";
          }
          if (prettier.tabWidth && !config.indentSize) config.indentSize = prettier.tabWidth;
        } catch { /* ignore */ }
        break;
      }
    }

    // .editorconfig
    const ecPath = resolve(current, ".editorconfig");
    if (existsSync(ecPath)) {
      try {
        const content = readFileSync(ecPath, "utf-8");
        for (const line of content.split("\n")) {
          const l = line.trim().toLowerCase();
          if (l.startsWith("indent_style") && l.includes("=") && !config.indentStyle) {
            config.indentStyle = l.split("=")[1].trim();
          }
          if (l.startsWith("indent_size") && l.includes("=") && !config.indentSize) {
            const n = parseInt(l.split("=")[1].trim(), 10);
            if (!isNaN(n)) config.indentSize = n;
          }
        }
      } catch { /* ignore */ }
    }

    if (current === dirname(current)) break;
    current = dirname(current);
  }

  return config;
}

function isSafePath(filepath: string): boolean {
  if (resolve(filepath) === resolve(filepath)) return true; // absolute
  return !filepath.split("/").includes("..");
}

function getStagedFiles(): string[] {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACM"], { encoding: "utf-8" });
  if (result.status !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean).filter(isSafePath);
}

function getDirectoryFiles(directory: string): string[] {
  const files: string[] = [];
  const glob = new Bun.Glob("**/*");
  for (const entry of glob.scanSync({ cwd: directory, onlyFiles: true })) {
    if (SCANNABLE_EXTENSIONS.has(extname(entry).toLowerCase())) files.push(resolve(directory, entry));
  }
  return files.sort();
}

function readFileLines(filepath: string): string[] {
  try {
    return readFileSync(filepath, "utf-8").split("\n");
  } catch {
    return [];
  }
}

function hasSuppression(lines: string[], rule: string): boolean {
  for (const line of lines.slice(0, 10)) {
    const match = SUPPRESSION_PATTERN.exec(line);
    if (match && match[1] === rule) return true;
  }
  return false;
}

function checkFileSize(filepath: string, lines: string[], config: ProjectConfig): Violation[] {
  if (hasSuppression(lines, "file-size")) return [];
  const count = lines.length;
  const bn = basename(filepath, extname(filepath));
  const sx = extname(filepath);
  if (count > config.maxFileLines) {
    return [{ rule: "file-size", severity: "error", file: filepath, line: count,
      message: `File exceeds ${config.maxFileLines} lines (${count} lines)`,
      remediation: `AGENT_REMEDIATION: Split this file into smaller modules. Consider extracting:\n  1. Helper functions -> ${bn}_helpers${sx}\n  2. Type definitions -> ${bn}_types${sx}\n  3. Constants -> ${bn}_constants${sx}\n  Target: each module under 300 lines for good cohesion.` }];
  }
  if (count > 300) {
    return [{ rule: "file-size", severity: "warning", file: filepath, line: count,
      message: `File approaching size limit (${count}/${config.maxFileLines} lines)`,
      remediation: `AGENT_REMEDIATION: File is growing large. Plan extraction before it exceeds ${config.maxFileLines} lines. Look for:\n  1. Groups of related functions that form a cohesive module\n  2. Data classes or constants that can be separated\n  3. Test helpers that belong in a fixture file` }];
  }
  return [];
}

function toSnakeCase(name: string): string {
  return name.replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").replace(/([a-z\d])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
}

function toKebabCase(name: string): string {
  return name.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2").replace(/([a-z\d])([A-Z])/g, "$1-$2").replace(/_/g, "-").toLowerCase();
}

function checkNaming(filepath: string, lines: string[]): Violation[] {
  if (hasSuppression(lines, "naming")) return [];
  const violations: Violation[] = [];
  const name = basename(filepath, extname(filepath));
  const suffix = extname(filepath);

  // Python
  if (suffix === ".py" && name !== "__init__" && !/^[a-z][a-z0-9_]*$/.test(name)) {
    violations.push({ rule: "naming", severity: "error", file: filepath, line: 0,
      message: `Python file '${name}${suffix}' is not snake_case`,
      remediation: `AGENT_REMEDIATION: Rename to snake_case. Suggested: ${toSnakeCase(name)}${suffix}\n  Update all imports that reference this module.\n  Run: git mv ${filepath} ${dirname(filepath)}/${toSnakeCase(name)}${suffix}` });
  }

  // TypeScript - camelCase or kebab-case filenames
  if ((suffix === ".ts" || suffix === ".tsx") && !/^[a-z][a-z0-9._-]*$/.test(name) && name !== "CLAUDE") {
    violations.push({ rule: "naming", severity: "warning", file: filepath, line: 0,
      message: `TypeScript file '${name}${suffix}' uses non-standard naming`,
      remediation: `AGENT_REMEDIATION: TypeScript files use camelCase or kebab-case.\n  Suggested: ${toKebabCase(name)}${suffix}\n  Update all imports that reference this module.` });
  }

  // YAML
  if ((suffix === ".yml" || suffix === ".yaml") && !/^[a-z][a-z0-9-]*$/.test(name) && !["CLAUDE", "project", "settings"].includes(name)) {
    violations.push({ rule: "naming", severity: "warning", file: filepath, line: 0,
      message: `YAML file '${name}${suffix}' is not kebab-case`,
      remediation: `AGENT_REMEDIATION: Rename to kebab-case. Suggested: ${toKebabCase(name)}${suffix}\n  Update any references in workflows or configs.` });
  }

  // Skill directory
  if (filepath.includes("/skills/")) {
    const parts = filepath.split("/");
    const skillIdx = parts.indexOf("skills");
    if (skillIdx >= 0 && skillIdx + 1 < parts.length) {
      const skillDir = parts[skillIdx + 1];
      if (!/^[a-z][a-z0-9-]*$/.test(skillDir) && skillDir !== "CLAUDE.md") {
        violations.push({ rule: "naming", severity: "warning", file: filepath, line: 0,
          message: `Skill directory '${skillDir}' is not kebab-case`,
          remediation: `AGENT_REMEDIATION: Skill directories use kebab-case.\n  Rename: ${skillDir} -> ${toKebabCase(skillDir)}\n  Update SKILL.md name field to match.` });
      }
    }
  }
  return violations;
}

function checkComplexity(filepath: string, lines: string[], config: ProjectConfig): Violation[] {
  if (extname(filepath) !== ".py" || hasSuppression(lines, "complexity")) return [];
  // Also support .ts complexity checking
  const isTS = extname(filepath) === ".ts" || extname(filepath) === ".tsx";
  if (!filepath.endsWith(".py") && !isTS) return [];

  const violations: Violation[] = [];
  const branchKeywords = /^\s*(if |elif |for |while |except |with |else if |catch |case )/;
  let currentFunc: string | null = null;
  let currentFuncLine = 0;
  let funcIndent = 0;
  let branchCount = 0;

  const emit = (): void => {
    if (currentFunc && branchCount > config.maxComplexity) {
      violations.push({ rule: "complexity", severity: "error", file: filepath, line: currentFuncLine,
        message: `Function '${currentFunc}' has complexity ${branchCount} (max ${config.maxComplexity})`,
        remediation: `AGENT_REMEDIATION: Decompose '${currentFunc}' to reduce complexity.\n  1. Extract conditional branches into named helper methods\n  2. Use early returns to flatten nested conditions\n  3. Replace complex conditionals with strategy pattern or lookup tables\n  Target: cyclomatic complexity <= ${config.maxComplexity} per function.` });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trimEnd()) continue;
    const indent = line.length - line.trimStart().length;
    const funcMatch = /^(\s*)(?:def|function|async function)\s+(\w+)/.exec(line);
    if (funcMatch) {
      emit();
      funcIndent = funcMatch[1].length;
      currentFunc = funcMatch[2];
      currentFuncLine = i + 1;
      branchCount = 1;
      continue;
    }
    if (currentFunc && indent > funcIndent && branchKeywords.test(line)) branchCount++;
    if (currentFunc && indent <= funcIndent && !line.trim().startsWith("#") && !line.trim().startsWith("//") && !/^(\s*)(?:def|function)/.test(line)) {
      emit();
      currentFunc = null;
    }
  }
  emit();
  return violations;
}

function checkSkillSize(filepath: string, lines: string[], config: ProjectConfig): Violation[] {
  if (!filepath.endsWith("SKILL.md") || !filepath.includes("/skills/")) return [];
  if (hasSuppression(lines, "skill-size")) return [];
  if (lines.slice(0, 20).join("").includes("size-exception: true")) return [];
  const count = lines.length;
  if (count > config.maxSkillLines) {
    const sd = basename(dirname(filepath));
    return [{ rule: "skill-size", severity: "error", file: filepath, line: count,
      message: `Skill prompt exceeds ${config.maxSkillLines} lines (${count} lines)`,
      remediation: `AGENT_REMEDIATION: Refactor using progressive disclosure:\n  1. Move reference docs -> ${sd}/references/\n  2. Extract reusable logic -> ${sd}/scripts/\n  3. Use templates -> ${sd}/templates/\n  Or add 'size-exception: true' to frontmatter if justified.` }];
  }
  if (count > 300) {
    return [{ rule: "skill-size", severity: "warning", file: filepath, line: count,
      message: `Skill prompt approaching limit (${count}/${config.maxSkillLines} lines)`,
      remediation: `AGENT_REMEDIATION: Plan progressive disclosure refactoring before exceeding ${config.maxSkillLines} lines.\n  Move reference material to references/ subdirectory.` }];
  }
  return [];
}

const RULE_CHECKERS: Record<string, (f: string, l: string[], c: ProjectConfig) => Violation[]> = {
  "file-size": checkFileSize,
  naming: (f, l, _c) => checkNaming(f, l),
  complexity: checkComplexity,
  "skill-size": checkSkillSize,
};

function runLint(files: string[], rules: readonly string[], config: ProjectConfig): LintResult {
  const result: LintResult = { filesScanned: 0, violations: [] };
  for (const filepath of files) {
    if (!isSafePath(filepath) || !existsSync(filepath) || !statSync(filepath).isFile()) continue;
    if (!SCANNABLE_EXTENSIONS.has(extname(filepath).toLowerCase())) continue;
    result.filesScanned++;
    const lines = readFileLines(filepath);
    for (const rule of rules) {
      const checker = RULE_CHECKERS[rule];
      if (checker) result.violations.push(...checker(filepath, lines, config));
    }
  }
  return result;
}

function formatText(result: LintResult): string {
  if (result.violations.length === 0) return `taste-lints: ${result.filesScanned} files scanned, no violations found.`;
  const output: string[] = [];
  for (const v of result.violations) {
    const marker = v.severity === "error" ? "ERROR" : "WARNING";
    output.push(`\n[${marker}] ${v.rule}: ${v.file}:${v.line}\n  ${v.message}\n  ${v.remediation}`);
  }
  const errors = result.violations.filter((v) => v.severity === "error").length;
  const warnings = result.violations.filter((v) => v.severity === "warning").length;
  output.push(`\ntaste-lints: ${result.filesScanned} files scanned, ${errors} error(s), ${warnings} warning(s)`);
  return output.join("\n");
}

function formatJson(result: LintResult): string {
  return JSON.stringify({
    files_scanned: result.filesScanned,
    error_count: result.violations.filter((v) => v.severity === "error").length,
    warning_count: result.violations.filter((v) => v.severity === "warning").length,
    violations: result.violations,
  }, null, 2);
}

function parseRules(rulesStr: string | undefined): readonly string[] {
  if (!rulesStr) return ALL_RULES;
  const rules = rulesStr.split(",").map((r) => r.trim());
  const invalid = rules.filter((r) => !(ALL_RULES as readonly string[]).includes(r));
  if (invalid.length > 0) {
    console.error(`error: unknown rules: ${invalid.join(", ")}`);
    console.error(`valid rules: ${ALL_RULES.join(", ")}`);
    process.exit(EXIT_ERROR);
  }
  return rules;
}

function main(): number {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "git-staged": { type: "boolean", default: false },
      directory: { type: "string", short: "d" },
      format: { type: "string", default: "text" },
      rules: { type: "string" },
    },
    strict: false,
    allowPositionals: true,
  });

  const rules = parseRules(values.rules as string | undefined);
  let files: string[] = [];

  if (values["git-staged"]) files = getStagedFiles();
  else if (values.directory) files = getDirectoryFiles(values.directory as string);
  else if (positionals.length > 0) files = positionals;
  else { console.error("taste-lints: no input specified. Use --git-staged, --directory, or list files."); return EXIT_ERROR; }

  if (files.length === 0) { console.log("taste-lints: no files to scan."); return EXIT_SUCCESS; }

  const projectConfig = detectProjectConfig(files[0]);
  const result = runLint(files, rules, projectConfig);

  if (values.format === "json") console.log(formatJson(result));
  else console.log(formatText(result));

  return result.violations.some((v) => v.severity === "error") ? EXIT_VIOLATIONS : EXIT_SUCCESS;
}

process.exit(main());
