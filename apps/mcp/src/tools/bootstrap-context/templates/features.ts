/**
 * Features section template
 *
 * Renders active features with their phases and tasks.
 */

import type { NoteType } from "../noteType";
import type { NoteStatus } from "../statusParser";

export interface FeatureData {
	title: string;
	permalink: string;
	type: NoteType;
	status: NoteStatus;
	phases?: FeatureData[];
	tasks?: FeatureData[];
}

/**
 * Render features section with hierarchy
 */
export function renderFeaturesSection(features: FeatureData[]): string {
	if (features.length === 0) {
		return "";
	}

	const lines: string[] = ["### Active Features", ""];

	for (const feature of features) {
		lines.push(renderFeature(feature, 0));
	}

	return lines.join("\n");
}

function renderFeature(item: FeatureData, depth: number): string {
	const indent = "  ".repeat(depth);
	const statusBadge = getStatusBadge(item.status);
	const lines: string[] = [];

	lines.push(`${indent}- ${statusBadge} **[[${item.title}]]** (${item.type})`);

	// Render phases if present
	if (item.phases && item.phases.length > 0) {
		for (const phase of item.phases) {
			lines.push(renderFeature(phase, depth + 1));
		}
	}

	// Render tasks if present
	if (item.tasks && item.tasks.length > 0) {
		for (const task of item.tasks) {
			lines.push(renderFeature(task, depth + 1));
		}
	}

	return lines.join("\n");
}

function getStatusBadge(status: NoteStatus): string {
	switch (status) {
		case "not_started":
			return "○";
		case "in_progress":
			return "◐";
		case "complete":
			return "●";
		case "blocked":
			return "⊘";
		case "closed":
			return "✓";
		case "active":
			return "◐";
		default:
			return "·";
	}
}
