import type { ProjectProfile, Audience, Explanation } from "@/types";

/**
 * In-memory cache for audience explanations.
 *
 * When a user asks for one audience, we generate all 5 audiences in parallel
 * and cache them so subsequent audience clicks are instant (no AI call).
 *
 * Cache entries expire after 30 minutes to avoid unbounded memory growth.
 */

interface CacheEntry {
  explanation: Explanation;
  expiresAt: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const cache = new Map<string, CacheEntry>();

/** Build a stable cache key from repo owner/name + audience. */
export function buildCacheKey(
  projectProfile: ProjectProfile,
  audience: Audience
): string {
  const { owner, name } = projectProfile.repository;
  return `${owner}/${name}:${audience}`;
}

/** Return a cached explanation if fresh, otherwise null. */
export function getCachedExplanation(
  projectProfile: ProjectProfile,
  audience: Audience
): Explanation | null {
  const key = buildCacheKey(projectProfile, audience);
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.explanation;
}

/** Store an explanation in the cache. */
export function cacheExplanation(
  projectProfile: ProjectProfile,
  audience: Audience,
  explanation: Explanation
): void {
  const key = buildCacheKey(projectProfile, audience);
  cache.set(key, {
    explanation,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/** Remove expired entries (called opportunistically). */
export function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expiresAt) {
      cache.delete(key);
    }
  }
}