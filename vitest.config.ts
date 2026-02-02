import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // --- Parallelization ---
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
    fileParallelism: true,

    // --- Performance ---
    isolate: true, // Set to false for faster local dev (less isolation)
    testTimeout: 10000,
    hookTimeout: 10000,

    // --- Environment ---
    globals: false,
    environment: "node",
    passWithNoTests: true,

    // --- Patterns ---
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],

    // --- Coverage (only when requested) ---
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/*.test.ts"],
    },
  },
});
