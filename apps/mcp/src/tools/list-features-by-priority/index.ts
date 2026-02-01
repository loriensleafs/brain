/**
 * list_features_by_priority tool
 * Returns features sorted by dependency order (topological sort)
 */
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { resolveProject } from "../../project/resolve";
import { buildDependencyGraph } from "./dependencyGraph";
import type { ListFeaturesByPriorityArgs } from "./schema";
import { topologicalSort } from "./topologicalSort";

const COMPLETED_STATUSES = ["COMPLETE", "COMPLETED", "DONE", "ARCHIVED"];

export async function handler(
  args: ListFeaturesByPriorityArgs,
): Promise<CallToolResult> {
  const project = args.project || resolveProject();
  const entityType = args.entity_type || "feature";
  const includeCompleted = args.include_completed ?? false;

  if (!project) {
    return {
      content: [{ type: "text" as const, text: "🧠 No project specified." }],
      isError: true,
    };
  }

  const graph = await buildDependencyGraph(project, entityType);
  const { sorted, cycles } = topologicalSort(graph);

  // Filter completed items if requested
  const filteredSorted = includeCompleted
    ? sorted
    : sorted.filter((n) => !COMPLETED_STATUSES.includes(n.status));

  // Build reverse dependency map (what each item blocks)
  const blocksMap = new Map<string, string[]>();
  for (const [permalink] of graph.nodes) {
    blocksMap.set(permalink, []);
  }
  for (const [permalink, node] of graph.nodes) {
    for (const dep of node.dependencies) {
      if (blocksMap.has(dep)) {
        blocksMap.get(dep)?.push(permalink);
      }
    }
  }

  // Build structuredContent
  const orderedItems = filteredSorted.map((node, index) => ({
    rank: index + 1,
    permalink: node.permalink,
    title: node.title,
    priority: node.priority ?? 3,
    status: node.status,
    blocked_by: node.dependencies.filter((d) => graph.nodes.has(d)),
    blocks: blocksMap.get(node.permalink) || [],
  }));

  const noPrioritySet = Array.from(graph.nodes.values())
    .filter((n) => n.priority === undefined)
    .map((n) => n.permalink);

  const missingDependencies: string[] = [];
  for (const [, node] of graph.nodes) {
    for (const dep of node.dependencies) {
      if (!graph.nodes.has(dep) && !missingDependencies.includes(dep)) {
        missingDependencies.push(dep);
      }
    }
  }

  const structuredContent = {
    ordered_items: orderedItems,
    validation: {
      cycles_detected: cycles,
      missing_dependencies: missingDependencies,
      no_priority_set: noPrioritySet,
    },
    metadata: {
      project,
      entity_type: entityType,
      total_items: graph.nodes.size,
      actionable_items: filteredSorted.filter((n) =>
        n.dependencies.every(
          (d) =>
            !graph.nodes.has(d) ||
            COMPLETED_STATUSES.includes(graph.nodes.get(d)?.status),
        ),
      ).length,
      generated_at: new Date().toISOString(),
    },
  };

  // Build TextContent output
  const lines: string[] = [
    `## ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}s by Dependency Order`,
    ``,
    `**Total:** ${graph.nodes.size}`,
    `**Sorted:** ${filteredSorted.length}`,
    `**Actionable:** ${structuredContent.metadata.actionable_items}`,
  ];

  // Add cycle warnings
  if (cycles.length > 0) {
    lines.push(`**Cycles Detected:** ${cycles.length}`);
    lines.push(``);
    lines.push(`### Circular Dependencies`);
    for (const cycle of cycles) {
      lines.push(`- ${cycle.join(" → ")}`);
    }
  }

  // Add other warnings
  if (graph.warnings.length > 0) {
    lines.push(``);
    lines.push(`### Warnings`);
    for (const warning of graph.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
  }

  // Add sorted items
  lines.push(``);
  lines.push(`### Execution Order`);
  lines.push(``);
  for (let i = 0; i < filteredSorted.length; i++) {
    const item = filteredSorted[i];
    const priorityStr =
      item.priority !== undefined ? `P${item.priority}` : "P?";
    lines.push(`${i + 1}. **${item.title}** [${priorityStr}] - ${item.status}`);
  }

  // Add unsorted items (in cycles)
  const sortedPermalinks = new Set(sorted.map((f) => f.permalink));
  const unsorted = Array.from(graph.nodes.values()).filter(
    (n) => !sortedPermalinks.has(n.permalink),
  );

  if (unsorted.length > 0) {
    lines.push(``);
    lines.push(`### Items in Cycles (unsorted)`);
    for (const item of unsorted) {
      const priorityStr =
        item.priority !== undefined ? `P${item.priority}` : "P?";
      lines.push(`- **${item.title}** [${priorityStr}] - ${item.status}`);
    }
  }

  return {
    structuredContent,
    content: [{ type: "text" as const, text: lines.join("\n") }],
  };
}

export { toolDefinition } from "./schema";
