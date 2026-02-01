/**
 * Status parsing utilities
 *
 * Parses status from ## Status sections, title patterns, and defaults.
 * Priority: section content > title pattern > default ("active")
 */

export type NoteStatus =
  | "not_started"
  | "in_progress"
  | "complete"
  | "blocked"
  | "closed"
  | "active";

/**
 * Status patterns in order of priority (case-insensitive matching)
 */
const STATUS_PATTERNS: Record<string, NoteStatus> = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETE: "complete",
  COMPLETED: "complete",
  DONE: "complete",
  BLOCKED: "blocked",
  CLOSED: "closed",
};

/**
 * Title patterns indicating status
 */
const TITLE_STATUS_PATTERNS: Record<string, NoteStatus> = {
  "WIP:": "in_progress",
  "DONE:": "complete",
  "[CLOSED]": "closed",
  "[BLOCKED]": "blocked",
};

/**
 * Parse status from note content and/or title
 *
 * @param content - Full markdown content of the note
 * @param title - Note title (optional fallback)
 * @returns Normalized status value
 */
export function parseStatus(content?: string, title?: string): NoteStatus {
  // Priority 1: ## Status section
  if (content) {
    const sectionStatus = parseStatusSection(content);
    if (sectionStatus) return sectionStatus;
  }

  // Priority 2: Title pattern
  if (title) {
    const titleStatus = parseTitleStatus(title);
    if (titleStatus) return titleStatus;
  }

  // Default: assume active work
  return "active";
}

/**
 * Extract status from ## Status section content
 *
 * Handles formats:
 * - **STATUS** (bold)
 * - `**STATUS**` (code + bold)
 * - Plain STATUS word
 *
 * @param content - Full markdown content
 * @returns Parsed status or null if not found
 */
export function parseStatusSection(content: string): NoteStatus | null {
  // Match ## Status section and capture content until next section or end
  // Using multiline flag and capturing everything after "## Status"
  const sectionMatch = content.match(
    /^##\s+Status\s*\n+([\s\S]*?)(?=\n##\s|\n---|\n\n\n|$)/im,
  );

  if (!sectionMatch) return null;

  const sectionContent = sectionMatch[1].trim();

  // Look for **STATUS** pattern (bold) - most common format
  const boldMatch = sectionContent.match(/\*\*([A-Z_]+)\*\*/i);
  if (boldMatch) {
    const status = boldMatch[1].toUpperCase();
    if (status in STATUS_PATTERNS) {
      return STATUS_PATTERNS[status];
    }
  }

  // Look for plain status word anywhere in section
  const upperContent = sectionContent.toUpperCase();
  for (const [pattern, status] of Object.entries(STATUS_PATTERNS)) {
    if (upperContent.includes(pattern)) {
      return status;
    }
  }

  return null;
}

/**
 * Extract status from title patterns
 *
 * @param title - Note title
 * @returns Parsed status or null if no pattern matches
 */
export function parseTitleStatus(title: string): NoteStatus | null {
  for (const [pattern, status] of Object.entries(TITLE_STATUS_PATTERNS)) {
    if (title.includes(pattern)) {
      return status;
    }
  }
  return null;
}

/**
 * Check if a status indicates the item is "open" (not finished)
 */
export function isOpenStatus(status: NoteStatus): boolean {
  return status !== "complete" && status !== "closed";
}

/**
 * Check if a status indicates active work
 */
export function isActiveStatus(status: NoteStatus): boolean {
  return status === "in_progress" || status === "active";
}
