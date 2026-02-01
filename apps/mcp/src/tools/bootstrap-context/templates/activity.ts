/**
 * Activity section template
 *
 * Renders recent activity (recently updated notes).
 */

import type { NoteType } from "../noteType";

export interface ActivityData {
	title: string;
	permalink: string;
	type: NoteType;
	updatedAt?: string;
}

/**
 * Render activity section
 */
export function renderActivitySection(
	activity: ActivityData[],
	limit: number = 10,
): string {
	if (activity.length === 0) {
		return "";
	}

	const lines: string[] = ["### Recent Activity", ""];

	const items = activity.slice(0, limit);
	for (const item of items) {
		const typeLabel = getTypeLabel(item.type);
		lines.push(`- [[${item.title}]] ${typeLabel}`);
	}

	if (activity.length > limit) {
		lines.push(`- _...and ${activity.length - limit} more_`);
	}

	return lines.join("\n");
}

function getTypeLabel(type: NoteType): string {
	switch (type) {
		case "feature":
			return "(feature)";
		case "phase":
			return "(phase)";
		case "task":
			return "(task)";
		case "decision":
			return "(decision)";
		case "bug":
			return "(bug)";
		case "spec":
			return "(spec)";
		case "research":
			return "(research)";
		case "analysis":
			return "(analysis)";
		default:
			return "";
	}
}
