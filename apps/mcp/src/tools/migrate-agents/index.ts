/**
 * Handler for migrate_agents tool
 *
 * Migrates .agents/ content to basic-memory format with full transformation
 * including observations, relations, and proper frontmatter generation.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { getBasicMemoryClient } from "../../proxy/client";
import { triggerEmbedding } from "../../services/embedding/triggerEmbedding";
import { logger } from "../../utils/internal/logger";
import { parseAgentFile } from "./parser";
import type {
	MigrateAgentsArgs,
	MigrateAgentsOutput,
	MigrationResult,
} from "./schema";
import { transformToBasicMemory, validateTransformation } from "./transformer";

/**
 * Main handler for the migrate_agents tool
 */
export async function handler(
	args: MigrateAgentsArgs,
): Promise<CallToolResult> {
	const project = args.project || resolveProject();
	const sourcePath = args.source_path;
	const subdirectory = args.subdirectory;
	const dryRun = args.dry_run ?? false;
	const limit = args.limit;

	if (!project) {
		return {
			content: [{ type: "text" as const, text: "No project specified." }],
			isError: true,
		};
	}

	if (!sourcePath) {
		return {
			content: [{ type: "text" as const, text: "No source_path specified." }],
			isError: true,
		};
	}

	// Verify source path exists
	try {
		const stats = await fs.stat(sourcePath);
		if (!stats.isDirectory()) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Source path is not a directory: ${sourcePath}`,
					},
				],
				isError: true,
			};
		}
	} catch {
		return {
			content: [
				{
					type: "text" as const,
					text: `Source path does not exist: ${sourcePath}`,
				},
			],
			isError: true,
		};
	}

	// Discover markdown files
	const targetPath = subdirectory
		? path.join(sourcePath, subdirectory)
		: sourcePath;

	const files = await discoverMarkdownFiles(targetPath, limit);

	if (files.length === 0) {
		return {
			content: [
				{
					type: "text" as const,
					text: `No markdown files found in: ${targetPath}`,
				},
			],
			isError: true,
		};
	}

	logger.info(
		{ project, sourcePath, fileCount: files.length, dryRun },
		"Starting .agents migration",
	);

	// Process files
	const results: MigrationResult[] = [];
	const errors: string[] = [];
	let totalObservations = 0;
	let totalRelations = 0;
	let migrated = 0;
	let failed = 0;

	const client = dryRun ? null : await getBasicMemoryClient();

	for (const filePath of files) {
		try {
			const result = await processFile(
				filePath,
				sourcePath,
				project,
				client,
				dryRun,
			);

			results.push(result);

			if (result.success) {
				migrated++;
				totalObservations += result.observationCount;
				totalRelations += result.relationCount;
			} else {
				failed++;
				if (result.error) {
					errors.push(`${filePath}: ${result.error}`);
				}
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			failed++;
			errors.push(`${filePath}: ${errorMsg}`);
			results.push({
				source: filePath,
				target: "",
				success: false,
				observationCount: 0,
				relationCount: 0,
				error: errorMsg,
			});
		}
	}

	logger.info(
		{ project, migrated, failed, totalObservations, totalRelations },
		"Migration complete",
	);

	const output: MigrateAgentsOutput = {
		success: failed === 0,
		files_processed: files.length,
		files_migrated: migrated,
		files_failed: failed,
		total_observations: totalObservations,
		total_relations: totalRelations,
		results,
		errors,
	};

	// Build output text
	const text = buildOutputText(project, output, dryRun);

	return {
		structuredContent: output as unknown as { [x: string]: unknown },
		content: [{ type: "text" as const, text }],
	};
}

/**
 * Discover markdown files in directory recursively
 */
async function discoverMarkdownFiles(
	dirPath: string,
	limit?: number,
): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string): Promise<void> {
		if (limit && files.length >= limit) return;

		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				if (limit && files.length >= limit) break;

				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					// Skip hidden directories and node_modules
					if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
						await walk(fullPath);
					}
				} else if (entry.isFile() && entry.name.endsWith(".md")) {
					files.push(fullPath);
				}
			}
		} catch (error) {
			logger.warn({ dir, error }, "Failed to read directory");
		}
	}

	await walk(dirPath);
	return files;
}

/**
 * Process a single file
 */
async function processFile(
	filePath: string,
	agentsRoot: string,
	project: string,
	client: Awaited<ReturnType<typeof getBasicMemoryClient>> | null,
	dryRun: boolean,
): Promise<MigrationResult> {
	// Read file content
	const content = await fs.readFile(filePath, "utf-8");

	// Parse the file
	const parsed = parseAgentFile(content, filePath, agentsRoot);

	// Transform to basic-memory format
	const transformed = transformToBasicMemory(parsed);

	// Validate transformation
	const validation = validateTransformation(transformed);
	if (!validation.valid) {
		logger.debug(
			{ file: filePath, warnings: validation.warnings },
			"Transformation has warnings",
		);
	}

	const target = `${transformed.folder}/${generateSlug(transformed.title)}`;

	if (dryRun) {
		// Just return what would be done
		return {
			source: filePath,
			target,
			success: true,
			observationCount: transformed.observations.length,
			relationCount: transformed.relations.length,
		};
	}

	// Write to basic-memory
	if (!client) {
		throw new Error("Client not available for write operation");
	}

	try {
		const result = await client.callTool({
			name: "write_note",
			arguments: {
				folder: transformed.folder,
				title: transformed.title,
				content: transformed.fullContent,
				project,
			},
		});

		// Check for errors in result
		const resultContent = result.content as
			| Array<{ text?: string }>
			| undefined;
		const text = resultContent?.[0]?.text || "";
		if (result.isError || text.toLowerCase().includes("error")) {
			throw new Error(text || "Unknown error from write_note");
		}

		// Trigger embedding generation (fire-and-forget)
		// This ensures migrated notes are searchable via semantic search
		triggerEmbedding(target, transformed.fullContent);

		logger.debug(
			{
				source: filePath,
				target,
				observations: transformed.observations.length,
			},
			"File migrated successfully",
		);

		return {
			source: filePath,
			target,
			success: true,
			observationCount: transformed.observations.length,
			relationCount: transformed.relations.length,
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		return {
			source: filePath,
			target,
			success: false,
			observationCount: 0,
			relationCount: 0,
			error: errorMsg,
		};
	}
}

/**
 * Generate URL-safe slug from title
 */
function generateSlug(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Build human-readable output text
 */
function buildOutputText(
	project: string,
	output: MigrateAgentsOutput,
	dryRun: boolean,
): string {
	const lines: string[] = [];

	lines.push(`## ${dryRun ? "Migration Preview" : "Migration Results"}`);
	lines.push("");
	lines.push(`**Project:** ${project}`);
	lines.push(`**Status:** ${output.success ? "SUCCESS" : "PARTIAL FAILURE"}`);
	lines.push(`**Files Processed:** ${output.files_processed}`);
	lines.push(`**Files Migrated:** ${output.files_migrated}`);
	lines.push(`**Files Failed:** ${output.files_failed}`);
	lines.push(`**Total Observations:** ${output.total_observations}`);
	lines.push(`**Total Relations:** ${output.total_relations}`);
	lines.push("");

	// Quality metrics
	const avgObs =
		output.files_migrated > 0
			? (output.total_observations / output.files_migrated).toFixed(1)
			: "0";
	const avgRel =
		output.files_migrated > 0
			? (output.total_relations / output.files_migrated).toFixed(1)
			: "0";

	lines.push("### Quality Metrics");
	lines.push(`- Average observations per note: ${avgObs}`);
	lines.push(`- Average relations per note: ${avgRel}`);
	lines.push("");

	// Successful migrations
	const successes = output.results.filter((r) => r.success);
	if (successes.length > 0) {
		lines.push(
			`### ${dryRun ? "Would Migrate" : "Migrated"} (${successes.length})`,
		);
		for (const result of successes.slice(0, 15)) {
			const sourceName = path.basename(result.source);
			lines.push(
				`- ${sourceName} → ${result.target} (${result.observationCount} obs, ${result.relationCount} rel)`,
			);
		}
		if (successes.length > 15) {
			lines.push(`- ... and ${successes.length - 15} more`);
		}
		lines.push("");
	}

	// Failures
	if (output.errors.length > 0) {
		lines.push("### Errors");
		for (const error of output.errors.slice(0, 10)) {
			lines.push(`- ${error}`);
		}
		if (output.errors.length > 10) {
			lines.push(`- ... and ${output.errors.length - 10} more errors`);
		}
		lines.push("");
	}

	if (dryRun) {
		lines.push("---");
		lines.push(
			"*This is a dry run. Run with dry_run=false to execute migration.*",
		);
	}

	return lines.join("\n");
}

export { toolDefinition } from "./schema";
