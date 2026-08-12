import fs from "fs";
import path from "path";
import crypto from "crypto";
import type { ProjectProfile } from "@/types";

/**
 * Disk-based JSON cache for repository analysis results.
 *
 * The AI project-understanding step is the slowest part of the pipeline
 * (up to 40s on NVIDIA). Caching the fully-built ProjectProfile to disk
 * means re-analyzing the same repository URL is near-instant.
 *
 * Cache is enabled by default (set CACHE_ANALYSIS=false to disable),
 * stored under `.cache/analysis/` in the project root, with a TTL of
 * 24 hours by default.
 */

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
  createdAt: number;
  expiresAt: number;
  profile: ProjectProfile;
}

function cacheDir(): string {
  return path.join(process.cwd(), ".cache", "analysis");
}

function cacheFileFor(url: string): string {
  const hash = crypto.createHash("sha256").update(url).digest("hex");
  return path.join(cacheDir(), `${hash}.json`);
}

function isEnabled(): boolean {
  // Enabled by default. Set CACHE_ANALYSIS=false to disable.
  return process.env.CACHE_ANALYSIS !== "false";
}

/** Return a cached ProjectProfile for a repo URL, or null if absent/expired. */
export function getCachedAnalysis(url: string): ProjectProfile | null {
  if (!isEnabled()) return null;

  try {
    const file = cacheFileFor(url);
    if (!fs.existsSync(file)) return null;

    const raw = fs.readFileSync(file, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry;

    if (Date.now() > entry.expiresAt) {
      fs.unlinkSync(file);
      return null;
    }

    return entry.profile;
  } catch (error) {
    console.error("[analysis-cache] Read failed:", error);
    return null;
  }
}

/** Persist a ProjectProfile for a repo URL. */
export function setCachedAnalysis(url: string, profile: ProjectProfile): void {
  if (!isEnabled()) return;

  try {
    fs.mkdirSync(cacheDir(), { recursive: true });
    const file = cacheFileFor(url);
    const entry: CacheEntry = {
      createdAt: Date.now(),
      expiresAt: Date.now() + DEFAULT_TTL_MS,
      profile,
    };
    fs.writeFileSync(file, JSON.stringify(entry), "utf-8");
  } catch (error) {
    console.error("[analysis-cache] Write failed:", error);
  }
}

/** Remove all cached analysis entries. */
export function clearAnalysisCache(): void {
  try {
    if (fs.existsSync(cacheDir())) {
      fs.rmSync(cacheDir(), { recursive: true, force: true });
    }
  } catch (error) {
    console.error("[analysis-cache] Clear failed:", error);
  }
}
