import { defineConfig } from "vitest/config";

export default defineConfig({
  // =============================================================================
  // Build
  // =============================================================================

  cacheDir: "node_modules/.vite",

  esbuild: {
    target: "esnext",
  },

  server: {
    deps: {
      // Inline certain modules to fix SSR import issues with Bun
      inline: ["zod"],
    },
  },

  // =============================================================================
  // Test
  // =============================================================================

  test: {
    // --- Environment ---
    environment: "node",
    globals: false,

    // --- Patterns ---
    include: [
      "apps/**/src/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
    ],
    exclude: [
      "**/dist/**",
      "**/node_modules/**",
    ],

    // --- Performance ---
    // Vitest 4: pool options are now top-level (not nested in poolOptions)
    fileParallelism: true,
    isolate: true,
    pool: "forks",
    minForks: 2,
    maxForks: 8,

    // --- Timeouts ---
    hookTimeout: 10000,
    teardownTimeout: 1000,
    testTimeout: 10000,

    // --- Thresholds ---
    passWithNoTests: true,
    slowTestThreshold: 1000,

    // --- Reporter ---
    reporter: process.env.CI ? "dot" : "default",

    // --- Watch ---
    watch: false,
    watchExclude: [
      "**/.turbo/**",
      "**/dist/**",
      "**/node_modules/**",
    ],

    // --- Coverage ---
    coverage: {
      enabled: false,
      provider: "v8",
      exclude: [
        "**/*.test.ts",
        "**/dist/**",
        "**/node_modules/**",
      ],
      reporter: ["html", "json", "text"],
    },
  },
});
