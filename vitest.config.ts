import { defineConfig } from "vitest/config";

export default defineConfig({
  // =============================================================================
  // Build Configuration
  // =============================================================================

  cacheDir: "node_modules/.vite",

  esbuild: {
    target: "esnext",
  },

  // =============================================================================
  // Test Configuration
  // =============================================================================

  test: {
    // --- Environment ---
    environment: "node",
    globals: false,

    // --- File Patterns ---
    include: [
      "apps/**/src/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
    ],
    exclude: [
      // Standard exclusions
      "**/dist/**",
      "**/node_modules/**",

      // Bun-only tests (require bun:sqlite, must run via Turbo)
      "apps/mcp/src/config/__tests__/migration-verify.test.ts",
      "apps/mcp/src/db/__tests__/**",
      "apps/mcp/src/services/embedding/__tests__/integration.test.ts",
      "apps/mcp/src/services/embedding/__tests__/queue.test.ts",
      "apps/mcp/src/services/embedding/__tests__/retry.test.ts",
      "apps/mcp/src/services/embedding/__tests__/triggerEmbedding.test.ts",
      "apps/mcp/src/tools/__tests__/edit-note-embedding.test.ts",
      "apps/mcp/src/tools/bootstrap-context/__tests__/catchupTrigger.test.ts",
      "apps/mcp/src/tools/search/__tests__/handler.test.ts",
    ],

    // --- Parallelism (Vitest 4: top-level, not poolOptions) ---
    fileParallelism: true,
    isolate: true,
    maxForks: 8,
    minForks: 2,
    pool: "forks",

    // --- Timeouts ---
    hookTimeout: 10000,
    teardownTimeout: 1000,
    testTimeout: 10000,

    // --- Behavior ---
    passWithNoTests: true,
    slowTestThreshold: 1000,

    // --- Reporter ---
    reporter: process.env.CI ? "dot" : "default",

    // --- Watch Mode ---
    watch: false,
    watchExclude: [
      "**/.turbo/**",
      "**/dist/**",
      "**/node_modules/**",
    ],

    // --- Coverage ---
    coverage: {
      enabled: false,
      exclude: [
        "**/*.test.ts",
        "**/dist/**",
        "**/node_modules/**",
      ],
      provider: "v8",
      reporter: ["html", "json", "text"],
    },
  },
});
