/**
 * Bugs section template
 *
 * Renders open bugs with status indicators.
 */

import type { NoteStatus } from "../statusParser";

export interface BugData {
	title: string;
	permalink: string;
	status: NoteStatus;
	updatedAt?: string;
}

/**
 * Render bugs section
 */
export function renderBugsSection(bugs: BugData[]): string {
	if (bugs.length === 0) {
		return "";
	}

	const lines: string[] = ["### Open Bugs", ""];

	for (const bug of bugs) {
		const statusBadge = getStatusBadge(bug.status);
		lines.push(`- ${statusBadge} [[${bug.title}]]`);
	}

	return lines.join("\n");
}

function getStatusBadge(status: NoteStatus): string {
	switch (status) {
		case "not_started":
			return "🔴";
		case "in_progress":
			return "🟡";
		case "blocked":
			return "⛔";
		default:
			return "🔴";
	}
}
