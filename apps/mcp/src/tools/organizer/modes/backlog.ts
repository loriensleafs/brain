/**
 * Backlog mode for organizer tool
 *
 * Manages feature backlog with operations:
 * - QUERY_ORDER: Get features sorted by dependency order then priority
 * - SET_PRIORITY: Update a feature's priority value
 * - ADD_DEPENDENCY: Add dependency link between features
 * - REMOVE_DEPENDENCY: Remove dependency link
 *
 * Uses existing list_features_by_priority tool for query operations
 * and custom operations for mutations.
 */

import { buildDependencyGraph } from "../../list-features-by-priority/dependencyGraph";
import { topologicalSort } from "../../list-features-by-priority/topologicalSort";
import { addDependency, removeDependency } from "../operations/manageDependencies";
import { setPriority } from "../operations/setPriority";
import type { BacklogConfig, BacklogResult } from "../types";

/**
 * Execute backlog mode operation
 */
export async function executeBacklogOperation(config: BacklogConfig): Promise<BacklogResult> {
  const { project, operation } = config;

  try {
    switch (operation) {
      case "QUERY_ORDER":
        return await queryBacklogOrder(project);

      case "SET_PRIORITY":
        if (!config.feature_id || config.priority === undefined) {
          return {
            operation,
            success: false,
            error: "SET_PRIORITY requires feature_id and priority",
          };
        }
        return await executeSetPriority(project, config.feature_id, config.priority);

      case "ADD_DEPENDENCY":
        if (!config.feature_id || !config.dependency_target) {
          return {
            operation,
            success: false,
            error: "ADD_DEPENDENCY requires feature_id and dependency_target",
          };
        }
        return await executeAddDependency(project, config.feature_id, config.dependency_target);

      case "REMOVE_DEPENDENCY":
        if (!config.feature_id || !config.dependency_target) {
          return {
            operation,
            success: false,
            error: "REMOVE_DEPENDENCY requires feature_id and dependency_target",
          };
        }
        return await executeRemoveDependency(project, config.feature_id, config.dependency_target);

      default:
        return {
          operation,
          success: false,
          error: `Unknown operation: ${operation}`,
        };
    }
  } catch (error) {
    return {
      operation,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Query features in dependency order with priority tie-breaking
 */
async function queryBacklogOrder(project: string): Promise<BacklogResult> {
  const graph = await buildDependencyGraph(project, "feature");
  const { sorted, cycles } = topologicalSort(graph);

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

  const orderedFeatures = sorted.map((node, index) => ({
    rank: index + 1,
    permalink: node.permalink,
    title: node.title,
    priority: node.priority ?? 3,
    status: node.status,
    blocked_by: node.dependencies.filter((d) => graph.nodes.has(d)),
    blocks: blocksMap.get(node.permalink) || [],
  }));

  return {
    operation: "QUERY_ORDER",
    success: true,
    data: {
      features: orderedFeatures,
      cycles,
      warnings: graph.warnings,
      total: graph.nodes.size,
    },
  };
}

/**
 * Execute SET_PRIORITY operation
 */
async function executeSetPriority(
  project: string,
  featureId: string,
  priority: number,
): Promise<BacklogResult> {
  const result = await setPriority(project, featureId, priority);

  return {
    operation: "SET_PRIORITY",
    success: result.success,
    data: result.success
      ? {
          feature: result.feature,
          oldPriority: result.oldPriority,
          newPriority: result.newPriority,
        }
      : undefined,
    error: result.error,
  };
}

/**
 * Execute ADD_DEPENDENCY operation
 */
async function executeAddDependency(
  project: string,
  source: string,
  target: string,
): Promise<BacklogResult> {
  const result = await addDependency(project, source, target);

  return {
    operation: "ADD_DEPENDENCY",
    success: result.success,
    data: result.success
      ? {
          source: result.source,
          target: result.target,
          message: `${source} now depends on ${target}`,
        }
      : undefined,
    error: result.error,
  };
}

/**
 * Execute REMOVE_DEPENDENCY operation
 */
async function executeRemoveDependency(
  project: string,
  source: string,
  target: string,
): Promise<BacklogResult> {
  const result = await removeDependency(project, source, target);

  return {
    operation: "REMOVE_DEPENDENCY",
    success: result.success,
    data: result.success
      ? {
          source: result.source,
          target: result.target,
          message: `Removed dependency: ${source} depends on ${target}`,
        }
      : undefined,
    error: result.error,
  };
}
