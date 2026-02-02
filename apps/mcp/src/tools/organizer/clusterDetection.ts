/**
 * Multi-pass cluster detection for grouping related files during import
 *
 * Implements three detection passes:
 * 1. Reference analysis: Groups files with explicit links (wikilinks, see-also)
 * 2. Folder grouping: Groups files in same source folder
 * 3. Topic detection: LLM-based thematic grouping (placeholder for Phase 3)
 *
 * Uses union-find algorithm for connected component detection in reference graphs.
 */

import type { FileCluster, FileReference, ParsedSourceFile } from "./schemas/clusterSchema";
import type { SourceSchema } from "./schemas/sourceSchema";

/**
 * Detects clusters using multi-pass algorithm
 */
export async function detectClusters(
  files: ParsedSourceFile[],
  sourceSchema: SourceSchema,
): Promise<FileCluster[]> {
  const clusters: FileCluster[] = [];

  // Pass 1: Reference-based clusters
  const refClusters = detectReferenceClusters(files, sourceSchema.relation_patterns);
  clusters.push(...refClusters);

  // Pass 2: Folder-based clusters (for files not in reference clusters)
  const clusteredFiles = new Set(refClusters.flatMap((c) => c.files));
  const unclusteredFiles = files.filter((f) => !clusteredFiles.has(f.path));
  const folderClusters = detectFolderClusters(unclusteredFiles);
  clusters.push(...folderClusters);

  // Pass 3: Topic-based clusters (LLM) - placeholder
  // TODO: Implement LLM topic detection in Phase 3

  return deduplicateClusters(clusters);
}

/**
 * Detects explicit references between files using regex patterns
 */
function detectReferenceClusters(
  files: ParsedSourceFile[],
  relationPatterns: string[],
): FileCluster[] {
  // Build reference graph
  const references: FileReference[] = [];
  const filePathMap = new Map(files.map((f) => [extractFilename(f.path), f.path]));

  for (const file of files) {
    for (const pattern of relationPatterns) {
      try {
        const regex = new RegExp(pattern, "g");
        const matches = [...file.content.matchAll(regex)];

        for (const match of matches) {
          const target = match[1] || match[0];
          const targetClean = target.replace(/\[\[|\]\]/g, "").trim();
          const targetPath = filePathMap.get(targetClean) || filePathMap.get(`${targetClean}.md`);

          if (targetPath && targetPath !== file.path) {
            references.push({
              from: file.path,
              to: targetPath,
              reference_type: inferReferenceType(pattern),
            });
          }
        }
      } catch (_e) {
        // Skip invalid regex patterns
      }
    }
  }

  // Build connected components using union-find
  return buildClustersFromReferences(references, files);
}

/**
 * Groups files by their parent folder
 */
function detectFolderClusters(files: ParsedSourceFile[]): FileCluster[] {
  const folderGroups = new Map<string, ParsedSourceFile[]>();

  for (const file of files) {
    if (!folderGroups.has(file.folder)) {
      folderGroups.set(file.folder, []);
    }
    folderGroups.get(file.folder)?.push(file);
  }

  const clusters: FileCluster[] = [];
  let clusterId = 0;

  for (const [folder, groupFiles] of folderGroups) {
    if (groupFiles.length > 1) {
      const totalLines = groupFiles.reduce((sum, f) => sum + f.lineCount, 0);

      clusters.push({
        id: `folder-${clusterId++}`,
        files: groupFiles.map((f) => f.path),
        cluster_type: "folder",
        merge_recommendation: totalLines < 200 ? "merge" : "keep_separate",
        rationale: `${groupFiles.length} files in folder "${folder}"${totalLines < 200 ? " (small enough to merge)" : ""}`,
      });
    }
  }

  return clusters;
}

function inferReferenceType(pattern: string): FileReference["reference_type"] {
  if (pattern.includes("[[")) return "wikilink";
  if (pattern.toLowerCase().includes("see")) return "see_also";
  return "related_to";
}

function extractFilename(path: string): string {
  return path.split("/").pop()?.replace(".md", "") || path;
}

function buildClustersFromReferences(
  references: FileReference[],
  files: ParsedSourceFile[],
): FileCluster[] {
  if (references.length === 0) return [];

  // Union-find for connected components
  const parent = new Map<string, string>();

  const find = (x: string): string => {
    if (!parent.has(x)) parent.set(x, x);
    const current = parent.get(x);
    if (current !== x && current !== undefined) {
      parent.set(x, find(current));
    }
    return parent.get(x) ?? x;
  };

  const union = (a: string, b: string) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };

  // Build connected components
  for (const ref of references) {
    union(ref.from, ref.to);
  }

  // Group by root
  const groups = new Map<string, string[]>();
  const filesInRefs = new Set([...references.map((r) => r.from), ...references.map((r) => r.to)]);

  for (const filePath of filesInRefs) {
    const root = find(filePath);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)?.push(filePath);
  }

  const clusters: FileCluster[] = [];
  let clusterId = 0;

  for (const [, groupFiles] of groups) {
    if (groupFiles.length > 1) {
      const groupParsedFiles = files.filter((f) => groupFiles.includes(f.path));
      const totalLines = groupParsedFiles.reduce((sum, f) => sum + f.lineCount, 0);
      const refCount = references.filter(
        (r) => groupFiles.includes(r.from) && groupFiles.includes(r.to),
      ).length;

      clusters.push({
        id: `ref-${clusterId++}`,
        files: groupFiles,
        cluster_type: "reference",
        merge_recommendation: totalLines < 200 ? "merge" : "keep_separate",
        rationale: `${groupFiles.length} files with ${refCount} cross-references${totalLines < 200 ? " (small enough to merge)" : ""}`,
      });
    }
  }

  return clusters;
}

function deduplicateClusters(clusters: FileCluster[]): FileCluster[] {
  const seenFiles = new Set<string>();
  const result: FileCluster[] = [];

  // Reference clusters take priority over folder clusters
  const sortedClusters = [...clusters].sort((a, b) => {
    const priority = { reference: 0, topic: 1, folder: 2 };
    return priority[a.cluster_type] - priority[b.cluster_type];
  });

  for (const cluster of sortedClusters) {
    const uniqueFiles = cluster.files.filter((f) => !seenFiles.has(f));
    if (uniqueFiles.length > 1) {
      result.push({ ...cluster, files: uniqueFiles });
      for (const f of uniqueFiles) {
        seenFiles.add(f);
      }
    }
  }

  return result;
}

export { detectReferenceClusters, detectFolderClusters };
