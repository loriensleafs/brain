/**
 * Parser module for extracting content from .agents/ markdown files
 *
 * Handles frontmatter extraction, section parsing, and entity type detection.
 */

import * as path from "node:path";
import matter from "gray-matter";
import type { AgentEntityType, ParsedAgentFile } from "./schema";

// Re-import for runtime use
const DIRECTORY_MAP: Record<
	string,
	{ folder: string; entityType: AgentEntityType }
> = {
	sessions: { folder: "sessions", entityType: "session" },
	architecture: { folder: "decisions", entityType: "decision" },
	planning: { folder: "planning", entityType: "feature" },
	analysis: { folder: "analysis", entityType: "analysis" },
	roadmap: { folder: "roadmap", entityType: "epic" },
	critique: { folder: "critique", entityType: "critique" },
	qa: { folder: "qa", entityType: "test-report" },
	security: { folder: "security", entityType: "security" },
	retrospective: { folder: "retrospective", entityType: "retrospective" },
	skills: { folder: "skills", entityType: "skill" },
	"specs/requirements": {
		folder: "specs/requirements",
		entityType: "requirement",
	},
	"specs/design": { folder: "specs/design", entityType: "design" },
	"specs/tasks": { folder: "specs/tasks", entityType: "task" },
};

/**
 * Parse a markdown file from .agents/ directory
 *
 * @param content - Raw markdown content
 * @param sourcePath - Full path to the source file
 * @param agentsRoot - Root .agents/ directory path
 * @returns Parsed file structure
 */
export function parseAgentFile(
	content: string,
	sourcePath: string,
	agentsRoot: string,
): ParsedAgentFile {
	// Parse frontmatter
	const parsed = matter(content);
	const originalFrontmatter = parsed.data as Record<string, unknown>;
	const bodyContent = parsed.content;

	// Calculate relative path within .agents/
	const relativePath = path.relative(agentsRoot, sourcePath);
	const relativeDir = path.dirname(relativePath);

	// Detect entity type from directory structure
	const entityType = detectEntityType(
		relativeDir,
		sourcePath,
		originalFrontmatter,
	);

	// Extract title
	const title = extractTitle(originalFrontmatter, bodyContent, sourcePath);

	// Parse sections
	const sections = parseSections(bodyContent);

	return {
		sourcePath,
		relativePath,
		originalFrontmatter,
		content: bodyContent,
		entityType,
		title,
		sections,
	};
}

/**
 * Detect entity type from directory path and content
 */
function detectEntityType(
	relativeDir: string,
	sourcePath: string,
	frontmatter: Record<string, unknown>,
): AgentEntityType {
	// First check frontmatter type
	if (frontmatter.type && typeof frontmatter.type === "string") {
		const fmType = frontmatter.type.toLowerCase();
		if (isValidEntityType(fmType)) {
			return fmType as AgentEntityType;
		}
	}

	// Check directory mapping
	const normalizedDir = relativeDir.replace(/\\/g, "/");

	// Check for exact match first
	if (DIRECTORY_MAP[normalizedDir]) {
		return DIRECTORY_MAP[normalizedDir].entityType;
	}

	// Check for prefix match (e.g., specs/requirements/foo -> requirement)
	for (const [dirPrefix, mapping] of Object.entries(DIRECTORY_MAP)) {
		if (normalizedDir.startsWith(dirPrefix)) {
			return mapping.entityType;
		}
	}

	// Check filename patterns
	const basename = path.basename(sourcePath, ".md");

	// ADR pattern: ADR-NNN-* or adr-nnn-*
	if (/^ADR-\d+/i.test(basename)) {
		return "decision";
	}

	// Session pattern: YYYY-MM-DD-session-*
	if (/^\d{4}-\d{2}-\d{2}-session/.test(basename)) {
		return "session";
	}

	// REQ pattern
	if (/^REQ-\d+/i.test(basename)) {
		return "requirement";
	}

	// DESIGN pattern
	if (/^DESIGN-\d+/i.test(basename)) {
		return "design";
	}

	// TASK pattern
	if (/^TASK-\d+/i.test(basename)) {
		return "task";
	}

	// Default to note
	return "note";
}

/**
 * Validate entity type string
 */
function isValidEntityType(type: string): boolean {
	const validTypes: AgentEntityType[] = [
		"session",
		"decision",
		"requirement",
		"design",
		"task",
		"analysis",
		"feature",
		"epic",
		"critique",
		"test-report",
		"security",
		"retrospective",
		"skill",
		"note",
	];
	return validTypes.includes(type as AgentEntityType);
}

/**
 * Extract title from frontmatter, H1 heading, or filename
 */
function extractTitle(
	frontmatter: Record<string, unknown>,
	content: string,
	sourcePath: string,
): string {
	// Try frontmatter title
	if (frontmatter.title && typeof frontmatter.title === "string") {
		return frontmatter.title.trim();
	}

	// Try first H1 heading
	const h1Match = content.match(/^#\s+(.+)$/m);
	if (h1Match) {
		return h1Match[1].trim();
	}

	// Fall back to filename (without extension, kebab-to-title case)
	const basename = path.basename(sourcePath, ".md");
	return kebabToTitleCase(basename);
}

/**
 * Convert kebab-case to Title Case
 */
function kebabToTitleCase(str: string): string {
	return str
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * Parse markdown content into sections by headings
 */
export function parseSections(content: string): Map<string, string> {
	const sections = new Map<string, string>();
	const lines = content.split("\n");

	let currentSection = "";
	let currentContent: string[] = [];

	for (const line of lines) {
		// Match any heading level (##, ###, etc.)
		const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

		if (headingMatch) {
			// Save previous section
			if (currentSection) {
				sections.set(currentSection, currentContent.join("\n").trim());
			}

			currentSection = headingMatch[2].trim();
			currentContent = [];
		} else {
			currentContent.push(line);
		}
	}

	// Save last section
	if (currentSection) {
		sections.set(currentSection, currentContent.join("\n").trim());
	}

	// Also save the full content before first heading as 'intro'
	const introMatch = content.match(/^([\s\S]*?)(?=^#)/m);
	if (introMatch?.[1].trim()) {
		sections.set("_intro", introMatch[1].trim());
	}

	return sections;
}

/**
 * Extract key-value pairs from table in markdown content
 */
export function parseMarkdownTable(content: string): Map<string, string> {
	const result = new Map<string, string>();

	// Match table rows: | Key | Value |
	const tableRowPattern = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$/gm;
	let match;

	while ((match = tableRowPattern.exec(content)) !== null) {
		const key = match[1].trim();
		const value = match[2].trim();

		// Skip header separator row (contains dashes)
		if (key.includes("-") && key.replace(/-/g, "").trim() === "") {
			continue;
		}

		// Skip header row (common header names)
		if (
			["Req", "Step", "Status", "Evidence", "Finding", "Severity"].includes(key)
		) {
			continue;
		}

		result.set(key, value);
	}

	return result;
}

/**
 * Extract list items from markdown
 */
export function parseListItems(content: string): string[] {
	const items: string[] = [];

	// Match unordered list items
	const listPattern = /^[-*]\s+(.+)$/gm;
	let match;

	while ((match = listPattern.exec(content)) !== null) {
		items.push(match[1].trim());
	}

	// Match ordered list items
	const orderedPattern = /^\d+\.\s+(.+)$/gm;
	while ((match = orderedPattern.exec(content)) !== null) {
		items.push(match[1].trim());
	}

	return items;
}

/**
 * Get target folder for entity type
 */
export function getTargetFolder(
	entityType: AgentEntityType,
	relativeDir: string,
): string {
	// Check directory mapping
	const normalizedDir = relativeDir.replace(/\\/g, "/");

	for (const [dirPrefix, mapping] of Object.entries(DIRECTORY_MAP)) {
		if (normalizedDir.startsWith(dirPrefix) || normalizedDir === dirPrefix) {
			return mapping.folder;
		}
	}

	// Fall back to entity type as folder
	switch (entityType) {
		case "session":
			return "sessions";
		case "decision":
			return "decisions";
		case "requirement":
			return "specs/requirements";
		case "design":
			return "specs/design";
		case "task":
			return "specs/tasks";
		case "analysis":
			return "analysis";
		case "feature":
			return "planning";
		case "epic":
			return "roadmap";
		case "critique":
			return "critique";
		case "test-report":
			return "qa";
		case "security":
			return "security";
		case "retrospective":
			return "retrospective";
		case "skill":
			return "skills";
		default:
			return "notes";
	}
}
