/**
 * Template processing helpers for session log generation.
 *
 * Provides functions to populate session log templates with actual values
 * and extract descriptive keywords from objectives.
 */

import { ApplicationFailedError } from "./common_types.ts";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "up", "about", "into", "through", "during",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "should", "could", "may", "might",
  "can", "this", "that", "these", "those", "i", "you", "he", "she", "it",
  "we", "they", "what", "which", "who", "when", "where", "why", "how",
  "all", "each", "every", "both", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too",
  "very", "s", "t", "just", "now", "before", "after", "new",
]);

const REQUIRED_PLACEHOLDERS: [RegExp, string][] = [
  [/\bNN\b/, "NN (session number)"],
  [/YYYY-MM-DD/, "YYYY-MM-DD (date)"],
  [/\[branch name\]/, "[branch name]"],
  [/\[SHA\]/, "[SHA]"],
  [/\[What this session aims to accomplish\]/, "[What this session aims to accomplish]"],
  [/\[clean\/dirty\]/, "[clean/dirty]"],
];

export function getDescriptiveKeywords(objective: string): string {
  if (!objective || !objective.trim()) return "";

  const words = objective.replace(/[^\w\s-]/g, "").toLowerCase().split(/\s+/);

  const keywords = words
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5);

  let result = keywords.join("-");
  result = result.replace(/^-+/, "");
  result = result.replace(/-+$/, "");
  result = result.replace(/-{2,}/g, "-");
  return result;
}

export interface GitInfoForTemplate {
  branch: string;
  commit: string;
  status: string;
}

export interface UserInput {
  session_number: number;
  objective: string;
}

export function newPopulatedSessionLog(
  template: string,
  gitInfo: GitInfoForTemplate,
  userInput: UserInput,
  options: { skipValidation?: boolean } = {}
): string {
  try {
    const missing = REQUIRED_PLACEHOLDERS
      .filter(([pattern]) => !pattern.test(template))
      .map(([, name]) => name);

    if (missing.length > 0) {
      const detail = missing.join(", ");
      if (options.skipValidation) {
        console.error(
          `WARNING: Template missing required placeholders: ${detail}. Proceeding due to skipValidation.`
        );
      } else {
        throw new Error(
          `Template missing required placeholders: ${detail}\n\n` +
            "This indicates a version mismatch with SESSION-PROTOCOL.md. " +
            "Session log cannot be created."
        );
      }
    }

    const currentDate = new Date().toISOString().split("T")[0];

    let populated = template;
    populated = populated.replace(/\bNN\b/g, String(userInput.session_number));
    populated = populated.replaceAll("YYYY-MM-DD", currentDate);
    populated = populated.replaceAll("[branch name]", gitInfo.branch);
    populated = populated.replaceAll("[SHA]", gitInfo.commit);
    populated = populated.replaceAll(
      "[What this session aims to accomplish]",
      userInput.objective
    );
    populated = populated.replaceAll("[clean/dirty]", gitInfo.status);

    const unreplaced: string[] = [];
    if (/\bNN\b/.test(populated)) unreplaced.push("NN");
    const markers = [
      "[branch name]",
      "[SHA]",
      "[What this session aims to accomplish]",
      "[clean/dirty]",
    ];
    for (const marker of markers) {
      if (populated.includes(marker)) unreplaced.push(marker);
    }

    if (unreplaced.length > 0) {
      const detail = unreplaced.join(", ");
      if (options.skipValidation) {
        console.error(`WARNING: Placeholders not replaced: ${detail}`);
      } else {
        throw new Error(
          `Placeholders were not replaced: ${detail}\n\nThis indicates a validation failure.`
        );
      }
    }

    return populated;
  } catch (e) {
    if (e instanceof Error && (e.message.startsWith("Template missing") || e.message.startsWith("Placeholders were"))) {
      throw e;
    }
    throw new ApplicationFailedError(
      `UNEXPECTED ERROR in newPopulatedSessionLog\n` +
        `Exception Type: ${(e as Error).constructor.name}\n` +
        `Message: ${e}\n\n` +
        `This is a bug. Please report this error with the above details.`
    );
  }
}
