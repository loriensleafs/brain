/**
 * quick_validate.ts - Fast validation for Claude Code skills
 *
 * Validates that a skill meets the packaging requirements for distribution.
 * This is the minimal validation required before packaging with package_skill.ts.
 *
 * Usage:
 *    bun quick_validate.ts <skill_directory>
 *    bun quick_validate.ts ~/.claude/skills/my-skill/
 */

import { existsSync, readFileSync, realpathSync } from "fs";
import { resolve, join, sep } from "path";
import {
  ALLOWED_PROPERTIES,
  REQUIRED_PROPERTIES,
  NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NAME_REGEX,
  FRONTMATTER_REGEX,
} from "./_constants";

// ===========================================================================
// FALLBACK YAML PARSER
// ===========================================================================

function parseFrontmatterFallback(
  frontmatterText: string,
): Record<string, unknown> {
  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterText.split("\n");
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
        frontmatter[currentKey] = currentValueLines.join(" ").trim();
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
        frontmatter[currentKey] = value;
        currentValueLines.length = 0;
      }
    } else if (
      (isFolded || isLiteral) &&
      (line.startsWith("  ") || line.startsWith("\t"))
    ) {
      currentValueLines.push(line.trim());
    } else if (line.startsWith("  ") && currentKey === "metadata") {
      if (
        !frontmatter["metadata"] ||
        typeof frontmatter["metadata"] !== "object"
      ) {
        frontmatter["metadata"] = {};
      }
      if (line.includes(":")) {
        const colonIdx = line.indexOf(":");
        const nestedKey = line.slice(0, colonIdx).trim();
        const nestedValue = line.slice(colonIdx + 1).trim();
        (frontmatter["metadata"] as Record<string, string>)[nestedKey] =
          nestedValue;
      }
    }
  }

  if (currentKey && (isFolded || isLiteral) && currentValueLines.length > 0) {
    frontmatter[currentKey] = currentValueLines.join(" ").trim();
  }

  return frontmatter;
}

// ===========================================================================
// VALIDATION
// ===========================================================================

export function validateSkill(
  skillPath: string,
): { valid: boolean; message: string } {
  const resolvedPath = resolve(skillPath);

  // Check SKILL.md exists
  const skillMd = join(resolvedPath, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { valid: false, message: "SKILL.md not found" };
  }

  // Read and validate frontmatter
  const content = readFileSync(skillMd, "utf-8");
  if (!content.startsWith("---")) {
    return { valid: false, message: "No YAML frontmatter found" };
  }

  // Extract frontmatter
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return { valid: false, message: "Invalid frontmatter format" };
  }

  const frontmatterText = match[1];
  const frontmatter = parseFrontmatterFallback(frontmatterText);

  // Check for unexpected properties
  const unexpectedKeys = Object.keys(frontmatter).filter(
    (k) => !ALLOWED_PROPERTIES.has(k),
  );
  if (unexpectedKeys.length > 0) {
    return {
      valid: false,
      message: `Unexpected key(s) in SKILL.md frontmatter: ${unexpectedKeys.sort().join(", ")}. Allowed properties are: ${[...ALLOWED_PROPERTIES].sort().join(", ")}`,
    };
  }

  // Check required fields
  for (const field of REQUIRED_PROPERTIES) {
    if (!(field in frontmatter)) {
      return { valid: false, message: `Missing '${field}' in frontmatter` };
    }
  }

  // Validate name field
  const name = String(frontmatter["name"] ?? "").trim();
  if (name) {
    if (!NAME_REGEX.test(name)) {
      return {
        valid: false,
        message: `Name '${name}' should be hyphen-case (start with letter, lowercase letters, digits, and hyphens only)`,
      };
    }
    if (name.includes("--")) {
      return {
        valid: false,
        message: `Name '${name}' cannot contain consecutive hyphens`,
      };
    }
    if (name.length > NAME_MAX_LENGTH) {
      return {
        valid: false,
        message: `Name is too long (${name.length} characters). Maximum is ${NAME_MAX_LENGTH} characters.`,
      };
    }
  }

  // Validate description field
  const description = String(frontmatter["description"] ?? "").trim();
  if (description) {
    if (description.includes("<") || description.includes(">")) {
      return {
        valid: false,
        message: "Description cannot contain angle brackets (< or >)",
      };
    }
    if (description.length > DESCRIPTION_MAX_LENGTH) {
      return {
        valid: false,
        message: `Description is too long (${description.length} characters). Maximum is ${DESCRIPTION_MAX_LENGTH} characters.`,
      };
    }
  }

  return { valid: true, message: "Skill is valid!" };
}

// ===========================================================================
// CLI
// ===========================================================================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length !== 1) {
    console.log("Usage: bun quick_validate.ts <skill_directory>");
    console.log("\nExample:");
    console.log("  bun quick_validate.ts ~/.claude/skills/my-skill/");
    process.exit(1);
  }

  const skillPath = args[0];
  const HOME = process.env.HOME ?? "";

  // SECURITY: Validate path stays within allowed base directory (CWE-22)
  const skillsRoot = realpathSync(join(HOME, ".claude", "skills"));
  const resolved = realpathSync(skillPath);
  if (!resolved.startsWith(skillsRoot + sep) && resolved !== skillsRoot) {
    console.log(`Error: Path traversal detected: ${skillPath}`);
    process.exit(1);
  }

  if (!existsSync(skillPath)) {
    console.log(`Error: Path not found: ${skillPath}`);
    process.exit(1);
  }

  const { valid, message } = validateSkill(skillPath);

  if (valid) {
    console.log(`[PASS] ${message}`);
  } else {
    console.log(`[FAIL] ${message}`);
  }

  process.exit(valid ? 0 : 1);
}

main();
