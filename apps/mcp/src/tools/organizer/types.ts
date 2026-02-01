/**
 * Type definitions for organizer consolidate mode
 *
 * Defines interfaces for consolidation operations including merge and split
 * candidates, configuration options, and operation results.
 */

/**
 * Configuration for consolidate mode analysis
 */
export interface ConsolidateConfig {
	project: string;
	similarityThreshold?: number; // default 0.85
	minNoteSize?: number; // min lines for merge candidate (default 10)
	maxNoteSize?: number; // max lines for split candidate (default 200)
}

/**
 * Candidate for merging multiple notes into one
 */
export interface MergeCandidate {
	notes: string[]; // permalinks of notes to merge
	similarity: number; // 0-1 similarity score
	suggestedTitle: string; // proposed title for merged note
	rationale: string; // explanation for merge recommendation
}

/**
 * Candidate for splitting a large note into multiple atomic notes
 */
export interface SplitCandidate {
	note: string; // permalink of note to split
	suggestedTopics: string[]; // identified topics/sections
	rationale: string; // explanation for split recommendation
}

/**
 * Result from consolidation analysis
 */
export interface ConsolidateResult {
	mergeCandidates: MergeCandidate[];
	splitCandidates: SplitCandidate[];
}

/**
 * Operation type for note consolidation
 */
export type OperationType = "MERGE" | "SPLIT" | "NOOP";

/**
 * Result from executing a merge operation
 */
export interface MergeResult {
	success: boolean;
	targetNote: string; // permalink of resulting merged note
	archivedNotes: string[]; // permalinks of archived original notes
	error?: string;
}

/**
 * Result from executing a split operation
 */
export interface SplitResult {
	success: boolean;
	resultingNotes: string[]; // permalinks of new notes created
	archivedNote: string; // permalink of archived original note
	error?: string;
}

/**
 * Configuration for maintain mode analysis
 */
export interface MaintainConfig {
	project: string;
	staleThresholdDays?: number; // default 90
	qualityThreshold?: number; // default 0.5
}

/**
 * Quality issue found in knowledge graph
 */
export interface QualityIssue {
	type: "ORPHAN" | "STALE" | "GAP" | "WEAK";
	note?: string;
	reference?: string;
	score?: number;
	lastModified?: Date;
	recommendation: string;
}

/**
 * Result from maintain mode analysis
 */
export interface MaintainResult {
	orphans: QualityIssue[];
	stale: QualityIssue[];
	gaps: QualityIssue[];
	weak: QualityIssue[];
	summary: {
		totalIssues: number;
		orphanCount: number;
		staleCount: number;
		gapCount: number;
		weakCount: number;
	};
}

/**
 * Configuration for dedupe mode analysis
 */
export interface DedupeConfig {
	project: string;
	embeddingThreshold?: number; // default 0.85
	fulltextThreshold?: number; // default 0.7
}

/**
 * Pair of potentially duplicate notes
 */
export interface DuplicatePair {
	note1: string; // permalink
	note2: string; // permalink
	embeddingSimilarity: number;
	fulltextSimilarity: number;
	rationale?: string; // LLM explanation
}

/**
 * Result from dedupe mode analysis
 */
export interface DedupeResult {
	candidates: DuplicatePair[];
	confirmed: DuplicatePair[];
	summary: {
		totalCandidates: number;
		confirmedDuplicates: number;
	};
}

/**
 * Configuration for backlog mode operations
 */
export interface BacklogConfig {
	project: string;
	operation:
		| "QUERY_ORDER"
		| "SET_PRIORITY"
		| "ADD_DEPENDENCY"
		| "REMOVE_DEPENDENCY";
	feature_id?: string;
	priority?: number;
	dependency_target?: string;
}

/**
 * Result from backlog mode operations
 */
export interface BacklogResult {
	operation: string;
	success: boolean;
	data?: any;
	error?: string;
}
