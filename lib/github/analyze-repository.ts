import { ProjectProfile } from "@/types";
import { parseGitHubUrl } from "./parse-url";
import { fetchRepository } from "./fetch-repository";
import { fetchRepositoryTree } from "./fetch-tree";
import { fetchFileContent } from "./fetch-file";
import { identifyImportantFiles } from "./identify-important-files";
import type { ImportantFiles } from "./identify-important-files";
import { analyzeTechnicalFacts } from "@/lib/analyzer";
import { generateUnderstanding } from "@/lib/ai";
import { buildProfile } from "@/lib/profile";

/**
 * Orchestrates the full GitHub repository analysis pipeline.
 *
 * Steps:
 *   1. Parse the GitHub URL
 *   2. Fetch repository metadata
 *   3. Fetch the file tree
 *   4. Identify important files
 *   5. Fetch and analyze manifest + Docker files
 *   6. Fetch README + entry point content
 *   7. Generate project understanding via AI
 *   8. Build and return complete ProjectProfile
 *
 * @param url - A GitHub repository URL
 * @returns Complete ProjectProfile with repository, technical facts, and understanding
 */
export async function analyzeRepository(
  url: string
): Promise<ProjectProfile> {
  const { owner, repo } = parseGitHubUrl(url);

  const repository = await fetchRepository(owner, repo);
  const branch = repository.defaultBranch;

  const tree = await fetchRepositoryTree(owner, repo, branch);
  const importantFiles = identifyImportantFiles(tree);

  // Fetch and analyze important files for technical facts
  const fetchFile = (path: string) =>
    fetchFileContent(owner, repo, path, branch);

  const technicalFacts = await analyzeTechnicalFacts(importantFiles, fetchFile);

  // Fetch README and entry point in parallel for AI understanding
  const [readmeResult, entryPointResult] = await Promise.all([
    importantFiles.readme
      ? fetchFile(importantFiles.readme).catch(() => null)
      : Promise.resolve(null),
    importantFiles.entryPoint
      ? fetchFile(importantFiles.entryPoint).catch(() => null)
      : Promise.resolve(null),
  ]);

  const readmeContent = readmeResult;
  const entryPointContent = entryPointResult;

  // Generate project understanding via AI
  // First attempt with full content, retry with reduced content if it fails
  let understanding;
  try {
    understanding = await generateUnderstanding({
      repository,
      technicalFacts,
      readmeContent,
      entryPointContent,
    });
  } catch (firstError) {
    console.error("First AI attempt failed, retrying with reduced content:", firstError);

    // Retry with smaller input — truncate README and entry point more aggressively
    const reducedReadme = readmeContent
      ? readmeContent.slice(0, 1500)
      : null;
    const reducedEntryPoint = entryPointContent
      ? entryPointContent.slice(0, 800)
      : null;

    try {
      understanding = await generateUnderstanding({
        repository,
        technicalFacts,
        readmeContent: reducedReadme,
        entryPointContent: reducedEntryPoint,
      });
    } catch (secondError) {
      console.error("Second AI attempt also failed:", secondError);
      throw new Error(
        `AI project understanding failed: ${
          secondError instanceof Error ? secondError.message : "Unknown error"
        }. Check server logs for details.`
      );
    }
  }

  return buildProfile(repository, technicalFacts, understanding);
}