#!/usr/bin/env bun
/**
 * Dynamic skill pattern loader for invoke_skill_learning.ts.
 *
 * Scans SKILL.md files at runtime to build detection maps, eliminating
 * hardcoded pattern dictionaries that drift when skills change.
 *
 * Scans four skill source paths covering both harness ecosystems:
 * - Claude Code: .claude/skills/ (repo) + ~/.claude/skills/ (user)
 * - Copilot/GitHub: .github/skills/ (repo) + ~/.copilot/skills/ (user)
 *
 * Uses stat-based caching: invalidates when any source SKILL.md mtime changes.
 *
 * Performance budget:
 * - Cold start: ~40ms (42 files x ~2KB each)
 * - Warm cache: ~2ms (one JSON read + stat checks)
 *
 * This is a utility module, not a hook entry point. Export functions only.
 */

import { join, resolve, sep, basename } from "path";
import { homedir } from "os";
import { Glob } from "bun";

/** Maximum SKILL.md file size to read (100 KB). Legitimate files are ~2 KB. */
const MAX_SKILL_FILE_BYTES = 100 * 1024;

const CACHE_VERSION = 1;
const CACHE_FILENAME = ".skill_pattern_cache.json";

/** Regex to extract backtick-wrapped phrases from markdown table cells. */
const TRIGGER_CELL_RE = /\|\s*`([^`]+)`\s*\|/g;

/** Regex to extract frontmatter name field. */
const FRONTMATTER_NAME_RE = /^name:\s*(.+)$/m;

interface ParsedSkill {
  readonly name: string;
  readonly triggers: ReadonlyArray<string>;
  readonly slash_commands: ReadonlyArray<string>;
}

interface CacheData {
  readonly version: number;
  readonly source_mtimes: Record<string, number>;
  readonly skill_patterns: Record<string, string[]>;
  readonly command_to_skill: Record<string, string>;
}

/** Glob for skill files within root, rejecting symlinks that escape. */
async function globContainedSkills(
  root: string,
  filename: string,
): Promise<string[]> {
  const resolvedRoot = resolve(root) + sep;
  const results: string[] = [];

  const glob = new Glob(`*/${filename}`);
  try {
    for await (const entry of glob.scan({ cwd: root })) {
      const fullPath = join(root, entry);
      const resolved = resolve(fullPath);
      if (resolved.startsWith(resolvedRoot)) {
        results.push(fullPath);
      }
    }
  } catch {
    // directory doesn't exist or inaccessible
  }

  return results.sort();
}

/**
 * Scan skill sources in priority order and return deduplicated SKILL.md paths.
 *
 * Priority (lower wins for same skill name):
 * 1. {projectDir}/.claude/skills/(star)/SKILL.md   (Claude Code repo)
 * 2. {projectDir}/.github/skills/(star)/SKILL.md   (Copilot/GitHub repo)
 * 3. ~/.claude/skills/(star)/SKILL.md               (Claude Code user)
 * 4. ~/.copilot/skills/(star)/SKILL.md              (Copilot CLI user)
 */
async function scanSkillDirectories(
  projectDir: string,
): Promise<string[]> {
  const home = homedir();
  const searchRoots = [
    join(projectDir, ".claude", "skills"),
    join(projectDir, ".github", "skills"),
    join(home, ".claude", "skills"),
    join(home, ".copilot", "skills"),
  ];

  const seenNames = new Set<string>();
  const result: string[] = [];

  for (const root of searchRoots) {
    // Check if directory exists
    const dirExists =
      (await Bun.spawn(["test", "-d", root]).exited) === 0;
    if (!dirExists) continue;

    // Case-insensitive: try SKILL.md then skill.md
    for (const filename of ["SKILL.md", "skill.md"]) {
      const skillFiles = await globContainedSkills(root, filename);
      for (const skillMd of skillFiles) {
        const parentDir = basename(resolve(skillMd, ".."));
        const skillName = parentDir.toLowerCase();
        if (!seenNames.has(skillName)) {
          seenNames.add(skillName);
          result.push(skillMd);
        }
      }
    }
  }

  return result;
}

/** Extract skill name from YAML frontmatter, or return default. */
function extractFrontmatterName(
  content: string,
  defaultName: string,
): string {
  if (!content.startsWith("---")) return defaultName;
  const parts = content.split("---", 3);
  if (parts.length < 3) return defaultName;
  const match = FRONTMATTER_NAME_RE.exec(parts[1]);
  return match ? match[1].trim() : defaultName;
}

/**
 * Determine whether we are inside a trigger section after this line.
 */
function updateSectionState(
  stripped: string,
  inSection: boolean,
): boolean {
  if (stripped.startsWith("#") && stripped.toLowerCase().includes("trigger")) {
    return true;
  }
  if (inSection && stripped.startsWith("#")) {
    return stripped.toLowerCase().includes("trigger");
  }
  if (inSection && stripped === "---") {
    return false;
  }
  return inSection;
}

/**
 * Append backtick-wrapped phrases from a table row.
 */
function collectPhrases(
  line: string,
  triggers: string[],
  slashCommands: string[],
): void {
  // Reset regex state for each call since it uses global flag
  TRIGGER_CELL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TRIGGER_CELL_RE.exec(line)) !== null) {
    const phrase = match[1].trim();
    if (!phrase) continue;
    triggers.push(phrase);
    if (phrase.startsWith("/")) {
      slashCommands.push(phrase);
    }
  }
}

/**
 * Scan markdown for trigger sections and extract backtick phrases.
 *
 * Finds headings containing "trigger", then extracts backtick-wrapped
 * phrases from subsequent table rows until the next non-trigger heading
 * or horizontal rule.
 */
function extractTriggerPhrases(
  content: string,
): { triggers: string[]; slashCommands: string[] } {
  const triggers: string[] = [];
  const slashCommands: string[] = [];
  let inTriggerSection = false;

  for (const line of content.split("\n")) {
    const stripped = line.trim();
    inTriggerSection = updateSectionState(stripped, inTriggerSection);
    if (!inTriggerSection || stripped.startsWith("#")) continue;
    collectPhrases(line, triggers, slashCommands);
  }

  return { triggers, slashCommands };
}

/** Parse a SKILL.md file and extract trigger phrases and slash commands. */
async function parseSkillTriggers(
  skillMdPath: string,
): Promise<ParsedSkill> {
  const parentDir = basename(resolve(skillMdPath, ".."));
  const defaultName = parentDir;

  try {
    const file = Bun.file(skillMdPath);
    const size = file.size;
    if (size > MAX_SKILL_FILE_BYTES) {
      return { name: defaultName, triggers: [], slash_commands: [] };
    }
    const content = await file.text();
    const name = extractFrontmatterName(content, defaultName);
    const { triggers, slashCommands } = extractTriggerPhrases(content);
    return { name, triggers, slash_commands: slashCommands };
  } catch {
    return { name: defaultName, triggers: [], slash_commands: [] };
  }
}

/** Remove duplicate patterns (case-insensitive) while preserving order. */
function deduplicatePatterns(patterns: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const p of patterns) {
    const lower = p.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(p);
    }
  }
  return unique;
}

/**
 * Build detection maps from parsed skill data.
 *
 * Auto-adds:
 * - Skill name as a pattern (e.g., "github" for the github skill)
 * - Skill path pattern (e.g., ".claude/skills/github")
 * - Identity slash command mappings (e.g., /reflect -> reflect)
 */
function buildDetectionMaps(
  skills: ReadonlyArray<ParsedSkill>,
): {
  skillPatterns: Record<string, string[]>;
  commandToSkill: Record<string, string>;
} {
  const skillPatterns: Record<string, string[]> = {};
  const commandToSkill: Record<string, string> = {};

  for (const skill of skills) {
    const patterns = [...skill.triggers];
    patterns.push(skill.name);
    patterns.push(`.claude/skills/${skill.name}`);
    skillPatterns[skill.name] = deduplicatePatterns(patterns);

    for (const cmd of skill.slash_commands) {
      const cmdName = cmd.replace(/^\//, "");
      if (cmdName) {
        commandToSkill[cmdName] = skill.name;
      }
    }

    // Auto-add identity mapping (e.g., /reflect -> reflect)
    if (!(skill.name in commandToSkill)) {
      commandToSkill[skill.name] = skill.name;
    }
  }

  return { skillPatterns, commandToSkill };
}

function getCachePath(projectDir: string): string {
  return join(projectDir, ".claude", "hooks", "Stop", CACHE_FILENAME);
}

async function readCache(cachePath: string): Promise<CacheData | null> {
  try {
    const file = Bun.file(cachePath);
    if (!(await file.exists())) return null;

    const data = (await file.json()) as Record<string, unknown>;
    if (typeof data !== "object" || data === null) return null;
    if (data["version"] !== CACHE_VERSION) return null;
    if (!("source_mtimes" in data)) return null;
    if (!("skill_patterns" in data)) return null;
    if (!("command_to_skill" in data)) return null;

    return data as unknown as CacheData;
  } catch {
    return null;
  }
}

async function checkCacheFreshness(
  cacheData: CacheData,
  skillFiles: ReadonlyArray<string>,
): Promise<boolean> {
  const storedMtimes = cacheData.source_mtimes;

  const currentMtimes: Record<string, number> = {};
  for (const f of skillFiles) {
    try {
      const file = Bun.file(f);
      currentMtimes[f] = file.lastModified;
    } catch {
      return false;
    }
  }

  const storedKeys = new Set(Object.keys(storedMtimes));
  const currentKeys = new Set(Object.keys(currentMtimes));

  if (storedKeys.size !== currentKeys.size) return false;
  for (const key of storedKeys) {
    if (!currentKeys.has(key)) return false;
  }

  for (const [pathStr, mtime] of Object.entries(currentMtimes)) {
    if (storedMtimes[pathStr] !== mtime) return false;
  }

  return true;
}

async function writeCache(
  cachePath: string,
  skillFiles: ReadonlyArray<string>,
  skillPatterns: Record<string, string[]>,
  commandToSkill: Record<string, string>,
): Promise<void> {
  const sourceMtimes: Record<string, number> = {};
  for (const f of skillFiles) {
    try {
      sourceMtimes[f] = Bun.file(f).lastModified;
    } catch {
      // skip unreadable files
    }
  }

  const cacheData: CacheData = {
    version: CACHE_VERSION,
    source_mtimes: sourceMtimes,
    skill_patterns: skillPatterns,
    command_to_skill: commandToSkill,
  };

  try {
    // Atomic write via temp file + rename
    const tmpPath = cachePath + ".tmp";
    await Bun.write(tmpPath, JSON.stringify(cacheData, null, 2));
    // Rename atomically
    const { rename } = await import("fs/promises");
    await rename(tmpPath, cachePath);
  } catch (error) {
    console.error(`Warning: Failed to write skill cache: ${error}`);
    // Clean up temp file if rename failed
    try {
      const { unlink } = await import("fs/promises");
      await unlink(cachePath + ".tmp");
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Load skill patterns with stat-based caching.
 *
 * 1. Scan skill directories for SKILL.md files
 * 2. Check cache: if all source mtimes match, return cached data
 * 3. Otherwise: parse all SKILL.md files, build maps, write cache
 * 4. Return [skillPatterns, commandToSkill]
 *
 * Returns empty objects on any error (graceful degradation).
 */
async function loadSkillPatterns(
  projectDir: string,
): Promise<
  [Record<string, string[]>, Record<string, string>]
> {
  try {
    const skillFiles = await scanSkillDirectories(projectDir);

    if (skillFiles.length === 0) {
      return [{}, {}];
    }

    const cachePath = getCachePath(projectDir);
    const cacheData = await readCache(cachePath);

    if (
      cacheData &&
      (await checkCacheFreshness(cacheData, skillFiles))
    ) {
      return [cacheData.skill_patterns, cacheData.command_to_skill];
    }

    // Cache miss: parse all SKILL.md files
    const parsedSkills = await Promise.all(
      skillFiles.map((f) => parseSkillTriggers(f)),
    );
    const { skillPatterns, commandToSkill } =
      buildDetectionMaps(parsedSkills);

    await writeCache(cachePath, skillFiles, skillPatterns, commandToSkill);

    return [skillPatterns, commandToSkill];
  } catch (error) {
    console.error(`Skill pattern loading error: ${error}`);
    return [{}, {}];
  }
}

export {
  loadSkillPatterns,
  scanSkillDirectories,
  parseSkillTriggers,
  buildDetectionMaps,
  extractTriggerPhrases,
  extractFrontmatterName,
  deduplicatePatterns,
};
export type { ParsedSkill, CacheData };
