/**
 * Skill/Passive Context Compliance Validator.
 *
 * Validates that content placement follows the skill vs passive context decision framework.
 * Checks 6 compliance rules and returns structured JSON with violations and recommendations.
 *
 * Exit codes:
 *   0: All compliance checks passed
 *   1: One or more violations detected
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, resolve } from "path";
import { validatePathWithinRepo } from "./path_validation";

// --- Types ---

interface CheckResult {
  readonly passed: boolean;
  readonly severity: "none" | "warning" | "error";
  readonly message: string;
  readonly details: Record<string, unknown>;
}

interface ComplianceResults {
  timestamp: string;
  path: string;
  claudeMdPath: string;
  violations: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
  recommendations: string[];
  summary: {
    total_checks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

// --- Repository Root ---

function findRepositoryRoot(): string {
  let current = process.cwd();
  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) {
      throw new Error("Not in a git repository");
    }
    current = parent;
  }
}

// --- Compliance Checks ---

function checkSkillHasActions(skillPath: string): CheckResult {
  const skillMd = join(skillPath, "SKILL.md");

  if (!existsSync(skillMd)) {
    return { passed: false, severity: "error", message: "SKILL.md not found", details: {} };
  }

  const content = readFileSync(skillMd, "utf-8");

  const actionVerbs = [
    "create", "update", "delete", "execute", "run", "modify", "remove", "add",
    "generate", "process", "validate", "scan", "fix", "commit", "push", "merge",
    "resolve", "post", "reply", "close", "open",
  ];

  const foundVerbs = actionVerbs.filter((verb) =>
    new RegExp(`\\b${verb}\\b`, "i").test(content),
  );

  const scriptsDir = join(skillPath, "scripts");
  const hasScripts =
    existsSync(scriptsDir) &&
    readdirSync(scriptsDir).some((f) => f.endsWith(".ts"));

  const toolPatterns = ["Bash", "Read", "Write", "Edit", "pwsh", "gh ", "git "];
  const foundTools = toolPatterns.filter((tool) => content.includes(tool));

  if (foundVerbs.length === 0 && !hasScripts && foundTools.length === 0) {
    return {
      passed: false,
      severity: "warning",
      message: "No action verbs, scripts, or tool execution found",
      details: {},
    };
  }

  return {
    passed: true,
    severity: "none",
    message: `Actions found (verbs: ${foundVerbs.length}, scripts: ${hasScripts})`,
    details: {},
  };
}

function checkPassiveContextKnowledgeOnly(filePath: string): CheckResult {
  const content = readFileSync(filePath, "utf-8");

  const actionIndicators = [
    /```powershell\npwsh /,
    /```bash\n(?:gh|git) /,
    /```python\n/,
    /Run the following/,
    /Execute:/,
    /Call.*tool/,
    /Invoke-/,
  ];

  const foundActions = actionIndicators.filter((pattern) => pattern.test(content));

  if (foundActions.length > 0) {
    return {
      passed: false,
      severity: "warning",
      message: `Contains ${foundActions.length} action pattern(s)`,
      details: {},
    };
  }

  return { passed: true, severity: "none", message: "Knowledge-only content", details: {} };
}

function checkClaudeMdLineCount(filePath: string): CheckResult {
  if (!existsSync(filePath)) {
    return { passed: false, severity: "error", message: "CLAUDE.md not found", details: {} };
  }

  const lineCount = readFileSync(filePath, "utf-8").split("\n").length;

  if (lineCount > 200) {
    return {
      passed: false,
      severity: "error",
      message: `CLAUDE.md has ${lineCount} lines (exceeds 200 limit)`,
      details: {},
    };
  }

  if (lineCount > 150) {
    return {
      passed: true,
      severity: "warning",
      message: `CLAUDE.md has ${lineCount} lines (approaching 200 line limit)`,
      details: {},
    };
  }

  return {
    passed: true,
    severity: "none",
    message: `CLAUDE.md has ${lineCount} lines (within limit)`,
    details: {},
  };
}

function checkImportedFilesExist(
  claudeMdPath: string,
  repositoryRoot: string,
): CheckResult {
  if (!existsSync(claudeMdPath)) {
    return { passed: false, severity: "error", message: "CLAUDE.md not found", details: {} };
  }

  const content = readFileSync(claudeMdPath, "utf-8");
  const importPattern = /@([^\s]+\.md)/g;
  const imports: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importPattern.exec(content)) !== null) {
    imports.push(match[1]);
  }

  if (imports.length === 0) {
    return {
      passed: true,
      severity: "none",
      message: "No @imports found",
      details: { imports: [] },
    };
  }

  const results: Array<{ path: string; exists: boolean; readable: boolean }> = [];

  for (const importPath of imports) {
    const fullPath = resolve(repositoryRoot, importPath);

    // Simple containment check
    if (!fullPath.startsWith(repositoryRoot)) {
      results.push({ path: importPath, exists: false, readable: false });
      continue;
    }

    const fileExists = existsSync(fullPath);
    let readable = false;
    if (fileExists) {
      try {
        readFileSync(fullPath, "utf-8");
        readable = true;
      } catch {
        // Not readable
      }
    }
    results.push({ path: importPath, exists: fileExists, readable });
  }

  const missing = results.filter((r) => !r.exists);
  const unreadable = results.filter((r) => r.exists && !r.readable);

  if (missing.length > 0) {
    const paths = missing.map((r) => r.path).join(", ");
    return {
      passed: false,
      severity: "error",
      message: `${missing.length} imported file(s) not found: ${paths}`,
      details: { imports: results },
    };
  }

  if (unreadable.length > 0) {
    const paths = unreadable.map((r) => r.path).join(", ");
    return {
      passed: false,
      severity: "error",
      message: `${unreadable.length} imported file(s) not readable: ${paths}`,
      details: { imports: results },
    };
  }

  return {
    passed: true,
    severity: "none",
    message: `All ${imports.length} imported files exist and are readable`,
    details: { imports: results },
  };
}

function checkSkillFrontmatter(skillPath: string): CheckResult {
  const skillMd = join(skillPath, "SKILL.md");

  if (!existsSync(skillMd)) {
    return { passed: false, severity: "error", message: "SKILL.md not found", details: {} };
  }

  const content = readFileSync(skillMd, "utf-8");

  if (!content.startsWith("---\n")) {
    return {
      passed: false,
      severity: "error",
      message: "Frontmatter not found (must start with --- on line 1)",
      details: {},
    };
  }

  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    return {
      passed: false,
      severity: "error",
      message: "Frontmatter end delimiter (---) not found",
      details: {},
    };
  }

  const frontmatter = fmMatch[1];

  const hasName = /^name:\s*\S+|^\s+name:\s*\S+/m.test(frontmatter);
  const hasDescription = /^description:\s*\S+|^\s+description:\s*\S+/m.test(frontmatter);

  if (!hasName) {
    return {
      passed: false,
      severity: "error",
      message: "Missing required frontmatter field: name",
      details: {},
    };
  }

  if (!hasDescription) {
    return {
      passed: false,
      severity: "error",
      message: "Missing required frontmatter field: description",
      details: {},
    };
  }

  const nameMatch = frontmatter.match(/name:\s*([^\r\n]+)/);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (!/^[a-z0-9-]{1,64}$/.test(name)) {
      return {
        passed: false,
        severity: "error",
        message: `Invalid name format: '${name}' (lowercase alphanum+hyphens)`,
        details: {},
      };
    }
  }

  return {
    passed: true,
    severity: "none",
    message: "Valid frontmatter with required fields",
    details: {},
  };
}

function checkNoDuplicateContent(
  skillPath: string,
  passiveContextFiles: readonly string[],
): CheckResult {
  const skillMd = join(skillPath, "SKILL.md");

  if (!existsSync(skillMd)) {
    return {
      passed: true,
      severity: "none",
      message: "SKILL.md not found, skipping duplicate check",
      details: {},
    };
  }

  const skillContent = readFileSync(skillMd, "utf-8");

  const fmMatch = skillContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const skillBody = fmMatch ? fmMatch[1] : skillContent;

  const skillPhrases = skillBody
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 20 && !line.startsWith("```") && !line.startsWith("#"),
    );

  const duplicates: Array<{ phrase: string; file: string }> = [];

  for (const passiveFile of passiveContextFiles) {
    if (!existsSync(passiveFile)) continue;

    const passiveContent = readFileSync(passiveFile, "utf-8");

    for (const phrase of skillPhrases) {
      if (phrase.length > 30 && passiveContent.includes(phrase)) {
        const fileName = passiveFile.split("/").pop() ?? passiveFile;
        duplicates.push({ phrase: phrase.slice(0, 50), file: fileName });
      }
    }
  }

  if (duplicates.length > 0) {
    return {
      passed: false,
      severity: "warning",
      message: `Found ${duplicates.length} potential duplicate phrase(s) in passive context`,
      details: { duplicates },
    };
  }

  return { passed: true, severity: "none", message: "No obvious duplicates found", details: {} };
}

// --- Main Compliance Runner ---

function runComplianceChecks(
  path: string,
  claudeMdPath: string,
): ComplianceResults {
  const repoRoot = findRepositoryRoot();
  const fullPath = resolve(repoRoot, path);
  const fullClaudeMdPath = resolve(repoRoot, claudeMdPath);

  const results: ComplianceResults = {
    timestamp: new Date().toISOString(),
    path,
    claudeMdPath,
    violations: [],
    warnings: [],
    recommendations: [],
    summary: { total_checks: 0, passed: 0, failed: 0, warnings: 0 },
  };

  // Check 1: CLAUDE.md line count
  results.summary.total_checks++;
  const lineCheck = checkClaudeMdLineCount(fullClaudeMdPath);

  if (lineCheck.passed) {
    results.summary.passed++;
    if (lineCheck.severity === "warning") {
      results.warnings.push({ check: "CLAUDE.md Line Count", message: lineCheck.message });
      results.summary.warnings++;
    }
  } else {
    results.summary.failed++;
    results.violations.push({
      check: "CLAUDE.md Line Count",
      severity: lineCheck.severity,
      message: lineCheck.message,
      recommendation: "Split content into separate files and use @imports",
    });
  }

  // Check 2: @imported files exist
  results.summary.total_checks++;
  const importCheck = checkImportedFilesExist(fullClaudeMdPath, repoRoot);

  if (importCheck.passed) {
    results.summary.passed++;
  } else {
    results.summary.failed++;
    results.violations.push({
      check: "@Imported Files Exist",
      severity: importCheck.severity,
      message: importCheck.message,
      recommendation: "Create missing files or remove @import directives",
    });
  }

  // Get passive context files for duplicate checking
  const passiveContextFiles: string[] = [fullClaudeMdPath];
  const importDetails = importCheck.details.imports as
    | Array<{ path: string; exists: boolean }>
    | undefined;
  if (importDetails) {
    for (const importInfo of importDetails) {
      if (importInfo.exists) {
        passiveContextFiles.push(resolve(repoRoot, importInfo.path));
      }
    }
  }

  // Check 3-6: Passive context files (knowledge-only check)
  for (const file of passiveContextFiles) {
    if (!existsSync(file)) continue;

    results.summary.total_checks++;
    const passiveCheck = checkPassiveContextKnowledgeOnly(file);

    if (passiveCheck.passed) {
      results.summary.passed++;
    } else {
      const fileName = file.split("/").pop() ?? file;
      if (passiveCheck.severity === "warning") {
        results.summary.warnings++;
        results.warnings.push({
          check: `Passive Context Knowledge-Only (${fileName})`,
          message: passiveCheck.message,
        });
        results.recommendations.push(
          `Extract action patterns from ${fileName} to a skill`,
        );
      } else {
        results.summary.failed++;
        results.violations.push({
          check: `Passive Context Knowledge-Only (${fileName})`,
          severity: passiveCheck.severity,
          message: passiveCheck.message,
          recommendation: "Extract action patterns to a skill",
        });
      }
    }
  }

  // Check 4-6: Skills (if scanning skills directory)
  if (existsSync(fullPath)) {
    const entries = readdirSync(fullPath);
    const skillDirs = entries.filter((entry) => {
      const entryPath = join(fullPath, entry);
      return (
        statSync(entryPath).isDirectory() &&
        existsSync(join(entryPath, "SKILL.md"))
      );
    });

    for (const skillName of skillDirs) {
      const skillDir = join(fullPath, skillName);

      // Check: Skill has actions
      results.summary.total_checks++;
      const actionCheck = checkSkillHasActions(skillDir);

      if (actionCheck.passed) {
        results.summary.passed++;
      } else {
        if (actionCheck.severity === "warning") {
          results.summary.warnings++;
          results.warnings.push({
            check: `Skill Has Actions (${skillName})`,
            message: actionCheck.message,
          });
          results.recommendations.push(
            `Consider moving ${skillName} to passive context`,
          );
        } else {
          results.summary.failed++;
          results.violations.push({
            check: `Skill Has Actions (${skillName})`,
            severity: actionCheck.severity,
            message: actionCheck.message,
            recommendation: `Add scripts to ${skillName}`,
          });
        }
      }

      // Check: Skill has required frontmatter
      results.summary.total_checks++;
      const frontmatterCheck = checkSkillFrontmatter(skillDir);

      if (frontmatterCheck.passed) {
        results.summary.passed++;
      } else {
        results.summary.failed++;
        results.violations.push({
          check: `Skill Frontmatter (${skillName})`,
          severity: frontmatterCheck.severity,
          message: frontmatterCheck.message,
          recommendation: `Add frontmatter to ${skillName}/SKILL.md`,
        });
      }

      // Check: No duplicate content
      results.summary.total_checks++;
      const duplicateCheck = checkNoDuplicateContent(skillDir, passiveContextFiles);

      if (duplicateCheck.passed) {
        results.summary.passed++;
      } else {
        results.summary.warnings++;
        results.warnings.push({
          check: `No Duplicate Content (${skillName})`,
          message: duplicateCheck.message,
        });
        results.recommendations.push(
          `Review ${skillName} for content that duplicates passive context`,
        );
      }
    }
  }

  return results;
}

// --- Table Output ---

function printTableFormat(results: ComplianceResults): void {
  console.log("\nSkill/Passive Context Compliance Check");
  console.log("=".repeat(70));
  console.log(`Timestamp: ${results.timestamp}`);
  console.log(`Path: ${results.path}`);
  console.log(`CLAUDE.md: ${results.claudeMdPath}`);
  console.log();

  console.log("Summary:");
  console.log(`  Total Checks: ${results.summary.total_checks}`);
  console.log(`  Passed: ${results.summary.passed}`);
  console.log(`  Failed: ${results.summary.failed}`);
  console.log(`  Warnings: ${results.summary.warnings}`);

  if (results.violations.length > 0) {
    console.log("\nViolations:");
    for (const violation of results.violations) {
      console.log(`  [FAIL] ${violation.check}`);
      console.log(`     Severity: ${(violation.severity as string).toUpperCase()}`);
      console.log(`     Issue: ${violation.message}`);
      console.log(`     Fix: ${violation.recommendation}`);
      console.log();
    }
  }

  if (results.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of results.warnings) {
      console.log(`  [WARNING] ${warning.check}`);
      console.log(`     ${warning.message}`);
      console.log();
    }
  }

  if (results.recommendations.length > 0) {
    console.log("\nRecommendations:");
    for (const rec of results.recommendations) {
      console.log(`  - ${rec}`);
    }
  }

  console.log();
  if (results.summary.failed === 0) {
    console.log("[PASS] All compliance checks passed");
  } else {
    console.log("[FAIL] Compliance violations detected");
  }
}

// --- CLI ---

function main(): number {
  const args = process.argv.slice(2);

  let path = ".claude";
  let claudeMdPath = "CLAUDE.md";
  let format = "json";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--path" && i + 1 < args.length) {
      path = args[++i];
    } else if (arg === "--claude-md-path" && i + 1 < args.length) {
      claudeMdPath = args[++i];
    } else if (arg === "--format" && i + 1 < args.length) {
      const val = args[++i];
      if (val !== "json" && val !== "table") {
        console.error(`Error: Invalid format: ${val} (must be json or table)`);
        return 1;
      }
      format = val;
    }
  }

  try {
    const results = runComplianceChecks(path, claudeMdPath);

    if (format === "table") {
      printTableFormat(results);
    } else {
      console.log(JSON.stringify(results, null, 2));
    }

    return results.summary.failed > 0 ? 1 : 0;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Compliance check failed: ${message}`);
    return 1;
  }
}

process.exit(main());
