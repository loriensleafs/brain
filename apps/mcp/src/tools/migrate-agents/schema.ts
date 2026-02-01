/**
 * Schema definitions for the migrate-agents tool
 *
 * Defines types for migrating .agents/ content to basic-memory format
 * with full transformation to observations and relations.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Entity type mappings for .agents/ directories
 */
export type AgentEntityType =
	| "session"
	| "decision"
	| "requirement"
	| "design"
	| "task"
	| "analysis"
	| "feature"
	| "epic"
	| "critique"
	| "test-report"
	| "security"
	| "retrospective"
	| "skill"
	| "note";

/**
 * Observation categories per basic-memory format
 */
export type ObservationCategory =
	| "fact"
	| "decision"
	| "requirement"
	| "technique"
	| "insight"
	| "problem"
	| "solution"
	| "outcome";

/**
 * Relation types per basic-memory format
 */
export type RelationType =
	| "implements"
	| "depends_on"
	| "relates_to"
	| "extends"
	| "part_of"
	| "inspired_by"
	| "contains"
	| "pairs_with"
	| "supersedes"
	| "leads_to"
	| "caused_by";

/**
 * A single observation extracted from content
 */
export interface Observation {
	category: ObservationCategory;
	content: string;
	tags: string[];
}

/**
 * A single relation extracted from content
 */
export interface Relation {
	type: RelationType;
	target: string;
	context?: string;
}

/**
 * Parsed source file from .agents/
 */
export interface ParsedAgentFile {
	/** Original file path */
	sourcePath: string;
	/** Relative path within .agents/ */
	relativePath: string;
	/** Original frontmatter if present */
	originalFrontmatter: Record<string, unknown>;
	/** Original content without frontmatter */
	content: string;
	/** Detected entity type */
	entityType: AgentEntityType;
	/** Extracted title */
	title: string;
	/** Raw sections for observation extraction */
	sections: Map<string, string>;
}

/**
 * Transformed note ready for basic-memory
 */
export interface TransformedNote {
	/** Target folder in basic-memory */
	folder: string;
	/** Note title */
	title: string;
	/** Entity type for frontmatter */
	type: AgentEntityType;
	/** Tags extracted from content */
	tags: string[];
	/** Generated observations */
	observations: Observation[];
	/** Detected relations */
	relations: Relation[];
	/** Context section content */
	context: string;
	/** Full markdown content for write_note */
	fullContent: string;
}

/**
 * Result of a single file migration
 */
export interface MigrationResult {
	source: string;
	target: string;
	success: boolean;
	observationCount: number;
	relationCount: number;
	error?: string;
}

/**
 * Input arguments for migrate_agents tool
 */
export interface MigrateAgentsArgs {
	/** Source directory containing .agents/ files */
	source_path: string;
	/** Target project for basic-memory */
	project?: string;
	/** Only process specific subdirectory (sessions, planning, etc.) */
	subdirectory?: string;
	/** Dry run mode - show what would happen without writing */
	dry_run?: boolean;
	/** Maximum files to process (for testing) */
	limit?: number;
}

/**
 * Output from migrate_agents tool
 */
export interface MigrateAgentsOutput {
	success: boolean;
	files_processed: number;
	files_migrated: number;
	files_failed: number;
	total_observations: number;
	total_relations: number;
	results: MigrationResult[];
	errors: string[];
}

/**
 * Directory to folder mapping for .agents/ structure
 */
export const DIRECTORY_MAPPING: Record<
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
 * Quality thresholds for transformed notes
 */
export const QUALITY_THRESHOLDS = {
	minObservations: 3,
	maxObservations: 10,
	minRelations: 2,
	maxRelations: 5,
};

export const toolDefinition: Tool = {
	name: "migrate_agents",
	description: `Migrate .agents/ content to basic-memory format with full transformation.

This tool:
1. Reads .agents/ files (sessions, ADRs, specs, etc.)
2. Extracts metadata from frontmatter and content
3. Transforms content into categorized observations
4. Detects relations to other entities
5. Generates proper basic-memory format with frontmatter
6. Writes to Brain memory using write_note

Quality thresholds: 3-5 observations per note, 2-3 relations per note.

Usage:
- source_path: Path to .agents/ directory
- project: Target Brain project (auto-resolved if not specified)
- subdirectory: Only process specific subdirectory (sessions, planning, etc.)
- dry_run: Preview transformations without writing
- limit: Maximum files to process (for testing)`,
	inputSchema: {
		type: "object" as const,
		properties: {
			source_path: {
				type: "string",
				description: "Path to .agents/ directory to migrate",
			},
			project: {
				type: "string",
				description: "Target Brain project. Auto-resolved if not specified.",
			},
			subdirectory: {
				type: "string",
				description:
					"Only process specific subdirectory (sessions, planning, etc.)",
			},
			dry_run: {
				type: "boolean",
				default: false,
				description: "Preview transformations without writing",
			},
			limit: {
				type: "number",
				description: "Maximum files to process (for testing)",
			},
		},
		required: ["source_path"],
	},
};
