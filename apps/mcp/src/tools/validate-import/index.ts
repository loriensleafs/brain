/**
 * Handler for validate_import tool
 *
 * Verifies migration quality by checking that migrated files exist and
 * now conform to Brain project conventions. Re-runs conformance checks
 * on target files and computes a quality score.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { getBasicMemoryClient } from "../../proxy/client";
import { logger } from "../../utils/internal/logger";
import { checkConformance } from "../analyze-project/conformanceChecker";
import { brainTargetSchema } from "../analyze-project/schema";
import type {
	MigrationResultInput,
	ValidateImportArgs,
	ValidateImportOutput,
} from "./schema";

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
 * Validates a single migration result input has required fields
 */
function isValidMigrationResult(
	result: unknown,
): result is MigrationResultInput {
	if (typeof result !== "object" || result === null) return false;
	const obj = result as Record<string, unknown>;
	return (
		typeof obj.source === "string" &&
		typeof obj.target === "string" &&
		typeof obj.success === "boolean"
	);
}

/**
 * Main handler for the validate_import tool
 */
export async function handler(
	args: ValidateImportArgs,
): Promise<CallToolResult> {
	const project = args.project || resolveProject();
	const migrationResults = args.migration_results || [];

	if (!project) {
		return {
			content: [{ type: "text" as const, text: "No project specified." }],
			isError: true,
		};
	}

	if (!Array.isArray(migrationResults) || migrationResults.length === 0) {
		return {
			content: [
				{
					type: "text" as const,
					text: "No migration results provided. Execute migrations first and pass the results.",
				},
			],
			isError: true,
		};
	}

	// Validate input format
	const validResults: MigrationResultInput[] = [];
	for (const result of migrationResults) {
		if (isValidMigrationResult(result)) {
			validResults.push(result);
		}
	}

	if (validResults.length === 0) {
		return {
			content: [
				{
					type: "text" as const,
					text: "No valid migration results found. Each result must have source, target, and success fields.",
				},
			],
			isError: true,
		};
	}

	// Filter to only successful migrations for validation
	const successfulMigrations = validResults.filter((r) => r.success);
	const failedMigrations = validResults.filter((r) => !r.success);

	logger.info(
		{
			project,
			total: validResults.length,
			successful: successfulMigrations.length,
		},
		"Starting migration validation",
	);

	const client = await getBasicMemoryClient();

	// Check content preservation - verify target files exist and have content
	const missingContent: string[] = [];
	const existingTargets: string[] = [];

	for (const migration of successfulMigrations) {
		try {
			const readResult = await client.callTool({
				name: "read_note",
				arguments: { identifier: migration.target, project },
			});

			const content = readResult.content as
				| Array<{ text?: string }>
				| undefined;
			const text = content?.[0]?.text || "";
			if (!text || text.includes("not found") || text.includes("Error")) {
				missingContent.push(migration.target);
			} else {
				existingTargets.push(migration.target);
			}
		} catch {
			// File doesn't exist or couldn't be read
			missingContent.push(migration.target);
		}
	}

	const contentPreserved = missingContent.length === 0;
	const contentCoverage =
		successfulMigrations.length > 0
			? existingTargets.length / successfulMigrations.length
			: 0;

	// Re-run conformance checks on existing targets
	const stillNonConforming: string[] = [];
	let issuesFixed = 0;

	for (const targetPath of existingTargets) {
		try {
			const readResult = await client.callTool({
				name: "read_note",
				arguments: { identifier: targetPath, project },
			});

			const parsed = parseNoteContent(targetPath, readResult);
			const issues = checkConformance(parsed, brainTargetSchema);

			if (issues.length > 0) {
				stillNonConforming.push(targetPath);
			} else {
				// This file now conforms - count as fixed
				issuesFixed++;
			}
		} catch (error) {
			logger.warn({ target: targetPath, error }, "Failed to check conformance");
			stillNonConforming.push(targetPath);
		}
	}

	const allConform =
		stillNonConforming.length === 0 && existingTargets.length > 0;

	// Calculate quality score (0-100)
	// Weight factors: content preservation (40%), conformance (60%)
	const contentScore = contentCoverage * 40;
	const conformanceRate =
		existingTargets.length > 0
			? (existingTargets.length - stillNonConforming.length) /
				existingTargets.length
			: 0;
	const conformanceScore = conformanceRate * 60;
	const qualityScore = Math.round(contentScore + conformanceScore);

	// Build summary
	const summaryParts: string[] = [];
	if (contentPreserved && allConform) {
		summaryParts.push(
			"Migration successful - all files preserved and conform to conventions.",
		);
	} else {
		if (!contentPreserved) {
			summaryParts.push(
				`${missingContent.length} file(s) missing or unreadable.`,
			);
		}
		if (!allConform) {
			summaryParts.push(
				`${stillNonConforming.length} file(s) still have conformance issues.`,
			);
		}
	}
	if (failedMigrations.length > 0) {
		summaryParts.push(
			`${failedMigrations.length} migration(s) were not attempted (marked as failed).`,
		);
	}
	summaryParts.push(`Quality score: ${qualityScore}/100`);

	const output: ValidateImportOutput = {
		content_preserved: contentPreserved,
		content_coverage: Math.round(contentCoverage * 100) / 100,
		missing_content: missingContent,

		conformance_check: {
			all_conform: allConform,
			still_non_conforming: stillNonConforming,
			issues_fixed: issuesFixed,
		},

		quality_score: qualityScore,
		summary: summaryParts.join(" "),
	};

	logger.info(
		{ project, qualityScore, contentPreserved, allConform },
		"Migration validation complete",
	);

	// Build text output
	const lines = buildResultText(project, output, failedMigrations.length);

	return {
		structuredContent: output as unknown as { [x: string]: unknown },
		content: [{ type: "text" as const, text: lines.join("\n") }],
	};
}

/**
 * Parses note content to extract frontmatter and check for required sections
 */
function parseNoteContent(path: string, result: unknown): ParsedNote {
	const resultObj = result as { content?: Array<{ text?: string }> };
	const text = resultObj.content?.[0]?.text || "";

	// Check for frontmatter
	let frontmatter: Record<string, unknown> | null = null;
	const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
	if (fmMatch) {
		try {
			// Simple YAML-like parsing
			const lines = fmMatch[1].split("\n");
			frontmatter = {};
			for (const line of lines) {
				const [key, ...valueParts] = line.split(":");
				if (key && valueParts.length) {
					frontmatter[key.trim()] = valueParts.join(":").trim();
				}
			}
		} catch {
			// Ignore parsing errors
		}
	}

	return {
		path,
		relativePath: path,
		frontmatter,
		hasObservations: text.includes("## Observations"),
		hasRelations: text.includes("## Relations"),
	};
}

/**
 * Builds the result text for display
 */
function buildResultText(
	project: string,
	output: ValidateImportOutput,
	skippedCount: number,
): string[] {
	const lines: string[] = [
		`## Migration Validation Results`,
		``,
		`**Project:** ${project}`,
		`**Quality Score:** ${output.quality_score}/100`,
		``,
	];

	// Content preservation section
	lines.push(`### Content Preservation`);
	lines.push(`- **Preserved:** ${output.content_preserved ? "Yes" : "No"}`);
	lines.push(`- **Coverage:** ${Math.round(output.content_coverage * 100)}%`);
	if (output.missing_content.length > 0) {
		lines.push(`- **Missing (${output.missing_content.length}):**`);
		for (const path of output.missing_content.slice(0, 10)) {
			lines.push(`  - ${path}`);
		}
		if (output.missing_content.length > 10) {
			lines.push(`  - ... and ${output.missing_content.length - 10} more`);
		}
	}
	lines.push(``);

	// Conformance check section
	lines.push(`### Conformance Check`);
	lines.push(
		`- **All Conform:** ${output.conformance_check.all_conform ? "Yes" : "No"}`,
	);
	lines.push(`- **Issues Fixed:** ${output.conformance_check.issues_fixed}`);
	if (output.conformance_check.still_non_conforming.length > 0) {
		lines.push(
			`- **Still Non-Conforming (${output.conformance_check.still_non_conforming.length}):**`,
		);
		for (const path of output.conformance_check.still_non_conforming.slice(
			0,
			10,
		)) {
			lines.push(`  - ${path}`);
		}
		if (output.conformance_check.still_non_conforming.length > 10) {
			lines.push(
				`  - ... and ${output.conformance_check.still_non_conforming.length - 10} more`,
			);
		}
	}
	lines.push(``);

	// Summary
	lines.push(`### Summary`);
	lines.push(output.summary);

	if (skippedCount > 0) {
		lines.push(``);
		lines.push(
			`*Note: ${skippedCount} failed migration(s) were not validated.*`,
		);
	}

	return lines;
}

export { toolDefinition } from "./schema";
