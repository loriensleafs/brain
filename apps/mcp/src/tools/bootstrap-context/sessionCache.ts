/**
 * Session-level caching for bootstrap_context tool
 *
 * Implements TTL-based caching to avoid repeated queries during a single session.
 * Cache is invalidated when write_note or edit_note operations occur.
 *
 * Features:
 * - 45 second TTL (balances freshness and performance)
 * - Cache key based on project + timeframe + options hash
 * - Automatic invalidation on write operations
 * - Hit/miss logging for debugging
 * - Not persisted across sessions (in-memory only)
 */

import { logger } from "../../utils/internal/logger";
import type { StructuredContent } from "./structuredOutput";

/**
 * Cache entry with value and expiration
 */
interface CacheEntry {
  value: StructuredContent;
  expiresAt: number;
  createdAt: number;
}

/**
 * Cache options
 */
export interface CacheOptions {
  project: string;
  timeframe: string;
  includeReferenced: boolean;
}

/**
 * Default TTL in milliseconds (45 seconds)
 */
const DEFAULT_TTL_MS = 45 * 1000;

/**
 * Session cache storage (Map-based for O(1) lookups)
 */
const cache = new Map<string, CacheEntry>();

/**
 * Statistics for debugging
 */
let stats = {
  hits: 0,
  misses: 0,
  invalidations: 0,
  expirations: 0,
};

/**
 * Generate a cache key from options
 *
 * Key format: `{project}:{timeframe}:{includeReferenced}`
 */
export function generateCacheKey(options: CacheOptions): string {
  const { project, timeframe, includeReferenced } = options;
  return `${project}:${timeframe}:${includeReferenced}`;
}

/**
 * Get cached context if available and not expired
 *
 * @returns Cached content or null if not found/expired
 */
export function getCachedContext(
  options: CacheOptions,
): StructuredContent | null {
  const key = generateCacheKey(options);
  const entry = cache.get(key);

  if (!entry) {
    stats.misses++;
    logger.debug({ key }, "Cache miss: entry not found");
    return null;
  }

  const now = Date.now();

  // Check if expired
  if (now > entry.expiresAt) {
    stats.expirations++;
    cache.delete(key);
    logger.debug(
      {
        key,
        age: now - entry.createdAt,
        ttl: DEFAULT_TTL_MS,
      },
      "Cache miss: entry expired",
    );
    return null;
  }

  stats.hits++;
  const age = now - entry.createdAt;
  const remainingTtl = entry.expiresAt - now;

  logger.debug(
    {
      key,
      age,
      remainingTtl,
    },
    "Cache hit",
  );

  return entry.value;
}

/**
 * Set cached context with TTL
 *
 * @param options - Cache key options
 * @param content - Content to cache
 * @param ttlMs - Time to live in milliseconds (default 45s)
 */
export function setCachedContext(
  options: CacheOptions,
  content: StructuredContent,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  const key = generateCacheKey(options);
  const now = Date.now();

  const entry: CacheEntry = {
    value: content,
    createdAt: now,
    expiresAt: now + ttlMs,
  };

  cache.set(key, entry);

  logger.debug(
    {
      key,
      ttlMs,
      noteCount: content.metadata.note_count,
    },
    "Cache set",
  );
}

/**
 * Invalidate all cache entries for a specific project
 *
 * Called when write_note or edit_note operations occur to ensure
 * subsequent context queries reflect the latest data.
 *
 * @param project - Project to invalidate cache for (optional, invalidates all if not specified)
 */
export function invalidateCache(project?: string): void {
  if (!project) {
    // Invalidate entire cache
    const count = cache.size;
    cache.clear();
    stats.invalidations += count;
    logger.debug({ count }, "Cache invalidated: all entries cleared");
    return;
  }

  // Invalidate entries for specific project
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(`${project}:`)) {
      cache.delete(key);
      count++;
    }
  }

  stats.invalidations += count;
  logger.debug(
    { project, count },
    "Cache invalidated: project entries cleared",
  );
}

/**
 * Get cache statistics for debugging
 */
export function getCacheStats(): typeof stats & { size: number } {
  return {
    ...stats,
    size: cache.size,
  };
}

/**
 * Reset cache statistics (for testing)
 */
export function resetCacheStats(): void {
  stats = {
    hits: 0,
    misses: 0,
    invalidations: 0,
    expirations: 0,
  };
}

/**
 * Clear the entire cache (for testing)
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Check if a project has cached content
 */
export function hasCachedContent(project: string): boolean {
  for (const key of cache.keys()) {
    if (key.startsWith(`${project}:`)) {
      const entry = cache.get(key);
      if (entry && Date.now() <= entry.expiresAt) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Get the TTL constant for external use
 */
export function getDefaultTtl(): number {
  return DEFAULT_TTL_MS;
}
