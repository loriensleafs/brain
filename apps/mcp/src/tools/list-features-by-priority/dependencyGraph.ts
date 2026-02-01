/**
 * Dependency graph builder for features
 */
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getBasicMemoryClient } from "../../proxy/client";

export interface FeatureNode {
	permalink: string;
	title: string;
	priority?: number;
	dependencies: string[]; // permalinks this feature depends on
	status: string;
}

export interface DependencyGraph {
	nodes: Map<string, FeatureNode>;
	warnings: string[];
}

const DEPENDENCY_RELATIONS = ["requires", "builds_on", "blocked_by"];

/**
 * Regex to extract priority from frontmatter
 */
const PRIORITY_REGEX = /^priority:\s*(\d+)/m;

/**
 * Extract priority from note content (includes frontmatter)
 */
function extractPriorityFromFrontmatter(content: string): number | undefined {
	const match = content.match(PRIORITY_REGEX);
	return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Read notes in parallel to extract priority from frontmatter
 */
async function readNotesForPriority(
	client: Client,
	project: string,
	permalinks: string[],
): Promise<Map<string, number | undefined>> {
	const priorities = new Map<string, number | undefined>();

	// Read notes in parallel (batch of 10 at a time)
	for (let i = 0; i < permalinks.length; i += 10) {
		const batch = permalinks.slice(i, i + 10);
		const results = await Promise.all(
			batch.map(async (permalink) => {
				try {
					const result = await client.callTool({
						name: "read_note",
						arguments: { identifier: permalink, project },
					});
					const content = result.content as Array<{
						type: string;
						text: string;
					}>;
					const text = content?.[0]?.text || "";
					return { permalink, priority: extractPriorityFromFrontmatter(text) };
				} catch {
					return { permalink, priority: undefined };
				}
			}),
		);
		for (const { permalink, priority } of results) {
			priorities.set(permalink, priority);
		}
	}

	return priorities;
}

/**
 * Build dependency graph from notes of specified entity type
 */
export async function buildDependencyGraph(
	project: string,
	entityType: "feature" | "task" | "phase" = "feature",
): Promise<DependencyGraph> {
	const client = await getBasicMemoryClient();
	const warnings: string[] = [];
	const nodes = new Map<string, FeatureNode>();

	// Query entities of specified type
	const result = await client.callTool({
		name: "search_notes",
		arguments: {
			project,
			query: "*",
			types: [entityType],
			page_size: 100,
		},
	});

	// Parse results
	const content = result.content as Array<{ type: string; text: string }>;
	if (!content?.[0]?.text) {
		return { nodes, warnings: ["No features found"] };
	}

	let features: Array<{
		permalink: string;
		title: string;
		content?: string;
		metadata?: { priority?: number };
	}> = [];

	try {
		const parsed = JSON.parse(content[0].text);
		features =
			parsed.results?.filter((r: { type: string }) => r.type === "entity") ||
			[];
	} catch {
		warnings.push("Failed to parse feature search results");
		return { nodes, warnings };
	}

	// Read full notes to get priority from frontmatter
	const permalinks = features.map((f) => f.permalink);
	const priorities = await readNotesForPriority(client, project, permalinks);

	// Build nodes
	for (const feature of features) {
		const dependencies = extractDependencies(feature.content || "");
		const priority = priorities.get(feature.permalink);

		if (priority === undefined) {
			warnings.push(`Feature "${feature.title}" has no priority set`);
		}

		nodes.set(feature.permalink, {
			permalink: feature.permalink,
			title: feature.title,
			priority,
			dependencies,
			status: extractStatus(feature.content || ""),
		});
	}

	// Validate dependencies exist
	for (const [, node] of nodes) {
		for (const dep of node.dependencies) {
			if (!nodes.has(dep)) {
				warnings.push(`Feature "${node.title}" depends on unknown "${dep}"`);
			}
		}
	}

	return { nodes, warnings };
}

/**
 * Extract dependency permalinks from note content
 */
function extractDependencies(content: string): string[] {
	const deps: string[] = [];
	const lines = content.split("\n");

	for (const line of lines) {
		const trimmed = line.trim();
		for (const rel of DEPENDENCY_RELATIONS) {
			const match = trimmed.match(
				new RegExp(`^-\\s*${rel}\\s+\\[\\[([^\\]]+)\\]\\]`),
			);
			if (match) {
				deps.push(match[1]);
			}
		}
	}

	return deps;
}

/**
 * Extract status from note content
 */
function extractStatus(content: string): string {
	const match = content.match(/\*\*([A-Z_]+)\*\*/);
	return match ? match[1] : "UNKNOWN";
}
