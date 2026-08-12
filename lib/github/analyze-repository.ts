import { ProjectProfile } from "@/types";
import { parseGitHubUrl } from "./parse-url";
import { fetchRepository } from "./fetch-repository";
import { fetchRepositoryTree } from "./fetch-tree";
import { fetchFileContent } from "./fetch-file";
import { identifyImportantFiles } from "./identify-important-files";
import type { ImportantFiles } from "./identify-important-files";
import { analyzeTechnicalFacts } from "@/lib/analyzer";
import { generateUnderstanding } from "@/lib/ai";
import type { GenerateUnderstandingInput } from "@/lib/ai";
import { buildProfile } from "@/lib/profile";
import { getCachedAnalysis, setCachedAnalysis } from "@/lib/cache/analysis-cache";

export type ProgressStep =
  | "Fetching repository metadata..."
  | "Scanning file tree..."
  | "Analyzing technical facts..."
  | "Generating project understanding..."
  | "Complete";

export type ProgressCallback = (step: ProgressStep) => void;

/**
 * Orchestrates the full GitHub repository analysis pipeline.
 *
 * @param url - A GitHub repository URL
 * @param onProgress - Optional callback for real-time progress updates
 * @returns Complete ProjectProfile with repository, technical facts, and understanding
 */
export async function analyzeRepository(
  url: string,
  onProgress?: ProgressCallback
): Promise<ProjectProfile> {
  console.time("analyzeRepository total");

  // Serve from disk cache if available (env-gated)
  const cached = getCachedAnalysis(url);
  if (cached) {
    onProgress?.("Complete");
    console.timeEnd("analyzeRepository total");
    console.log("[analyzeRepository] Serving from disk cache.");
    return cached;
  }

  const { owner, repo } = parseGitHubUrl(url);

  // ── Parallel: fetch repo metadata + file tree simultaneously ──
  // GitHub's API resolves "HEAD" to the default branch, so we don't need
  // to wait for the repo metadata before fetching the tree. If the HEAD
  // tree fetch fails, we fall back to the sequential approach.
  onProgress?.("Fetching repository metadata...");
  const [repository, headTree] = await Promise.all([
    fetchRepository(owner, repo),
    fetchRepositoryTree(owner, repo, "HEAD").catch(() => null),
  ]);
  const branch = repository.defaultBranch;
  const tree = headTree ?? (await fetchRepositoryTree(owner, repo, branch));

  const importantFiles = identifyImportantFiles(tree);

  const fetchFile = (path: string) => fetchFileContent(owner, repo, path, branch);

  // ── Parallel: fetch all important files (manifest, docker, README, entry) ──
  onProgress?.("Analyzing technical facts...");
  const filePaths = [
    importantFiles.manifest,
    importantFiles.docker,
    importantFiles.readme,
    importantFiles.entryPoint,
  ].filter((p): p is string => p !== null);

  const fileContents = await Promise.all(
    filePaths.map((path) =>
      fetchFile(path).catch(() => null)
    )
  );

  const contentByPath = new Map<string, string>();
  filePaths.forEach((path, i) => {
    const content = fileContents[i];
    if (content !== null) contentByPath.set(path, content);
  });

  const technicalFacts = await analyzeTechnicalFacts(importantFiles, (path) => {
    const content = contentByPath.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`File not found: ${path}`));
    }
    return Promise.resolve(content);
  });

  const readmeContent = importantFiles.readme
    ? contentByPath.get(importantFiles.readme) ?? null
    : null;
  const entryPointContent = importantFiles.entryPoint
    ? contentByPath.get(importantFiles.entryPoint) ?? null
    : null;

  onProgress?.("Generating project understanding...");
  let understanding;
  try {
    const input: GenerateUnderstandingInput = {
      repository,
      technicalFacts,
      readmeContent,
      entryPointContent,
    };
    understanding = await generateUnderstanding(input);
  } catch (error) {
    console.error("AI project understanding failed after all retries:", error);
    throw new Error(
      `AI project understanding failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Check server logs for details.`
    );
  }

  onProgress?.("Complete");
  console.timeEnd("analyzeRepository total");
  const profile = buildProfile(repository, technicalFacts, understanding);
  setCachedAnalysis(url, profile);
  return profile;
}