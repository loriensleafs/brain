/**
 * Load-skills command handler.
 *
 * Ported from apps/claude-plugin/cmd/hooks/load_skills.go.
 * Loads skill markdown files from the skills/ directory.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import type { LoadSkillsInput, LoadSkillsOutput, SkillInfo } from "./types.js";

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
function resolveSkillsPath(): string {
  const root = getPluginRoot();
  if (!root) {
    try {
      statSync("skills");
      return "skills";
    } catch {
      return "";
    }
  }
  return join(root, "skills");
}

/** Load a single skill and all its markdown files. */
function loadSkill(
  skillsDir: string,
  skillName: string,
): { content: string; files: string[] } | null {
  const skillPath = join(skillsDir, skillName);
  try {
    statSync(skillPath);
  } catch {
    return null;
  }

  const parts: string[] = [];
  const filesLoaded: string[] = [];

  // Load main SKILL.md first
  const mainFile = join(skillPath, "SKILL.md");
  try {
    const content = readFileSync(mainFile, "utf-8");
    parts.push(`# Skill: ${skillName}\n\n${content}\n\n`);
    filesLoaded.push(mainFile);
  } catch {
    // No SKILL.md
  }

  // Load other top-level markdown files
  for (const fileName of ["ANALYSIS.md", "PLANNING.md", "CODING.md"]) {
    const filePath = join(skillPath, fileName);
    try {
      const content = readFileSync(filePath, "utf-8");
      parts.push(`## ${fileName.replace(".md", "")}\n\n${content}\n\n`);
      filesLoaded.push(filePath);
    } catch {
      // File doesn't exist
    }
  }

  // Load scenarios subdirectory
  const scenariosDir = join(skillPath, "scenarios");
  try {
    const entries = readdirSync(scenariosDir);
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const filePath = join(scenariosDir, entry);
      try {
        if (!statSync(filePath).isFile()) continue;
        const content = readFileSync(filePath, "utf-8");
        const name = entry.replace(".md", "");
        parts.push(`## Scenario: ${name}\n\n${content}\n\n`);
        filesLoaded.push(filePath);
      } catch {
        // Skip
      }
    }
  } catch {
    // No scenarios dir
  }

  // Load templates subdirectory
  const templatesDir = join(skillPath, "templates");
  try {
    const entries = readdirSync(templatesDir);
    if (entries.some((e) => e.endsWith(".md"))) {
      parts.push("## Templates\n\n");
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const filePath = join(templatesDir, entry);
        try {
          if (!statSync(filePath).isFile()) continue;
          const content = readFileSync(filePath, "utf-8");
          const name = entry.replace(".md", "");
          parts.push(`### Template: ${name}\n\n${content}\n\n`);
          filesLoaded.push(filePath);
        } catch {
          // Skip
        }
      }
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
  let skillsDir = loadInput.skillsDir || resolveSkillsPath();
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
    try {
      skillNames = readdirSync(skillsDir).filter((entry) => {
        try {
          return statSync(join(skillsDir, entry)).isDirectory();
        } catch {
          return false;
        }
      });
    } catch {
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
    const result = loadSkill(skillsDir, skillName);
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
