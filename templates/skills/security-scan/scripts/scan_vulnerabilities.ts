#!/usr/bin/env bun
/**
 * Security vulnerability scanner for CWE-22 (path traversal)
 * and CWE-78 (command injection).
 *
 * Lightweight pattern-based detection for Python, TypeScript, Bash, and C# files.
 *
 * Exit codes:
 *   0  - No vulnerabilities found
 *   1  - Scan error
 *   10 - Vulnerabilities detected
 */

import { parseArgs } from "util";
import { resolve, extname } from "path";
import { readFileSync, existsSync, statSync } from "fs";
import { spawnSync } from "child_process";

const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_VULNERABILITIES = 10;

const SUPPRESSION_PATTERN = /#\s*security-scan:\s*ignore\s+(CWE-\d+)/i;

interface Vulnerability {
  cwe: string;
  title: string;
  file: string;
  line: number;
  code: string;
  pattern: string;
  severity: string;
  recommendation: string;
}

interface ScanResult {
  scanTimestamp: string;
  filesScanned: number;
  vulnerabilities: Vulnerability[];
  suppressed: string[];
  errors: string[];
}

interface PatternDef {
  pattern: RegExp;
  description: string;
  severity: string;
  recommendation: string;
}

const CWE22_PATTERNS: Record<string, PatternDef[]> = {
  python: [
    { pattern: /os\.path\.join\s*\([^,]+,\s*(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "os.path.join with potentially unvalidated user input", severity: "HIGH", recommendation: "Validate input does not contain '..' and use os.path.realpath() with containment check" },
    { pattern: /open\s*\(\s*(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "File open with potentially unvalidated path", severity: "HIGH", recommendation: "Validate path is within allowed directory before opening" },
    { pattern: /Path\s*\(\s*(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "pathlib.Path with potentially unvalidated input", severity: "HIGH", recommendation: "Use Path.resolve() and verify path is within allowed directory" },
    { pattern: /(shutil\.(copy|move|rmtree)|os\.(remove|unlink|rename))\s*\([^)]*(\w*(user|input|param|arg|request|path|file)\w*)/i, description: "File operation with potentially unvalidated path", severity: "HIGH", recommendation: "Validate all paths before file operations" },
  ],
  typescript: [
    { pattern: /(?:readFileSync|writeFileSync|Bun\.file|Bun\.write)\s*\(\s*(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "File operation with potentially unvalidated path", severity: "HIGH", recommendation: "Validate path is within allowed directory before file operations" },
    { pattern: /resolve\s*\([^,]*,\s*(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "Path resolve with potentially unvalidated input", severity: "HIGH", recommendation: "Use resolve() and verify path starts with allowed base directory" },
  ],
  bash: [
    { pattern: /(cat|head|tail|less|more|source|\.)\s+["']?\$\{?(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "File read with potentially unvalidated path", severity: "HIGH", recommendation: "Validate path does not contain '..' and is within allowed directory" },
    { pattern: /(rm|mv|cp)\s+(-[rfv]+\s+)?["']?\$\{?(\w*(user|input|param|arg|request|path|file)\w*)/i, description: "File operation with potentially unvalidated path", severity: "HIGH", recommendation: "Validate path before file operations" },
    { pattern: /source\s+["']?\$/i, description: "Sourcing script from variable path", severity: "CRITICAL", recommendation: "Never source user-provided script paths" },
  ],
  csharp: [
    { pattern: /Path\.Combine\s*\([^,]+,\s*(\w*(user|input|param|arg|request|path|file|name)\w*)/i, description: "Path.Combine with potentially unvalidated user input", severity: "HIGH", recommendation: "Use Path.GetFullPath() and verify path starts with allowed base directory" },
    { pattern: /(File\.(ReadAllText|WriteAllText|Delete|Copy|Move)|Directory\.(Delete|Move))\s*\([^)]*(\w*(user|input|param|arg|request|path|file)\w*)/i, description: "File operation with potentially unvalidated path", severity: "HIGH", recommendation: "Validate path is within allowed directory before file operations" },
    { pattern: /new\s+FileStream\s*\([^)]*(\w*(user|input|param|arg|request|path|file)\w*)/i, description: "FileStream with potentially unvalidated path", severity: "HIGH", recommendation: "Validate path before creating FileStream" },
  ],
};

const CWE78_PATTERNS: Record<string, PatternDef[]> = {
  python: [
    { pattern: /subprocess\.(run|call|Popen|check_output|check_call)\s*\(\s*f["']/, description: "Subprocess with f-string command (potential injection)", severity: "CRITICAL", recommendation: "Use list form of command arguments instead of shell string" },
    { pattern: /subprocess\.(run|call|Popen|check_output|check_call)\s*\([^)]*shell\s*=\s*True/, description: "Subprocess with shell=True", severity: "HIGH", recommendation: "Avoid shell=True; use list form of command arguments" },
    { pattern: /subprocess\.(run|call|Popen|check_output|check_call)\s*\(\s*["'][^"']*\s*\+/, description: "Subprocess with string concatenation", severity: "CRITICAL", recommendation: "Use list form of command arguments instead of string concatenation" },
    { pattern: /eval\s*\(\s*(\w*(user|input|param|arg|request|cmd|command)\w*)/i, description: "eval() with potentially unvalidated input", severity: "CRITICAL", recommendation: "Never use eval() with user input" },
  ],
  typescript: [
    { pattern: /Bun\.spawn\s*\(\s*`/, description: "Bun.spawn with template literal command", severity: "CRITICAL", recommendation: "Use array form of command arguments" },
    { pattern: /spawnSync\s*\([^)]*shell\s*:\s*true/i, description: "spawnSync with shell: true", severity: "HIGH", recommendation: "Avoid shell: true; use array form of command arguments" },
    { pattern: /\$`[^`]*\$\{(\w*(user|input|param|arg|request|cmd|command)\w*)/i, description: "Bun shell with potentially unvalidated interpolation", severity: "CRITICAL", recommendation: "Validate and sanitize input before shell interpolation" },
    { pattern: /eval\s*\(\s*(\w*(user|input|param|arg|request|cmd|command)\w*)/i, description: "eval() with potentially unvalidated input", severity: "CRITICAL", recommendation: "Never use eval() with user input" },
  ],
  bash: [
    { pattern: /eval\s+["']?\$/, description: "eval with variable expansion", severity: "CRITICAL", recommendation: "Avoid eval; use direct command execution with proper quoting" },
    { pattern: /\$\(\s*\$(\w*(user|input|param|arg|request|cmd|command)\w*)/i, description: "Command substitution with potentially unvalidated input", severity: "CRITICAL", recommendation: "Validate input before command substitution" },
    { pattern: /`\s*\$(\w*(user|input|param|arg|request|cmd|command)\w*)/i, description: "Backtick command substitution with potentially unvalidated input", severity: "CRITICAL", recommendation: "Validate input before command substitution; prefer $() syntax" },
    { pattern: /(?<!["'])\$\w+(?!["'\w])/, description: "Unquoted variable expansion (potential word splitting/injection)", severity: "MEDIUM", recommendation: "Quote all variable expansions: use \"$var\" instead of $var" },
  ],
  csharp: [
    { pattern: /Process\.Start\s*\([^)]*(\w*(user|input|param|arg|request|cmd|command)\w*)/i, description: "Process.Start with potentially unvalidated command", severity: "HIGH", recommendation: "Validate command and arguments before execution" },
    { pattern: /ProcessStartInfo\s*\{[^}]*Arguments\s*=\s*\$"/, description: "ProcessStartInfo with interpolated arguments", severity: "HIGH", recommendation: "Validate all arguments; avoid string interpolation in command arguments" },
  ],
};

function getLanguage(filePath: string): string | null {
  const map: Record<string, string> = {
    ".py": "python", ".ts": "typescript", ".js": "typescript", ".tsx": "typescript", ".jsx": "typescript",
    ".sh": "bash", ".bash": "bash", ".cs": "csharp",
  };
  return map[extname(filePath).toLowerCase()] ?? null;
}

function getStagedFiles(): string[] {
  const result = spawnSync("git", ["diff", "--staged", "--name-only"], { encoding: "utf-8" });
  if (result.status !== 0) return [];
  return result.stdout.trim().split("\n").filter(Boolean);
}

function getDirectoryFiles(directory: string): string[] {
  const supported = new Set([".py", ".ts", ".js", ".tsx", ".jsx", ".sh", ".bash", ".cs"]);
  const files: string[] = [];
  const glob = new Bun.Glob("**/*");
  for (const entry of glob.scanSync({ cwd: directory, onlyFiles: true })) {
    if (supported.has(extname(entry).toLowerCase())) files.push(resolve(directory, entry));
  }
  return files;
}

function isLineSuppressed(line: string, cwe: string): boolean {
  const match = SUPPRESSION_PATTERN.exec(line);
  return match !== null && match[1].toUpperCase() === cwe.toUpperCase();
}

function scanFile(filePath: string, cweFilter: number[] | null): { vulns: Vulnerability[]; suppressed: string[] } {
  const vulns: Vulnerability[] = [];
  const suppressed: string[] = [];
  const language = getLanguage(filePath);
  if (!language) return { vulns, suppressed };

  let lines: string[];
  try {
    lines = readFileSync(filePath, "utf-8").split("\n");
  } catch {
    return { vulns, suppressed: [`Error reading ${filePath}`] };
  }

  const cwe22 = CWE22_PATTERNS[language] ?? [];
  const cwe78 = CWE78_PATTERNS[language] ?? [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!cweFilter || cweFilter.includes(22)) {
      for (const p of cwe22) {
        if (p.pattern.test(line)) {
          if (isLineSuppressed(line, "CWE-22")) suppressed.push(`CWE-22 suppressed at ${filePath}:${i + 1}`);
          else vulns.push({ cwe: "CWE-22", title: "Path Traversal Vulnerability", file: filePath, line: i + 1, code: line.trim().slice(0, 200), pattern: p.description, severity: p.severity, recommendation: p.recommendation });
          break;
        }
      }
    }
    if (!cweFilter || cweFilter.includes(78)) {
      for (const p of cwe78) {
        if (p.pattern.test(line)) {
          if (isLineSuppressed(line, "CWE-78")) suppressed.push(`CWE-78 suppressed at ${filePath}:${i + 1}`);
          else vulns.push({ cwe: "CWE-78", title: "Command Injection Vulnerability", file: filePath, line: i + 1, code: line.trim().slice(0, 200), pattern: p.description, severity: p.severity, recommendation: p.recommendation });
          break;
        }
      }
    }
  }
  return { vulns, suppressed };
}

function formatConsole(result: ScanResult): string {
  const output = ["=== Security Vulnerability Scan ===", ""];
  if (result.errors.length > 0) {
    output.push("Errors:");
    for (const e of result.errors) output.push(`  ${e}`);
    output.push("");
  }
  if (result.vulnerabilities.length === 0) {
    output.push(`Files scanned: ${result.filesScanned}`, "No vulnerabilities found.");
    if (result.suppressed.length > 0) output.push(`Suppressed findings: ${result.suppressed.length}`);
    return output.join("\n");
  }
  for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
    for (const v of result.vulnerabilities.filter((x) => x.severity === sev)) {
      output.push(`[${v.cwe}] ${v.title}`, `  File: ${v.file}:${v.line}`, `  Pattern: ${v.pattern}`, `  Code: ${v.code}`, `  Severity: ${v.severity}`, `  Recommendation: ${v.recommendation}`, "");
    }
  }
  output.push("=== Summary ===", `Files scanned: ${result.filesScanned}`, `Vulnerabilities found: ${result.vulnerabilities.length}`);
  const cweCounts = new Map<string, number>();
  for (const v of result.vulnerabilities) cweCounts.set(v.cwe, (cweCounts.get(v.cwe) ?? 0) + 1);
  for (const [cwe, count] of [...cweCounts.entries()].sort()) {
    output.push(`  ${cwe} (${cwe === "CWE-22" ? "Path Traversal" : "Command Injection"}): ${count}`);
  }
  if (result.suppressed.length > 0) output.push(`Suppressed findings: ${result.suppressed.length}`);
  output.push("", `Exit code: ${EXIT_VULNERABILITIES} (vulnerabilities detected)`);
  return output.join("\n");
}

function formatJson(result: ScanResult): string {
  const byCwe: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  for (const v of result.vulnerabilities) {
    byCwe[v.cwe] = (byCwe[v.cwe] ?? 0) + 1;
    bySeverity[v.severity] = (bySeverity[v.severity] ?? 0) + 1;
  }
  return JSON.stringify({
    scan_timestamp: result.scanTimestamp, files_scanned: result.filesScanned,
    vulnerabilities: result.vulnerabilities, suppressed: result.suppressed, errors: result.errors,
    summary: { total: result.vulnerabilities.length, by_cwe: byCwe, by_severity: bySeverity },
    exit_code: result.vulnerabilities.length > 0 ? EXIT_VULNERABILITIES : EXIT_SUCCESS,
  }, null, 2);
}

function main(): number {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      "git-staged": { type: "boolean", default: false },
      directory: { type: "string", short: "d" },
      cwe: { type: "string", multiple: true },
      format: { type: "string", short: "f", default: "console" },
      output: { type: "string", short: "o" },
    },
    strict: false,
    allowPositionals: true,
  });

  const cweFilter = values.cwe ? (values.cwe as string[]).map(Number) : null;
  const filesToScan: string[] = [];

  if (values["git-staged"]) filesToScan.push(...getStagedFiles());
  if (values.directory) filesToScan.push(...getDirectoryFiles(values.directory as string));
  if (positionals.length > 0) filesToScan.push(...positionals);

  if (filesToScan.length === 0) {
    console.log("No files to scan. Use --git-staged, --directory, or specify files.");
    return EXIT_ERROR;
  }

  const unique = [...new Set(filesToScan)];
  const supported = unique.filter((f) => getLanguage(f) !== null);

  if (supported.length === 0) {
    console.log("No supported files found (Python, TypeScript, Bash, C#).");
    return EXIT_SUCCESS;
  }

  const result: ScanResult = { scanTimestamp: new Date().toISOString(), filesScanned: supported.length, vulnerabilities: [], suppressed: [], errors: [] };
  for (const f of supported) {
    const { vulns, suppressed } = scanFile(f, cweFilter);
    result.vulnerabilities.push(...vulns);
    result.suppressed.push(...suppressed);
  }

  const output = values.format === "json" ? formatJson(result) : formatConsole(result);
  if (values.output) { Bun.write(values.output as string, output); console.log(`Results written to ${values.output}`); }
  else console.log(output);

  return result.vulnerabilities.length > 0 ? EXIT_VULNERABILITIES : EXIT_SUCCESS;
}

process.exit(main());
