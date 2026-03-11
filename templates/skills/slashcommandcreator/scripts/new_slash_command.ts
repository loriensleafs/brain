#!/usr/bin/env bun
/**
 * Create new slash command with frontmatter template.
 *
 * Automates slash command file creation with proper frontmatter structure.
 * Generates a template file that passes initial validation.
 *
 * Exit codes:
 *   0 - Success: Command file created
 *   1 - Error: Invalid input, file exists, or creation failed
 */

import { resolve } from "path";

function validateName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function parseArgs(argv: string[]): { name: string; namespace: string } {
  let name: string | undefined;
  let namespace = "";

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name") {
      name = argv[++i];
    } else if (argv[i] === "--namespace") {
      namespace = argv[++i];
    }
  }

  if (!name) {
    console.error("ERROR: --name is required");
    process.exit(1);
  }

  return { name, namespace };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (!validateName(args.name)) {
    console.error(
      "Error: Name must contain only alphanumeric characters, hyphens, or underscores",
    );
    return 1;
  }

  if (args.namespace && !validateName(args.namespace)) {
    console.error(
      "Error: Namespace must contain only alphanumeric characters, hyphens, or underscores",
    );
    return 1;
  }

  const baseDir = ".claude/commands";
  const filePath = args.namespace
    ? resolve(baseDir, args.namespace, `${args.name}.md`)
    : resolve(baseDir, `${args.name}.md`);

  const file = Bun.file(filePath);
  if (await file.exists()) {
    console.error(`Error: File already exists: ${filePath}`);
    return 1;
  }

  const dir = resolve(filePath, "..");
  const { mkdirSync } = await import("fs");
  try {
    mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(
      `Error: Failed to create commands directory '${dir}': ${err}\n` +
        "Check permissions, disk space, and path validity",
    );
    return 1;
  }

  const template = `---
description: Use when Claude needs to [FILL IN: when to use this command]
argument-hint: <arg>
allowed-tools: []
---

# ${args.name} Command

[FILL IN: Detailed prompt instructions]

## Arguments

- \`$ARGUMENTS\`: [FILL IN: what argument is expected]

## Example

\`\`\`text
/${args.name} [example argument]
\`\`\`
`;

  try {
    await Bun.write(filePath, template);
    const written = Bun.file(filePath);
    if (!(await written.exists())) {
      console.error("Error: File write succeeded but file does not exist");
      return 1;
    }
  } catch (err) {
    console.error(
      `Error: Failed to write command file '${filePath}': ${err}\n` +
        "Check disk space, file locks, and filesystem health",
    );
    return 1;
  }

  console.log(`[PASS] Created: ${filePath}`);
  console.log("\nNext steps:");
  console.log("  1. Edit frontmatter (description, argument-hint, allowed-tools)");
  console.log("  2. Write prompt body");
  console.log(
    `  3. Run: bun run \${CLAUDE_SKILL_DIR}/scripts/validate_slash_command.ts --path ${filePath}`,
  );
  console.log(`  4. Test: /${args.name} [arguments]`);
  return 0;
}

main().then((code) => process.exit(code));

export { validateName };
