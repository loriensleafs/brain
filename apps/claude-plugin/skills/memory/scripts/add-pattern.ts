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
 * Resolves project paths directly from Brain MCP config (~/.basic-memory/config.json)
 * and writes pattern files directly to the filesystem.
 *
 * Usage:
 *   bun run add-pattern.ts --name "Pattern Name" --trigger "When X happens" \
 *     --action "Do Y" --evidence "episode-id" [--success-rate 0.85] [--project brain]
 *
 * Example:
 *   bun run add-pattern.ts --name "Markdownlint Before Edit" \
 *     --trigger "Editing markdown files with spacing issues" \
 *     --action "Run markdownlint --fix before manual edits" \
 *     --evidence "episode-2026-01-20-session-06" \
 *     --success-rate 0.95 \
 *     --project brain
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { getProjectMemoriesPath } from "@brain/utils";

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

interface _PatternFrontmatter {
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

/**
 * Read note content from filesystem.
 *
 * @param identifier - Note identifier (path like "patterns/PATTERN-p001-name")
 * @param projectPath - Absolute path to the project directory
 * @returns Note content or null if not found
 */
function readNote(identifier: string, projectPath: string): string | null {
  const notePath = join(projectPath, `${identifier}.md`);

  if (!existsSync(notePath)) {
    return null;
  }

  return readFileSync(notePath, "utf-8");
}

/**
 * Write note content to filesystem.
 *
 * @param title - Note title (used as filename without extension)
 * @param folder - Folder within the project (e.g., "patterns")
 * @param content - Markdown content to write
 * @param projectPath - Absolute path to the project directory
 */
function writeNote(title: string, folder: string, content: string, projectPath: string): void {
  const folderPath = join(projectPath, folder);

  // Ensure folder exists
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }

  const notePath = join(folderPath, `${title}.md`);
  writeFileSync(notePath, content, "utf-8");
}

/**
 * Search for patterns in the patterns directory.
 *
 * @param query - Search query (slug to match in filename)
 * @param projectPath - Absolute path to the project directory
 * @returns Array of matching pattern identifiers (e.g., "patterns/PATTERN-p001-name")
 */
function searchPatterns(query: string, projectPath: string): string[] {
  const patternsDir = join(projectPath, "patterns");

  if (!existsSync(patternsDir)) {
    return [];
  }

  const files = readdirSync(patternsDir);
  const queryLower = query.toLowerCase();

  return files
    .filter(
      (f) => /^pattern-p/i.test(f) && f.endsWith(".md") && f.toLowerCase().includes(queryLower),
    )
    .map((f) => `patterns/${f.replace(".md", "")}`);
}

/**
 * Get next available pattern ID by scanning existing patterns.
 *
 * @param projectPath - Absolute path to the project directory
 * @returns Next pattern ID like "p001", "p002", etc.
 */
function getNextPatternId(projectPath: string): string {
  const patternsDir = join(projectPath, "patterns");

  if (!existsSync(patternsDir)) {
    return "p001";
  }

  const files = readdirSync(patternsDir);
  const patternFiles = files.filter((f) => /^pattern-p/i.test(f) && f.endsWith(".md"));

  if (patternFiles.length === 0) {
    return "p001";
  }

  // Extract pattern numbers (case-insensitive)
  const numbers = patternFiles
    .map((f) => {
      const match = f.match(/pattern-p(\d+)/i);
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

/**
 * Parse pattern data from markdown content.
 *
 * @param content - Markdown content with frontmatter
 * @returns Parsed Pattern or null if parsing fails
 */
function parsePatternFromContent(content: string): Pattern | null {
  try {
    const lines = content.split("\n");

    // Parse frontmatter
    let inFrontmatter = false;
    const frontmatterLines: string[] = [];
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
        ? categorizePattern(getFrontmatterValue("trigger"), getFrontmatterValue("action"))
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

/**
 * Find existing pattern by name in the patterns directory.
 *
 * @param name - Pattern name to search for
 * @param projectPath - Absolute path to the project directory
 * @returns Pattern data and identifier or null if not found
 */
function findExistingPattern(
  name: string,
  projectPath: string,
): { identifier: string; pattern: Pattern } | null {
  const slug = slugify(name);

  // Search for patterns matching the slug
  const matches = searchPatterns(slug, projectPath);

  for (const identifier of matches) {
    // Read the full note content
    const content = readNote(identifier, projectPath);
    if (content) {
      const pattern = parsePatternFromContent(content);
      if (pattern) {
        return { identifier, pattern };
      }
    }
  }

  return null;
}

function loadTemplate(): string {
  const templatePath = join(import.meta.dir, "..", "templates", "pattern-template.md");
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
    observations.push(`- [insight] Pattern validated ${pattern.occurrences} times #recurring`);
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
  newRate: number,
): number {
  // Weighted running average
  const totalWeight = currentCount + 1;
  return (currentRate * currentCount + newRate) / totalWeight;
}

// Main Execution

async function main(): Promise<void> {
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
      project: {
        type: "string",
        short: "p",
        default: "brain",
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
  -p, --project NAME        Brain project name (default: brain)
  -h, --help                Show this help message

Example:
  bun run add-pattern.ts \\
    --name "Markdownlint Before Edit" \\
    --trigger "Editing markdown files with spacing issues" \\
    --action "Run markdownlint --fix before manual edits" \\
    --evidence "episode-2026-01-20-session-06" \\
    --success-rate 0.95 \\
    --project brain

Note: Reads project paths from ~/.basic-memory/config.json and writes
pattern files directly to the filesystem.
`);
    process.exit(0);
  }

  // Validate required arguments
  const name = args.values.name;
  const trigger = args.values.trigger;
  const action = args.values.action;
  const evidence = args.values.evidence;
  const project = args.values.project ?? "brain";

  if (!name || !trigger || !action || !evidence) {
    console.error("Error: --name, --trigger, --action, and --evidence are required");
    console.error("Use --help for usage information");
    process.exit(1);
  }

  const successRate = args.values["success-rate"] ? parseFloat(args.values["success-rate"]) : 1.0;

  if (Number.isNaN(successRate) || successRate < 0 || successRate > 1) {
    console.error("Error: --success-rate must be between 0 and 1");
    process.exit(1);
  }

  // Resolve project path from Brain config
  let projectPath: string;
  try {
    projectPath = await getProjectMemoriesPath(project);
    console.log(`Project '${project}' resolved to: ${projectPath}`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  // Check for existing pattern
  console.log(`Searching for existing pattern...`);
  const existing = findExistingPattern(name, projectPath);

  let pattern: Pattern;
  let noteTitle: string;

  if (existing) {
    // Update existing pattern
    console.log(`Updating existing pattern: ${existing.identifier}`);

    const newSuccessRate = calculateRunningAverage(
      existing.pattern.success_rate,
      existing.pattern.occurrences,
      successRate,
    );

    pattern = {
      ...existing.pattern,
      success_rate: newSuccessRate,
      occurrences: existing.pattern.occurrences + 1,
      last_used: new Date().toISOString().split("T")[0],
      evidence: [...existing.pattern.evidence, evidence],
    };

    // Extract title from identifier (patterns/PATTERN-p001-name -> PATTERN-p001-name)
    noteTitle = existing.identifier.split("/").pop() || `PATTERN-${pattern.id}-${slugify(name)}`;
  } else {
    // Create new pattern
    const id = getNextPatternId(projectPath);
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

    noteTitle = `PATTERN-${id}-${slugify(name)}`;
  }

  // Generate markdown
  const template = loadTemplate();
  const markdown = renderTemplate(pattern, template);

  // Write pattern file
  const patternsDir = join(projectPath, "patterns");
  const patternPath = join(patternsDir, `${noteTitle}.md`);
  console.log(`  Writing to: ${patternPath}`);

  try {
    writeNote(noteTitle, "patterns", markdown, projectPath);
  } catch (error) {
    console.error(`Error: Failed to write pattern file`);
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  // Summary
  console.log(`
Pattern ${existing ? "updated" : "created"}:
  ID:           ${pattern.id}
  Name:         ${pattern.name}
  Category:     ${pattern.category}
  Success Rate: ${(pattern.success_rate * 100).toFixed(1)}%
  Occurrences:  ${pattern.occurrences}
  File:         ${patternPath}
`);
}

main();
