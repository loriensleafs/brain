#!/usr/bin/env bun
/**
 * CVA Template Generator
 *
 * Creates an empty CVA matrix template from user-specified commonalities and variabilities.
 *
 * Exit Codes:
 *   0: Template generated
 *   1: Invalid arguments
 *
 * Usage:
 *   bun run generate-cva-template.ts \
 *     --commonalities "Validate,Authorize,Record,Handle errors" \
 *     --variabilities "CreditCard,PayPal,BankTransfer" \
 *     --output cva-matrix.md
 */

import { resolve } from "path";

function generateTemplate(commonalities: string[], variabilities: string[]): string {
  const lines: string[] = [];

  // Header row
  const header = ["Commonality", ...variabilities];
  lines.push(`| ${header.join(" | ")} |`);

  // Separator row
  const separator = header.map((h) => "-".repeat(Math.max(h.length, 3)));
  lines.push(`| ${separator.join(" | ")} |`);

  // Data rows with TBD cells
  for (const commonality of commonalities) {
    const cells = [commonality, ...variabilities.map(() => "TBD")];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

function generateFullDocument(commonalities: string[], variabilities: string[]): string {
  const matrix = generateTemplate(commonalities, variabilities);

  return `# CVA Matrix

## Use Cases

${variabilities.map((v, i) => `${i + 1}. ${v}`).join("\n")}

## CVA Matrix

${matrix}

## Pattern Recommendations

_Run validation after filling matrix:_

\`\`\`bash
bun run \${CLAUDE_SKILL_DIR}/scripts/validate-cva-matrix.ts cva-matrix.md
\`\`\`

## Reassessment Triggers

Re-run CVA when:

1. 3+ new use cases added
2. Major architectural shift
3. Performance issues with current abstraction
4. Team feedback: abstraction too complex or not pulling weight
`;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: bun run generate-cva-template.ts \\
  --commonalities "Validate,Authorize,Record,Handle errors" \\
  --variabilities "CreditCard,PayPal,BankTransfer" \\
  --output cva-matrix.md`);
    return 1;
  }

  let commonalitiesRaw = "";
  let variabilitiesRaw = "";
  let outputPath = "";

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--commonalities":
        commonalitiesRaw = args[++i] ?? "";
        break;
      case "--variabilities":
        variabilitiesRaw = args[++i] ?? "";
        break;
      case "--output":
        outputPath = args[++i] ?? "";
        break;
    }
  }

  if (!commonalitiesRaw.trim()) {
    console.error("ERROR: --commonalities is required");
    return 1;
  }

  if (!variabilitiesRaw.trim()) {
    console.error("ERROR: --variabilities is required");
    return 1;
  }

  const commonalities = commonalitiesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const variabilities = variabilitiesRaw.split(",").map((s) => s.trim()).filter(Boolean);

  if (commonalities.length < 1) {
    console.error("ERROR: At least 1 commonality required");
    return 1;
  }

  if (variabilities.length < 2) {
    console.error("ERROR: At least 2 variabilities required for CVA analysis");
    return 1;
  }

  const document = generateFullDocument(commonalities, variabilities);

  if (outputPath) {
    const resolvedOutput = resolve(outputPath);
    await Bun.write(resolvedOutput, document);
    console.log(`[PASS] CVA template generated: ${resolvedOutput}`);
    console.log(`  ${commonalities.length} commonalities x ${variabilities.length} variabilities`);
    console.log("  Fill in TBD cells with concrete implementations, then validate.");
  } else {
    console.log(document);
  }

  return 0;
}

process.exit(await main());
