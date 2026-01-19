/**
 * Resource Discovery and Registration
 *
 * - Discovers Brain guide resources from filesystem (brain://guides/*)
 * - Parses YAML frontmatter from markdown files for self-describing resources
 * - Combines with basic-memory resources
 * - Registers MCP handlers for list/read
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Resource,
} from "@modelcontextprotocol/sdk/types.js";
import { getBasicMemoryClient } from "./../../proxy/client";
import { logger } from "./../../utils/internal/logger";
import * as fs from "fs";
import * as path from "path";

const GUIDES_DIR = path.join(import.meta.dir, "guides");

/**
 * Frontmatter structure parsed from guide files
 */
interface GuideFrontmatter {
  name: string;
  description: string;
  mimeType?: string;
  priority?: number;
}

/**
 * Parse YAML frontmatter from markdown content
 * Uses simple regex - no external dependencies
 */
function parseFrontmatter(content: string): GuideFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const result: Record<string, string | number> = {};

  // Simple YAML parsing for our specific format
  for (const line of yaml.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    // Remove quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Parse numbers
    if (key === "priority") {
      result[key] = parseFloat(value);
    } else {
      result[key] = value;
    }
  }

  if (!result.name || !result.description) return null;

  return {
    name: result.name as string,
    description: result.description as string,
    mimeType: (result.mimeType as string) || "text/markdown",
    priority: result.priority as number | undefined,
  };
}

/**
 * Discover guide resources from filesystem
 * Scans guides/ directory for .md files, parses frontmatter for metadata
 */
export function discoverGuideResources(): Resource[] {
  // Gracefully handle missing guides directory
  if (!fs.existsSync(GUIDES_DIR)) {
    logger.debug({ dir: GUIDES_DIR }, "Guides directory not found, skipping");
    return [];
  }

  const files = fs.readdirSync(GUIDES_DIR).filter((f) => f.endsWith(".md"));

  // Parse all files once, storing priority for sorting
  const resources = files.map((file) => {
    const slug = path.basename(file, ".md");
    const filePath = path.join(GUIDES_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatter = parseFrontmatter(content);

    // Fallback if no frontmatter
    const meta = frontmatter || {
      name: slug,
      description: `Guide: ${slug}`,
      mimeType: "text/markdown",
      priority: 0.5,
    };

    // Get file modification time for lastModified annotation
    const stats = fs.statSync(filePath);

    return {
      resource: {
        uri: `brain://guides/${slug}`,
        name: meta.name,
        description: meta.description,
        mimeType: meta.mimeType || "text/markdown",
        annotations: {
          audience: ["user", "assistant"] as const,
          priority: meta.priority ?? 0.5,
          lastModified: stats.mtime.toISOString(),
        },
      } as Resource,
      priority: meta.priority ?? 0.5,
    };
  });

  // Sort by priority (higher first), then alphabetically
  return resources
    .sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.resource.name.localeCompare(b.resource.name);
    })
    .map((r) => r.resource);
}

/**
 * Read guide content by slug (lazy-loaded on demand)
 * @param slug - Guide name without extension (e.g., "knowledge-graph")
 * @returns File content or null if not found
 */
function readGuideContent(slug: string): string | null {
  const filePath = path.join(GUIDES_DIR, `${slug}.md`);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, "utf-8");
}

// Store discovered resources (Brain guides + basic-memory)
let discoveredResources: Resource[] = [];

/**
 * Discover and register resource handlers.
 * Combines Brain guides (brain://guides/*) with basic-memory resources.
 */
export async function discoverAndRegisterResources(
  server: McpServer
): Promise<void> {
  const client = await getBasicMemoryClient();

  // Discover available resources from basic-memory
  const resourcesResult = await client.listResources();
  const basicMemoryResources = resourcesResult.resources;
  logger.info(
    { count: basicMemoryResources.length },
    "Discovered basic-memory resources"
  );

  // Combine Brain guides with basic-memory resources
  // Brain guides come first (higher priority, sorted by priority within)
  const brainGuides = discoverGuideResources();
  discoveredResources = [...brainGuides, ...basicMemoryResources];
  logger.info(
    {
      brainGuides: brainGuides.length,
      basicMemory: basicMemoryResources.length,
      total: discoveredResources.length,
    },
    "Registered combined resources"
  );

  // Register resources/list handler
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: discoveredResources };
  });

  // Register resources/read handler - handles both brain:// and memory:// URIs
  server.server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      const { uri } = request.params;
      logger.debug({ uri }, "Reading resource");

      // Handle Brain guides directly (brain://guides/*)
      if (uri.startsWith("brain://guides/")) {
        const slug = uri.replace("brain://guides/", "");
        const content = readGuideContent(slug);
        if (content) {
          return {
            contents: [
              {
                uri,
                mimeType: "text/markdown",
                text: content,
              },
            ],
          };
        } else {
          throw new Error(`Guide not found: ${uri}`);
        }
      }

      // Proxy all other resources to basic-memory
      const result = await client.readResource({ uri });
      return result;
    }
  );

  logger.debug("Registered resource handlers");
}
