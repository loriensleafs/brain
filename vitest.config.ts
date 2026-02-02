import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // --- Environment ---
    environment: "node",
    globals: false,
    passWithNoTests: true,

    // --- Parallelization ---
    fileParallelism: true,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
        useAtomics: true, // Faster thread communication
      },
    },

    // --- Performance ---
    isolate: true, // Safer: isolate test files (set to false for ~30-50% speedup if tests don't conflict)
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 1000,
    slowTestThreshold: 1000,

    // --- Caching ---
    cache: {
      dir: "node_modules/.vitest",
    },

    // --- Reporter (faster than default) ---
    reporter: process.env.CI ? "dot" : "default",
    outputFile: process.env.CI ? "test-results.json" : undefined,

    // --- Deps optimization ---
    deps: {
      optimizer: {
        web: {
          enabled: false, // Not using web
        },
      },
    },

    // --- Patterns ---
    include: ["src/**/*.test.ts"],
    exclude: ["**/dist/**", "**/node_modules/**"],

    // --- Watch mode optimization ---
    watch: true,
    watchExclude: ["**/dist/**", "**/node_modules/**", "**/.turbo/**"],
    forceRerunTriggers: ["**/vitest.config.ts"],

    // --- Coverage (only when explicitly requested) ---
    coverage: {
      enabled: false, // Only enable via --coverage flag
      provider: "v8",
      reporter: ["html", "json", "text"],
      exclude: ["**/*.test.ts", "**/dist/**", "**/node_modules/**"],
    },
  },

  // --- Build optimization ---
  esbuild: {
    target: "esnext", // Fastest transpilation
  },
});
