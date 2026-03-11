/**
 * package_skill.ts - Creates a distributable .skill file
 *
 * Validates a skill using quick_validate.ts, then packages it into a .skill
 * file (zip format) for distribution.
 *
 * Usage:
 *    bun package_skill.ts <path/to/skill-folder> [output-directory]
 *
 * Example:
 *    bun package_skill.ts ~/.claude/skills/my-skill
 *    bun package_skill.ts ~/.claude/skills/my-skill ./dist
 */

import {
  existsSync,
  realpathSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
} from "fs";
import { resolve, join, sep, relative } from "path";
import { Glob } from "bun";
import { validateSkill } from "./quick_validate";

// ===========================================================================
// TYPES
// ===========================================================================

interface PackageResult {
  success: boolean;
  message: string;
  outputPath?: string;
}

// ===========================================================================
// SKILLIGNORE
// ===========================================================================

function loadSkillignore(skillPath: string): string[] {
  const ignoreFile = join(skillPath, ".skillignore");
  if (!existsSync(ignoreFile)) {
    return [];
  }

  const content = readFileSync(ignoreFile, "utf-8");
  const patterns: string[] = [];
  for (const line of content.split("\n")) {
    const stripped = line.trim();
    if (stripped && !stripped.startsWith("#")) {
      patterns.push(stripped);
    }
  }
  return patterns;
}

function isIgnored(
  filePath: string,
  skillPath: string,
  patterns: string[],
): boolean {
  const relPath = relative(skillPath, filePath);
  const name = filePath.split("/").pop() ?? "";

  for (const pattern of patterns) {
    // Simple glob matching using Bun
    const glob = new Glob(pattern);
    if (glob.match(name) || glob.match(relPath)) {
      return true;
    }
    // Handle directory-style patterns
    if (relPath.startsWith(pattern + "/") || relPath === pattern) {
      return true;
    }
  }
  return false;
}

// ===========================================================================
// PACKAGING
// ===========================================================================

function packageSkill(
  skillPathArg: string,
  outputDir?: string,
): PackageResult {
  const skillPath = resolve(skillPathArg);
  const HOME = process.env.HOME ?? "";

  // SECURITY: Validate path stays within allowed base directory (CWE-22)
  const skillsRoot = realpathSync(join(HOME, ".claude", "skills"));
  const resolved = realpathSync(skillPath);
  if (!resolved.startsWith(skillsRoot + sep) && resolved !== skillsRoot) {
    return { success: false, message: `Path traversal detected: ${skillPath}` };
  }

  // Validate skill folder exists
  if (!existsSync(skillPath)) {
    return { success: false, message: `Skill folder not found: ${skillPath}` };
  }

  if (!statSync(skillPath).isDirectory()) {
    return {
      success: false,
      message: `Path is not a directory: ${skillPath}`,
    };
  }

  // Validate SKILL.md exists
  if (!existsSync(join(skillPath, "SKILL.md"))) {
    return {
      success: false,
      message: `SKILL.md not found in ${skillPath}`,
    };
  }

  // Run validation before packaging
  console.log("Validating skill...");
  const { valid, message } = validateSkill(skillPath);
  if (!valid) {
    return { success: false, message: `Validation failed: ${message}` };
  }
  console.log(`[PASS] ${message}\n`);

  // Determine output location
  const skillName = skillPath.split("/").pop() ?? "skill";
  let outputPath: string;

  if (outputDir) {
    outputPath = resolve(outputDir);
    const cwdReal = realpathSync(process.cwd());
    const outputReal = realpathSync(outputPath);
    if (
      !outputReal.startsWith(cwdReal + sep) &&
      outputReal !== cwdReal
    ) {
      return {
        success: false,
        message: `Path traversal detected: ${outputDir}`,
      };
    }
    mkdirSync(outputPath, { recursive: true });
  } else {
    outputPath = process.cwd();
  }

  const skillFilename = join(outputPath, `${skillName}.skill`);
  const ignorePatterns = loadSkillignore(skillPath);

  // Create the .skill file using Bun's zip writer
  try {
    // Use the system zip command for portability
    const glob = new Glob("**/*");
    const files: string[] = [];

    for (const filePath of glob.scanSync({
      cwd: skillPath,
      absolute: true,
    })) {
      if (!statSync(filePath).isFile()) continue;

      const name = filePath.split("/").pop() ?? "";

      // Skip common exclusions
      if (name.startsWith(".") || filePath.includes("__pycache__")) {
        continue;
      }

      // Apply .skillignore patterns
      if (isIgnored(filePath, skillPath, ignorePatterns)) {
        continue;
      }

      files.push(filePath);
    }

    // Use Bun.spawn to create zip
    const relFiles = files.map((f) => relative(resolve(skillPath, ".."), f));
    const proc = Bun.spawnSync(["zip", "-j", skillFilename, ...files], {
      cwd: resolve(skillPath, ".."),
    });

    // Actually, zip with paths relative to parent
    const proc2 = Bun.spawnSync(
      ["zip", skillFilename, ...relFiles],
      {
        cwd: resolve(skillPath, ".."),
      },
    );

    for (const f of relFiles) {
      console.log(`  Added: ${f}`);
    }

    return {
      success: true,
      message: `Successfully packaged skill to: ${skillFilename}`,
      outputPath: skillFilename,
    };
  } catch (e) {
    return {
      success: false,
      message: `Error creating .skill file: ${e}`,
    };
  }
}

// ===========================================================================
// CLI
// ===========================================================================

function main(): void {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log(
      "Usage: bun package_skill.ts <path/to/skill-folder> [output-directory]",
    );
    console.log("\nExample:");
    console.log("  bun package_skill.ts ~/.claude/skills/my-skill");
    console.log("  bun package_skill.ts ~/.claude/skills/my-skill ./dist");
    process.exit(1);
  }

  const skillPath = args[0];
  const outputDir = args[1];

  console.log(`Packaging skill: ${skillPath}`);
  if (outputDir) {
    console.log(`   Output directory: ${outputDir}`);
  }
  console.log();

  const result = packageSkill(skillPath, outputDir);

  if (result.success) {
    console.log(`\n[PASS] ${result.message}`);
    process.exit(0);
  } else {
    console.log(`[FAIL] ${result.message}`);
    console.log("   Please fix the errors before packaging.");
    process.exit(1);
  }
}

main();
