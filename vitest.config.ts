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
      "adapters/**/*.test.ts",
      "apps/**/src/**/*.test.ts",
      "hooks/scripts/__tests__/**/*.test.ts",
      "packages/**/src/**/*.test.ts",
    ],
    exclude: [
      "**/dist/**",
      "**/node_modules/**",
    ],

    // --- Parallelism ---
    fileParallelism: true,
    isolate: true,
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
