#!/usr/bin/env bun
/**
 * Validate session log completeness before Claude stops responding.
 *
 * Claude Code Stop hook that verifies the session log exists and contains
 * required sections. If incomplete, forces Claude to continue working until
 * the session log is properly completed per SESSION-PROTOCOL requirements.
 *
 * IMPORTANT: Returns JSON {"continue": true, "reason": "..."} to force
 * Claude to continue. This behavior must be preserved exactly.
 *
 * Hook Type: Stop
 * Exit Codes:
 *     0 = Always (non-blocking hook, all errors are warnings)
 */

import { join, basename } from "path";
import { Glob } from "bun";
import { skipIfConsumerRepo } from "../../lib/guards.ts";
import { getMemoriesDir } from "../../lib/utilities.ts";

interface HookInput {
  readonly cwd?: string;
}

const REQUIRED_JSON_KEYS = [
  "session",
  "protocolCompliance",
  "work",
  "outcomes",
] as const;

const PLACEHOLDER_PATTERNS: ReadonlyArray<RegExp> = [
  /to be filled/i,
  /\btbd\b/i,
  /\btodo\b/i,
  /coming soon/i,
  /\(pending\)/i,
  /\[pending\]/i,
];

type SessionLogResult =
  | { kind: "directory_missing" }
  | { kind: "log_missing"; today: string }
  | { kind: "found"; path: string; name: string };

function writeContinueResponse(reason: string): void {
  const response = JSON.stringify({ continue: true, reason });
  console.log(response);
}

async function getTodaySessionLogs(
  sessionsDir: string,
): Promise<SessionLogResult> {
  // Check directory existence via shell since Bun.file can't check dirs
  const dirExists =
    (await Bun.spawn(["test", "-d", sessionsDir]).exited) === 0;
  if (!dirExists) {
    return { kind: "directory_missing" };
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    const glob = new Glob(`${today}-session-*.json`);
    const matches: Array<{ path: string; mtime: number }> = [];

    for await (const entry of glob.scan({ cwd: sessionsDir })) {
      const fullPath = join(sessionsDir, entry);
      const file = Bun.file(fullPath);
      matches.push({ path: fullPath, mtime: file.lastModified });
    }

    if (matches.length === 0) {
      return { kind: "log_missing", today };
    }

    matches.sort((a, b) => b.mtime - a.mtime);
    return {
      kind: "found",
      path: matches[0].path,
      name: basename(matches[0].path),
    };
  } catch {
    return { kind: "directory_missing" };
  }
}

function getMissingKeys(logContent: string): string[] {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(logContent) as Record<string, unknown>;
  } catch {
    return ["Valid JSON structure (file is not valid JSON)"];
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return ["Valid JSON object (file is not a JSON object)"];
  }

  const missing: string[] = [];

  for (const key of REQUIRED_JSON_KEYS) {
    if (!(key in data)) {
      missing.push(key);
    } else if (
      typeof data[key] === "object" &&
      data[key] !== null &&
      !Array.isArray(data[key]) &&
      Object.keys(data[key] as Record<string, unknown>).length === 0
    ) {
      missing.push(`${key} (empty)`);
    }
  }

  // Check if outcomes section has actual content
  const outcomes = data["outcomes"];
  if (typeof outcomes === "object" && outcomes !== null) {
    const values = Object.values(outcomes as Record<string, unknown>);
    const hasPlaceholder = values.some((v) =>
      PLACEHOLDER_PATTERNS.some((p) => p.test(String(v))),
    );
    if (hasPlaceholder) {
      missing.push("outcomes (contains placeholder text)");
    }
  }

  return missing;
}

async function main(): Promise<number> {
  try {
    const inputJson = await Bun.stdin.text();
    if (!inputJson.trim()) return 0;

    const hookInput = JSON.parse(inputJson) as HookInput;

    if (await skipIfConsumerRepo("session-validator", hookInput.cwd)) return 0;

    const memoriesDir = await getMemoriesDir(hookInput.cwd);
    if (!memoriesDir) return 0;

    const sessionsDir = join(memoriesDir, "sessions");

    const result = await getTodaySessionLogs(sessionsDir);

    if (result.kind === "directory_missing") return 0;

    if (result.kind === "log_missing") {
      writeContinueResponse(
        `Session log missing. MUST create session log at ` +
          `sessions/${result.today}-session-NN.json per session protocol`,
      );
      return 0;
    }

    // result.kind === "found"
    const logContent = await Bun.file(result.path).text();
    const missingKeys = getMissingKeys(logContent);

    if (missingKeys.length > 0) {
      const missingList = missingKeys.join(", ");

      writeContinueResponse(
        `Session log incomplete in ${result.name}. ` +
          `Missing or incomplete keys: ${missingList}. ` +
          `MUST complete per session protocol`,
      );
    }

    return 0;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("EACCES") ||
        error.message.includes("ENOENT") ||
        error.message.includes("Permission"))
    ) {
      console.log(`Session validator file error: ${error}`);
      writeContinueResponse(
        `Session validation failed: Cannot read session log. ` +
          `MUST investigate file system issue. Error: ${error}`,
      );
      return 0;
    }

    const errorName =
      error instanceof Error ? error.constructor.name : "Unknown";
    console.log(
      `Session validator unexpected error: ${errorName} - ${error}`,
    );
    writeContinueResponse(
      `Session validation encountered unexpected error. ` +
        `MUST investigate: ${errorName} - ${error}`,
    );
    return 0;
  }
}

process.exit(await main());
