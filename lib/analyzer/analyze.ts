import { TechnicalFacts } from "@/types";
import type { ImportantFiles } from "@/lib/github";
import { parseManifest } from "./manifest-parser";
import { parseDocker } from "./docker-parser";

/**
 * Analyzes important files to extract deterministic technical facts.
 *
 * Combines manifest parsing (language, framework) and Docker parsing
 * (deployment) into a single TechnicalFacts object.
 *
 * Fetches manifest and Docker files in parallel for better performance.
 *
 * @param importantFiles - The important files detected from the repository tree
 * @param fetchFile - A function that fetches file content by path
 * @returns TechnicalFacts with language, framework, and deployment
 */
export async function analyzeTechnicalFacts(
  importantFiles: ImportantFiles,
  fetchFile: (path: string) => Promise<string>
): Promise<TechnicalFacts> {
  // Default values
  let language = "Unknown";
  let framework = "Unknown";
  let deployment = "None";

  // Fetch manifest and Docker files in parallel
  const fetches: Promise<void>[] = [];

  if (importantFiles.manifest) {
    fetches.push(
      (async () => {
        try {
          const content = await fetchFile(importantFiles.manifest!);
          const result = parseManifest(importantFiles.manifest!, content);
          if (result) {
            language = result.language;
            framework = result.framework;
          }
        } catch {
          // If file fetch fails, keep defaults
        }
      })()
    );
  }

  if (importantFiles.docker) {
    fetches.push(
      (async () => {
        try {
          const content = await fetchFile(importantFiles.docker!);
          const result = parseDocker(importantFiles.docker!, content);
          if (result) {
            deployment = result.deployment;
          }
        } catch {
          // If file fetch fails, keep default
        }
      })()
    );
  }

  await Promise.all(fetches);

  return { language, framework, deployment };
}