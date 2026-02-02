import { defineConfig } from "vitest/config";

export default defineConfig({
  // =============================================================================
  // Build
  // =============================================================================

  cacheDir: "node_modules/.vite",

  esbuild: {
    target: "esnext",
  },

  // =============================================================================
  // Test
  // =============================================================================

  test: {
    // --- Environment ---
    environment: "node",
    globals: false,

    // --- Patterns ---
    include: ["src/**/*.test.ts"],
    exclude: [
      // Standard exclusions
      "**/dist/**",
      "**/node_modules/**",
      // sqlite-vec tests (run via vitest.integration.config.ts with Node.js)
      "**/db/__tests__/performance.test.ts",
      "**/db/__tests__/schema.test.ts",
      "**/db/__tests__/vectors.test.ts",
      "**/tools/search/__tests__/handler.test.ts",
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
    watchExclude: ["**/.turbo/**", "**/dist/**", "**/node_modules/**"],

    // --- Coverage ---
    coverage: {
      enabled: false,
      provider: "v8",
      exclude: ["**/*.test.ts", "**/dist/**", "**/node_modules/**"],
      reporter: ["html", "json", "text"],
    },
  },
});
