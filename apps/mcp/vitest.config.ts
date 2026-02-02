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
    watchExclude: ["**/.turbo/**", "**/dist/**", "**/node_modules/**"],

    // --- Coverage ---
    coverage: {
      enabled: false,
      exclude: ["**/*.test.ts", "**/dist/**", "**/node_modules/**"],
      provider: "v8",
      reporter: ["html", "json", "text"],
    },
  },
});
