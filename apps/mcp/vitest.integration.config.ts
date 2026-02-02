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
  // Test
  // =============================================================================

  test: {
    // --- Environment ---
    environment: "node",
    env: {
      USE_BETTER_SQLITE3: "true",
    },

    // --- Patterns ---
    include: [
      "src/db/__tests__/performance.test.ts",
      "src/db/__tests__/schema.test.ts",
      "src/db/__tests__/vectors.test.ts",
      "src/tools/search/__tests__/handler.test.ts",
    ],

    // --- Performance ---
    // Use threads pool for Node.js native module compatibility
    // Vitest 4: pool options are now top-level (not nested in poolOptions)
    pool: "threads",
    minThreads: 1,
    maxThreads: 4,
    isolate: false, // Reuse threads to avoid sqlite-vec extension reload overhead

    // --- Timeouts ---
    // Performance tests run 100+ query iterations, need longer timeouts
    hookTimeout: 60000,
    teardownTimeout: 5000,
    testTimeout: 60000,

    // --- Reporter ---
    reporter: process.env.CI ? "dot" : "default",
  },
});
