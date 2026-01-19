/**
 * Topological sort implementation using Kahn's algorithm
 * Task 4.2: Implement Topological Sort
 * Task 4.3: Add Priority Tie-Breaking
 */
import type { DependencyGraph, FeatureNode } from "./dependencyGraph";

/** Default priority when not specified in frontmatter */
const DEFAULT_PRIORITY = 3;

export interface TopologicalSortResult {
  sorted: FeatureNode[];
  cycles: string[][]; // Each cycle is an array of permalinks forming a cycle
}

/**
 * Get effective priority for a feature node.
 * Lower number = higher priority (processed first).
 * Defaults to 3 when not specified.
 */
function getEffectivePriority(node: FeatureNode): number {
  return node.priority ?? DEFAULT_PRIORITY;
}

/**
 * Perform topological sort using Kahn's algorithm with cycle detection
 *
 * Dependencies flow: A requires B means B must come before A
 * So edges go from dependency -> dependent (B -> A)
 */
export function topologicalSort(graph: DependencyGraph): TopologicalSortResult {
  const { nodes } = graph;
  const sorted: FeatureNode[] = [];
  const cycles: string[][] = [];

  // Build in-degree map (how many dependencies each node has)
  // and adjacency list (which nodes depend on each node)
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // node -> nodes that depend on it

  // Initialize
  for (const [permalink] of nodes) {
    inDegree.set(permalink, 0);
    dependents.set(permalink, []);
  }

  // Count in-degrees (number of dependencies for each node)
  // and build reverse adjacency (dependents)
  for (const [permalink, node] of nodes) {
    let validDeps = 0;
    for (const dep of node.dependencies) {
      // Only count dependencies that exist in our graph
      if (nodes.has(dep)) {
        validDeps++;
        dependents.get(dep)!.push(permalink);
      }
    }
    inDegree.set(permalink, validDeps);
  }

  // Queue nodes with no dependencies (in-degree 0)
  const queue: string[] = [];
  for (const [permalink, degree] of inDegree) {
    if (degree === 0) {
      queue.push(permalink);
    }
  }

  // Process queue - sort by priority before each pick (lower number = higher priority)
  while (queue.length > 0) {
    // Sort queue by priority (ascending - lower number first)
    queue.sort((a, b) => {
      const nodeA = nodes.get(a)!;
      const nodeB = nodes.get(b)!;
      return getEffectivePriority(nodeA) - getEffectivePriority(nodeB);
    });

    const current = queue.shift()!;
    const node = nodes.get(current)!;
    sorted.push(node);

    // Reduce in-degree for all dependents
    for (const dependent of dependents.get(current)!) {
      const newDegree = inDegree.get(dependent)! - 1;
      inDegree.set(dependent, newDegree);

      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // If we didn't process all nodes, there are cycles
  if (sorted.length < nodes.size) {
    const remaining = new Set<string>();
    for (const [permalink] of nodes) {
      if (!sorted.find((n) => n.permalink === permalink)) {
        remaining.add(permalink);
      }
    }

    // Find cycles in remaining nodes
    const detectedCycles = detectCycles(nodes, remaining);
    cycles.push(...detectedCycles);
  }

  return { sorted, cycles };
}

/**
 * Detect cycles in a subset of nodes using DFS
 */
function detectCycles(
  nodes: Map<string, FeatureNode>,
  remaining: Set<string>
): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];

  function dfs(permalink: string): void {
    if (inStack.has(permalink)) {
      // Found a cycle - extract it from the stack
      const cycleStart = stack.indexOf(permalink);
      const cycle = stack.slice(cycleStart);
      cycle.push(permalink); // Complete the cycle
      cycles.push(cycle);
      return;
    }

    if (visited.has(permalink)) {
      return;
    }

    visited.add(permalink);
    inStack.add(permalink);
    stack.push(permalink);

    const node = nodes.get(permalink);
    if (node) {
      for (const dep of node.dependencies) {
        // Only follow edges within remaining nodes
        if (remaining.has(dep)) {
          dfs(dep);
        }
      }
    }

    stack.pop();
    inStack.delete(permalink);
  }

  // Start DFS from each unvisited remaining node
  for (const permalink of remaining) {
    if (!visited.has(permalink)) {
      dfs(permalink);
    }
  }

  return cycles;
}
