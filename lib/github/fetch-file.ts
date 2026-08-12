import { GitHubError, GitHubErrors } from "./errors";

interface GitHubContentResponse {
  name: string;
  path: string;
  content: string;
  encoding: string;
}

/**
 * Fetches the content of a specific file from a GitHub repository.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param path - File path within the repository (e.g. "README.md")
 * @param branch - Branch name (e.g. "main" or "master")
 * @returns The decoded file content as a UTF-8 string
 * @throws GitHubError on API errors or timeout
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  branch: string
): Promise<string> {
  const token = process.env.GITHUB_TOKEN;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  let response: Response;

  try {
    response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`,
      { headers, signal: controller.signal }
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GitHubError(`Request timed out while fetching file: ${path}`);
    }
    throw GitHubErrors.NETWORK();
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    throw new GitHubError(`File not found: ${path}`);
  }

  if (response.status === 403) {
    throw GitHubErrors.RATE_LIMITED();
  }

  if (!response.ok) {
    throw GitHubErrors.UNEXPECTED(response.status);
  }

  let data: GitHubContentResponse;
  try {
    data = await response.json();
  } catch {
    throw GitHubErrors.NETWORK();
  }

  if (data.encoding !== "base64" || !data.content) {
    throw new GitHubError(`Unable to decode file: ${path}`);
  }

  // Decode base64 content to UTF-8 string
  const decoded = Buffer.from(data.content, "base64").toString("utf-8");
  return decoded;
}