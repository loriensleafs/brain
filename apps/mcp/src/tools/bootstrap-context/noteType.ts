/**
 * Note type detection utilities
 *
 * Detects note types from frontmatter, folder patterns, and title patterns.
 * Priority: frontmatter > folder > title > default
 */

export type NoteType =
	| "feature"
	| "phase"
	| "task"
	| "decision"
	| "bug"
	| "spec"
	| "research"
	| "analysis"
	| "note";

/**
 * Folder patterns that indicate note type
 */
const FOLDER_PATTERNS: Record<string, NoteType> = {
	features: "feature",
	decisions: "decision",
	bugs: "bug",
	specs: "spec",
	research: "research",
	analysis: "analysis",
};

/**
 * Title prefixes that indicate note type
 */
const TITLE_PATTERNS: Record<string, NoteType> = {
	"Decision:": "decision",
	"Spec:": "spec",
	"Research:": "research",
	"Analysis:": "analysis",
	"Bug:": "bug",
};

/**
 * Detect note type from frontmatter, folder, or title
 */
export function detectNoteType(
	frontmatterType?: string,
	folder?: string,
	title?: string,
): NoteType {
	// Priority 1: Explicit frontmatter type
	if (frontmatterType) {
		const normalized = frontmatterType.toLowerCase();
		if (isValidNoteType(normalized)) {
			return normalized;
		}
	}

	// Priority 2: Folder pattern
	if (folder) {
		const topFolder = folder.split("/")[0].toLowerCase();
		if (topFolder in FOLDER_PATTERNS) {
			return FOLDER_PATTERNS[topFolder];
		}
	}

	// Priority 3: Title prefix
	if (title) {
		for (const [prefix, type] of Object.entries(TITLE_PATTERNS)) {
			if (title.startsWith(prefix)) {
				return type;
			}
		}
	}

	// Default
	return "note";
}

/**
 * Check if a string is a valid NoteType
 */
function isValidNoteType(value: string): value is NoteType {
	return [
		"feature",
		"phase",
		"task",
		"decision",
		"bug",
		"spec",
		"research",
		"analysis",
		"note",
	].includes(value);
}
