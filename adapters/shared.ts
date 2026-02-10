/**
 * Shared adapter utilities for Brain cross-platform plugin system.
 * Provides frontmatter parsing, file generation, and common transform helpers.
 */

import { readFile as nodeReadFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

/** Read a text file using Bun.file() when available, node:fs otherwise. */
export async function readTextFile(path: string): Promise<string> {
  if (typeof globalThis.Bun !== "undefined") {
    return Bun.file(path).text();
  }
  return nodeReadFile(path, "utf-8");
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrainConfig {
  targets: string[];
  agents: Record<string, AgentToolConfig>;
  hooks?: Record<string, HookToolConfig>;
}

export interface AgentToolConfig {
  [tool: string]: AgentPlatformConfig | null;
}

export interface AgentPlatformConfig {
  model?: string;
  allowed_tools?: string[];
  memory?: string;
  color?: string;
  description?: string;
  argument_hint?: string;
  skills?: string[];
}

export interface HookToolConfig {
  [tool: string]: HookPlatformConfig | null;
}

export interface HookPlatformConfig {
  event: string;
  matcher?: string;
  timeout?: number;
}

export interface CanonicalAgent {
  /** Filename without extension (e.g., "architect") */
  name: string;
  /** Raw markdown body (everything after frontmatter) */
  body: string;
  /** Any frontmatter fields from the canonical file (minimal) */
  frontmatter: Record<string, unknown>;
}

export interface GeneratedFile {
  /** Relative path from the tool's config directory */
  relativePath: string;
  /** File content */
  content: string;
}

// ─── Frontmatter Parsing ─────────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/**
 * Parse a markdown file's YAML frontmatter and body.
 * Returns empty frontmatter if none found.
 */
export function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }
  const [, yamlBlock, body] = match;
  const frontmatter = parseSimpleYaml(yamlBlock);
  return { frontmatter, body: body.trimStart() };
}

/**
 * Minimal YAML parser for agent frontmatter.
 * Handles: scalars, simple arrays (both inline [...] and block - item), nested objects (one level).
 * Does NOT handle complex nested structures, multi-line strings, or anchors.
 */
export function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");
  let currentKey = "";
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // Skip empty lines and comments
    if (line.trim() === "" || line.trim().startsWith("#")) {
      if (currentArray && currentKey) {
        result[currentKey] = currentArray;
        currentArray = null;
        currentKey = "";
      }
      continue;
    }

    // Block array item (  - value)
    const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayItemMatch && currentArray) {
      currentArray.push(arrayItemMatch[1].trim());
      continue;
    }

    // Flush pending array
    if (currentArray && currentKey) {
      result[currentKey] = currentArray;
      currentArray = null;
    }

    // Key-value pair
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kvMatch) continue;

    const [, key, rawValue] = kvMatch;
    const value = rawValue.trim();

    // Inline array: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      const items = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      result[key] = items;
      currentKey = "";
      continue;
    }

    // Empty value followed by array items
    if (value === "") {
      currentKey = key;
      currentArray = [];
      continue;
    }

    // Scalar: quoted string
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      result[key] = value.slice(1, -1);
      currentKey = key;
      continue;
    }

    // Scalar: boolean
    if (value === "true") {
      result[key] = true;
      currentKey = key;
      continue;
    }
    if (value === "false") {
      result[key] = false;
      currentKey = key;
      continue;
    }

    // Scalar: number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      result[key] = Number(value);
      currentKey = key;
      continue;
    }

    // Scalar: null
    if (value === "null" || value === "~") {
      result[key] = null;
      currentKey = key;
      continue;
    }

    // Scalar: plain string
    result[key] = value;
    currentKey = key;
  }

  // Flush any trailing array
  if (currentArray && currentKey) {
    result[currentKey] = currentArray;
  }

  return result;
}

// ─── YAML Serialization ──────────────────────────────────────────────────────

/**
 * Serialize a record to simple YAML frontmatter string.
 * Produces clean YAML for agent frontmatter blocks.
 */
export function serializeYaml(data: Record<string, unknown>): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
    } else if (typeof value === "string") {
      // Quote strings that contain special YAML characters
      if (
        value.includes(":") ||
        value.includes("#") ||
        value.includes("{") ||
        value.includes("[") ||
        value.startsWith(" ") ||
        value.endsWith(" ")
      ) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === "boolean" || typeof value === "number") {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join("\n");
}

/**
 * Wrap content with YAML frontmatter.
 */
export function withFrontmatter(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const yaml = serializeYaml(frontmatter);
  if (!yaml) return body;
  return `---\n${yaml}\n---\n\n${body}`;
}

// ─── File Discovery ──────────────────────────────────────────────────────────

/**
 * Read all markdown files from a directory and parse them as canonical agents.
 */
export async function readCanonicalAgents(
  agentsDir: string,
): Promise<CanonicalAgent[]> {
  const agents: CanonicalAgent[] = [];

  let entries: string[];
  try {
    entries = await readdir(agentsDir);
  } catch {
    return agents;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = join(agentsDir, entry);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) continue;

    const raw = await readTextFile(filePath);
    const { frontmatter, body } = parseFrontmatter(raw);
    const name = entry.replace(/\.md$/, "");
    agents.push({ name, body, frontmatter });
  }

  return agents;
}

/**
 * Read brain.config.json from the project root.
 */
export async function readBrainConfig(
  projectRoot: string,
): Promise<BrainConfig> {
  const configPath = join(projectRoot, "brain.config.json");
  const raw = await readTextFile(configPath);
  return JSON.parse(raw) as BrainConfig;
}

/**
 * Recursively collect all files in a directory, returning relative paths.
 */
export async function collectFiles(
  dir: string,
  base?: string,
): Promise<string[]> {
  const result: string[] = [];
  const baseDir = base ?? dir;

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return result;
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".git" || entry === ".DS_Store")
      continue;
    const fullPath = join(dir, entry);
    const fileStat = await stat(fullPath);
    if (fileStat.isDirectory()) {
      result.push(...(await collectFiles(fullPath, baseDir)));
    } else {
      result.push(relative(baseDir, fullPath));
    }
  }

  return result;
}

// ─── Naming ──────────────────────────────────────────────────────────────────

/** Add the Brain emoji prefix to a filename. */
export function brainPrefix(name: string): string {
  if (name.startsWith("\u{1F9E0}-")) return name;
  return `\u{1F9E0}-${name}`;
}
