/**
 * Unit tests for Translation Layer module.
 *
 * Tests TASK-020-04 requirements:
 * - translateBrainToBasicMemory(): Convert Brain config -> basic-memory config format
 * - Field mapping from ADR-020 (memories_location, projects, etc.)
 * - One-way sync (Brain is source of truth)
 * - Preserve unknown fields (round-trip fidelity)
 * - syncConfigToBasicMemory(): Write translated config to basic-memory
 * - Memories mode resolution (DEFAULT, CODE, CUSTOM)
 */

import * as os from "node:os";
import * as path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type BrainConfig, DEFAULT_BRAIN_CONFIG } from "../schema";

// Use vi.hoisted() to ensure mocks are available before vi.mock() hoisting
const { mockFs, mockLock } = vi.hoisted(() => ({
  mockFs: {
    existsSync: vi.fn<(p: string) => boolean>(() => false),
    readFileSync: vi.fn<(p: string, enc: string) => string>(() => ""),
    writeFileSync: vi.fn<(p: string, content: string, opts: unknown) => void>(() => undefined),
    mkdirSync: vi.fn<(p: string, opts?: unknown) => void>(() => undefined),
    chmodSync: vi.fn<(p: string, mode: number) => void>(() => undefined),
    renameSync: vi.fn<(from: string, to: string) => void>(() => undefined),
    unlinkSync: vi.fn<(p: string) => void>(() => undefined),
    openSync: vi.fn<(p: string, flags: number) => number>(() => 1),
    closeSync: vi.fn<(fd: number) => void>(() => undefined),
    constants: {
      O_CREAT: 0x0200,
      O_EXCL: 0x0800,
      O_WRONLY: 0x0001,
    },
  },
  mockLock: {
    acquireConfigLock: vi.fn<(opts: unknown) => Promise<{ acquired: boolean; error?: string }>>(
      async () => ({ acquired: true }),
    ),
    releaseConfigLock: vi.fn<() => boolean>(() => true),
  },
}));

vi.mock("fs", () => mockFs);

// Mock path-validator with proper implementations
vi.mock("../path-validator", () => ({
  validatePathOrThrow: (p: string) => p,
  validatePath: (p: string) => ({ valid: true, normalizedPath: p }),
  expandTilde: (p: string) => {
    if (p === "~") return os.homedir();
    if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
    return p;
  },
  normalizePath: (p: string) => {
    let expanded = p;
    if (p === "~") expanded = os.homedir();
    if (p.startsWith("~/")) expanded = path.join(os.homedir(), p.slice(2));
    return path.normalize(path.resolve(expanded));
  },
}));

vi.mock("../../utils/security/configLock", () => mockLock);

import {
  type BasicMemoryConfig,
  getBasicMemoryConfigDir,
  getBasicMemoryConfigPath,
  previewTranslation,
  resolveMemoriesPath,
  syncConfigToBasicMemory,
  TranslationError,
  translateBrainToBasicMemory,
  trySyncConfigToBasicMemory,
  validateTranslation,
} from "../translation-layer";

describe("getBasicMemoryConfigPath", () => {
  test("returns path in .basic-memory directory", () => {
    const configPath = getBasicMemoryConfigPath();
    expect(configPath).toContain(".basic-memory");
    expect(configPath).toContain("config.json");
  });

  test("path is within user home directory", () => {
    const configPath = getBasicMemoryConfigPath();
    expect(configPath.startsWith(os.homedir())).toBe(true);
  });
});

describe("getBasicMemoryConfigDir", () => {
  test("returns .basic-memory directory", () => {
    const configDir = getBasicMemoryConfigDir();
    expect(configDir).toContain(".basic-memory");
    expect(configDir).not.toContain("config.json");
  });
});

describe("resolveMemoriesPath", () => {
  describe("DEFAULT mode", () => {
    test("resolves to memories_location/project_name", () => {
      const result = resolveMemoriesPath("brain", { code_path: "/dev/brain" }, "~/memories");

      expect(result.mode).toBe("DEFAULT");
      expect(result.error).toBeUndefined();
      expect(result.path).toContain("memories");
      expect(result.path).toContain("brain");
    });

    test("expands tilde in memories_location", () => {
      const result = resolveMemoriesPath(
        "myproject",
        { code_path: "/dev/myproject" },
        "~/memories",
      );

      expect(result.path).toContain(os.homedir());
      expect(result.path).not.toContain("~");
    });
  });

  describe("CODE mode", () => {
    test("resolves to code_path/docs", () => {
      const result = resolveMemoriesPath(
        "brain",
        { code_path: "/dev/brain", memories_mode: "CODE" },
        "~/memories",
      );

      expect(result.mode).toBe("CODE");
      expect(result.error).toBeUndefined();
      expect(result.path).toContain("/dev/brain");
      expect(result.path).toContain("docs");
    });

    test("expands tilde in code_path", () => {
      const result = resolveMemoriesPath(
        "brain",
        { code_path: "~/Dev/brain", memories_mode: "CODE" },
        "~/memories",
      );

      expect(result.path).toContain(os.homedir());
      expect(result.path).not.toContain("~");
    });
  });

  describe("CUSTOM mode", () => {
    test("uses explicit memories_path", () => {
      const result = resolveMemoriesPath(
        "brain",
        {
          code_path: "/dev/brain",
          memories_path: "~/custom/path",
          memories_mode: "CUSTOM",
        },
        "~/memories",
      );

      expect(result.mode).toBe("CUSTOM");
      expect(result.error).toBeUndefined();
      expect(result.path).toContain("custom");
    });

    test("returns error when memories_path is missing", () => {
      const result = resolveMemoriesPath(
        "brain",
        { code_path: "/dev/brain", memories_mode: "CUSTOM" },
        "~/memories",
      );

      expect(result.error).toBeDefined();
      expect(result.error).toContain("memories_path");
    });
  });

  describe("mode defaults", () => {
    test("defaults to DEFAULT mode when not specified", () => {
      const result = resolveMemoriesPath("project", { code_path: "/dev/project" }, "~/memories");

      expect(result.mode).toBe("DEFAULT");
    });
  });
});

describe("translateBrainToBasicMemory", () => {
  test("maps sync.enabled to sync_changes", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      sync: { enabled: true, delay_ms: 500 },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.sync_changes).toBe(true);
  });

  test("maps sync.delay_ms to sync_delay", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      sync: { enabled: true, delay_ms: 1000 },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.sync_delay).toBe(1000);
  });

  test("maps logging.level to log_level", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      logging: { level: "debug" },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.log_level).toBe("debug");
  });

  test("resolves project paths and maps to projects object", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {
        brain: { code_path: "/dev/brain" },
        "my-app": { code_path: "/dev/my-app" },
      },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.projects).toBeDefined();
    expect(result.projects?.brain).toBeDefined();
    expect(result.projects?.["my-app"]).toBeDefined();
  });

  test("preserves unknown fields from existing config", () => {
    const brainConfig: BrainConfig = { ...DEFAULT_BRAIN_CONFIG };
    const existingConfig: BasicMemoryConfig = {
      kebab_filenames: true,
      cloud_mode: false,
      default_project: "shared",
    };

    const result = translateBrainToBasicMemory(brainConfig, existingConfig);

    expect(result.kebab_filenames).toBe(true);
    expect(result.cloud_mode).toBe(false);
    expect(result.default_project).toBe("shared");
  });

  test("handles empty projects object", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {},
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.projects).toEqual({});
  });

  test("skips projects with resolution errors", () => {
    // This test verifies that failed resolutions don't crash the translation
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {
        valid: { code_path: "/dev/valid" },
        invalid: { code_path: "/dev/invalid", memories_mode: "CUSTOM" }, // Missing memories_path
      },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    // Valid project should be included
    expect(result.projects?.valid).toBeDefined();
    // Invalid project should be skipped (no crash)
    expect(result.projects?.invalid).toBeUndefined();
  });
});

describe("syncConfigToBasicMemory", () => {
  beforeEach(() => {
    mockFs.existsSync.mockReset();
    mockFs.readFileSync.mockReset();
    mockFs.writeFileSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockFs.renameSync.mockReset();
    mockFs.chmodSync.mockReset();
    mockFs.unlinkSync.mockReset();
    mockLock.acquireConfigLock.mockReset();
    mockLock.releaseConfigLock.mockReset();

    mockLock.acquireConfigLock.mockResolvedValue({ acquired: true });
    mockLock.releaseConfigLock.mockReturnValue(true);
  });

  test("acquires and releases lock during sync", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("{}");

    await syncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG);

    expect(mockLock.acquireConfigLock).toHaveBeenCalled();
    expect(mockLock.releaseConfigLock).toHaveBeenCalled();
  });

  test("throws TranslationError when lock acquisition fails", async () => {
    mockLock.acquireConfigLock.mockResolvedValue({
      acquired: false,
      error: "Lock timeout",
    });

    await expect(syncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG)).rejects.toThrow(TranslationError);
  });

  test("preserves existing config fields during sync", async () => {
    const existingConfig = { default_project: "shared", kebab_filenames: true };
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(existingConfig));

    let writtenConfig: BasicMemoryConfig | null = null;
    mockFs.writeFileSync.mockImplementation((p: string, content: string) => {
      if (String(p).includes(".tmp")) {
        writtenConfig = JSON.parse(content) as BasicMemoryConfig;
      }
    });

    await syncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG);

    expect(writtenConfig).not.toBeNull();
    const config = writtenConfig as unknown as BasicMemoryConfig;
    expect(config.default_project).toBe("shared");
    expect(config.kebab_filenames).toBe(true);
  });

  test("uses atomic write pattern", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("{}");

    await syncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG);

    // Verify temp file write happened
    const writeCalls = mockFs.writeFileSync.mock.calls;
    expect(writeCalls.length).toBeGreaterThan(0);
    expect(String(writeCalls[0][0])).toContain(".tmp");

    // Verify rename happened
    expect(mockFs.renameSync).toHaveBeenCalled();
  });

  test("creates config directory if missing", async () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.readFileSync.mockReturnValue("{}");

    await syncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG);

    expect(mockFs.mkdirSync).toHaveBeenCalled();
  });
});

describe("trySyncConfigToBasicMemory", () => {
  beforeEach(() => {
    mockFs.existsSync.mockReset();
    mockFs.readFileSync.mockReset();
    mockFs.writeFileSync.mockReset();
    mockFs.mkdirSync.mockReset();
    mockFs.renameSync.mockReset();
    mockLock.acquireConfigLock.mockReset();
    mockLock.releaseConfigLock.mockReset();

    mockLock.acquireConfigLock.mockResolvedValue({ acquired: true });
    mockLock.releaseConfigLock.mockReturnValue(true);
  });

  test("returns success on successful sync", async () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue("{}");

    const result = await trySyncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("returns error without throwing on failure", async () => {
    mockLock.acquireConfigLock.mockResolvedValue({
      acquired: false,
      error: "Lock timeout",
    });

    const result = await trySyncConfigToBasicMemory(DEFAULT_BRAIN_CONFIG);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("validateTranslation", () => {
  test("returns empty array for valid config", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {
        brain: { code_path: "/dev/brain" },
      },
    };

    const errors = validateTranslation(brainConfig);

    expect(errors).toEqual([]);
  });

  test("returns error for invalid memories_mode", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {
        invalid: {
          code_path: "/dev/invalid",
          memories_mode: "CUSTOM", // Missing memories_path
        },
      },
    };

    const errors = validateTranslation(brainConfig);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("invalid");
  });

  test("returns error for negative sync delay", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      sync: { enabled: true, delay_ms: -100 },
    };

    const errors = validateTranslation(brainConfig);

    expect(errors.some((e) => e.includes("sync delay"))).toBe(true);
  });
});

describe("previewTranslation", () => {
  test("returns translated config and resolutions", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {
        brain: { code_path: "/dev/brain" },
        webapp: { code_path: "/dev/webapp", memories_mode: "CODE" },
      },
    };

    const { config, resolutions } = previewTranslation(brainConfig);

    // Verify config is present
    expect(config.sync_changes).toBeDefined();
    expect(config.log_level).toBeDefined();

    // Verify resolutions for each project
    expect(resolutions.brain).toBeDefined();
    expect(resolutions.brain.mode).toBe("DEFAULT");
    expect(resolutions.webapp).toBeDefined();
    expect(resolutions.webapp.mode).toBe("CODE");
  });

  test("includes resolution errors in preview", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      projects: {
        broken: {
          code_path: "/dev/broken",
          memories_mode: "CUSTOM",
          // Missing memories_path
        },
      },
    };

    const { resolutions } = previewTranslation(brainConfig);

    expect(resolutions.broken.error).toBeDefined();
  });
});

describe("TranslationError", () => {
  test("has correct error name", () => {
    const error = new TranslationError("test", "IO_ERROR");
    expect(error.name).toBe("TranslationError");
  });

  test("preserves error code", () => {
    const error = new TranslationError("test", "VALIDATION_ERROR");
    expect(error.code).toBe("VALIDATION_ERROR");
  });

  test("preserves cause", () => {
    const cause = new Error("original error");
    const error = new TranslationError("test", "IO_ERROR", cause);
    expect(error.cause).toBe(cause);
  });
});

describe("Field mapping test cases from ADR-020", () => {
  test("DEFAULT mode: ~/memories + brain -> ~/memories/brain", () => {
    const result = resolveMemoriesPath("brain", { code_path: "/dev/brain" }, "~/memories");

    expect(result.mode).toBe("DEFAULT");
    expect(result.path).toContain("memories");
    expect(result.path).toContain("brain");
  });

  test("CODE mode: /Users/peter/Dev/brain -> /Users/peter/Dev/brain/docs", () => {
    const result = resolveMemoriesPath(
      "brain",
      { code_path: "/Users/peter/Dev/brain", memories_mode: "CODE" },
      "~/memories",
    );

    expect(result.mode).toBe("CODE");
    expect(result.path).toContain("/Users/peter/Dev/brain");
    expect(result.path).toContain("docs");
  });

  test("CUSTOM mode: ~/custom/path -> ~/custom/path", () => {
    const result = resolveMemoriesPath(
      "brain",
      {
        code_path: "/dev/brain",
        memories_path: "~/custom/path",
        memories_mode: "CUSTOM",
      },
      "~/memories",
    );

    expect(result.mode).toBe("CUSTOM");
    expect(result.path).toContain("custom");
    expect(result.path).toContain("path");
  });

  test("Sync enabled: true -> sync_changes: true", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      sync: { enabled: true, delay_ms: 500 },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.sync_changes).toBe(true);
  });

  test("Sync delay: 500 -> sync_delay: 500", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      sync: { enabled: true, delay_ms: 500 },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.sync_delay).toBe(500);
  });

  test("logging.level: info -> log_level: info", () => {
    const brainConfig: BrainConfig = {
      ...DEFAULT_BRAIN_CONFIG,
      logging: { level: "info" },
    };

    const result = translateBrainToBasicMemory(brainConfig);

    expect(result.log_level).toBe("info");
  });
});
