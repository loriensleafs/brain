/**
 * Schema definitions for the analyze_project tool
 *
 * Defines the target schema for Brain project conventions, including naming rules,
 * required sections, and conformance issue types. Used to validate and report
 * on project structure compliance.
 */

import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { SourceSchema } from "../organizer/schemas/sourceSchema";

/**
 * Supported note types in a Brain project
 */
export type NoteType =
	| "feature"
	| "phase"
	| "task"
	| "research"
	| "analysis"
	| "spec"
	| "decision"
	| "note";

/**
 * Naming and location conventions for a specific note type
 */
export interface NamingRule {
	location: string;
	main_file: string;
	child_pattern?: string;
	no_prefix?: boolean;
}

export interface TargetSchema {
	naming: Record<NoteType, NamingRule>;
	required_sections: string[];
	frontmatter_required: boolean;
	min_observations: number;
	min_relations: number;
}

export type ConformanceIssueType =
	| "wrong_folder"
	| "bad_prefix"
	| "root_level_scoped"
	| "redundant_child_prefix"
	| "not_overview"
	| "missing_frontmatter"
	| "missing_observations"
	| "missing_relations";

export interface ConformanceIssue {
	type: ConformanceIssueType;
	description: string;
	auto_fixable: boolean;
	suggested_fix: string;
}

export const brainTargetSchema: TargetSchema = {
	naming: {
		feature: { location: "features/[slug]/", main_file: "overview.md" },
		phase: { location: "features/[slug]/phase-[n]/", main_file: "overview.md" },
		task: { location: "features/[slug]/", main_file: "[task-name].md" },
		research: { location: "research/[slug]/", main_file: "overview.md" },
		analysis: { location: "analysis/[slug]/", main_file: "overview.md" },
		spec: { location: "specs/", main_file: "[name].md", no_prefix: true },
		decision: {
			location: "decisions/",
			main_file: "[name].md",
			no_prefix: true,
		},
		note: { location: "[folder]/", main_file: "[name].md" },
	},
	required_sections: ["## Observations", "## Relations"],
	frontmatter_required: true,
	min_observations: 3,
	min_relations: 2,
};

export interface AnalyzeProjectArgs {
	project?: string;
	mode?: "conform" | "import";
	preview?: boolean;
	source_schema?: SourceSchema;
	source_path?: string; // Direct filesystem path for import mode
}

/**
 * Types of migration operations for dry-run preview
 */
export type MigrationOperation = "rename" | "restructure" | "move";

/**
 * Single item in the migration preview showing source, target, and reason
 */
export interface MigrationPreviewItem {
	source: string;
	target: string;
	operation: MigrationOperation;
	reason: string;
	issues: ConformanceIssue[];
}

/**
 * Complete migration preview with files grouped by operation type
 */
export interface MigrationPreview {
	total_changes: number;
	by_operation: {
		rename: MigrationPreviewItem[];
		restructure: MigrationPreviewItem[];
		move: MigrationPreviewItem[];
	};
	warnings: string[];
	auto_fixable_count: number;
	needs_review_count: number;
}

export interface NonConformingFile {
	path: string;
	current_type: NoteType | null;
	issues: ConformanceIssue[];
	suggested_target: string;
}

export interface AnalyzeProjectOutput {
	mode: "conform";
	project: string;
	total_files: number;
	conforming: string[];
	non_conforming: NonConformingFile[];
	summary: {
		by_issue_type: Partial<Record<ConformanceIssueType, number>>;
		auto_fixable: number;
		needs_review: number;
	};
}

export const toolDefinition: Tool = {
	name: "analyze_project",
	description:
		"Scan a Brain project and report conformance issues against naming conventions. Returns lists of conforming and non-conforming files with suggested fixes.",
	inputSchema: {
		type: "object" as const,
		properties: {
			project: {
				type: "string",
				description: "Project to analyze. Auto-resolved if not specified.",
			},
			mode: {
				type: "string",
				enum: ["conform", "import"],
				default: "conform",
				description:
					"Analysis mode. conform=check existing notes, import=analyze external project",
			},
			preview: {
				type: "boolean",
				default: false,
				description:
					"When true, return a grouped visual preview of planned migrations instead of raw conformance data",
			},
			source_schema: {
				type: "object",
				description:
					"Required when mode=import. Describes the source project structure (folder_types, file_patterns, metadata_format).",
			},
			source_path: {
				type: "string",
				description:
					"Required when mode=import. Direct filesystem path to the external project to import.",
			},
		},
	},
};
