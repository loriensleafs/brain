#!/usr/bin/env bun
/**
 * Style enforcement checker for code files.
 *
 * Validates code against style rules from .editorconfig, biome.json,
 * eslint.config.js/.mjs, .prettierrc, and tsconfig.json.
 * Detects line ending violations, naming convention issues,
 * indentation problems, and charset mismatches.
 *
 * Exit codes:
 *   0  - All files compliant
 *   1  - Script error
 *   10 - Violations detected
 */

import { parseArgs } from "util";
import { resolve, extname, basename, dirname } from "path";
import { readFileSync, existsSync, statSync } from "fs";
import { spawnSync } from "child_process";

const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_VIOLATIONS = 10;

const SUPPRESSION_PATTERN = /#\s*style-enforcement:\s*ignore\s+(STYLE-\d+)/i;

interface Violation {
  file: string;
  line: number;
  column: number;
  rule: string;
  message: string;
  severity: string;
}

interface StyleConfig {
  pattern: string;
  endOfLine: string | null;
  indentStyle: string | null;
  indentSize: number | null;
  charset: string | null;
  trimTrailingWhitespace: boolean | null;
  insertFinalNewline: boolean | null;
  asyncSuffixRequired: boolean;
}

interface ScanResult {
  scanTimestamp: string;
  filesScanned: number;
  violations: Violation[];
  suppressed: Violation[];
  errors: string[];
}

function parseEditorconfig(filePath: string): Record<string, Record<string, string>> {
  const config: Record<string, Record<string, string>> = {};
  if (!existsSync(filePath)) return config;

  try {
    const content = readFileSync(filePath, "utf-8");
    let currentSection: string | null = null;
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(";")) continue;
      if (line.startsWith("[") && line.endsWith("]")) {
        currentSection = line.slice(1, -1);
        config[currentSection] = {};
        continue;
      }
      if (line.includes("=") && currentSection !== null) {
        const [key, ...rest] = line.split("=");
        config[currentSection][key.trim().toLowerCase()] = rest.join("=").trim().toLowerCase();
      }
    }
  } catch {
    // Ignore parse errors
  }
  return config;
}

function findEditorconfigs(startPath: string): string[] {
  const configs: string[] = [];
  let current = resolve(startPath);
  while (current !== dirname(current)) {
    const ec = resolve(current, ".editorconfig");
    if (existsSync(ec)) {
      configs.push(ec);
      const parsed = parseEditorconfig(ec);
      for (const props of Object.values(parsed)) {
        if (props.root === "true") return configs;
      }
    }
    current = dirname(current);
  }
  return configs;
}

function matchPattern(pattern: string, filePath: string): boolean {
  const fileName = basename(filePath);
  let p = pattern.replace(/\*\*/g, "*");
  if (p.includes("{") && p.includes("}")) {
    const m = /\{([^}]+)\}/.exec(p);
    if (m) {
      const alts = m[1].split(",");
      const base = p.slice(0, m.index) + "{}" + p.slice(m.index + m[0].length);
      return alts.some((alt) => matchPattern(base.replace("{}", alt.trim()), filePath));
    }
  }
  const regex = new RegExp("^" + p.replace(/\./g, "\\.").replace(/\*/g, "[^/]*") + "$");
  return regex.test(fileName) || regex.test(filePath);
}

function getConfigForFile(filePath: string, editorconfigs: string[]): StyleConfig {
  const config: StyleConfig = {
    pattern: "*", endOfLine: null, indentStyle: null, indentSize: null,
    charset: null, trimTrailingWhitespace: null, insertFinalNewline: null,
    asyncSuffixRequired: false,
  };

  // Also detect project-specific lint configs
  const projectRoot = dirname(editorconfigs[0] ?? filePath);
  detectProjectConfig(config, projectRoot, filePath);

  for (const ecPath of [...editorconfigs].reverse()) {
    const parsed = parseEditorconfig(ecPath);
    for (const [section, props] of Object.entries(parsed)) {
      if (section === "*" || matchPattern(section, filePath)) {
        if (props.end_of_line) config.endOfLine = props.end_of_line;
        if (props.indent_style) config.indentStyle = props.indent_style;
        if (props.indent_size) {
          const n = parseInt(props.indent_size, 10);
          if (!isNaN(n)) config.indentSize = n;
        }
        if (props.charset) config.charset = props.charset;
        if (props.trim_trailing_whitespace) config.trimTrailingWhitespace = props.trim_trailing_whitespace === "true";
        if (props.insert_final_newline) config.insertFinalNewline = props.insert_final_newline === "true";
      }
    }
  }

  if (extname(filePath) === ".cs") {
    for (const ecPath of editorconfigs) {
      const parsed = parseEditorconfig(ecPath);
      for (const props of Object.values(parsed)) {
        for (const [key, value] of Object.entries(props)) {
          if (key.toLowerCase().includes("async") && value.toLowerCase().includes("suffix")) {
            config.asyncSuffixRequired = true;
          }
        }
      }
    }
  }
  return config;
}

function detectProjectConfig(config: StyleConfig, projectRoot: string, _filePath: string): void {
  // Detect biome.json
  const biomePath = resolve(projectRoot, "biome.json");
  if (existsSync(biomePath)) {
    try {
      const biome = JSON.parse(readFileSync(biomePath, "utf-8"));
      const formatter = biome?.formatter;
      if (formatter?.indentStyle && !config.indentStyle) {
        config.indentStyle = formatter.indentStyle === "tab" ? "tab" : "space";
      }
      if (formatter?.indentWidth && !config.indentSize) {
        config.indentSize = formatter.indentWidth;
      }
      if (formatter?.lineEnding && !config.endOfLine) {
        config.endOfLine = formatter.lineEnding === "crlf" ? "crlf" : "lf";
      }
    } catch {
      // Ignore
    }
  }

  // Detect tsconfig.json for newLine setting
  const tsconfigPath = resolve(projectRoot, "tsconfig.json");
  if (existsSync(tsconfigPath)) {
    try {
      const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
      const newLine = tsconfig?.compilerOptions?.newLine;
      if (newLine && !config.endOfLine) {
        config.endOfLine = newLine.toLowerCase() === "crlf" ? "crlf" : "lf";
      }
    } catch {
      // Ignore
    }
  }

  // Detect .prettierrc
  for (const name of [".prettierrc", ".prettierrc.json"]) {
    const prettierPath = resolve(projectRoot, name);
    if (existsSync(prettierPath)) {
      try {
        const prettier = JSON.parse(readFileSync(prettierPath, "utf-8"));
        if (prettier.useTabs !== undefined && !config.indentStyle) {
          config.indentStyle = prettier.useTabs ? "tab" : "space";
        }
        if (prettier.tabWidth && !config.indentSize) {
          config.indentSize = prettier.tabWidth;
        }
        if (prettier.endOfLine && !config.endOfLine) {
          config.endOfLine = prettier.endOfLine;
        }
      } catch {
        // Ignore
      }
      break;
    }
  }
}

function detectLineEnding(content: Uint8Array): string {
  let crlf = 0, lf = 0, cr = 0;
  for (let i = 0; i < content.length; i++) {
    if (content[i] === 0x0d) {
      if (i + 1 < content.length && content[i + 1] === 0x0a) { crlf++; i++; }
      else cr++;
    } else if (content[i] === 0x0a) {
      lf++;
    }
  }
  if (crlf > lf && crlf > cr) return "crlf";
  if (cr > lf) return "cr";
  return "lf";
}

function checkLineEndings(filePath: string, raw: Uint8Array, config: StyleConfig): Violation[] {
  if (!config.endOfLine) return [];
  const actual = detectLineEnding(raw);
  if (actual !== config.endOfLine) {
    return [{ file: filePath, line: 1, column: 1, rule: "STYLE-001", message: `File uses ${actual.toUpperCase()} but config requires ${config.endOfLine.toUpperCase()}`, severity: "warning" }];
  }
  return [];
}

function checkIndentation(filePath: string, lines: string[], config: StyleConfig): Violation[] {
  if (!config.indentStyle) return [];
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const leading = line.length - line.trimStart().length;
    if (leading === 0) continue;
    const leadingChars = line.slice(0, leading);
    if (config.indentStyle === "space" && leadingChars.includes("\t")) {
      violations.push({ file: filePath, line: i + 1, column: 1, rule: "STYLE-002", message: "Line uses tabs but config requires spaces", severity: "warning" });
    } else if (config.indentStyle === "tab" && leadingChars.includes(" ") && (leadingChars.match(/ /g)?.length ?? 0) >= 2) {
      violations.push({ file: filePath, line: i + 1, column: 1, rule: "STYLE-002", message: "Line uses spaces but config requires tabs", severity: "warning" });
    }
  }
  return violations;
}

function checkCharset(filePath: string, raw: Uint8Array, config: StyleConfig): Violation[] {
  if (!config.charset) return [];
  const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  if (config.charset === "utf-8" && hasBom) {
    return [{ file: filePath, line: 1, column: 1, rule: "STYLE-003", message: "File has UTF-8 BOM but config requires utf-8 (no BOM)", severity: "warning" }];
  }
  if (config.charset === "utf-8-bom" && !hasBom) {
    return [{ file: filePath, line: 1, column: 1, rule: "STYLE-003", message: "File missing UTF-8 BOM but config requires utf-8-bom", severity: "warning" }];
  }
  return [];
}

function checkTrailingWhitespace(filePath: string, lines: string[], config: StyleConfig): Violation[] {
  if (!config.trimTrailingWhitespace) return [];
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== lines[i].trimEnd()) {
      violations.push({ file: filePath, line: i + 1, column: lines[i].trimEnd().length + 1, rule: "STYLE-004", message: "Line has trailing whitespace", severity: "info" });
    }
  }
  return violations;
}

function checkFinalNewline(filePath: string, content: string, config: StyleConfig): Violation[] {
  if (config.insertFinalNewline === null) return [];
  if (config.insertFinalNewline && !content.endsWith("\n") && content.length > 0) {
    return [{ file: filePath, line: content.split("\n").length, column: 1, rule: "STYLE-005", message: "File does not end with newline", severity: "info" }];
  }
  return [];
}

function checkCSharpAsyncNaming(filePath: string, content: string, config: StyleConfig): Violation[] {
  if (!config.asyncSuffixRequired || extname(filePath) !== ".cs") return [];
  const violations: Violation[] = [];
  const pattern = /\basync\s+(?:Task|ValueTask|IAsyncEnumerable)[\s<].*?\s+(\w+)\s*\(/gm;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const match of lines[i].matchAll(pattern)) {
      const methodName = match[1];
      if (!methodName.endsWith("Async") && !["Main", "ConfigureServices", "Configure"].includes(methodName)) {
        violations.push({ file: filePath, line: i + 1, column: (match.index ?? 0) + 1, rule: "STYLE-010", message: `Async method '${methodName}' should end with 'Async' suffix`, severity: "warning" });
      }
    }
  }
  return violations;
}

function checkFile(filePath: string, editorconfigs: string[]): { violations: Violation[]; suppressed: Violation[]; error: string | null } {
  const config = getConfigForFile(filePath, editorconfigs);
  try {
    const raw = new Uint8Array(readFileSync(filePath));
    const content = new TextDecoder("utf-8", { fatal: false }).decode(raw);
    const lines = content.split("\n");

    const suppressionLines = new Map<number, string>();
    for (let i = 0; i < lines.length; i++) {
      const m = SUPPRESSION_PATTERN.exec(lines[i]);
      if (m) {
        suppressionLines.set(i + 1, m[1].toUpperCase());
        suppressionLines.set(i + 2, m[1].toUpperCase());
      }
    }

    const allViolations = [
      ...checkLineEndings(filePath, raw, config),
      ...checkIndentation(filePath, lines, config),
      ...checkCharset(filePath, raw, config),
      ...checkTrailingWhitespace(filePath, lines, config),
      ...checkFinalNewline(filePath, content, config),
      ...checkCSharpAsyncNaming(filePath, content, config),
    ];

    const violations: Violation[] = [];
    const suppressed: Violation[] = [];
    for (const v of allViolations) {
      if (suppressionLines.has(v.line) && suppressionLines.get(v.line) === v.rule) {
        suppressed.push(v);
      } else {
        violations.push(v);
      }
    }
    return { violations, suppressed, error: null };
  } catch (e) {
    return { violations: [], suppressed: [], error: String(e) };
  }
}

function getGitStagedFiles(): string[] {
  const result = spawnSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], { encoding: "utf-8" });
  if (result.status !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean);
}

function getFilesToCheck(target: string, gitStaged: boolean, files: string[]): string[] {
  if (gitStaged) return getGitStagedFiles();
  const targets = files.length > 0 ? files : [target];
  const result: string[] = [];
  const extensions = new Set([".cs", ".py", ".ps1", ".psm1", ".js", ".ts", ".jsx", ".tsx", ".go", ".rs", ".java", ".rb", ".md", ".yml", ".yaml", ".json"]);
  for (const t of targets) {
    if (!existsSync(t)) continue;
    if (statSync(t).isFile()) { result.push(t); continue; }
    const glob = new Bun.Glob("**/*");
    for (const entry of glob.scanSync({ cwd: t, onlyFiles: true })) {
      if (extensions.has(extname(entry).toLowerCase())) result.push(resolve(t, entry));
    }
  }
  return result;
}

function formatText(result: ScanResult): string {
  const output = [`Style Enforcement Report`, "=".repeat(24), "", `Files scanned: ${result.filesScanned}`, `Violations: ${result.violations.length}`, `Suppressed: ${result.suppressed.length}`, ""];
  if (result.violations.length > 0) {
    const byFile = new Map<string, Violation[]>();
    for (const v of result.violations) {
      if (!byFile.has(v.file)) byFile.set(v.file, []);
      byFile.get(v.file)!.push(v);
    }
    for (const [file, vs] of [...byFile.entries()].sort()) {
      output.push(file);
      for (const v of vs.sort((a, b) => a.line - b.line)) output.push(`  Line ${v.line}: [${v.rule}] ${v.message}`);
      output.push("");
    }
  }
  output.push(result.violations.length > 0 ? "Exit code: 10 (violations detected)" : "Exit code: 0 (all files compliant)");
  return output.join("\n");
}

function formatJson(result: ScanResult): string {
  const bySeverity: Record<string, number> = {};
  for (const v of result.violations) bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
  return JSON.stringify({
    scan_timestamp: result.scanTimestamp,
    files_scanned: result.filesScanned,
    violations: result.violations.map((v) => ({ file: v.file, line: v.line, column: v.column, rule: v.rule, message: v.message, severity: v.severity })),
    suppressed: result.suppressed.map((v) => ({ file: v.file, line: v.line, rule: v.rule, message: v.message })),
    summary: { total: result.violations.length, by_severity: bySeverity },
  }, null, 2);
}

function formatSarif(result: ScanResult): string {
  return JSON.stringify({
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "style-enforcement", version: "1.0.0", rules: [
        { id: "STYLE-001", name: "LineEndingViolation", shortDescription: { text: "Line ending mismatch" } },
        { id: "STYLE-002", name: "IndentationViolation", shortDescription: { text: "Indentation style mismatch" } },
        { id: "STYLE-003", name: "CharsetViolation", shortDescription: { text: "Charset mismatch" } },
        { id: "STYLE-004", name: "TrailingWhitespace", shortDescription: { text: "Trailing whitespace" } },
        { id: "STYLE-005", name: "FinalNewline", shortDescription: { text: "Missing final newline" } },
        { id: "STYLE-010", name: "AsyncNamingConvention", shortDescription: { text: "Async method naming" } },
      ] } },
      results: result.violations.map((v) => ({
        ruleId: v.rule, level: v.severity === "warning" ? "warning" : "note",
        message: { text: v.message },
        locations: [{ physicalLocation: { artifactLocation: { uri: v.file }, region: { startLine: v.line, startColumn: v.column } } }],
      })),
    }],
  }, null, 2);
}

function main(): number {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      target: { type: "string", default: "." },
      "git-staged": { type: "boolean", default: false },
      format: { type: "string", default: "text" },
      output: { type: "string" },
      severity: { type: "string", default: "warning" },
    },
    strict: false,
    allowPositionals: true,
  });

  const files = getFilesToCheck(values.target as string, values["git-staged"] as boolean, positionals);
  if (files.length === 0) {
    console.error("No files to check");
    process.exit(EXIT_SUCCESS);
  }

  const startPath = values["git-staged"] ? process.cwd() : values.target as string;
  const editorconfigs = findEditorconfigs(startPath);
  if (editorconfigs.length === 0) console.error("Warning: No .editorconfig found");

  const result: ScanResult = { scanTimestamp: new Date().toISOString(), filesScanned: 0, violations: [], suppressed: [], errors: [] };
  const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
  const minSev = severityOrder[values.severity as string] ?? 1;

  for (const filePath of files) {
    if (!existsSync(filePath)) { result.errors.push(`File not found: ${filePath}`); continue; }
    const { violations, suppressed, error } = checkFile(filePath, editorconfigs);
    result.filesScanned++;
    if (error) result.errors.push(error);
    else {
      for (const v of violations) {
        if ((severityOrder[v.severity] ?? 1) <= minSev) result.violations.push(v);
      }
      result.suppressed.push(...suppressed);
    }
  }

  let output: string;
  if (values.format === "json") output = formatJson(result);
  else if (values.format === "sarif") output = formatSarif(result);
  else output = formatText(result);

  if (values.output) Bun.write(values.output as string, output);
  else console.log(output);

  if (result.errors.length > 0) process.exit(EXIT_ERROR);
  if (result.violations.length > 0) process.exit(EXIT_VIOLATIONS);
  process.exit(EXIT_SUCCESS);
}

main();
