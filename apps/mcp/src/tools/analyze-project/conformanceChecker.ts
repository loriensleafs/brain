/**
 * Conformance checking for analyze_project tool
 *
 * Checks notes against target schema rules:
 * - Location matches naming convention
 * - No bad prefixes
 * - Scoped types in correct directories
 */

import * as path from "node:path";
import type { ConformanceIssue, NoteType, TargetSchema } from "./schema";

/**
 * Parsed note structure for conformance checking
 */
interface ParsedNote {
  path: string;
  relativePath: string;
  frontmatter: Record<string, unknown> | null;
  hasObservations: boolean;
  hasRelations: boolean;
}

/**
 * Infers note type from file path based on directory structure
 */
export function inferTypeFromPath(relativePath: string): NoteType | null {
  if (relativePath.startsWith("features/")) return "feature";
  if (relativePath.startsWith("research/")) return "research";
  if (relativePath.startsWith("analysis/")) return "analysis";
  if (relativePath.startsWith("specs/")) return "spec";
  if (relativePath.startsWith("decisions/")) return "decision";
  return "note";
}

/**
 * Checks a note against the target schema and returns any conformance issues
 */
export function checkConformance(note: ParsedNote, schema: TargetSchema): ConformanceIssue[] {
  const issues: ConformanceIssue[] = [];
  const fileName = path.basename(note.relativePath);
  const dirPath = path.dirname(note.relativePath);

  // 1. Check frontmatter
  if (!note.frontmatter && schema.frontmatter_required) {
    issues.push({
      type: "missing_frontmatter",
      description: "Note is missing frontmatter",
      auto_fixable: true,
      suggested_fix: "Add frontmatter with title and type",
    });
  }

  // 2. Determine type
  const declaredType = note.frontmatter?.type as NoteType | undefined;
  const inferredType = inferTypeFromPath(note.relativePath);
  const noteType = declaredType || inferredType || "note";
  const rule = schema.naming[noteType];

  // 3. Check for bad prefixes (spec-, decision-, etc.)
  if (rule?.no_prefix) {
    const prefixes = ["spec-", "decision-", "analysis-", "research-"];
    for (const prefix of prefixes) {
      if (fileName.startsWith(prefix)) {
        issues.push({
          type: "bad_prefix",
          description: `File has "${prefix}" prefix which should be removed`,
          auto_fixable: true,
          suggested_fix: `Rename to ${fileName.replace(prefix, "")}`,
        });
        break;
      }
    }
  }

  // 4. Check root-level scoped types (should be in slug/overview.md)
  const scopedTypes: NoteType[] = ["feature", "research", "analysis"];
  if (scopedTypes.includes(noteType)) {
    const parts = note.relativePath.split("/");
    // Should be: type/slug/overview.md or type/slug/something.md
    if (parts.length === 2) {
      // Root level like features/foo.md - should be features/foo/overview.md
      issues.push({
        type: "root_level_scoped",
        description: `${noteType} should be in a subdirectory with overview.md`,
        auto_fixable: true,
        suggested_fix: `Move to ${parts[0]}/${fileName.replace(".md", "")}/overview.md`,
      });
    }
  }

  // 5. Check for redundant child prefix (foo/foo-task.md -> foo/task.md)
  if (dirPath !== ".") {
    const parentSlug = path.basename(dirPath);
    if (fileName.startsWith(`${parentSlug}-`)) {
      issues.push({
        type: "redundant_child_prefix",
        description: `File has redundant parent prefix "${parentSlug}-"`,
        auto_fixable: true,
        suggested_fix: `Rename to ${fileName.replace(`${parentSlug}-`, "")}`,
      });
    }
  }

  // 6. Check main file is overview.md for scoped types
  if (scopedTypes.includes(noteType)) {
    const parts = note.relativePath.split("/");
    if (parts.length >= 3) {
      // In a subdirectory - check if it's the main file
      const isPhaseDir = parts[parts.length - 2].startsWith("phase-");
      if (!isPhaseDir && fileName !== "overview.md") {
        // Could be a child task, which is fine
        // Only flag if it looks like it should be overview.md
        const typeNames = ["feature-", "research-", "analysis-"];
        for (const typeName of typeNames) {
          if (fileName.startsWith(typeName)) {
            issues.push({
              type: "not_overview",
              description: `Main file should be named overview.md, not ${fileName}`,
              auto_fixable: true,
              suggested_fix: `Rename to overview.md`,
            });
            break;
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Computes the suggested target path by applying fixes for all issues
 */
export function getSuggestedTarget(note: ParsedNote, issues: ConformanceIssue[]): string {
  let target = note.relativePath;

  for (const issue of issues) {
    if (issue.type === "root_level_scoped") {
      const parts = target.split("/");
      const slug = path.basename(parts[1], ".md");
      target = `${parts[0]}/${slug}/overview.md`;
    }
    if (issue.type === "bad_prefix") {
      const fileName = path.basename(target);
      const prefixes = ["spec-", "decision-", "analysis-", "research-"];
      for (const prefix of prefixes) {
        if (fileName.startsWith(prefix)) {
          target = target.replace(fileName, fileName.replace(prefix, ""));
          break;
        }
      }
    }
    if (issue.type === "redundant_child_prefix") {
      const dirPath = path.dirname(target);
      const fileName = path.basename(target);
      const parentSlug = path.basename(dirPath);
      target = `${dirPath}/${fileName.replace(`${parentSlug}-`, "")}`;
    }
  }

  return target;
}
