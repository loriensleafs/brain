/**
 * Handler for analyze_project tool
 *
 * Scans a Brain project and reports conformance issues against naming conventions.
 * Returns lists of conforming and non-conforming files with suggested fixes.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { getBasicMemoryClient } from "../../proxy/client";
import { detectClusters } from "../organizer/clusterDetection";
import type { ParsedSourceFile } from "../organizer/schemas/clusterSchema";
import {
	checkConformance,
	getSuggestedTarget,
	inferTypeFromPath,
} from "./conformanceChecker";
import { formatPreviewText, generatePreview } from "./preview";
import type {
	AnalyzeProjectArgs,
	AnalyzeProjectOutput,
	ConformanceIssueType,
	NonConformingFile,
} from "./schema";
import { brainTargetSchema } from "./schema";

/**
 * Main handler for the analyze_project tool
 */
export async function handler(
	args: AnalyzeProjectArgs,
): Promise<CallToolResult> {
	const project = args.project || resolveProject();
	const mode = args.mode || "conform";

	if (!project) {
		return {
			content: [{ type: "text" as const, text: "No project specified." }],
			isError: true,
		};
	}

	// Validate import mode requirements
	if (mode === "import") {
		if (!args.source_schema) {
			return {
				content: [
					{
						type: "text" as const,
						text: "source_schema is required when mode=import",
					},
				],
				isError: true,
			};
		}
		if (!args.source_path) {
			return {
				content: [
					{
						type: "text" as const,
						text: "source_path is required when mode=import",
					},
				],
				isError: true,
			};
		}
	}

	// Branch by mode
	if (mode === "import") {
		return handleImportMode(
			args.source_path!,
			args.source_schema!,
			args.preview || false,
		);
	} else {
		return handleConformMode(project, args.preview || false);
	}
}

/**
 * Handle conform mode - check existing Brain notes for conformance
 */
async function handleConformMode(
	project: string,
	preview: boolean,
): Promise<CallToolResult> {
	const client = await getBasicMemoryClient();

	// Get all notes via list_directory with depth
	const listResult = await client.callTool({
		name: "list_directory",
		arguments: { project, depth: 10, file_name_glob: "*.md" },
	});

	// Parse the result to extract file paths
	const files = parseListDirectoryResult(listResult);

	const conforming: string[] = [];
	const nonConforming: NonConformingFile[] = [];
	const issueCounts: Partial<Record<ConformanceIssueType, number>> = {};
	let autoFixable = 0;
	let needsReview = 0;

	for (const filePath of files) {
		// Read each file to check frontmatter
		const readResult = await client.callTool({
			name: "read_note",
			arguments: { identifier: filePath, project },
		});

		const parsed = parseNoteContent(filePath, readResult);
		const issues = checkConformance(parsed, brainTargetSchema);

		if (issues.length === 0) {
			conforming.push(filePath);
		} else {
			const suggestedTarget = getSuggestedTarget(parsed, issues);
			const _allAutoFixable = issues.every((i) => i.auto_fixable);

			nonConforming.push({
				path: filePath,
				current_type:
					(parsed.frontmatter?.type as any) || inferTypeFromPath(filePath),
				issues,
				suggested_target: suggestedTarget,
			});

			// Count issues
			for (const issue of issues) {
				issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
				if (issue.auto_fixable) autoFixable++;
				else needsReview++;
			}
		}
	}

	const output: AnalyzeProjectOutput = {
		mode: "conform",
		project,
		total_files: files.length,
		conforming,
		non_conforming: nonConforming,
		summary: {
			by_issue_type: issueCounts,
			auto_fixable: autoFixable,
			needs_review: needsReview,
		},
	};

	// If preview mode, generate and format the migration preview
	if (preview) {
		const migrationPreview = generatePreview(nonConforming);
		const previewText = formatPreviewText(migrationPreview);

		return {
			structuredContent: migrationPreview as unknown as {
				[x: string]: unknown;
			},
			content: [{ type: "text" as const, text: previewText }],
		};
	}

	// Build text output
	const lines: string[] = [
		`## Project Conformance Analysis`,
		``,
		`**Project:** ${project}`,
		`**Mode:** conform`,
		`**Total Files:** ${files.length}`,
		`**Conforming:** ${conforming.length}`,
		`**Non-Conforming:** ${nonConforming.length}`,
		``,
	];

	if (Object.keys(issueCounts).length > 0) {
		lines.push(`### Issues by Type`);
		for (const [type, count] of Object.entries(issueCounts)) {
			lines.push(`- ${type}: ${count}`);
		}
		lines.push(``);
	}

	if (nonConforming.length > 0) {
		lines.push(`### Non-Conforming Files`);
		for (const file of nonConforming.slice(0, 20)) {
			// Limit output
			lines.push(`- **${file.path}**`);
			for (const issue of file.issues) {
				lines.push(`  - ${issue.type}: ${issue.description}`);
				lines.push(`    Fix: ${issue.suggested_fix}`);
			}
		}
		if (nonConforming.length > 20) {
			lines.push(`... and ${nonConforming.length - 20} more`);
		}
	}

	return {
		structuredContent: output as unknown as { [x: string]: unknown },
		content: [{ type: "text" as const, text: lines.join("\n") }],
	};
}

/**
 * Handle import mode - analyze external project files for migration to Brain
 * Reads directly from filesystem at source_path
 */
async function handleImportMode(
	sourcePath: string,
	sourceSchema: any,
	preview: boolean,
): Promise<CallToolResult> {
	// Expand ~ to home directory
	const expandedPath = sourcePath.replace(/^~/, process.env.HOME || "");

	// Verify source path exists
	if (!fs.existsSync(expandedPath)) {
		return {
			content: [
				{
					type: "text" as const,
					text: `Source path not found: ${expandedPath}`,
				},
			],
			isError: true,
		};
	}

	// Recursively find all .md files
	const files = findMarkdownFiles(expandedPath);
	const nonConforming: NonConformingFile[] = [];
	const parsedFiles: ParsedSourceFile[] = [];

	for (const filePath of files) {
		// Read file content directly from filesystem
		const content = fs.readFileSync(filePath, "utf-8");
		const relativePath = path.relative(expandedPath, filePath);

		// Infer note type from source schema
		const noteType = inferTypeFromSourceSchema(relativePath, sourceSchema);

		// Generate suggested target path using Brain conventions
		const suggestedTarget = generateBrainTargetPath(relativePath, noteType);

		nonConforming.push({
			path: relativePath,
			current_type: noteType,
			issues: [
				{
					type: "wrong_folder",
					description: `External file needs migration to Brain conventions`,
					auto_fixable: true,
					suggested_fix: `Move to ${suggestedTarget}`,
				},
			],
			suggested_target: suggestedTarget,
		});

		// Parse for cluster detection
		const folder = relativePath.includes("/")
			? relativePath.substring(0, relativePath.lastIndexOf("/"))
			: "";
		parsedFiles.push({
			path: relativePath,
			content,
			title: extractTitle(content),
			folder,
			lineCount: content.split("\n").length,
		});
	}

	// Detect clusters
	const clusters = await detectClusters(parsedFiles, sourceSchema);

	// If preview mode, generate migration preview
	if (preview) {
		const migrationPreview = generatePreview(nonConforming);
		const previewText = formatPreviewText(migrationPreview);
		return {
			structuredContent: migrationPreview as unknown as {
				[x: string]: unknown;
			},
			content: [{ type: "text" as const, text: previewText }],
		};
	}

	// Build text output
	const lines: string[] = [
		`## Import Analysis`,
		``,
		`**Source Path:** ${expandedPath}`,
		`**Source Schema:** ${sourceSchema.name}`,
		`**Total Files:** ${files.length}`,
		`**Clusters Detected:** ${clusters.length}`,
		``,
	];

	if (clusters.length > 0) {
		lines.push(`### Detected Clusters`);
		for (const cluster of clusters) {
			lines.push(
				`- **${cluster.id}** (${cluster.cluster_type}): ${cluster.files.length} files`,
			);
			lines.push(`  ${cluster.rationale}`);
			lines.push(`  Recommendation: ${cluster.merge_recommendation}`);
		}
		lines.push(``);
	}

	if (nonConforming.length > 0) {
		lines.push(`### Migration Plan`);
		for (const file of nonConforming.slice(0, 20)) {
			lines.push(`- **${file.path}** → ${file.suggested_target}`);
			lines.push(`  Type: ${file.current_type || "unknown"}`);
		}
		if (nonConforming.length > 20) {
			lines.push(`... and ${nonConforming.length - 20} more`);
		}
	}

	return {
		structuredContent: { files: nonConforming, clusters } as unknown as {
			[x: string]: unknown;
		},
		content: [{ type: "text" as const, text: lines.join("\n") }],
	};
}

/**
 * Recursively find all markdown files in a directory
 */
function findMarkdownFiles(dir: string): string[] {
	const files: string[] = [];

	function walk(currentDir: string) {
		const entries = fs.readdirSync(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory() && !entry.name.startsWith(".")) {
				walk(fullPath);
			} else if (entry.isFile() && entry.name.endsWith(".md")) {
				files.push(fullPath);
			}
		}
	}

	walk(dir);
	return files;
}

/**
 * Extract title from markdown content
 */
function extractTitle(content: string): string | undefined {
	// Try YAML frontmatter
	const fmMatch = content.match(
		/^---\n[\s\S]*?title:\s*['"]?([^'"\n]+)['"]?[\s\S]*?\n---/,
	);
	if (fmMatch) return fmMatch[1];

	// Try first H1
	const h1Match = content.match(/^#\s+(.+)$/m);
	if (h1Match) return h1Match[1];

	// Try inline header (working-memory style)
	const inlineMatch = content.match(/^\*\*Title:\*\*\s*(.+)$/m);
	if (inlineMatch) return inlineMatch[1];

	return undefined;
}

/**
 * Infers note type from source schema folder_types and file_patterns
 */
function inferTypeFromSourceSchema(filePath: string, sourceSchema: any): any {
	// Check folder_types first
	for (const [folder, type] of Object.entries(sourceSchema.folder_types)) {
		if (filePath.startsWith(`${folder}/`)) {
			return type;
		}
	}

	// Check file_patterns
	const fileName = filePath.split("/").pop() || "";
	for (const [pattern, type] of Object.entries(sourceSchema.file_patterns)) {
		if (fileName.match(new RegExp(pattern))) {
			return type;
		}
	}

	return null;
}

/**
 * Generates Brain-compliant target path from source file and inferred type
 */
function generateBrainTargetPath(sourcePath: string, noteType: any): string {
	// Extract slug from filename
	const fileName = sourcePath.split("/").pop() || "";
	const slug = fileName
		.replace(".md", "")
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-");

	// Map to Brain conventions based on type
	switch (noteType) {
		case "feature":
			return `features/${slug}/overview.md`;
		case "research":
			return `research/${slug}/overview.md`;
		case "analysis":
			return `analysis/${slug}/overview.md`;
		case "decision":
			return `decisions/${slug}.md`;
		case "spec":
			return `specs/${slug}.md`;
		case "conversation":
			return `history/${slug}.md`;
		default:
			return `notes/${slug}.md`;
	}
}

/**
 * Parses list_directory output to extract file paths
 */
function parseListDirectoryResult(result: any): string[] {
	// Parse list_directory output to extract file paths
	const text = result.content?.[0]?.text || "";
	const files: string[] = [];
	const lines = text.split("\n");
	for (const line of lines) {
		if (line.includes(".md") && !line.includes("Directory:")) {
			// Extract filename from output format
			const match = line.match(/([^\s]+\.md)/);
			if (match) files.push(match[1]);
		}
	}
	return files;
}

/**
 * Parses note content to extract frontmatter and check for required sections
 */
function parseNoteContent(
	path: string,
	result: any,
): {
	path: string;
	relativePath: string;
	frontmatter: Record<string, unknown> | null;
	hasObservations: boolean;
	hasRelations: boolean;
} {
	const text = result.content?.[0]?.text || "";

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

export { toolDefinition } from "./schema";
