/**
 * Load-skills command handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/load_skills.go.
 * Loads skill markdown files from the skills/ directory.
 * Uses Bun.file() and Bun.Glob for all file operations.
 */
import { join, dirname } from "path";
import type { LoadSkillsInput, LoadSkillsOutput, SkillInfo } from "./types.ts";

/** Map of scenarios to relevant skill names. */
const scenarioSkills: Record<string, string[]> = {
  ANALYSIS: ["coding-workflow", "writing-notes"],
  RESEARCH: ["writing-notes"],
  DECISION: ["writing-notes"],
  FEATURE: ["coding-workflow", "writing-notes"],
  SPEC: ["coding-workflow", "writing-notes"],
  TESTING: ["coding-workflow", "writing-notes"],
  BUG: ["coding-workflow", "writing-notes"],
};

/** Get the plugin root directory. */
function getPluginRoot(): string {
  const envRoot = process.env.CLAUDE_PLUGIN_ROOT;
  if (envRoot) return envRoot;

  // Fall back to two levels up from this script
  // Script is at hooks/scripts/load-skills.ts, root is ../../
  return dirname(dirname(dirname(new URL(import.meta.url).pathname)));
}

/** Resolve the skills directory path. */
async function resolveSkillsPath(): Promise<string> {
  const root = getPluginRoot();
  if (!root) {
    if (await Bun.file("skills/.gitkeep").exists() || await Bun.file("skills").exists()) {
      return "skills";
    }
    return "";
  }
  return join(root, "skills");
}

/** Read a file's text content, returns null if it doesn't exist. */
async function readFileIfExists(path: string): Promise<string | null> {
  const file = Bun.file(path);
  if (await file.exists()) {
    return file.text();
  }
  return null;
}

/** Load a single skill and all its markdown files. */
async function loadSkill(
  skillsDir: string,
  skillName: string,
): Promise<{ content: string; files: string[] } | null> {
  const skillPath = join(skillsDir, skillName);

  // Check skill directory exists by scanning for any files
  const dirGlob = new Bun.Glob("*");
  let hasFiles = false;
  try {
    for await (const _ of dirGlob.scan({ cwd: skillPath })) {
      hasFiles = true;
      break;
    }
  } catch {
    return null;
  }
  if (!hasFiles) return null;

  const parts: string[] = [];
  const filesLoaded: string[] = [];

  // Load main SKILL.md first
  const mainFile = join(skillPath, "SKILL.md");
  const mainContent = await readFileIfExists(mainFile);
  if (mainContent) {
    parts.push(`# Skill: ${skillName}\n\n${mainContent}\n\n`);
    filesLoaded.push(mainFile);
  }

  // Load other top-level markdown files
  for (const fileName of ["ANALYSIS.md", "PLANNING.md", "CODING.md"]) {
    const filePath = join(skillPath, fileName);
    const content = await readFileIfExists(filePath);
    if (content) {
      parts.push(`## ${fileName.replace(".md", "")}\n\n${content}\n\n`);
      filesLoaded.push(filePath);
    }
  }

  // Load scenarios subdirectory
  const scenariosDir = join(skillPath, "scenarios");
  const scenarioGlob = new Bun.Glob("*.md");
  try {
    for await (const entry of scenarioGlob.scan({ cwd: scenariosDir })) {
      const filePath = join(scenariosDir, entry);
      const content = await Bun.file(filePath).text();
      const name = entry.replace(".md", "");
      parts.push(`## Scenario: ${name}\n\n${content}\n\n`);
      filesLoaded.push(filePath);
    }
  } catch {
    // No scenarios dir
  }

  // Load templates subdirectory
  const templatesDir = join(skillPath, "templates");
  const templateGlob = new Bun.Glob("*.md");
  let hasTemplates = false;
  try {
    for await (const entry of templateGlob.scan({ cwd: templatesDir })) {
      if (!hasTemplates) {
        parts.push("## Templates\n\n");
        hasTemplates = true;
      }
      const filePath = join(templatesDir, entry);
      const content = await Bun.file(filePath).text();
      const name = entry.replace(".md", "");
      parts.push(`### Template: ${name}\n\n${content}\n\n`);
      filesLoaded.push(filePath);
    }
  } catch {
    // No templates dir
  }

  return { content: parts.join(""), files: filesLoaded };
}

/** Get skills relevant to a scenario. */
function getSkillsForScenario(scenario: string): string[] {
  return scenarioSkills[scenario.toUpperCase()] ?? [
    "coding-workflow",
    "writing-notes",
  ];
}

/** List all skill directories using Bun.Glob. */
async function listSkillDirs(skillsDir: string): Promise<string[]> {
  const dirs: string[] = [];
  const glob = new Bun.Glob("*/SKILL.md");
  try {
    for await (const entry of glob.scan({ cwd: skillsDir })) {
      const skillName = entry.split("/")[0];
      if (!dirs.includes(skillName)) {
        dirs.push(skillName);
      }
    }
  } catch {
    // skillsDir doesn't exist
  }
  return dirs;
}

export async function runLoadSkills(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8").trim();

  let loadInput: LoadSkillsInput = {};
  if (raw) {
    try {
      loadInput = JSON.parse(raw) as LoadSkillsInput;
    } catch {
      // Ignore
    }
  }

  // Resolve skills directory
  const skillsDir = loadInput.skillsDir || await resolveSkillsPath();
  if (!skillsDir) {
    process.stdout.write(
      JSON.stringify(
        { success: false, error: "Could not locate skills directory" },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const output: LoadSkillsOutput = {
    success: true,
    skillsDir,
    filesLoaded: [],
  };

  const contentParts: string[] = [];
  const skills: SkillInfo[] = [];

  // Determine which skills to load
  let skillNames: string[];

  if (loadInput.skills && loadInput.skills.length > 0) {
    skillNames = loadInput.skills;
  } else if (loadInput.scenario) {
    skillNames = getSkillsForScenario(loadInput.scenario);
  } else {
    // Load all skills
    skillNames = await listSkillDirs(skillsDir);
    if (skillNames.length === 0) {
      process.stdout.write(
        JSON.stringify(
          {
            success: false,
            error: `Failed to read skills directory: ${skillsDir}`,
          },
          null,
          2,
        ) + "\n",
      );
      return;
    }
  }

  for (const skillName of skillNames) {
    const result = await loadSkill(skillsDir, skillName);
    if (!result) continue;

    skills.push({
      name: skillName,
      path: join(skillsDir, skillName),
      content: result.content,
    });
    output.filesLoaded!.push(...result.files);
    contentParts.push(result.content);
    contentParts.push("\n\n---\n\n");
  }

  output.skills = skills;
  output.content = contentParts.join("");

  process.stdout.write(JSON.stringify(output, null, 2) + "\n");
}

// Run if executed directly
const isMain = process.argv[1]?.endsWith("load-skills.ts") ||
  process.argv[1]?.endsWith("load-skills.js");
if (isMain) {
  runLoadSkills().catch((err) => {
    process.stderr.write(`Error: ${err}\n`);
    process.exit(1);
  });
}
