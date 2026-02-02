import { defineConfig } from "vitest/config";

export default defineConfig({
  // --- Build optimization ---
  esbuild: {
    target: "esnext",
  },

  // --- Cache ---
  cacheDir: "node_modules/.vite",

  // --- Test ---
  test: {
    // Coverage
    coverage: {
      enabled: false,
      exclude: ["**/*.test.ts", "**/dist/**", "**/node_modules/**"],
      provider: "v8",
      reporter: ["html", "json", "text"],
    },

    // Environment
    environment: "node",
    globals: false,
    passWithNoTests: true,

    // Patterns
    exclude: ["**/dist/**", "**/node_modules/**"],
    include: ["src/**/*.test.ts"],

    // Performance
    fileParallelism: true,
    hookTimeout: 10000,
    isolate: true,
    pool: "forks",
    slowTestThreshold: 1000,
    teardownTimeout: 1000,
    testTimeout: 10000,

    // Reporter
    reporter: process.env.CI ? "dot" : "default",

    // Watch
    watch: false,
    watchExclude: ["**/.turbo/**", "**/dist/**", "**/node_modules/**"],
  },
});
