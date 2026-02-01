/**
 * Dependency management operations for backlog mode
 *
 * Provides operations to add/remove dependency relations between features
 * with cycle detection to prevent circular dependencies.
 */

import { getBasicMemoryClient } from "../../../proxy/client";

/**
 * Result from dependency operation
 */
export interface DependencyResult {
	success: boolean;
	source: string;
	target: string;
	operation: "add" | "remove";
	error?: string;
}

/**
 * Add a dependency relation from source to target
 * (source depends_on target, meaning target must be completed first)
 */
export async function addDependency(
	project: string,
	source: string,
	target: string,
): Promise<DependencyResult> {
	try {
		const client = await getBasicMemoryClient();

		// Check if adding this dependency would create a cycle
		const cycleCheck = await detectCycleIfAdded(project, source, target);
		if (cycleCheck.hasCycle) {
			return {
				success: false,
				source,
				target,
				operation: "add",
				error: `Adding this dependency would create a cycle: ${cycleCheck.cycle?.join(" → ")}`,
			};
		}

		// Read source note
		const readResult = await client.callTool({
			name: "read_note",
			arguments: { identifier: source, project },
		});

		const content = (readResult.content as any)?.[0]?.text || "";

		// Add dependency relation
		const updatedContent = addDependencyToContent(content, target);

		// Write back the note
		await client.callTool({
			name: "write_note",
			arguments: {
				path: source,
				project,
				content: updatedContent,
			},
		});

		return {
			success: true,
			source,
			target,
			operation: "add",
		};
	} catch (error) {
		return {
			success: false,
			source,
			target,
			operation: "add",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Remove a dependency relation from source to target
 */
export async function removeDependency(
	project: string,
	source: string,
	target: string,
): Promise<DependencyResult> {
	try {
		const client = await getBasicMemoryClient();

		// Read source note
		const readResult = await client.callTool({
			name: "read_note",
			arguments: { identifier: source, project },
		});

		const content = (readResult.content as any)?.[0]?.text || "";

		// Remove dependency relation
		const updatedContent = removeDependencyFromContent(content, target);

		// Write back the note
		await client.callTool({
			name: "write_note",
			arguments: {
				path: source,
				project,
				content: updatedContent,
			},
		});

		return {
			success: true,
			source,
			target,
			operation: "remove",
		};
	} catch (error) {
		return {
			success: false,
			source,
			target,
			operation: "remove",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Detect if adding a dependency would create a cycle
 */
async function detectCycleIfAdded(
	project: string,
	source: string,
	target: string,
): Promise<{ hasCycle: boolean; cycle?: string[] }> {
	try {
		const client = await getBasicMemoryClient();

		// Build current dependency graph
		const dependencies = new Map<string, string[]>();

		// Read source note to get its current dependencies
		const sourceResult = await client.callTool({
			name: "read_note",
			arguments: { identifier: source, project },
		});
		const sourceContent = (sourceResult.content as any)?.[0]?.text || "";
		dependencies.set(source, extractDependencies(sourceContent));

		// Read target note to get its dependencies
		const targetResult = await client.callTool({
			name: "read_note",
			arguments: { identifier: target, project },
		});
		const targetContent = (targetResult.content as any)?.[0]?.text || "";
		dependencies.set(target, extractDependencies(targetContent));

		// Simulate adding the new dependency
		const simulatedDeps = [...dependencies.get(source)!, target];
		dependencies.set(source, simulatedDeps);

		// DFS to check if target can reach source (which would create a cycle)
		const visited = new Set<string>();
		const path: string[] = [];

		function dfs(current: string): boolean {
			if (current === source) {
				path.push(current);
				return true; // Found cycle
			}

			if (visited.has(current)) {
				return false;
			}

			visited.add(current);
			path.push(current);

			const deps = dependencies.get(current) || [];
			for (const dep of deps) {
				if (dfs(dep)) {
					return true; // Cycle found in recursion
				}
			}

			path.pop();
			return false;
		}

		const hasCycle = dfs(target);
		return {
			hasCycle,
			cycle: hasCycle ? path : undefined,
		};
	} catch (_error) {
		// If we can't check, assume no cycle and let it proceed
		return { hasCycle: false };
	}
}

/**
 * Add dependency relation to note content
 */
function addDependencyToContent(content: string, target: string): string {
	const lines = content.split("\n");

	// Find Relations section or create it
	let relationsIndex = -1;
	let nextSectionIndex = -1;

	for (let i = 0; i < lines.length; i++) {
		if (lines[i].match(/^##\s+Relations/i)) {
			relationsIndex = i;
		} else if (relationsIndex !== -1 && lines[i].match(/^##\s+/)) {
			nextSectionIndex = i;
			break;
		}
	}

	const dependencyLine = `- depends_on [[${target}]]`;

	if (relationsIndex === -1) {
		// No Relations section, add it at the end
		lines.push("");
		lines.push("## Relations");
		lines.push("");
		lines.push(dependencyLine);
	} else {
		// Add to existing Relations section
		// Check if this dependency already exists
		const existingDep = lines.some(
			(line, idx) =>
				idx > relationsIndex &&
				(nextSectionIndex === -1 || idx < nextSectionIndex) &&
				line.includes(`depends_on [[${target}]]`),
		);

		if (!existingDep) {
			// Insert after Relations heading
			const insertIndex =
				nextSectionIndex !== -1 ? nextSectionIndex : lines.length;

			// Find first non-empty line after Relations heading
			let insertPos = relationsIndex + 1;
			while (insertPos < insertIndex && lines[insertPos].trim() === "") {
				insertPos++;
			}

			lines.splice(insertPos, 0, dependencyLine);
		}
	}

	return lines.join("\n");
}

/**
 * Remove dependency relation from note content
 */
function removeDependencyFromContent(content: string, target: string): string {
	const lines = content.split("\n");
	const filteredLines = lines.filter(
		(line) => !line.includes(`depends_on [[${target}]]`),
	);
	return filteredLines.join("\n");
}

/**
 * Extract dependency permalinks from note content
 */
function extractDependencies(content: string): string[] {
	const deps: string[] = [];
	const lines = content.split("\n");
	const dependencyRelations = [
		"requires",
		"builds_on",
		"blocked_by",
		"depends_on",
	];

	for (const line of lines) {
		const trimmed = line.trim();
		for (const rel of dependencyRelations) {
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
