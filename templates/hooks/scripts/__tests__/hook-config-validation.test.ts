/**
 * CI validation tests for hook configuration files.
 *
 * Validates that hook configs are well-formed, reference existing
 * scripts, and maintain cross-platform consistency.
 *
 * Uses Node fs APIs since vitest runs under Node, not Bun.
 *
 * @see TASK-020-add-ci-validation-and-golden-files
 */
import { describe, expect, it } from "vitest";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, "..", "..");

function readJSON(path: string): Record<string, unknown> {
  const content = readFileSync(path, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

// ============================================================================
// Claude Code Hook Config Validation
// ============================================================================

describe("hooks/claude-code.json validation", () => {
  const configPath = join(HOOKS_DIR, "claude-code.json");

  it("is valid JSON", () => {
    const config = readJSON(configPath);
    expect(config).toBeDefined();
  });

  it("has $schema field", () => {
    const config = readJSON(configPath);
    expect(config.$schema).toContain("hooks.schema.json");
  });

  it("has hooks object", () => {
    const config = readJSON(configPath);
    expect(config.hooks).toBeDefined();
    expect(typeof config.hooks).toBe("object");
  });

  it("all hook commands reference existing scripts", () => {
    const config = readJSON(configPath);
    const hooks = config.hooks as Record<string, unknown[]>;

    for (const [eventName, entries] of Object.entries(hooks)) {
      for (const entry of entries) {
        const hookEntry = entry as Record<string, unknown>;
        const hookList = (hookEntry.hooks as Record<string, unknown>[]) ??
          [hookEntry];
        for (const hook of hookList) {
          const command = hook.command as string;
          expect(command, `${eventName}: command must be defined`).toBeDefined();
          const match = command.match(/hooks\/scripts\/[\w-]+\.ts$/);
          expect(
            match,
            `${eventName}: command "${command}" must reference hooks/scripts/*.ts`,
          ).toBeTruthy();
          const scriptPath = join(HOOKS_DIR, "..", match![0]);
          expect(
            existsSync(scriptPath),
            `${eventName}: script ${match![0]} must exist`,
          ).toBe(true);
        }
      }
    }
  });

  it("uses known Claude Code event names", () => {
    const config = readJSON(configPath);
    const knownEvents = [
      "SessionStart", "UserPromptSubmit", "PreToolUse",
      "PostToolUse", "Stop", "Notification", "SubagentStop",
    ];
    const hooks = config.hooks as Record<string, unknown>;
    for (const eventName of Object.keys(hooks)) {
      expect(
        knownEvents,
        `Unknown CC event: ${eventName}`,
      ).toContain(eventName);
    }
  });
});

// ============================================================================
// Cursor Hook Config Validation
// ============================================================================

describe("hooks/cursor.json validation", () => {
  const configPath = join(HOOKS_DIR, "cursor.json");

  it("is valid JSON", () => {
    const config = readJSON(configPath);
    expect(config).toBeDefined();
  });

  it("has version field", () => {
    const config = readJSON(configPath);
    expect(config.version).toBe(1);
  });

  it("has hooks object", () => {
    const config = readJSON(configPath);
    expect(config.hooks).toBeDefined();
    expect(typeof config.hooks).toBe("object");
  });

  it("all hook commands reference existing scripts", () => {
    const config = readJSON(configPath);
    const hooks = config.hooks as Record<string, unknown[]>;

    for (const [eventName, entries] of Object.entries(hooks)) {
      for (const entry of entries) {
        const hook = entry as Record<string, unknown>;
        const command = hook.command as string;
        expect(command, `${eventName}: command must be defined`).toBeDefined();
        const match = command.match(/hooks\/scripts\/[\w-]+\.ts$/);
        expect(
          match,
          `${eventName}: command "${command}" must reference hooks/scripts/*.ts`,
        ).toBeTruthy();
        const scriptPath = join(HOOKS_DIR, "..", match![0]);
        expect(
          existsSync(scriptPath),
          `${eventName}: script ${match![0]} must exist`,
        ).toBe(true);
      }
    }
  });

  it("uses known Cursor event names", () => {
    const config = readJSON(configPath);
    const knownEvents = [
      "beforeSubmitPrompt", "beforeShellExecution",
      "beforeMCPExecution", "beforeReadFile",
      "afterFileEdit", "stop",
    ];
    const hooks = config.hooks as Record<string, unknown>;
    for (const eventName of Object.keys(hooks)) {
      expect(
        knownEvents,
        `Unknown Cursor event: ${eventName}`,
      ).toContain(eventName);
    }
  });
});

// ============================================================================
// Cross-Platform Consistency
// ============================================================================

describe("cross-platform hook config consistency", () => {
  it("shared scripts are referenced by both configs", () => {
    const ccConfig = readJSON(join(HOOKS_DIR, "claude-code.json"));
    const cursorConfig = readJSON(join(HOOKS_DIR, "cursor.json"));

    // Extract all script paths from CC config
    const ccScripts = new Set<string>();
    for (const entries of Object.values(ccConfig.hooks as Record<string, unknown[]>)) {
      for (const entry of entries) {
        const hookEntry = entry as Record<string, unknown>;
        const hookList = (hookEntry.hooks as Record<string, unknown>[]) ?? [hookEntry];
        for (const hook of hookList) {
          const match = (hook.command as string).match(/hooks\/scripts\/[\w-]+\.ts$/);
          if (match) ccScripts.add(match[0]);
        }
      }
    }

    // Extract all script paths from Cursor config
    const cursorScripts = new Set<string>();
    for (const entries of Object.values(cursorConfig.hooks as Record<string, unknown[]>)) {
      for (const entry of entries) {
        const hook = entry as Record<string, unknown>;
        const match = (hook.command as string).match(/hooks\/scripts\/[\w-]+\.ts$/);
        if (match) cursorScripts.add(match[0]);
      }
    }

    // Key shared scripts must appear in both
    const sharedScripts = [
      "hooks/scripts/user-prompt.ts",
      "hooks/scripts/pre-tool-use.ts",
      "hooks/scripts/stop.ts",
    ];

    for (const script of sharedScripts) {
      expect(ccScripts, `CC must use ${script}`).toContain(script);
      expect(cursorScripts, `Cursor must use ${script}`).toContain(script);
    }
  });

  it("CC-only scripts are not required in Cursor config", () => {
    const cursorConfig = readJSON(join(HOOKS_DIR, "cursor.json"));

    const hooks = cursorConfig.hooks as Record<string, unknown>;
    expect(hooks).not.toHaveProperty("SessionStart");
    expect(hooks).not.toHaveProperty("sessionStart");
  });

  it("Cursor-only events are not in CC config", () => {
    const ccConfig = readJSON(join(HOOKS_DIR, "claude-code.json"));

    const hooks = ccConfig.hooks as Record<string, unknown>;
    expect(hooks).not.toHaveProperty("beforeReadFile");
    expect(hooks).not.toHaveProperty("beforeShellExecution");
  });
});
