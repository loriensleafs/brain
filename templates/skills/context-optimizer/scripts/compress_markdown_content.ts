/**
 * Compress markdown documentation to minimal tokens using pipe-delimited format (Vercel pattern).
 *
 * Implements compression techniques from Vercel research achieving 60-80% token reduction
 * while maintaining 100% information density. Uses js-tiktoken for accurate
 * OpenAI-compatible token counting.
 *
 * Exit Codes:
 *   0: Success - Compression completed
 *   1: Error - Input file not found
 *   2: Error - Invalid compression level
 *   3: Error - Output file write failure
 *   4: Error - js-tiktoken not installed
 */

import { existsSync } from "fs";
import { validatePathWithinRepo } from "./path_validation";

let encodingForModel: typeof import("js-tiktoken").encodingForModel;
try {
  const mod = await import("js-tiktoken");
  encodingForModel = mod.encodingForModel;
} catch {
  console.error(
    "Error: js-tiktoken library not installed.\n" +
      "Install with: bun add js-tiktoken",
  );
  process.exit(4);
}

// --- Types ---

type CompressionLevel = "light" | "medium" | "aggressive";

interface CompressionMetrics {
  readonly original_tokens: number;
  readonly compressed_tokens: number;
  readonly reduction_percent: number;
  readonly original_size: number;
  readonly compressed_size: number;
  readonly compression_level: string;
}

interface CompressionResult {
  readonly success: boolean;
  readonly compressed_content: string;
  readonly metrics: CompressionMetrics;
  readonly index_file: string | null;
}

// --- Constants ---

const ABBREVIATIONS: Record<string, string> = {
  configuration: "config",
  repository: "repo",
  documentation: "docs",
  implementation: "impl",
  environment: "env",
  authentication: "auth",
  authorization: "authz",
  parameter: "param",
  reference: "ref",
  application: "app",
  information: "info",
  description: "desc",
  specification: "spec",
  administrator: "admin",
  development: "dev",
  production: "prod",
  directory: "dir",
  command: "cmd",
};

const VALID_LEVELS: ReadonlySet<string> = new Set(["light", "medium", "aggressive"]);

// --- Token Counting ---

function countTokens(text: string): number {
  const encoding = encodingForModel("gpt-4");
  const tokens = encoding.encode(text);
  return tokens.length;
}

// --- Code Block Preservation ---

function preserveCodeBlocks(content: string): { text: string; blocks: string[] } {
  const blocks: string[] = [];
  const text = content.replace(/```[\s\S]*?```/g, (match) => {
    blocks.push(match);
    return `___CODE_BLOCK_${blocks.length - 1}___ `;
  });
  return { text, blocks };
}

function restoreCodeBlocks(content: string, blocks: readonly string[]): string {
  let result = content;
  for (let i = 0; i < blocks.length; i++) {
    result = result.replace(`___CODE_BLOCK_${i}___`, blocks[i]);
  }
  return result;
}

// --- Compression Functions ---

function compressHeaders(content: string, level: CompressionLevel): string {
  // H2 headers: ## Title -> [Title]
  let result = content.replace(/^## (.+)$/gm, "[$1]");

  // H3 headers in aggressive mode: ### Title -> |Title:
  if (level === "aggressive") {
    result = result.replace(/^### (.+)$/gm, "|$1:");
  }

  return result;
}

function compressTables(content: string, level: CompressionLevel): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inTable = false;
  let headers: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Detect table start
    if (line.startsWith("|") && !inTable) {
      if (i + 1 < lines.length && /^\|[-:\s|]+\|$/.test(lines[i + 1].trim())) {
        inTable = true;
        headers = line
          .split("|")
          .map((h) => h.trim())
          .filter(Boolean);
        i += 2; // Skip header and separator
        continue;
      }
    }

    // Process table row
    if (inTable && line.startsWith("|")) {
      const cells = line
        .split("|")
        .map((c) => c.trim())
        .filter(Boolean);
      const pairs: string[] = [];

      for (let j = 0; j < Math.min(headers.length, cells.length); j++) {
        const cell = cells[j];
        if (level === "aggressive" && !cell) continue;
        if (cell) {
          pairs.push(`${headers[j]}: ${cell}`);
        }
      }

      if (pairs.length > 0) {
        result.push("|" + pairs.join(" |"));
      }
      i++;
    } else if (inTable) {
      inTable = false;
      headers = [];
      result.push(line);
      i++;
    } else {
      result.push(line);
      i++;
    }
  }

  return result.join("\n");
}

function compressLists(content: string, level: CompressionLevel): string {
  if (level !== "aggressive") return content;
  return content.replace(/^[*-]\s+(.+)$/gm, "|$1");
}

function lineIsProtected(line: string, inYamlFrontmatter: boolean): boolean {
  if (inYamlFrontmatter) return true;
  if (line.includes("`")) return true;
  if (line.includes("http://") || line.includes("https://")) return true;
  return false;
}

function applyWordRemovals(line: string, level: CompressionLevel): string {
  let result = line;

  const phraseReplacements: ReadonlyArray<readonly [RegExp, string]> = [
    [/\bin order to\b/gi, "to"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bfor the purpose of\b/gi, "for"],
    [/\bin the event that\b/gi, "if"],
    [/\bat the present time\b/gi, "now"],
    [/\bat this point in time\b/gi, "now"],
    [/\bmake sure to\b/gi, "ensure"],
    [/\bin spite of\b/gi, "despite"],
    [/\bby means of\b/gi, "via"],
    [/\bprior to\b/gi, "before"],
    [/\bsubsequent to\b/gi, "after"],
  ];

  for (const [pattern, replacement] of phraseReplacements) {
    result = result.replace(pattern, replacement);
  }

  if (level === "medium" || level === "aggressive") {
    result = result.replace(/\bthe\s+/gi, "");
    result = result.replace(/\ba\s+/gi, "");
    result = result.replace(/\ban\s+/gi, "");
    result = result.replace(/\bis\s+/gi, "");
    result = result.replace(/\bare\s+/gi, "");
    result = result.replace(/\bwas\s+/gi, "");
    result = result.replace(/\bwere\s+/gi, "");
  }

  if (level === "aggressive") {
    result = result.replace(/\bthis\s+/gi, "");
    result = result.replace(/\bthat\s+/gi, "");
    result = result.replace(/\bthese\s+/gi, "");
    result = result.replace(/\bthose\s+/gi, "");
    result = result.replace(/\bwill\s+/gi, "");
    result = result.replace(/\bshall\s+/gi, "");
    result = result.replace(/\bmust\s+/gi, "");
    result = result.replace(/\bshould\s+/gi, "");
    result = result.replace(/\bcan\s+/gi, "");
  }

  return result;
}

function removeRedundantWords(content: string, level: CompressionLevel): string {
  if (level === "light") return content;

  const lines = content.split("\n");
  const resultLines: string[] = [];
  let inYamlFrontmatter = false;
  let frontmatterSeen = false;

  for (const line of lines) {
    const stripped = line.trim();

    if (stripped === "---") {
      if (!frontmatterSeen) {
        inYamlFrontmatter = true;
        frontmatterSeen = true;
      } else if (inYamlFrontmatter) {
        inYamlFrontmatter = false;
      }
      resultLines.push(line);
      continue;
    }

    if (lineIsProtected(line, inYamlFrontmatter)) {
      resultLines.push(line);
    } else {
      resultLines.push(applyWordRemovals(line, level));
    }
  }

  return resultLines.join("\n");
}

function applyAbbreviations(content: string): string {
  let result = content;
  for (const [term, abbrev] of Object.entries(ABBREVIATIONS)) {
    result = result.replace(new RegExp(`\\b${term}\\b`, "gi"), abbrev);
  }
  return result;
}

function collapseWhitespace(content: string, level: CompressionLevel): string {
  // Collapse multiple spaces to single space
  let result = content.replace(/ {2,}/g, " ");

  // Trim trailing whitespace from lines
  result = result.replace(/ +$/gm, "");

  // Collapse newlines based on level
  if (level === "light") {
    result = result.replace(/\n{3,}/g, "\n\n");
  } else if (level === "medium") {
    result = result.replace(/\n{3,}/g, "\n");
  } else {
    result = result.replace(/\n{2,}/g, "\n");
  }

  return result;
}

// --- Main Compression Pipeline ---

export function compressMarkdown(content: string, level: CompressionLevel): string {
  // Phase 0: Preserve code blocks
  const { text, blocks } = preserveCodeBlocks(content);

  // Phase 1: Compress headers
  let compressed = compressHeaders(text, level);

  // Phase 2: Compress tables
  compressed = compressTables(compressed, level);

  // Phase 3: Compress lists
  compressed = compressLists(compressed, level);

  // Phase 4: Remove redundant words
  compressed = removeRedundantWords(compressed, level);

  // Phase 5: Apply abbreviations (aggressive only)
  if (level === "aggressive") {
    compressed = applyAbbreviations(compressed);
  }

  // Phase 6: Collapse whitespace
  compressed = collapseWhitespace(compressed, level);

  // Phase 7: Restore code blocks
  compressed = restoreCodeBlocks(compressed, blocks);

  return compressed;
}

function buildMetrics(
  original: string,
  compressed: string,
  level: CompressionLevel,
): CompressionMetrics {
  const originalTokens = countTokens(original);
  const compressedTokens = countTokens(compressed);

  let reductionPercent = 0;
  if (originalTokens > 0) {
    reductionPercent = Math.round((1 - compressedTokens / originalTokens) * 1000) / 10;
  }

  return {
    original_tokens: originalTokens,
    compressed_tokens: compressedTokens,
    reduction_percent: reductionPercent,
    original_size: original.length,
    compressed_size: compressed.length,
    compression_level: level,
  };
}

// --- CLI ---

function printUsage(): void {
  console.error(
    "Usage: bun run compress_markdown_content.ts -i <input> [-l light|medium|aggressive] [-o <output>] [-v]",
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let inputPath: string | undefined;
  let level: CompressionLevel = "medium";
  let outputPath: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-i" || arg === "--input") && i + 1 < args.length) {
      inputPath = args[++i];
    } else if ((arg === "-l" || arg === "--level") && i + 1 < args.length) {
      const val = args[++i].toLowerCase();
      if (!VALID_LEVELS.has(val)) {
        console.error(`Error: Invalid compression level: ${val}`);
        process.exit(2);
      }
      level = val as CompressionLevel;
    } else if ((arg === "-o" || arg === "--output") && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (arg === "-v" || arg === "--verbose") {
      verbose = true;
    } else {
      printUsage();
      process.exit(1);
    }
  }

  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  if (!existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  try {
    const resolvedInputPath = await validatePathWithinRepo(inputPath);
    const content = await Bun.file(resolvedInputPath).text();

    if (verbose) {
      console.error(`Compressing with level: ${level}`);
    }

    const compressed = compressMarkdown(content, level);
    const metrics = buildMetrics(content, compressed, level);

    const result: CompressionResult = {
      success: true,
      compressed_content: compressed,
      metrics,
      index_file: null,
    };

    if (outputPath) {
      try {
        const resolvedOutputPath = await validatePathWithinRepo(outputPath);
        await Bun.write(resolvedOutputPath, compressed);
        if (verbose) {
          console.error(`Compressed content written to: ${outputPath}`);
          console.error(
            `Metrics: ${metrics.original_tokens} -> ${metrics.compressed_tokens} tokens ` +
              `(${metrics.reduction_percent}% reduction)`,
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`Error writing output file: ${message}`);
        process.exit(3);
      }
    } else {
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(0);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Error reading input file: ${message}`);
    process.exit(1);
  }
}

await main();
