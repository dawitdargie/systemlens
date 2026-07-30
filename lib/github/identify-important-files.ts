import type { TreeItem } from "./fetch-tree";

export interface ImportantFiles {
  readme: string | null;
  manifest: string | null;
  docker: string | null;
  entryPoint: string | null;
}

const MANIFEST_PATTERNS = [
  "go.mod",
  "package.json",
  "requirements.txt",
  "Cargo.toml",
  "composer.json",
  "Gemfile",
  "build.gradle",
  "pom.xml",
];

const DOCKER_PATTERNS = [
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
];

const ENTRY_POINT_PATTERNS = [
  "main.go",
  "cmd/main.go",
  "index.js",
  "app.js",
  "main.ts",
  "index.ts",
  "main.py",
  "app.py",
  "server.js",
  "server.ts",
  "cli.js",
  "cmd/main.go",
];

/**
 * Scans a repository file tree and identifies important files for analysis.
 *
 * Detection priority:
 *   - README: README.md (case-insensitive)
 *   - Manifest: First match from the manifest patterns list
 *   - Docker: First match from the docker patterns list
 *   - Entry point: First match from the entry point patterns list
 *
 * @param tree - Array of file items from the repository tree
 * @returns Object with paths to detected important files (null if not found)
 */
export function identifyImportantFiles(tree: TreeItem[]): ImportantFiles {
  const filePaths = tree.map((item) => item.path);

  const findFirst = (patterns: string[]): string | null => {
    for (const pattern of patterns) {
      const match = filePaths.find(
        (p) => p.toLowerCase() === pattern.toLowerCase()
      );
      if (match) return match;
    }
    return null;
  };

  // README: case-insensitive match for README.md
  const readme = filePaths.find(
    (p) => p.toLowerCase() === "readme.md"
  ) ?? null;

  return {
    readme,
    manifest: findFirst(MANIFEST_PATTERNS),
    docker: findFirst(DOCKER_PATTERNS),
    entryPoint: findFirst(ENTRY_POINT_PATTERNS),
  };
}