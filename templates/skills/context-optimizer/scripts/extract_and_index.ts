/**
 * Extract markdown sections into separate files and generate a pipe-delimited index.
 *
 * Implements the Vercel extract-and-index pattern for 60-80% token reduction.
 * Parses markdown into sections by heading, writes each section to a detail file,
 * and produces a compact index with references to those files.
 *
 * Exit Codes:
 *   0: Success
 *   1: Error - Input file not found or read failure
 *   2: Error - Invalid arguments
 *   3: Error - Output write failure
 *   4: Error - js-tiktoken not installed
 */

import { existsSync, mkdirSync } from "fs";
import { posix } from "path";
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

interface Section {
  readonly heading: string;
  readonly level: number;
  readonly content: string;
  readonly slug: string;
}

interface ExtractionMetrics {
  readonly original_tokens: number;
  readonly index_tokens: number;
  readonly reduction_percent: number;
  readonly sections_extracted: number;
  readonly detail_files_written: number;
}

interface ExtractionResult {
  readonly success: boolean;
  readonly index_content: string;
  readonly metrics: ExtractionMetrics;
  readonly detail_dir: string;
}

// --- Token Counting ---

function countTokens(text: string): number {
  const encoding = encodingForModel("gpt-4");
  const tokens = encoding.encode(text);
  return tokens.length;
}

// --- Slug Generation ---

export function slugify(heading: string): string {
  let slug = heading.toLowerCase().trim();
  slug = slug.replace(/[^\w\s-]/g, "");
  slug = slug.replace(/[\s_]+/g, "-");
  slug = slug.replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

// --- Section Parsing ---

export function parseSections(content: string): Section[] {
  const lines = content.split("\n");
  const sections: Section[] = [];
  let currentHeading = "preamble";
  let currentLevel = 0;
  const currentLines: string[] = [];

  function flushSection(): void {
    const body = currentLines.join("\n").trim();
    if (body || currentHeading !== "preamble") {
      sections.push({
        heading: currentHeading,
        level: currentLevel,
        content: body,
        slug: slugify(currentHeading),
      });
    }
    currentLines.length = 0;
  }

  for (const line of lines) {
    const match = line.match(/^(#{1,2})\s+(.+)$/);
    if (match) {
      flushSection();
      currentHeading = match[2].trim();
      currentLevel = match[1].length;
    } else {
      currentLines.push(line);
    }
  }

  flushSection();
  return sections;
}

// --- Summary Generation ---

export function summarizeSection(section: Section): string {
  let inCodeBlock = false;
  for (const line of section.content.split("\n")) {
    const stripped = line.trim();
    if (stripped.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    if (!stripped) continue;

    // Skip table separators and short markers
    if (/^[-|#>]/.test(stripped) && stripped.length < 4) continue;
    if (/^\|[-:\s|]+\|$/.test(stripped)) continue;

    // Use first meaningful line, truncated
    let summary = stripped.replace(/^[-*> ]+/, "").trimEnd();
    if (summary.length > 80) {
      summary = summary.slice(0, 77) + "...";
    }
    return summary;
  }
  return "(see detail file)";
}

// --- Index Building ---

export function buildIndex(sections: readonly Section[], detailDir: string): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (section.heading === "preamble" && !section.content) continue;

    const headingDisplay = section.heading === "preamble" ? "Overview" : section.heading;
    lines.push(`[${headingDisplay}]`);

    const summary = summarizeSection(section);
    const detailPath = posix.join(detailDir, `${section.slug}.md`);
    lines.push(`|${summary} (see: ${detailPath})`);
  }
  return lines.join("\n");
}

// --- Detail File Writing ---

async function writeDetailFiles(
  sections: readonly Section[],
  detailDir: string,
  repoRoot?: string,
): Promise<number> {
  const validatedDir = await validatePathWithinRepo(detailDir, repoRoot);
  mkdirSync(validatedDir, { recursive: true });

  let written = 0;
  const seenSlugs: Record<string, number> = {};

  for (const section of sections) {
    let slug = section.slug;
    if (slug in seenSlugs) {
      seenSlugs[slug]++;
      slug = `${slug}-${seenSlugs[slug]}`;
    } else {
      seenSlugs[slug] = 0;
    }

    const filePath = `${validatedDir}/${slug}.md`;
    const headingPrefix = "#".repeat(Math.max(section.level, 1));
    const fileContent = `${headingPrefix} ${section.heading}\n\n${section.content}\n`;
    await Bun.write(filePath, fileContent);
    written++;
  }

  return written;
}

// --- Main Pipeline ---

export async function extractAndIndex(
  content: string,
  detailDir: string,
  detailDirRef: string,
  repoRoot?: string,
): Promise<ExtractionResult> {
  const sections = parseSections(content);
  const filesWritten = await writeDetailFiles(sections, detailDir, repoRoot);
  const indexContent = buildIndex(sections, detailDirRef);

  const originalTokens = countTokens(content);
  const indexTokens = countTokens(indexContent);
  let reduction = 0;
  if (originalTokens > 0) {
    reduction = Math.round((1 - indexTokens / originalTokens) * 1000) / 10;
  }

  return {
    success: true,
    index_content: indexContent,
    metrics: {
      original_tokens: originalTokens,
      index_tokens: indexTokens,
      reduction_percent: reduction,
      sections_extracted: sections.length,
      detail_files_written: filesWritten,
    },
    detail_dir: detailDir,
  };
}

// --- CLI ---

function printUsage(): void {
  console.error(
    "Usage: bun run extract_and_index.ts -i <input> -d <detail-dir> [-r <detail-ref>] [-o <output>] [-v]",
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let inputPath: string | undefined;
  let detailDir: string | undefined;
  let detailRef: string | undefined;
  let outputPath: string | undefined;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === "-i" || arg === "--input") && i + 1 < args.length) {
      inputPath = args[++i];
    } else if ((arg === "-d" || arg === "--detail-dir") && i + 1 < args.length) {
      detailDir = args[++i];
    } else if ((arg === "-r" || arg === "--detail-ref") && i + 1 < args.length) {
      detailRef = args[++i];
    } else if ((arg === "-o" || arg === "--output") && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (arg === "-v" || arg === "--verbose") {
      verbose = true;
    } else {
      printUsage();
      process.exit(2);
    }
  }

  if (!inputPath || !detailDir) {
    printUsage();
    process.exit(2);
  }

  if (!existsSync(inputPath)) {
    console.error(`Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }

  const effectiveDetailRef = detailRef ?? detailDir;

  try {
    const resolvedInput = await validatePathWithinRepo(inputPath);
    const content = await Bun.file(resolvedInput).text();

    if (verbose) {
      console.error(`Extracting sections from: ${inputPath}`);
    }

    const result = await extractAndIndex(content, detailDir, effectiveDetailRef);

    if (outputPath) {
      try {
        const resolvedOutput = await validatePathWithinRepo(outputPath);
        await Bun.write(resolvedOutput, result.index_content);
        if (verbose) {
          console.error(
            `Index written to: ${outputPath}\n` +
              `Metrics: ${result.metrics.original_tokens} -> ` +
              `${result.metrics.index_tokens} tokens ` +
              `(${result.metrics.reduction_percent}% reduction)`,
          );
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`Error: ${message}`);
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
