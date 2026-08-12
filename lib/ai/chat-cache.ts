import type { TreeItem } from "@/lib/github";
import type { ChooseFilesResult } from "./choose-files";

const CACHE_TTL_MS = 30 * 60 * 1000;

class TimedCache<T> {
  private map = new Map<string, { value: T; expiresAt: number }>();
  constructor(private ttlMs: number = CACHE_TTL_MS) {}
  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }
  set(key: string, value: T): void {
    this.map.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }
  get size(): number {
    return this.map.size;
  }
}

export const fileTreeCache: TimedCache<TreeItem[]> = new TimedCache();
export const fileContentCache: TimedCache<string> = new TimedCache();
export const chooseFilesCache: TimedCache<ChooseFilesResult> = new TimedCache();

export function buildTreeCacheKey(owner: string, repo: string, branch: string): string {
  return `${owner}/${repo}:${branch}`;
}
export function buildFileCacheKey(owner: string, repo: string, path: string, branch: string): string {
  return `${owner}/${repo}:${path}:${branch}`;
}
export function buildChooseFilesCacheKey(owner: string, repo: string, question: string): string {
  return `${owner}/${repo}:${question}`;
}
export function pruneChatCaches(): void {
  fileTreeCache.prune();
  fileContentCache.prune();
  chooseFilesCache.prune();
}
