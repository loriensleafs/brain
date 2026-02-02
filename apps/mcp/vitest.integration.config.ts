/**
 * Vitest configuration for sqlite-vec integration tests.
 *
 * These tests run with Node.js (not Bun) because:
 * - Bun's built-in SQLite doesn't support native extensions
 * - sqlite-vec requires extension loading capability
 * - better-sqlite3 (Node.js) supports native extensions
 *
 * Usage:
 *   npx vitest run --config vitest.integration.config.ts
 *   bun run test:integration
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  // =============================================================================
  // Module Resolution
  // =============================================================================

  resolve: {
    alias: {
      // Redirect bun:sqlite imports to better-sqlite3 adapter
      "bun:sqlite": new URL("./src/db/__tests__/better-sqlite3-adapter.ts", import.meta.url)
        .pathname,
    },
  },

  // =============================================================================
  // Test Configuration
  // =============================================================================

  test: {
    // --- Environment ---
    environment: "node",
    env: {
      USE_BETTER_SQLITE3: "true",
    },

    // --- File Patterns ---
    include: [
      "src/db/__tests__/performance.test.ts",
      "src/db/__tests__/schema.test.ts",
      "src/db/__tests__/vectors.test.ts",
      "src/tools/search/__tests__/handler.test.ts",
    ],

    // --- Parallelism (Vitest 4: top-level, not poolOptions) ---
    // Use threads pool for Node.js native module compatibility
    // Disable isolation to avoid sqlite-vec extension reload overhead
    isolate: false,
    maxThreads: 4,
    minThreads: 1,
    pool: "threads",

    // --- Timeouts ---
    // Performance tests run 100+ query iterations, need longer timeouts
    hookTimeout: 60000,
    teardownTimeout: 5000,
    testTimeout: 60000,

    // --- Reporter ---
    reporter: process.env.CI ? "dot" : "default",
  },
});
