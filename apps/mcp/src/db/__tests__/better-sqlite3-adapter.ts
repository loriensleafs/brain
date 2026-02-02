/**
 * Adapter to make better-sqlite3 compatible with bun:sqlite API.
 *
 * This allows the same test code to run with either:
 * - bun:sqlite (Bun runtime, no sqlite-vec support)
 * - better-sqlite3 (Node.js runtime, with sqlite-vec support)
 *
 * Used by vitest.integration.config.ts to alias "bun:sqlite" imports.
 */

import BetterSqlite3 from "better-sqlite3";

// =============================================================================
// Type Conversion Utilities
// =============================================================================

/**
 * Convert input parameters for better-sqlite3 + sqlite-vec compatibility.
 *
 * Conversions:
 * - Float32Array → Buffer (sqlite-vec expects vectors as Buffers)
 * - Integer → BigInt (vec0 virtual table requires BigInt for INTEGER columns)
 */
function convertParams(params: unknown[]): unknown[] {
  const result = new Array(params.length);

  for (let i = 0; i < params.length; i++) {
    const p = params[i];

    if (p instanceof Float32Array) {
      result[i] = Buffer.from(p.buffer, p.byteOffset, p.byteLength);
    } else if (typeof p === "number" && Number.isInteger(p)) {
      result[i] = BigInt(p);
    } else {
      result[i] = p;
    }
  }

  return result;
}

/**
 * Flatten array parameters (bun:sqlite passes arrays as single argument).
 */
function flattenParams(params: unknown[]): unknown[] {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

/**
 * Convert a single result row from better-sqlite3 to JavaScript-friendly format.
 *
 * Conversions:
 * - BigInt → number (SQLite INTEGER columns return as BigInt)
 */
function convertResult<T>(row: T): T {
  if (row === null || row === undefined || typeof row !== "object") {
    return row;
  }

  const converted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    converted[key] = typeof value === "bigint" ? Number(value) : value;
  }

  return converted as T;
}

/**
 * Convert an array of result rows.
 */
function convertResults<T>(rows: T[]): T[] {
  const result = new Array(rows.length);

  for (let i = 0; i < rows.length; i++) {
    result[i] = convertResult(rows[i]);
  }

  return result;
}

// =============================================================================
// Database Class
// =============================================================================

/**
 * Database class that wraps better-sqlite3 with bun:sqlite-compatible API.
 */
export class Database {
  private db: BetterSqlite3.Database;
  private stmtCache: Map<string, BetterSqlite3.Statement>;

  constructor(path: string) {
    this.db = new BetterSqlite3(path);
    this.stmtCache = new Map();
  }

  // --- Core Methods ---

  /**
   * Close the database connection.
   */
  close(): void {
    this.stmtCache.clear();
    this.db.close();
  }

  /**
   * Load a SQLite extension (used by sqlite-vec).
   */
  loadExtension(path: string): void {
    this.db.loadExtension(path);
  }

  /**
   * Get the underlying better-sqlite3 database instance.
   */
  get native(): BetterSqlite3.Database {
    return this.db;
  }

  // --- Statement Methods ---

  /**
   * Create a prepared statement (with caching).
   */
  prepare<T = unknown>(sql: string) {
    const cached = this.stmtCache.get(sql);
    const stmt = cached ?? this.db.prepare(sql);

    if (!cached) {
      this.stmtCache.set(sql, stmt);
    }

    return {
      all: (...params: unknown[]): T[] => {
        const flatParams = flattenParams(params);
        const results = stmt.all(...convertParams(flatParams));
        return convertResults(results) as T[];
      },
      get: (...params: unknown[]): T | undefined => {
        const flatParams = flattenParams(params);
        const result = stmt.get(...convertParams(flatParams));
        return convertResult(result) as T | undefined;
      },
      run: (...params: unknown[]) => {
        const flatParams = flattenParams(params);
        return stmt.run(...convertParams(flatParams));
      },
    };
  }

  /**
   * Query that returns results (bun:sqlite style).
   */
  query<T = unknown, P extends unknown[] = unknown[]>(sql: string) {
    const stmt = this.prepare<T>(sql);
    return {
      all: (...params: P): T[] => stmt.all(...params),
      get: (...params: P): T | undefined => stmt.get(...params),
      run: (...params: P) => stmt.run(...params),
    };
  }

  /**
   * Execute a SQL statement that doesn't return results.
   */
  run(sql: string, ...params: unknown[]): { changes: number } {
    const stmt = this.prepare(sql);
    const result = stmt.run(...params) as BetterSqlite3.RunResult;
    return { changes: result.changes };
  }

  /**
   * Create a transaction function.
   */
  transaction<T>(fn: () => T): () => T {
    return this.db.transaction(fn) as () => T;
  }

  // --- Static Methods ---

  /**
   * Set custom SQLite library (no-op for better-sqlite3).
   */
  static setCustomSQLite(_path: string): void {
    // No-op - better-sqlite3 uses its own bundled SQLite
  }
}

export default { Database };
