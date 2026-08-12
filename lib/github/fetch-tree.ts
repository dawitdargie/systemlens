import { GitHubError, GitHubErrors } from "./errors";

export interface TreeItem {
  path: string;
  type: "blob" | "tree";
  size: number;
}

interface GitHubTreeResponse {
  sha: string;
  url: string;
  tree: Array<{
    path: string;
    mode: string;
    type: "blob" | "tree";
    sha: string;
    size?: number;
    url: string;
  }>;
  truncated: boolean;
}

/**
 * Fetches the full file tree of a repository from the GitHub API.
 * Returns only blob (file) items, filtered out from directories.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param branch - Branch name (e.g. "main" or "master")
 * @returns Array of file items with path, type, and size
 * @throws GitHubError on API errors or timeout
 */
export async function fetchRepositoryTree(
  owner: string,
  repo: string,
  branch: string
): Promise<TreeItem[]> {
  const token = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let response: Response;

  try {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers, signal: controller.signal }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GitHubError("Request timed out while fetching file tree.");
    }
    throw GitHubErrors.NETWORK();
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    throw GitHubErrors.NOT_FOUND();
  }

  if (response.status === 403) {
    throw GitHubErrors.RATE_LIMITED();
  }

  if (!response.ok) {
    throw GitHubErrors.UNEXPECTED(response.status);
  }

  let data: GitHubTreeResponse;
  try {
    data = await response.json();
  } catch {
    throw GitHubErrors.NETWORK();
  }

  // Filter to only blob (file) items and map to our interface
  return data.tree
    .filter((item) => item.type === "blob")
    .map((item) => ({
      path: item.path,
      type: item.type as "blob",
      size: item.size ?? 0,
    }));
}