#!/usr/bin/env bun
/**
 * Add-Pattern.ts
 *
 * Creates or updates causal patterns in the reflexion memory system (Tier 3).
 * Patterns capture recurring cause-effect relationships observed across episodes.
 *
 * Features:
 * - Creates new patterns with proper markdown format
 * - Updates existing patterns (increments occurrences, updates success rate)
 * - Calculates running average for success rate
 * - Links patterns to episode evidence
 *
 * Usage:
 *   bun run add-pattern.ts --name "Pattern Name" --trigger "When X happens" \
 *     --action "Do Y" --evidence "episode-id" [--success-rate 0.85]
 *
 * Example:
 *   bun run add-pattern.ts --name "Markdownlint Before Edit" \
 *     --trigger "Editing markdown files with spacing issues" \
 *     --action "Run markdownlint --fix before manual edits" \
 *     --evidence "episode-2026-01-20-session-06" \
 *     --success-rate 0.95
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join, basename } from "path";
import { homedir } from "os";
import { parseArgs } from "util";

// Types
interface Pattern {
  id: string;
  name: string;
  category: string;
  trigger: string;
  action: string;
  success_rate: number;
  occurrences: number;
  last_used: string;
  evidence: string[];
}

interface PatternFrontmatter {
  title: string;
  type: string;
  tags: string[];
  pattern_id: string;
  trigger: string;
  action: string;
  success_rate: number;
  occurrences: number;
  last_used: string;
}

// Helper Functions

function getNextPatternId(outputPath: string): string {
  if (!existsSync(outputPath)) {
    return "p001";
  }

  const files = readdirSync(outputPath).filter(
    (f) => f.startsWith("PATTERN-") && f.endsWith(".md")
  );

  if (files.length === 0) {
    return "p001";
  }

  // Extract pattern numbers
  const numbers = files
    .map((f) => {
      const match = f.match(/PATTERN-p(\d+)-/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => n > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `p${String(maxNumber + 1).padStart(3, "0")}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function categorizePattern(trigger: string, action: string): string {
  const combined = `${trigger} ${action}`.toLowerCase();

  if (/error|fail|exception|recover|retry/.test(combined)) {
    return "error-handling";
  }
  if (/test|coverage|assert|pester|pytest/.test(combined)) {
    return "testing";
  }
  if (/lint|format|style|markdown/.test(combined)) {
    return "code-quality";
  }
  if (/build|compile|deploy|ci|pipeline/.test(combined)) {
    return "build-deploy";
  }
  if (/git|commit|branch|merge|pr/.test(combined)) {
    return "version-control";
  }
  if (/memory|cache|performance|optimize/.test(combined)) {
    return "performance";
  }
  if (/security|auth|credential|secret/.test(combined)) {
    return "security";
  }
  if (/agent|route|handoff|delegate/.test(combined)) {
    return "orchestration";
  }
  return "general";
}

function parseExistingPattern(filePath: string): Pattern | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    // Parse frontmatter
    let inFrontmatter = false;
    let frontmatterLines: string[] = [];
    let contentStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          contentStartIndex = i + 1;
          break;
        }
      } else if (inFrontmatter) {
        frontmatterLines.push(lines[i]);
      }
    }

    // Extract frontmatter values
    const getFrontmatterValue = (key: string): string => {
      const line = frontmatterLines.find((l) => l.startsWith(`${key}:`));
      return line ? line.split(":").slice(1).join(":").trim() : "";
    };

    // Parse evidence from content
    const evidence: string[] = [];
    let inEvidence = false;
    for (let i = contentStartIndex; i < lines.length; i++) {
      if (/^##\s*Evidence/i.test(lines[i])) {
        inEvidence = true;
        continue;
      }
      if (inEvidence && /^##\s/.test(lines[i])) {
        break;
      }
      if (inEvidence) {
        const match = lines[i].match(/\[\[([^\]]+)\]\]/);
        if (match) {
          evidence.push(match[1]);
        }
      }
    }

    return {
      id: getFrontmatterValue("pattern_id"),
      name: getFrontmatterValue("title")
        .replace(/^PATTERN-p\d+-/, "")
        .trim(),
      category: getFrontmatterValue("tags").includes("causal")
        ? categorizePattern(
            getFrontmatterValue("trigger"),
            getFrontmatterValue("action")
          )
        : "general",
      trigger: getFrontmatterValue("trigger"),
      action: getFrontmatterValue("action"),
      success_rate: parseFloat(getFrontmatterValue("success_rate")) || 0,
      occurrences: parseInt(getFrontmatterValue("occurrences"), 10) || 1,
      last_used: getFrontmatterValue("last_used"),
      evidence,
    };
  } catch {
    return null;
  }
}

function findExistingPattern(
  outputPath: string,
  name: string
): { path: string; pattern: Pattern } | null {
  if (!existsSync(outputPath)) {
    return null;
  }

  const slug = slugify(name);
  const files = readdirSync(outputPath).filter(
    (f) => f.startsWith("PATTERN-") && f.endsWith(".md")
  );

  for (const file of files) {
    if (file.toLowerCase().includes(slug)) {
      const filePath = join(outputPath, file);
      const pattern = parseExistingPattern(filePath);
      if (pattern) {
        return { path: filePath, pattern };
      }
    }
  }

  return null;
}

function loadTemplate(): string {
  const templatePath = join(
    import.meta.dir,
    "..",
    "templates",
    "pattern-template.md"
  );
  try {
    return readFileSync(templatePath, "utf-8");
  } catch {
    // Fallback template
    return `---
title: PATTERN-{{id}}-{{name}}
type: pattern
tags: [pattern, causal, {{category}}]
pattern_id: {{id}}
trigger: {{trigger}}
action: {{action}}
success_rate: {{success_rate}}
occurrences: {{occurrences}}
last_used: {{last_used}}
---

# Pattern: {{name}}

**ID**: {{id}}
**Category**: {{category}}
**Success Rate**: {{success_rate_percent}}%
**Occurrences**: {{occurrences}}
**Last Used**: {{last_used}}

## Trigger

{{trigger_description}}

## Action

{{action_description}}

## Observations

{{observations}}

## Evidence

{{evidence}}

## Relations

{{relations}}
`;
  }
}

function renderTemplate(pattern: Pattern, template: string): string {
  const replacements: Record<string, string> = {
    "{{id}}": pattern.id,
    "{{name}}": pattern.name,
    "{{category}}": pattern.category,
    "{{trigger}}": pattern.trigger,
    "{{action}}": pattern.action,
    "{{success_rate}}": pattern.success_rate.toFixed(2),
    "{{success_rate_percent}}": (pattern.success_rate * 100).toFixed(0),
    "{{occurrences}}": String(pattern.occurrences),
    "{{last_used}}": pattern.last_used,
    "{{trigger_description}}": pattern.trigger,
    "{{action_description}}": pattern.action,
    "{{observations}}": generateObservations(pattern),
    "{{evidence}}": generateEvidence(pattern.evidence),
    "{{relations}}": generateRelations(pattern),
  };

  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(key, value);
  }

  return result;
}

function generateObservations(pattern: Pattern): string {
  const observations = [
    `- [technique] ${pattern.action} #${pattern.category}`,
    `- [fact] Success rate: ${(pattern.success_rate * 100).toFixed(0)}% across ${pattern.occurrences} occurrence(s) #evidence`,
  ];

  if (pattern.occurrences > 1) {
    observations.push(
      `- [insight] Pattern validated ${pattern.occurrences} times #recurring`
    );
  }

  return observations.join("\n");
}

function generateEvidence(evidence: string[]): string {
  if (evidence.length === 0) {
    return "- No evidence recorded";
  }

  return evidence.map((e) => `- validated_by [[${e}]]`).join("\n");
}

function generateRelations(pattern: Pattern): string {
  const relations = [`- part_of [[Causal Memory Graph]]`];

  // Add category-specific relations
  switch (pattern.category) {
    case "error-handling":
      relations.push(`- relates_to [[Error Recovery Patterns]]`);
      break;
    case "testing":
      relations.push(`- relates_to [[Testing Strategies]]`);
      break;
    case "code-quality":
      relations.push(`- relates_to [[Code Quality Standards]]`);
      break;
    case "build-deploy":
      relations.push(`- relates_to [[Build Pipeline Patterns]]`);
      break;
  }

  return relations.join("\n");
}

function calculateRunningAverage(
  currentRate: number,
  currentCount: number,
  newRate: number
): number {
  // Weighted running average
  const totalWeight = currentCount + 1;
  return (currentRate * currentCount + newRate) / totalWeight;
}

// Main Execution

function main(): void {
  const args = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      name: {
        type: "string",
        short: "n",
      },
      trigger: {
        type: "string",
        short: "t",
      },
      action: {
        type: "string",
        short: "a",
      },
      evidence: {
        type: "string",
        short: "e",
      },
      "success-rate": {
        type: "string",
        short: "s",
      },
      output: {
        type: "string",
        short: "o",
      },
      help: {
        type: "boolean",
        short: "h",
        default: false,
      },
    },
    allowPositionals: true,
  });

  if (args.values.help) {
    console.log(`
Usage: bun run add-pattern.ts [options]

Options:
  -n, --name NAME           Pattern name (required)
  -t, --trigger TRIGGER     Condition that triggers the pattern (required)
  -a, --action ACTION       Recommended action (required)
  -e, --evidence EPISODE    Episode ID as evidence (required)
  -s, --success-rate RATE   Success rate 0-1 (default: 1.0)
  -o, --output PATH         Output directory (default: ~/memories/brain/patterns)
  -h, --help                Show this help message

Example:
  bun run add-pattern.ts \\
    --name "Markdownlint Before Edit" \\
    --trigger "Editing markdown files with spacing issues" \\
    --action "Run markdownlint --fix before manual edits" \\
    --evidence "episode-2026-01-20-session-06" \\
    --success-rate 0.95
`);
    process.exit(0);
  }

  // Validate required arguments
  const name = args.values.name;
  const trigger = args.values.trigger;
  const action = args.values.action;
  const evidence = args.values.evidence;

  if (!name || !trigger || !action || !evidence) {
    console.error("Error: --name, --trigger, --action, and --evidence are required");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  const successRate = args.values["success-rate"]
    ? parseFloat(args.values["success-rate"])
    : 1.0;

  if (isNaN(successRate) || successRate < 0 || successRate > 1) {
    console.error("Error: --success-rate must be between 0 and 1");
    process.exit(1);
  }

  const outputPath =
    args.values.output || join(homedir(), "memories", "brain", "patterns");

  // Ensure output directory exists
  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  // Check for existing pattern
  const existing = findExistingPattern(outputPath, name);

  let pattern: Pattern;
  let outputFile: string;

  if (existing) {
    // Update existing pattern
    console.log(`Updating existing pattern: ${existing.path}`);

    const newSuccessRate = calculateRunningAverage(
      existing.pattern.success_rate,
      existing.pattern.occurrences,
      successRate
    );

    pattern = {
      ...existing.pattern,
      success_rate: newSuccessRate,
      occurrences: existing.pattern.occurrences + 1,
      last_used: new Date().toISOString().split("T")[0],
      evidence: [...existing.pattern.evidence, evidence],
    };

    outputFile = existing.path;
  } else {
    // Create new pattern
    const id = getNextPatternId(outputPath);
    const category = categorizePattern(trigger, action);

    console.log(`Creating new pattern with ID: ${id}`);

    pattern = {
      id,
      name,
      category,
      trigger,
      action,
      success_rate: successRate,
      occurrences: 1,
      last_used: new Date().toISOString().split("T")[0],
      evidence: [evidence],
    };

    outputFile = join(outputPath, `PATTERN-${id}-${slugify(name)}.md`);
  }

  // Generate markdown
  const template = loadTemplate();
  const markdown = renderTemplate(pattern, template);

  // Write file
  writeFileSync(outputFile, markdown, "utf-8");

  // Summary
  console.log(`
Pattern ${existing ? "updated" : "created"}:
  ID:           ${pattern.id}
  Name:         ${pattern.name}
  Category:     ${pattern.category}
  Success Rate: ${(pattern.success_rate * 100).toFixed(1)}%
  Occurrences:  ${pattern.occurrences}
  Output:       ${outputFile}
`);
}

main();
