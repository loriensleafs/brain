#!/usr/bin/env bun

/**
 * Standalone migration script for .agents/ content to Brain memory
 *
 * Uses basic-memory CLI to write notes directly.
 *
 * Usage:
 *   bun scripts/migrate-agents.ts --dry-run
 *   bun scripts/migrate-agents.ts
 *   bun scripts/migrate-agents.ts --verify-only
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { $ } from "bun";

// Import transformer functions from MCP package
import { parseAgentFile } from "../apps/mcp/src/tools/migrate-agents/parser";
import {
	transformToBasicMemory,
	validateTransformation,
} from "../apps/mcp/src/tools/migrate-agents/transformer";

const AGENTS_ROOT = "/Users/peter.kloss/Dev/brain/.agents";
const PROJECT = "brain";

interface MigrationResult {
	source: string;
	target: string;
	success: boolean;
	observationCount: number;
	relationCount: number;
	error?: string;
}

async function discoverMarkdownFiles(dirPath: string): Promise<string[]> {
	const files: string[] = [];

	async function walk(dir: string): Promise<void> {
		try {
			const entries = await fs.readdir(dir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);

				if (entry.isDirectory()) {
					// Skip hidden directories
					if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
						await walk(fullPath);
					}
				} else if (entry.isFile() && entry.name.endsWith(".md")) {
					// Skip backup files
					if (!entry.name.endsWith(".bak")) {
						files.push(fullPath);
					}
				}
			}
		} catch (error) {
			console.error(`Failed to read directory ${dir}:`, error);
		}
	}

	await walk(dirPath);
	return files;
}

/**
 * Sanitize title for YAML frontmatter - remove colons and other problematic characters
 */
function sanitizeTitle(title: string): string {
	// Replace colons with dashes to avoid YAML issues
	return title.replace(/:/g, " -").replace(/\s+/g, " ").trim();
}

async function writeNote(
	folder: string,
	title: string,
	content: string,
): Promise<boolean> {
	try {
		// Sanitize title to avoid YAML issues
		const safeTitle = sanitizeTitle(title);

		// Write content to temp file to avoid shell escaping issues
		const tempFile = `/tmp/brain-migrate-${Date.now()}.md`;
		await fs.writeFile(tempFile, content, "utf-8");

		// Use basic-memory CLI with file input
		const result =
			await $`cat ${tempFile} | basic-memory tool write-note --title ${safeTitle} --folder ${folder} --project ${PROJECT}`.quiet();

		// Clean up temp file
		await fs.unlink(tempFile).catch(() => {});

		return result.exitCode === 0;
	} catch (error) {
		console.error(`Failed to write note ${title}:`, error);
		return false;
	}
}

async function verifyIndexing(): Promise<{ total: number; indexed: number }> {
	try {
		// Search for any notes to verify indexing
		const result =
			await $`basic-memory tool search-notes --query "session OR decision OR analysis" --project ${PROJECT}`.quiet();
		const output = result.text();
		// Count results (basic estimate)
		const matches = output.match(/permalink:/g);
		return { total: 232, indexed: matches?.length || 0 };
	} catch {
		return { total: 232, indexed: 0 };
	}
}

async function testSearch(query: string): Promise<boolean> {
	try {
		const result =
			await $`basic-memory tool search-notes --query ${query} --project ${PROJECT}`.quiet();
		return result.exitCode === 0 && result.text().includes("permalink:");
	} catch {
		return false;
	}
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const verifyOnly = args.includes("--verify-only");

	if (verifyOnly) {
		console.log("\n=== Verification Mode ===\n");
		const { total, indexed } = await verifyIndexing();
		console.log(`Total expected: ${total}`);
		console.log(`Indexed: ${indexed}`);

		console.log("\n=== Search Tests ===");
		const tests = [
			"session protocol",
			"ADR decision",
			"analysis implementation",
			"security review",
		];
		for (const query of tests) {
			const found = await testSearch(query);
			console.log(`  "${query}": ${found ? "[PASS]" : "[FAIL]"}`);
		}
		return;
	}

	console.log(`\n=== ${dryRun ? "Dry Run" : "Migration"} ===\n`);
	console.log(`Source: ${AGENTS_ROOT}`);
	console.log(`Project: ${PROJECT}`);
	console.log(`Dry Run: ${dryRun}\n`);

	// Discover files
	const files = await discoverMarkdownFiles(AGENTS_ROOT);
	console.log(`Found ${files.length} markdown files\n`);

	// Process files
	const results: MigrationResult[] = [];
	let migrated = 0;
	let failed = 0;
	let totalObservations = 0;
	let totalRelations = 0;

	for (const filePath of files) {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const parsed = parseAgentFile(content, filePath, AGENTS_ROOT);
			const transformed = transformToBasicMemory(parsed);
			const validation = validateTransformation(transformed);

			const relativePath = path.relative(AGENTS_ROOT, filePath);

			if (dryRun) {
				console.log(`[DRY] ${relativePath}`);
				console.log(`  -> ${transformed.folder}/${transformed.title}`);
				console.log(
					`  -> ${transformed.observations.length} obs, ${transformed.relations.length} rel`,
				);
				if (validation.warnings.length > 0) {
					console.log(`  -> Warnings: ${validation.warnings.join(", ")}`);
				}

				results.push({
					source: filePath,
					target: `${transformed.folder}/${transformed.title}`,
					success: true,
					observationCount: transformed.observations.length,
					relationCount: transformed.relations.length,
				});
				migrated++;
				totalObservations += transformed.observations.length;
				totalRelations += transformed.relations.length;
			} else {
				// Actually write the note
				const success = await writeNote(
					transformed.folder,
					transformed.title,
					transformed.fullContent,
				);

				if (success) {
					console.log(
						`[OK] ${relativePath} -> ${transformed.folder}/${transformed.title}`,
					);
					migrated++;
					totalObservations += transformed.observations.length;
					totalRelations += transformed.relations.length;
					results.push({
						source: filePath,
						target: `${transformed.folder}/${transformed.title}`,
						success: true,
						observationCount: transformed.observations.length,
						relationCount: transformed.relations.length,
					});
				} else {
					console.log(`[FAIL] ${relativePath}`);
					failed++;
					results.push({
						source: filePath,
						target: `${transformed.folder}/${transformed.title}`,
						success: false,
						observationCount: 0,
						relationCount: 0,
						error: "Write failed",
					});
				}
			}
		} catch (error) {
			const relativePath = path.relative(AGENTS_ROOT, filePath);
			console.log(`[ERROR] ${relativePath}: ${error}`);
			failed++;
			results.push({
				source: filePath,
				target: "",
				success: false,
				observationCount: 0,
				relationCount: 0,
				error: String(error),
			});
		}
	}

	// Summary
	console.log("\n=== Summary ===\n");
	console.log(`Files processed: ${files.length}`);
	console.log(`${dryRun ? "Would migrate" : "Migrated"}: ${migrated}`);
	console.log(`Failed: ${failed}`);
	console.log(`Total observations: ${totalObservations}`);
	console.log(`Total relations: ${totalRelations}`);
	console.log(
		`Avg observations/note: ${(totalObservations / migrated).toFixed(1)}`,
	);
	console.log(`Avg relations/note: ${(totalRelations / migrated).toFixed(1)}`);

	if (!dryRun) {
		console.log("\n=== Running verification ===\n");
		await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait for indexing
		const { total, indexed } = await verifyIndexing();
		console.log(`Indexed: ${indexed} of ${total} expected`);
	}
}

main().catch(console.error);
