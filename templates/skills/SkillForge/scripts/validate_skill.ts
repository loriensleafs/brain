/**
 * validate_skill.ts - Structural validation for Claude Code skills
 *
 * Validates that a SKILL.md file meets the requirements defined in
 * SkillForge 4.2's quality standards.
 *
 * Usage:
 *    bun validate_skill.ts <path-to-skill-directory>
 *    bun validate_skill.ts ~/.claude/skills/my-skill/
 */

import { existsSync, readFileSync, realpathSync, readdirSync, statSync } from "fs";
import { resolve, join } from "path";
import { Glob } from "bun";
import {
  ALLOWED_PROPERTIES,
  REQUIRED_PROPERTIES,
  RECOMMENDED_PROPERTIES,
  VALID_AGENT_TYPES,
  VALID_HOOK_EVENTS,
  VALID_HOOK_TYPES,
  KNOWN_TOOLS,
  NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_REGEX,
  SEMVER_REGEX,
  FRONTMATTER_REGEX,
} from "./_constants";

// ===========================================================================
// VALIDATOR
// ===========================================================================

class SkillValidator {
  private skillPath: string;
  private skillMdPath: string;
  private content: string = "";
  private frontmatter: Record<string, unknown> = {};
  private errors: string[] = [];
  private warnings: string[] = [];
  private checksPassed: number = 0;
  private checksTotal: number = 0;

  constructor(skillPath: string) {
    // SECURITY: Validate path stays within allowed base directory (CWE-22)
    const cwdReal = realpathSync(process.cwd());
    const resolved = realpathSync(skillPath);
    if (!resolved.startsWith(cwdReal + "/") && resolved !== cwdReal) {
      throw new Error(`Path traversal detected: ${skillPath}`);
    }
    this.skillPath = resolve(skillPath);
    this.skillMdPath = this.findSkillMd();
  }

  private findSkillMd(): string {
    for (const name of ["SKILL.md", "skill.md"]) {
      const path = join(this.skillPath, name);
      if (existsSync(path)) return path;
    }
    return join(this.skillPath, "SKILL.md");
  }

  private loadSkill(): boolean {
    if (!existsSync(this.skillMdPath)) {
      this.errors.push(`Skill file not found: ${this.skillMdPath}`);
      return false;
    }
    try {
      this.content = readFileSync(this.skillMdPath, "utf-8");
      return true;
    } catch (e) {
      this.errors.push(`Failed to read skill file: ${e}`);
      return false;
    }
  }

  private parseFrontmatter(): boolean {
    const match = this.content.match(FRONTMATTER_REGEX);
    if (!match) {
      this.errors.push("Missing YAML frontmatter");
      return false;
    }

    const frontmatterText = match[1];
    this.parseFrontmatterFallback(frontmatterText);
    return true;
  }

  private parseFrontmatterFallback(text: string): void {
    const lines = text.split("\n");
    let currentKey: string | null = null;
    const currentValueLines: string[] = [];
    let isFolded = false;
    let isLiteral = false;

    for (const line of lines) {
      if (
        line.includes(":") &&
        !line.startsWith(" ") &&
        !line.startsWith("\t")
      ) {
        if (currentKey && (isFolded || isLiteral)) {
          this.frontmatter[currentKey] = currentValueLines.join(" ").trim();
        }

        const colonIdx = line.indexOf(":");
        currentKey = line.slice(0, colonIdx).trim();
        const value = line.slice(colonIdx + 1).trim();

        if (value === ">" || value === ">-") {
          isFolded = true;
          isLiteral = false;
          currentValueLines.length = 0;
        } else if (value === "|" || value === "|-") {
          isLiteral = true;
          isFolded = false;
          currentValueLines.length = 0;
        } else {
          isFolded = false;
          isLiteral = false;
          this.frontmatter[currentKey] = value;
          currentValueLines.length = 0;
        }
      } else if (
        (isFolded || isLiteral) &&
        (line.startsWith("  ") || line.startsWith("\t"))
      ) {
        currentValueLines.push(line.trim());
      } else if (line.startsWith("  ") && currentKey === "metadata") {
        if (
          !this.frontmatter["metadata"] ||
          typeof this.frontmatter["metadata"] !== "object"
        ) {
          this.frontmatter["metadata"] = {};
        }
        if (line.includes(":")) {
          const colonIdx = line.indexOf(":");
          const nestedKey = line.slice(0, colonIdx).trim();
          const nestedValue = line.slice(colonIdx + 1).trim();
          (this.frontmatter["metadata"] as Record<string, string>)[nestedKey] =
            nestedValue;
        }
      }
    }

    if (currentKey && (isFolded || isLiteral) && currentValueLines.length > 0) {
      this.frontmatter[currentKey] = currentValueLines.join(" ").trim();
    }
  }

  private check(
    name: string,
    condition: boolean,
    errorMsg?: string,
    warning: boolean = false,
  ): boolean {
    this.checksTotal++;
    if (condition) {
      this.checksPassed++;
      return true;
    }
    const msg = errorMsg ?? `Check failed: ${name}`;
    if (warning) {
      this.warnings.push(msg);
    } else {
      this.errors.push(msg);
    }
    return false;
  }

  private validateFrontmatter(): void {
    for (const field of REQUIRED_PROPERTIES) {
      this.check(
        `frontmatter.${field}`,
        field in this.frontmatter && Boolean(this.frontmatter[field]),
        `Missing required frontmatter field: ${field}`,
      );
    }

    for (const field of RECOMMENDED_PROPERTIES) {
      this.check(
        `frontmatter.${field}`,
        field in this.frontmatter,
        `Recommended frontmatter field missing: ${field}`,
        true,
      );
    }

    const unexpectedKeys = Object.keys(this.frontmatter).filter(
      (k) => !ALLOWED_PROPERTIES.has(k),
    );
    if (unexpectedKeys.length > 0) {
      this.check(
        "frontmatter.allowed_properties",
        false,
        `Unexpected frontmatter properties: ${unexpectedKeys.sort().join(", ")}. Allowed: ${[...ALLOWED_PROPERTIES].sort().join(", ")}`,
      );
    }

    if ("name" in this.frontmatter) {
      const name = String(this.frontmatter["name"]);
      this.check(
        "frontmatter.name.format",
        NAME_REGEX.test(name) && !name.includes("--"),
        `Skill name should be hyphen-case (start with letter, no consecutive hyphens): ${name}`,
      );
      this.check(
        "frontmatter.name.length",
        name.length <= NAME_MAX_LENGTH,
        `Skill name too long (${name.length} chars, max ${NAME_MAX_LENGTH})`,
      );
    }

    if ("description" in this.frontmatter) {
      const desc = String(this.frontmatter["description"]);
      this.check(
        "frontmatter.description.characters",
        !desc.includes("<") && !desc.includes(">"),
        "Description cannot contain angle brackets (< or >)",
      );
      this.check(
        "frontmatter.description.length",
        desc.length <= DESCRIPTION_MAX_LENGTH,
        `Description too long (${desc.length} chars, max ${DESCRIPTION_MAX_LENGTH})`,
        true,
      );
    }

    // Validate version
    const version =
      this.frontmatter["version"] ??
      (typeof this.frontmatter["metadata"] === "object"
        ? (this.frontmatter["metadata"] as Record<string, unknown>)["version"]
        : undefined);
    if (version) {
      this.check(
        "frontmatter.version.format",
        SEMVER_REGEX.test(String(version)),
        `Version should be semver format: ${version}`,
        true,
      );
    }

    if ("context" in this.frontmatter) {
      this.check(
        "frontmatter.context.value",
        this.frontmatter["context"] === "fork",
        `context should be 'fork' (got '${this.frontmatter["context"]}')`,
        true,
      );
    }

    if ("agent" in this.frontmatter) {
      this.check(
        "frontmatter.agent.value",
        VALID_AGENT_TYPES.has(String(this.frontmatter["agent"])),
        `agent should be one of ${[...VALID_AGENT_TYPES].join(", ")} (got '${this.frontmatter["agent"]}')`,
        true,
      );
      if (this.frontmatter["context"] !== "fork") {
        this.check(
          "frontmatter.agent.requires_context",
          false,
          "'agent' field requires 'context: fork' to be set",
          true,
        );
      }
    }

    if ("user-invocable" in this.frontmatter) {
      const value = this.frontmatter["user-invocable"];
      this.check(
        "frontmatter.user-invocable.type",
        value === "true" || value === "false" || typeof value === "boolean",
        `user-invocable must be a boolean (got ${typeof value})`,
      );
    }

    this.validateAllowedTools();
    this.validateHooks();
  }

  private validateAllowedTools(): void {
    if (!("allowed-tools" in this.frontmatter)) return;

    const toolsValue = this.frontmatter["allowed-tools"];
    let tools: string[];

    if (typeof toolsValue === "string") {
      tools = toolsValue.split(",").map((t) => t.trim());
    } else if (Array.isArray(toolsValue)) {
      tools = toolsValue.map(String);
    } else {
      this.check(
        "frontmatter.allowed-tools.type",
        false,
        `allowed-tools should be string or list (got ${typeof toolsValue})`,
      );
      return;
    }

    const unknownTools = tools.filter((t) => !KNOWN_TOOLS.has(t));
    if (unknownTools.length > 0) {
      this.check(
        "frontmatter.allowed-tools.values",
        false,
        `Unknown tool(s): ${unknownTools.join(", ")}. Known: ${[...KNOWN_TOOLS].sort().join(", ")}`,
        true,
      );
    }
  }

  private validateHooks(): void {
    if (!("hooks" in this.frontmatter)) return;

    const hooks = this.frontmatter["hooks"];
    if (typeof hooks !== "object" || hooks === null) {
      this.check(
        "frontmatter.hooks.type",
        false,
        `hooks must be an object (got ${typeof hooks})`,
      );
      return;
    }

    // Hooks validation is simplified for the fallback parser.
    // Full hook validation requires proper YAML parsing.
    for (const hookName of Object.keys(hooks as Record<string, unknown>)) {
      this.check(
        `frontmatter.hooks.${hookName}.name`,
        VALID_HOOK_EVENTS.has(hookName),
        `Unknown hook event: '${hookName}'. Valid: ${[...VALID_HOOK_EVENTS].join(", ")}`,
      );
    }
  }

  private validateTriggers(): void {
    const triggersMatch = this.content.match(
      /##\s*Triggers\s*\n(.*?)(?=\n##|\Z)/si,
    );
    this.check("section.triggers", triggersMatch !== null, "Missing Triggers section");

    if (triggersMatch) {
      const triggerCount = (triggersMatch[1].match(/`[^`]+`/g) ?? []).length;
      this.check(
        "triggers.count",
        triggerCount >= 3 && triggerCount <= 5,
        `Should have 3-5 trigger phrases (found ${triggerCount})`,
      );
    }
  }

  private validateProcess(): void {
    const hasProcess = /##\s*Process/i.test(this.content);
    const hasPhases = /###\s*Phase\s*\d/i.test(this.content);

    this.check(
      "section.process",
      hasProcess || hasPhases,
      "Missing Process section or Phase definitions",
    );

    if (hasPhases) {
      const phaseCount = (this.content.match(/###\s*Phase\s*\d/gi) ?? []).length;
      this.check(
        "phases.count",
        phaseCount >= 1 && phaseCount <= 3,
        `Recommend 1-3 phases (found ${phaseCount})`,
        true,
      );
    }
  }

  private validateVerification(): void {
    const hasVerification = /##\s*(Verification|Success Criteria|Checklist)/i.test(
      this.content,
    );
    this.check("section.verification", hasVerification, "Missing Verification section");

    const checkboxCount = (this.content.match(/\[\s*\]/g) ?? []).length;
    this.check(
      "verification.checkboxes",
      checkboxCount >= 2,
      `Verification should have concrete checkboxes (found ${checkboxCount})`,
      true,
    );
  }

  private validateAntiPatterns(): void {
    const hasAntiPatterns = /##\s*Anti[-\s]?Patterns/i.test(this.content);
    this.check(
      "section.anti_patterns",
      hasAntiPatterns,
      "Missing Anti-Patterns section",
      true,
    );
  }

  private validateStructure(): void {
    const hasH1 = /^---.*?---\s*\n#\s+/s.test(this.content);
    this.check("structure.h1_title", hasH1, "Missing H1 title after frontmatter");

    const tableCount = (this.content.match(/\|.*\|.*\|/g) ?? []).length;
    this.check(
      "structure.tables",
      tableCount >= 1,
      "Should use tables for structured information",
      true,
    );

    const hasExtensions = /##\s*(Extension|Future|Evolution)/i.test(this.content);
    this.check(
      "section.extension_points",
      hasExtensions,
      "Missing Extension Points section",
      true,
    );
  }

  private validateReferencesDirectory(): void {
    const refsPath = join(this.skillPath, "references");
    const lineCount = this.content.split("\n").length;

    if (lineCount > 200) {
      const hasRefs =
        existsSync(refsPath) &&
        readdirSync(refsPath).length > 0;
      this.check(
        "structure.references",
        hasRefs,
        "Complex skill (>200 lines) should have references/ directory",
        true,
      );
    }
  }

  private validateScriptsDirectory(): void {
    const scriptsPath = join(this.skillPath, "scripts");

    if (!existsSync(scriptsPath)) {
      const tsScriptRefs = (this.content.match(/bun\s+scripts\//g) ?? []).length;
      if (tsScriptRefs > 0) {
        this.check(
          "scripts.presence",
          false,
          "SKILL.md references scripts/ but no scripts directory exists",
        );
      }
      return;
    }

    // Validate each TypeScript script
    const glob = new Glob("*.ts");
    const scripts = [...glob.scanSync({ cwd: scriptsPath, absolute: true })];

    for (const script of scripts) {
      this.validateScript(script);
    }

    this.validateScriptDocumentation(scripts);
  }

  private validateScript(scriptPath: string): void {
    let content: string;
    try {
      content = readFileSync(scriptPath, "utf-8");
    } catch (e) {
      const name = scriptPath.split("/").pop() ?? scriptPath;
      this.check(`script.${name}.readable`, false, `Cannot read script ${name}: ${e}`);
      return;
    }

    const scriptName = scriptPath.split("/").pop() ?? "";
    const isPrivateModule = scriptName.startsWith("_");

    // Check for JSDoc/docstring header
    const hasDocstring = content.includes("/**") || content.includes("/*");
    this.check(
      `script.${scriptName}.header`,
      hasDocstring,
      `Script ${scriptName} should have a JSDoc comment header`,
      true,
    );

    if (isPrivateModule) return;

    // Check for argv/CLI handling
    const hasMain =
      content.includes("function main") || content.includes("main()");
    const hasCli =
      content.includes("process.argv") || content.includes("Bun.argv");
    if (hasMain) {
      this.check(
        `script.${scriptName}.cli`,
        hasCli,
        `Script ${scriptName} should handle CLI arguments`,
        true,
      );
    }

    // Check for explicit exit codes
    const hasExit = content.includes("process.exit");
    this.check(
      `script.${scriptName}.exit_codes`,
      hasExit,
      `Script ${scriptName} should use explicit exit codes`,
      true,
    );

    // Check for error handling
    const hasTryCatch = content.includes("try") && content.includes("catch");
    this.check(
      `script.${scriptName}.error_handling`,
      hasTryCatch,
      `Script ${scriptName} should have error handling`,
      true,
    );

    // Check for result pattern
    const hasResultPattern =
      content.includes("Result") ||
      content.includes("ValidationResult") ||
      /return\s*\{?\s*(?:success|valid)\s*:/.test(content);
    this.check(
      `script.${scriptName}.result_pattern`,
      hasResultPattern,
      `Script ${scriptName} should use Result pattern`,
      true,
    );
  }

  private validateScriptDocumentation(scripts: string[]): void {
    if (scripts.length === 0) return;

    const hasScriptsSection = /##\s*Scripts/i.test(this.content);
    this.check(
      "scripts.documented.section",
      hasScriptsSection,
      "Skills with scripts should have a Scripts section documenting usage",
    );

    for (const script of scripts) {
      const scriptName = script.split("/").pop() ?? "";
      this.check(
        `scripts.documented.${scriptName}`,
        this.content.includes(scriptName),
        `Script ${scriptName} should be documented in SKILL.md`,
        true,
      );
    }

    const hasExitDocs = /Exit\s*Code|exit\s+code|Exit:\s*\d/i.test(
      this.content,
    );
    this.check(
      "scripts.documented.exit_codes",
      hasExitDocs,
      "Skills with scripts should document exit codes",
      true,
    );
  }

  validate(): { passed: boolean; report: string } {
    if (!this.loadSkill()) {
      return { passed: false, report: this.formatReport() };
    }
    if (!this.parseFrontmatter()) {
      return { passed: false, report: this.formatReport() };
    }

    this.validateFrontmatter();
    this.validateTriggers();
    this.validateProcess();
    this.validateVerification();
    this.validateAntiPatterns();
    this.validateStructure();
    this.validateReferencesDirectory();
    this.validateScriptsDirectory();

    return {
      passed: this.errors.length === 0,
      report: this.formatReport(),
    };
  }

  private formatReport(): string {
    const lines = [
      `\n${"=".repeat(60)}`,
      `Skill Validation Report: ${this.skillPath.split("/").pop()}`,
      `${"=".repeat(60)}`,
      `\nFile: ${this.skillMdPath}`,
      `Checks: ${this.checksPassed}/${this.checksTotal} passed`,
    ];

    if (this.errors.length > 0) {
      lines.push(`\n${"=".repeat(24)}ERRORS${"=".repeat(24)}`);
      for (const error of this.errors) {
        lines.push(`  [FAIL] ${error}`);
      }
    }

    if (this.warnings.length > 0) {
      lines.push(`\n${"=".repeat(22)}WARNINGS${"=".repeat(22)}`);
      for (const warning of this.warnings) {
        lines.push(`  [WARN] ${warning}`);
      }
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      lines.push("\n[PASS] All checks passed!");
    }

    lines.push(`\n${"=".repeat(60)}\n`);
    return lines.join("\n");
  }
}

// ===========================================================================
// CLI
// ===========================================================================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log("Usage: bun validate_skill.ts <path-to-skill-directory>");
    console.log("Example: bun validate_skill.ts ~/.claude/skills/my-skill/");
    process.exit(1);
  }

  const skillPath = args[0];
  const validator = new SkillValidator(skillPath);
  const { passed, report } = validator.validate();

  console.log(report);
  process.exit(passed ? 0 : 1);
}

main();
