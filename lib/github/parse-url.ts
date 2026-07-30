export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}

/**
 * Parses a GitHub repository URL into owner and repo name.
 *
 * Accepted formats:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - http://github.com/owner/repo
 *   - github.com/owner/repo
 *
 * Throws GitHubError if the URL is invalid.
 */
export function parseGitHubUrl(url: string): ParsedGitHubUrl {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid GitHub repository URL.");
  }

  const trimmed = url.trim();

  // Remove protocol prefix if present
  let remaining = trimmed;
  if (remaining.startsWith("https://")) {
    remaining = remaining.slice(8);
  } else if (remaining.startsWith("http://")) {
    remaining = remaining.slice(7);
  }

  // Remove trailing .git if present
  if (remaining.endsWith(".git")) {
    remaining = remaining.slice(0, -4);
  }

  // Remove trailing slash if present
  if (remaining.endsWith("/")) {
    remaining = remaining.slice(0, -1);
  }

  // Must start with github.com/
  if (!remaining.startsWith("github.com/")) {
    throw new Error("Invalid GitHub repository URL.");
  }

  const path = remaining.slice("github.com/".length);
  const parts = path.split("/");

  // Must have exactly owner/repo
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid GitHub repository URL.");
  }

  return {
    owner: parts[0],
    repo: parts[1],
  };
}