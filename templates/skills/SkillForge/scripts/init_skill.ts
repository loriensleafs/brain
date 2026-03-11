/**
 * init_skill.ts - Scaffold a new agent skill (Claude Code/Codex)
 *
 * Creates a complete skill directory with SKILL.md template, references/,
 * scripts/, and assets/ subdirectories pre-populated with starter files.
 *
 * Usage:
 *    bun init_skill.ts <skill-name> [--path <parent-directory>]
 *
 * Examples:
 *    bun init_skill.ts code-reviewer
 *    bun init_skill.ts deploy-helper --path ~/my-skills
 *    bun init_skill.ts test-generator --path ~/.codex/skills
 *
 * Exit Codes:
 *    0  - Success
 *    1  - General failure
 *    2  - Invalid arguments
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { resolve, join } from "path";

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function skillMdTemplate(name: string, title: string): string {
  return `---
name: ${name}
description: >
  TODO: Describe what this skill does in 1-2 sentences.
---

# ${title}

TODO: One-line summary of this skill's purpose.

## Triggers

- \`${name}: {goal}\` - TODO: Primary trigger description
- \`TODO: trigger phrase 2\` - TODO: Description
- \`TODO: trigger phrase 3\` - TODO: Description

## Quick Reference

| Input | Output | Duration |
|-------|--------|----------|
| TODO  | TODO   | TODO     |

## Process

### Phase 1: TODO Phase Name

TODO: Describe what happens in this phase.

1. **TODO Step 1** - Description
2. **TODO Step 2** - Description

**Verification:** TODO: How to verify this phase succeeded.

### Phase 2: TODO Phase Name

TODO: Describe what happens in this phase.

1. **TODO Step 1** - Description
2. **TODO Step 2** - Description

**Verification:** TODO: How to verify this phase succeeded.

## Anti-Patterns

| Avoid | Why | Instead |
|-------|-----|---------|
| TODO  | TODO | TODO   |

## Verification

After execution:

- [ ] TODO: Check 1
- [ ] TODO: Check 2
- [ ] TODO: Check 3

## References

- [TODO](references/TODO) - TODO: Description
`;
}

function readmeReferences(name: string): string {
  return `# References

Supporting documents for the ${name} skill.

Place domain knowledge, standards, examples, and long-form context here.
These files are loaded by the agent when deeper context is needed.

## Guidelines

- One topic per file, keep files focused
- Use markdown for prose, JSON/YAML for structured data
- Name files descriptively: \`api-conventions.md\`, \`error-catalog.json\`
- Keep individual files under 500 lines
`;
}

function readmeScripts(name: string): string {
  return `# Scripts

Automation scripts for the ${name} skill.

Scripts extend what the skill can do beyond prompt instructions.
They run via \`bun scripts/<name>.ts\` from the skill root.

## Guidelines

- Each script should have a docstring header, argv CLI, and explicit exit codes
- Use the Result type pattern (see script-template.ts in SkillForge assets)
- Exit 0 = success, 1 = failure, 2 = bad args, 10 = validation fail
`;
}

function readmeAssets(name: string): string {
  return `# Assets

Static assets for the ${name} skill.

Place templates, configuration files, images, and other non-code
resources here.

## Guidelines

- Templates go in \`assets/templates/\`
- Images go in \`assets/images/\`
- Keep assets that the skill references, not general documentation
`;
}

const EXAMPLE_REFERENCE = `# Domain Knowledge

TODO: Add domain-specific knowledge that the skill needs.

## Key Concepts

- **TODO Concept 1** - Definition
- **TODO Concept 2** - Definition

## Common Patterns

TODO: Document patterns the skill should follow.

## Edge Cases

TODO: Document edge cases and how to handle them.
`;

function exampleScript(name: string): string {
  return `/**
 * example.ts - Example automation script for ${name}
 *
 * Usage:
 *    bun example.ts <input> [--verbose]
 *
 * Exit Codes:
 *    0  - Success
 *    1  - General failure
 *    2  - Invalid arguments
 */

import { existsSync } from "fs";

function processInput(inputPath: string, verbose: boolean = false): boolean {
  if (!existsSync(inputPath)) {
    console.error(\`Error: File not found: \${inputPath}\`);
    return false;
  }

  if (verbose) {
    console.log(\`Processing: \${inputPath}\`);
  }

  // TODO: Add processing logic
  return true;
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: bun example.ts <input> [--verbose]");
    process.exit(2);
  }

  const inputPath = args[0];
  const verbose = args.includes("--verbose") || args.includes("-v");

  const success = processInput(inputPath, verbose);
  process.exit(success ? 0 : 1);
}

main();
`;
}

// ---------------------------------------------------------------------------
// Organizational pattern suggestions
// ---------------------------------------------------------------------------

const PATTERNS_GUIDE = `
## Skill Organization Patterns

Choose the pattern that best fits your skill's purpose:

### 1. Workflow-Based (multi-step processes)
Best for: build pipelines, deployment flows, review processes
Structure: Phases with sequential steps, verification gates between phases
Example: Phase 1: Analyze -> Phase 2: Generate -> Phase 3: Verify

### 2. Task-Based (single focused action)
Best for: formatters, linters, converters, single-purpose tools
Structure: One main action with input/output, minimal phases
Example: Input -> Transform -> Output with verification

### 3. Reference/Guidelines (standards and conventions)
Best for: style guides, API conventions, architectural decisions
Structure: Rules organized by category, examples for each rule
Example: Naming -> Structure -> Patterns -> Anti-patterns

### 4. Capabilities-Based (toolbox of related actions)
Best for: database tools, file utilities, API helpers
Structure: Multiple independent commands under one skill
Example: create | read | update | delete with shared context
`;

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function validateName(name: string): { valid: boolean; error: string } {
  if (!name) {
    return { valid: false, error: "Skill name cannot be empty" };
  }
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    return {
      valid: false,
      error: `Name '${name}' must be kebab-case (lowercase letters, digits, hyphens)`,
    };
  }
  if (name.endsWith("-") || name.includes("--")) {
    return {
      valid: false,
      error: `Name '${name}' cannot end with hyphen or have consecutive hyphens`,
    };
  }
  if (name.length > 64) {
    return {
      valid: false,
      error: `Name '${name}' exceeds 64 character limit (${name.length} chars)`,
    };
  }
  return { valid: true, error: "" };
}

function toTitle(name: string): string {
  return name
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function createSkill(name: string, parentDir: string): string {
  const title = toTitle(name);
  const skillDir = join(parentDir, name);

  if (existsSync(skillDir)) {
    console.error(`Error: Directory already exists: ${skillDir}`);
    process.exit(1);
  }

  // Create directory structure
  const dirs = [
    skillDir,
    join(skillDir, "references"),
    join(skillDir, "scripts"),
    join(skillDir, "assets"),
  ];
  for (const d of dirs) {
    mkdirSync(d, { recursive: true });
  }

  // Write SKILL.md
  writeFileSync(join(skillDir, "SKILL.md"), skillMdTemplate(name, title));

  // Write README files for subdirectories
  writeFileSync(
    join(skillDir, "references", "README.md"),
    readmeReferences(name),
  );
  writeFileSync(join(skillDir, "scripts", "README.md"), readmeScripts(name));
  writeFileSync(join(skillDir, "assets", "README.md"), readmeAssets(name));

  // Write example files
  writeFileSync(
    join(skillDir, "references", "domain-knowledge.md"),
    EXAMPLE_REFERENCE,
  );
  writeFileSync(join(skillDir, "scripts", "example.ts"), exampleScript(name));

  return skillDir;
}

function printNextSteps(skillDir: string, name: string): void {
  console.log(`
Skill scaffolded: ${skillDir}

Directory structure:
  ${name}/
    SKILL.md              <- Main skill definition (edit this first)
    references/
      README.md
      domain-knowledge.md <- Example reference file
    scripts/
      README.md
      example.ts          <- Example automation script
    assets/
      README.md

Next steps:
  1. Edit SKILL.md - replace all TODO placeholders
     - Fill in the description in frontmatter
     - Define trigger phrases (3-5 recommended)
     - Write process phases with concrete steps
     - Add anti-patterns and verification checks
  2. Add domain knowledge to references/
  3. Add automation scripts to scripts/ (optional)
  4. Validate: bun validate_skill.ts ${skillDir}
  5. Install:
     - Claude Code: copy to ~/.claude/skills/${name}/

Tips:
  - Keep SKILL.md under 500 lines (hard limit: 1000)
  - Use tables over prose for structured info
  - Frontmatter only needs 'name' and 'description'
  - Reference files keep SKILL.md lean
${PATTERNS_GUIDE}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: bun init_skill.ts <skill-name> [--path <parent-dir>]");
    console.log("\nExamples:");
    console.log("  bun init_skill.ts code-reviewer");
    console.log("  bun init_skill.ts deploy-helper --path ~/my-skills");
    process.exit(2);
  }

  const name = args[0];
  let parentPath = process.cwd();

  const pathIdx = args.indexOf("--path");
  if (pathIdx !== -1 && args[pathIdx + 1]) {
    parentPath = args[pathIdx + 1];
  }

  // Validate name
  const { valid, error } = validateName(name);
  if (!valid) {
    console.error(`Error: ${error}`);
    process.exit(2);
  }

  // Validate parent path
  const parent = resolve(parentPath);
  if (!existsSync(parent)) {
    console.error(`Error: Parent directory not found: ${parent}`);
    process.exit(2);
  }

  // Create scaffold
  const skillDir = createSkill(name, parent);
  printNextSteps(skillDir, name);

  process.exit(0);
}

main();
