/**
 * Unit tests for Config Migration module.
 *
 * Tests TASK-020-11 requirements:
 * - migrateToNewConfigLocation(): Move from ~/.basic-memory/brain-config.json
 *   to ~/.config/brain/config.json
 * - Transform old schema to new schema
 * - Rename fields (notes_path -> memories_path)
 * - Atomic migration with backup
 * - Verify new config loads correctly
 * - Remove old config after success
 */

import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { BrainConfig } from "../schema";
import { DEFAULT_BRAIN_CONFIG } from "../schema";

// Track file system state
let fileSystem: Map<string, string>;
let deletedFiles: Set<string>;

// Mock filesystem
const mockFs = {
  existsSync: vi.fn<(p: string) => boolean>((p: string) => fileSystem.has(p)),
  readFileSync: vi.fn<(p: string, enc: string) => string>((p: string) => {
    const content = fileSystem.get(p);
    if (!content) throw new Error(`ENOENT: no such file: ${p}`);
    return content;
  }),
  writeFileSync: vi.fn<(p: string, content: string, opts: unknown) => void>(
    (p: string, content: string) => {
      fileSystem.set(p, content);
    },
  ),
  mkdirSync: vi.fn<(p: string, opts: unknown) => void>(() => undefined),
  copyFileSync: vi.fn<(src: string, dest: string) => void>(
    (src: string, dest: string) => {
      const content = fileSystem.get(src);
      if (!content) throw new Error(`ENOENT: no such file: ${src}`);
      fileSystem.set(dest, content);
    },
  ),
  unlinkSync: vi.fn<(p: string) => void>((p: string) => {
    fileSystem.delete(p);
    deletedFiles.add(p);
  }),
  chmodSync: vi.fn<(p: string, mode: number) => void>(() => undefined),
  renameSync: vi.fn<(from: string, to: string) => void>(
    (from: string, to: string) => {
      const content = fileSystem.get(from);
      if (content) {
        fileSystem.set(to, content);
        fileSystem.delete(from);
      }
    },
  ),
};

vi.mock("fs", () => mockFs);

// Mock brain-config module
const mockBrainConfig = {
  saveBrainConfig: vi.fn(async (config: BrainConfig) => {
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");
    fileSystem.set(newPath, JSON.stringify(config, null, 2));
  }),
  loadBrainConfig: vi.fn(async () => {
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");
    const content = fileSystem.get(newPath);
    if (!content) return { ...DEFAULT_BRAIN_CONFIG };
    return JSON.parse(content) as BrainConfig;
  }),
  getBrainConfigDir: vi.fn(() => path.join(os.homedir(), ".config", "brain")),
  getBrainConfigPath: vi.fn(() =>
    path.join(os.homedir(), ".config", "brain", "config.json"),
  ),
};

vi.mock("../brain-config", () => mockBrainConfig);

// Mock translation-layer module
const mockTranslationLayer = {
  syncConfigToBasicMemory: vi.fn(async () => undefined),
};

vi.mock("../translation-layer", () => mockTranslationLayer);

// Mock logger
vi.mock("../../utils/internal/logger", () => ({
  logger: {
    info: () => {},
    debug: () => {},
    warn: () => {},
    error: () => {},
  },
}));

import {
  getOldConfigPath,
  loadOldConfig,
  migrateToNewConfigLocation,
  needsMigration,
  type OldBrainConfig,
  oldConfigExists,
  rollbackMigration,
  transformOldToNew,
} from "../config-migration";

/**
 * Create a test old config.
 */
function createOldConfig(
  overrides: Partial<OldBrainConfig> = {},
): OldBrainConfig {
  return {
    version: "1.0.0",
    notes_path: "~/old-memories",
    projects: {
      "test-project": {
        code_path: "/dev/test",
        notes_path: "~/custom/notes",
        mode: "custom",
      },
    },
    sync: {
      enabled: true,
      delay: 1000,
    },
    log_level: "debug",
    ...overrides,
  };
}

describe("getOldConfigPath", () => {
  test("returns path in .basic-memory directory", () => {
    const configPath = getOldConfigPath();
    expect(configPath).toContain(".basic-memory");
    expect(configPath).toContain("brain-config.json");
  });
});

describe("oldConfigExists", () => {
  beforeEach(() => {
    fileSystem = new Map();
    deletedFiles = new Set();
  });

  test("returns true when old config exists", () => {
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(createOldConfig()));

    expect(oldConfigExists()).toBe(true);
  });

  test("returns false when old config does not exist", () => {
    expect(oldConfigExists()).toBe(false);
  });
});

describe("needsMigration", () => {
  beforeEach(() => {
    fileSystem = new Map();
    deletedFiles = new Set();
  });

  test("returns true when old exists and new does not", () => {
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(createOldConfig()));

    expect(needsMigration()).toBe(true);
  });

  test("returns false when old does not exist", () => {
    expect(needsMigration()).toBe(false);
  });

  test("returns false when both exist (without force)", () => {
    const oldPath = getOldConfigPath();
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");

    fileSystem.set(oldPath, JSON.stringify(createOldConfig()));
    fileSystem.set(newPath, JSON.stringify(DEFAULT_BRAIN_CONFIG));

    expect(needsMigration()).toBe(false);
  });

  test("returns true when both exist with force option", () => {
    const oldPath = getOldConfigPath();
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");

    fileSystem.set(oldPath, JSON.stringify(createOldConfig()));
    fileSystem.set(newPath, JSON.stringify(DEFAULT_BRAIN_CONFIG));

    expect(needsMigration({ force: true })).toBe(true);
  });
});

describe("loadOldConfig", () => {
  beforeEach(() => {
    fileSystem = new Map();
    deletedFiles = new Set();
  });

  test("loads and parses old config", () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const loaded = loadOldConfig();

    expect(loaded).not.toBeNull();
    expect(loaded?.notes_path).toBe(oldConfig.notes_path);
    expect(loaded?.projects?.["test-project"]?.code_path).toBe("/dev/test");
  });

  test("returns null when file does not exist", () => {
    expect(loadOldConfig()).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, "invalid json {{{");

    expect(loadOldConfig()).toBeNull();
  });
});

describe("transformOldToNew", () => {
  test("maps notes_path to memories_location", () => {
    const oldConfig = createOldConfig({
      notes_path: "~/custom/memories",
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.defaults.memories_location).toBe("~/custom/memories");
  });

  test("maps sync.delay to sync.delay_ms", () => {
    const oldConfig = createOldConfig({
      sync: { enabled: true, delay: 2000 },
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.sync.delay_ms).toBe(2000);
  });

  test("maps log_level to logging.level", () => {
    const oldConfig = createOldConfig({
      log_level: "warn",
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.logging.level).toBe("warn");
  });

  test("transforms project notes_path to memories_path with CUSTOM mode", () => {
    const oldConfig = createOldConfig({
      projects: {
        myproject: {
          code_path: "/dev/myproject",
          notes_path: "~/custom/notes",
        },
      },
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.projects.myproject.memories_path).toBe("~/custom/notes");
    expect(newConfig.projects.myproject.memories_mode).toBe("CUSTOM");
  });

  test("transforms project mode to memories_mode", () => {
    const oldConfig = createOldConfig({
      projects: {
        codemode: { code_path: "/dev/code", mode: "code" },
        defaultmode: { code_path: "/dev/default", mode: "default" },
      },
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.projects.codemode.memories_mode).toBe("CODE");
    expect(newConfig.projects.defaultmode.memories_mode).toBe("DEFAULT");
  });

  test("sets version to 2.0.0", () => {
    const oldConfig = createOldConfig({ version: "1.0.0" });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.version).toBe("2.0.0");
  });

  test("adds default watcher config", () => {
    const oldConfig = createOldConfig();

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.watcher).toBeDefined();
    expect(newConfig.watcher.enabled).toBe(true);
    expect(newConfig.watcher.debounce_ms).toBe(2000);
  });

  test("uses defaults for missing fields", () => {
    const oldConfig: OldBrainConfig = {};

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.defaults.memories_location).toBe(
      DEFAULT_BRAIN_CONFIG.defaults.memories_location,
    );
    expect(newConfig.sync.enabled).toBe(DEFAULT_BRAIN_CONFIG.sync.enabled);
    expect(newConfig.logging.level).toBe(DEFAULT_BRAIN_CONFIG.logging.level);
  });

  test("skips projects without code_path", () => {
    const oldConfig = createOldConfig({
      projects: {
        valid: { code_path: "/dev/valid" },
        invalid: { notes_path: "~/notes" }, // Missing code_path
      },
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.projects.valid).toBeDefined();
    expect(newConfig.projects.invalid).toBeUndefined();
  });
});

describe("migrateToNewConfigLocation", () => {
  beforeEach(() => {
    fileSystem = new Map();
    deletedFiles = new Set();

    mockBrainConfig.saveBrainConfig.mockReset();
    mockBrainConfig.loadBrainConfig.mockReset();
    mockTranslationLayer.syncConfigToBasicMemory.mockReset();

    mockBrainConfig.saveBrainConfig.mockImplementation(
      async (config: BrainConfig) => {
        const newPath = path.join(
          os.homedir(),
          ".config",
          "brain",
          "config.json",
        );
        fileSystem.set(newPath, JSON.stringify(config, null, 2));
      },
    );

    mockBrainConfig.loadBrainConfig.mockImplementation(async () => {
      const newPath = path.join(
        os.homedir(),
        ".config",
        "brain",
        "config.json",
      );
      const content = fileSystem.get(newPath);
      if (!content) return { ...DEFAULT_BRAIN_CONFIG };
      return JSON.parse(content) as BrainConfig;
    });

    mockTranslationLayer.syncConfigToBasicMemory.mockResolvedValue(undefined);
  });

  test("successfully migrates old config to new location", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const result = await migrateToNewConfigLocation();

    expect(result.success).toBe(true);
    expect(result.migratedConfig).toBeDefined();
    expect(result.migratedConfig?.version).toBe("2.0.0");
    expect(result.backupPath).toBeDefined();
  });

  test("creates backup of old config", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const result = await migrateToNewConfigLocation();

    expect(result.backupPath).toBeDefined();
    expect(fileSystem.has(result.backupPath!)).toBe(true);
  });

  test("removes old config after successful migration by default", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const result = await migrateToNewConfigLocation();

    expect(result.success).toBe(true);
    expect(result.oldConfigRemoved).toBe(true);
    expect(fileSystem.has(oldPath)).toBe(false);
  });

  test("preserves old config when removeOldConfig is false", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const result = await migrateToNewConfigLocation({ removeOldConfig: false });

    expect(result.success).toBe(true);
    expect(result.oldConfigRemoved).toBe(false);
    expect(fileSystem.has(oldPath)).toBe(true);
  });

  test("skips migration when old config does not exist", async () => {
    const result = await migrateToNewConfigLocation();

    expect(result.success).toBe(true);
    expect(result.steps.some((s) => s.status === "skipped")).toBe(true);
  });

  test("skips migration when new config already exists", async () => {
    const oldPath = getOldConfigPath();
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");

    fileSystem.set(oldPath, JSON.stringify(createOldConfig()));
    fileSystem.set(newPath, JSON.stringify(DEFAULT_BRAIN_CONFIG));

    const result = await migrateToNewConfigLocation();

    expect(result.success).toBe(true);
    expect(result.error).toContain("New config already exists");
  });

  test("forces migration when force option is true", async () => {
    const oldPath = getOldConfigPath();
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");

    fileSystem.set(oldPath, JSON.stringify(createOldConfig()));
    fileSystem.set(newPath, JSON.stringify(DEFAULT_BRAIN_CONFIG));

    const result = await migrateToNewConfigLocation({ force: true });

    expect(result.success).toBe(true);
    expect(result.migratedConfig).toBeDefined();
  });

  test("syncs to basic-memory after migration", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    await migrateToNewConfigLocation();

    expect(mockTranslationLayer.syncConfigToBasicMemory).toHaveBeenCalled();
  });

  test("verifies new config loads correctly", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    await migrateToNewConfigLocation();

    expect(mockBrainConfig.loadBrainConfig).toHaveBeenCalled();
  });

  test("does not write files in dry run mode", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const result = await migrateToNewConfigLocation({ dryRun: true });

    expect(result.success).toBe(true);
    // Backup should not be created
    expect(result.backupPath).toBeUndefined();
    // saveBrainConfig should not be called
    expect(mockBrainConfig.saveBrainConfig).not.toHaveBeenCalled();
    // Old config should still exist
    expect(fileSystem.has(oldPath)).toBe(true);
  });

  test("includes step tracking in result", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    const result = await migrateToNewConfigLocation();

    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.steps.some((s) => s.name === "load_old_config")).toBe(true);
    expect(result.steps.some((s) => s.name === "transform_schema")).toBe(true);
    expect(result.steps.some((s) => s.name === "save_new_config")).toBe(true);
  });

  test("handles save failure gracefully", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    mockBrainConfig.saveBrainConfig.mockRejectedValue(new Error("Disk full"));

    const result = await migrateToNewConfigLocation();

    expect(result.success).toBe(false);
    expect(result.error).toContain("Disk full");
    expect(result.backupPath).toBeDefined(); // Backup should still exist
  });

  test("handles verification failure gracefully", async () => {
    const oldConfig = createOldConfig();
    const oldPath = getOldConfigPath();
    fileSystem.set(oldPath, JSON.stringify(oldConfig));

    mockBrainConfig.loadBrainConfig.mockResolvedValue({
      ...DEFAULT_BRAIN_CONFIG,
      version: "1.0.0" as "2.0.0", // Wrong version (cast to satisfy type, test verifies failure)
    });

    const result = await migrateToNewConfigLocation();

    expect(result.success).toBe(false);
    expect(result.error).toContain("verification failed");
  });
});

describe("rollbackMigration", () => {
  beforeEach(() => {
    fileSystem = new Map();
    deletedFiles = new Set();
  });

  test("restores old config from backup", async () => {
    const oldPath = getOldConfigPath();
    const backupPath = `${oldPath}.backup`;
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");

    const oldConfigContent = JSON.stringify(createOldConfig());
    fileSystem.set(backupPath, oldConfigContent);
    fileSystem.set(newPath, JSON.stringify(DEFAULT_BRAIN_CONFIG));

    const success = await rollbackMigration(backupPath);

    expect(success).toBe(true);
    expect(fileSystem.get(oldPath)).toBe(oldConfigContent);
  });

  test("removes new config on rollback", async () => {
    const oldPath = getOldConfigPath();
    const backupPath = `${oldPath}.backup`;
    const newPath = path.join(os.homedir(), ".config", "brain", "config.json");

    fileSystem.set(backupPath, JSON.stringify(createOldConfig()));
    fileSystem.set(newPath, JSON.stringify(DEFAULT_BRAIN_CONFIG));

    const success = await rollbackMigration(backupPath);

    expect(success).toBe(true);
    expect(fileSystem.has(newPath)).toBe(false);
  });

  test("fails when backup does not exist", async () => {
    const success = await rollbackMigration("/nonexistent/backup");

    expect(success).toBe(false);
  });
});

describe("schema transformation edge cases", () => {
  test("handles empty projects object", () => {
    const oldConfig = createOldConfig({ projects: {} });

    const newConfig = transformOldToNew(oldConfig);

    expect(Object.keys(newConfig.projects)).toHaveLength(0);
  });

  test("handles missing sync object", () => {
    const oldConfig: OldBrainConfig = {
      notes_path: "~/memories",
    };

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.sync.enabled).toBe(DEFAULT_BRAIN_CONFIG.sync.enabled);
    expect(newConfig.sync.delay_ms).toBe(DEFAULT_BRAIN_CONFIG.sync.delay_ms);
  });

  test("handles uppercase mode values", () => {
    const oldConfig = createOldConfig({
      projects: {
        uppercase: { code_path: "/dev/up", mode: "CODE" },
      },
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.projects.uppercase.memories_mode).toBe("CODE");
  });

  test("handles unknown mode values", () => {
    const oldConfig = createOldConfig({
      projects: {
        unknown: { code_path: "/dev/unknown", mode: "invalid" },
      },
    });

    const newConfig = transformOldToNew(oldConfig);

    // Should default to DEFAULT for unknown modes
    expect(newConfig.projects.unknown.memories_mode).toBe("DEFAULT");
  });

  test("preserves code_path in project config", () => {
    const oldConfig = createOldConfig({
      projects: {
        myproject: { code_path: "/specific/path" },
      },
    });

    const newConfig = transformOldToNew(oldConfig);

    expect(newConfig.projects.myproject.code_path).toBe("/specific/path");
  });
});
